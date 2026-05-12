import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { gsap } from "gsap";
import { useNavigate } from "react-router-dom";
import { getBillingStatus } from "../features/billing/billingLifecycle";
import { BILLING_STATUS_LABELS } from "../features/billing/billingLabels";
import { getBillingCollections } from "../features/billing/billingSelectors";
import { useBillingStore } from "../features/billing/billingStore";
import {
  getBillingGateMessage,
  getBillableTasksForProject,
  getProjectBillingRecord,
  isTaskBillableDone,
} from "../features/billing/billingGate";
import type { BillingRecord } from "../features/billing/types";
import type { CloudWorkspaceMember } from "../features/cloud/types";
import { useClientStore } from "../features/clients/clientStore";
import type { Client } from "../features/clients/types";
import ClientCreateForm, {
  type ClientCreateFormValues,
} from "../features/clients/components/ClientCreateForm";
import ClientEditForm, {
  type ClientEditFormPatch,
} from "../features/clients/components/ClientEditForm";
import ClientCardSections from "../features/clients/components/ClientCardSections";
import CatalogJobForm, {
  type CatalogJobFormValues,
} from "../features/clients/components/CatalogJobForm";
import { useProjectStore } from "../features/projects/projectStore";
import {
  getProjectLifecycle,
  getProjectProgress,
} from "../features/projects/projectLifecycle";
import {
  isProductVisibleForClient,
  readDemoProducts,
  readProducts,
  readProductsFromSupabase,
  saveProducts,
} from "../features/products/productStorage";
import type { Project, ProjectStage } from "../features/projects/types";
import ProjectForm, {
  type ProjectFormValues,
} from "../features/projects/components/ProjectForm";
import {
  buildStagesFromTemplate,
  getTemplateIdForProjectType,
} from "../features/projects/projectTemplates";
import {
  readDemoProcessTemplates,
  readProcessTemplates,
  readProcessTemplatesFromSupabase,
  saveProcessTemplates,
} from "../features/templates/templateStorage";
import { buildCatalogJobPayload } from "../features/workflows/createJobFromProduct";
import { TASK_STATUS_LABELS } from "../features/tasks/taskLabels";
import { isTaskCompleted, isTaskOpen } from "../features/tasks/taskLifecycle";
import { getLateTasks } from "../features/tasks/taskSelectors";
import {
  buildCommandCenterSignals,
  getActionRequiredTasks,
  isTaskOverdue,
} from "../features/tasks/taskSignals";
import { useTaskStore } from "../features/tasks/taskStore";
import type { Task } from "../features/tasks/types";
import CreateTaskForm, {
  type CreateTaskFormValues,
} from "../features/tasks/components/CreateTaskForm";
import { useCloudStore } from "../features/cloud/cloudStore";
import { useAuthStore } from "../features/auth/authStore";
import { useDemoStore } from "../features/demo/demoStore";
import {
  buildAdminAiSignals,
  buildSignalSuggestion,
  getSignalTone,
  type PulseSignal as AiPulseSignal,
} from "../features/admin/aiSignals";
import {
  buildFollowUpMessage,
  buildFollowUpProposals,
  canOpenFollowUpEmail,
  getFollowUpBadgeTone,
  getFollowUpToneLabel,
  type FollowUpProposal,
  type FollowUpTone,
} from "../features/commandCenter/followupEngine";
import { getSupabaseClient } from "../lib/supabaseClient";
import "../features/clients/pages/client-detail.css";
import "./admin-home-command-center.css";

type ModalState =
  | { type: "task"; task: Task }
  | { type: "project"; project: Project }
  | { type: "billing"; record: BillingRecord }
  | { type: "client"; client: Client; score: number }
  | { type: "signal-note"; signal: AiPulseSignal; note: string }
  | { type: "followup"; proposal: FollowUpProposal }
  | {
      type: "member-tasks";
      memberName: string;
      tasks: Task[];
      activeCount: number;
      lateCount: number;
    }
  | { type: "create-client" }
  | { type: "create-project"; clientId?: string }
  | null;

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatAmountValue(
  amount: number | null | undefined,
  currency = "RSD",
) {
  return typeof amount === "number"
    ? `${amount.toLocaleString("sr-RS")} ${currency}`
    : "-";
}

function formatAmount(record: BillingRecord) {
  return formatAmountValue(record.amount, record.currency);
}

function isOverdueDate(value?: string | null) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function daysLate(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000));
}

function daysSince(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86400000));
}

const DEFAULT_STEP_ESTIMATE_MINUTES = 8 * 60;

function minutesSince(value?: string | null) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

function formatDurationShort(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  if (hours < 24) return `${hours}h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days} dana`;
}

function getWorkflowSummary(tasks: Task[]) {
  const workflowTasks = tasks
    .filter((task) => task.source === "template" || task.sequenceOrder)
    .slice()
    .sort(
      (first, second) =>
        (first.sequenceOrder || 999) - (second.sequenceOrder || 999),
    );
  const progress = getProjectProgress(workflowTasks);
  const activeTask = workflowTasks.find(
    (task) => task.status === "dodeljen" || task.status === "u_radu",
  );
  return {
    total: progress.totalTasks,
    completed: progress.completedTasks,
    activeTask,
    progress: progress.progressPercent,
  };
}

function getBlockedStepSignal(projectTasks: Task[]) {
  const activeTask = projectTasks
    .filter(
      (task) =>
        (task.status === "dodeljen" || task.status === "u_radu") &&
        (task.source === "template" || task.sequenceOrder),
    )
    .sort(
      (first, second) =>
        (first.sequenceOrder || 999) - (second.sequenceOrder || 999),
    )[0];

  if (!activeTask) return null;
  const expectedMinutes = Math.max(
    30,
    activeTask.estimatedMinutes || DEFAULT_STEP_ESTIMATE_MINUTES,
  );
  const actualMinutes = minutesSince(
    activeTask.activatedAt || activeTask.updatedAt || activeTask.createdAt,
  );
  if (!actualMinutes || actualMinutes < expectedMinutes * 1.5) return null;

  const ratio = actualMinutes / expectedMinutes;
  return {
    task: activeTask,
    expectedMinutes,
    actualMinutes,
    ratio,
    tone: ratio >= 2 ? ("red" as const) : ("yellow" as const),
    title:
      ratio >= 3
        ? "Korak kritično kasni"
        : ratio >= 2
          ? "Korak je blokiran"
          : "Korak usporava",
  };
}

function taskValue(task: Task) {
  return (task.laborCost ?? 0) + (task.materialCost ?? 0);
}

type CommandStatusTone = "green" | "yellow" | "red";

type PulseSignalTone = "red" | "yellow" | "blue";

type PulseSignal = {
  id: string;
  tone: PulseSignalTone;
  badge: string;
  title: string;
  message: string;
  actionLabel: string;
  action: () => void;
};

function getStageDueDate(stage?: ProjectStage) {
  return stage ? (stage as { dueDate?: string | null }).dueDate : undefined;
}

function findOverdueStage(project: Project) {
  return project.stages?.find((stage) => {
    const dueDate = getStageDueDate(stage);
    return dueDate ? isOverdueDate(dueDate) : false;
  });
}

function normalizeRoleLabel(role?: string) {
  const value = role?.trim();
  if (!value) return "BEZ DODELE";

  const roleMap: Record<string, string> = {
    admin: "ADMIN",
    account: "ACCOUNT",
    user: "OPERATIVA",
    finance: "FINANSIJE",
    designer: "DIZAJNER",
    dizajner: "DIZAJNER",
    production: "PRODUKCIJA",
    produkcija: "PRODUKCIJA",
    logistics: "LOGISTIKA",
    logistika: "LOGISTIKA",
  };

  const normalizedKey = value.toLowerCase();
  return roleMap[normalizedKey] || value.toUpperCase();
}

function memberDisplayName(member: CloudWorkspaceMember) {
  const displayName = member.display_name?.trim();
  const profileName = member.profile?.full_name?.trim();
  const email = member.profile?.email?.trim();

  if (displayName) return displayName;
  if (profileName && !profileName.includes("@")) return profileName;
  if (email) return email;
  return member.user_id || "Član tima";
}

function memberInitials(member: CloudWorkspaceMember) {
  const name = memberDisplayName(member);
  const clean = name.includes("@") ? name.split("@")[0] : name;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase() || "ČT";
}

function memberOperationalRole(member: CloudWorkspaceMember) {
  return normalizeRoleLabel(
    member.production_role ||
      (member.role === "admin"
        ? "ADMIN"
        : member.role === "finance"
          ? "FINANSIJE"
          : ""),
  );
}

function isSuggestedAssignee(
  member: CloudWorkspaceMember,
  requiredRole?: string,
) {
  const normalizedRequiredRole = normalizeRoleLabel(requiredRole);
  const operationalRole = memberOperationalRole(member);
  if (
    !normalizedRequiredRole ||
    normalizedRequiredRole === "BEZ DODELE" ||
    normalizedRequiredRole === "BEZ ROLE"
  )
    return true;
  return (
    operationalRole === normalizedRequiredRole || operationalRole === "ADMIN"
  );
}

function ProjectCreateModal({
  clients,
  initialClientId,
  onCancel,
  onSubmit,
}: {
  clients: Client[];
  initialClientId?: string;
  onCancel: () => void;
  onSubmit: (clientId: string, values: ProjectFormValues) => void;
}) {
  const [clientId, setClientId] = useState(
    initialClientId ?? String(clients[0]?.id ?? ""),
  );
  return (
    <div className="pulse-create-modal-content">
      <label className="customer-task-form-field">
        <span>Klijent</span>
        <select
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
        >
          {clients.map((client) => (
            <option key={client.id} value={String(client.id)}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <ProjectForm
        onCancel={onCancel}
        onSubmit={(values) => onSubmit(clientId, values)}
      />
    </div>
  );
}

function ProjectDetailModal({
  project,
  tasks,
  clientName,
  activeBilling,
  onCreateBilling,
}: {
  project: Project;
  tasks: Task[];
  clientName: string;
  activeBilling: BillingRecord | null;
  onCreateBilling: (
    project: Project,
    tasksForBilling: Task[],
  ) => void | Promise<void>;
}) {
  const unbilledCompletedTasks = getBillableTasksForProject(
    project,
    tasks,
    activeBilling ? [activeBilling] : [],
  );
  const billingGateMessage = getBillingGateMessage(project, tasks);
  const totalLaborCost = unbilledCompletedTasks.reduce(
    (sum, task) => sum + (task.laborCost ?? 0),
    0,
  );
  const totalMaterialCost = unbilledCompletedTasks.reduce(
    (sum, task) => sum + (task.materialCost ?? 0),
    0,
  );
  const totalCost = totalLaborCost + totalMaterialCost;

  return (
    <>
      <h3>Detalji projekta</h3>
      <p>
        <strong>{project.title}</strong>
      </p>
      <p>Klijent - {clientName}</p>
      {project.source === "product" ? (
        <p>
          <span className="pulse-pill pulse-pill-blue">IZ PROIZVODA</span>{" "}
          {project.sourceProductTitle || "-"}
        </p>
      ) : null}
      <p>Status - {project.status}</p>
      <p>Tip - {project.type || "-"}</p>
      <p>Frekvencija - {project.frequency || "-"}</p>
      <p>
        Procenjena vrednost -{" "}
        {project.value ? `${project.value.toLocaleString("sr-RS")} RSD` : "-"}
      </p>
      <div className="pulse-project-billing-summary">
        <h4>Završeni taskovi za obračun</h4>
        {billingGateMessage ? (
          <p className="pulse-empty">{billingGateMessage}</p>
        ) : null}
        {unbilledCompletedTasks.length ? (
          <div className="pulse-list">
            {unbilledCompletedTasks.map((task) => (
              <article className="pulse-item" key={task.id}>
                <div className="pulse-item-title-row">
                  <h4>{task.title}</h4>
                  <span className="pulse-pill pulse-pill-green">ZAVRŠEN</span>
                </div>
                <p>
                  <strong>Dodeljeno:</strong> {task.assignedToLabel || "-"}
                </p>
                <p>
                  <strong>Vreme:</strong> {task.timeSpentMinutes ?? 0} min /{" "}
                  {formatAmountValue(task.laborCost ?? 0)}
                </p>
                <p>
                  <strong>Materijal:</strong>{" "}
                  {formatAmountValue(task.materialCost ?? 0)}
                </p>
                {task.materialDescription ? (
                  <p>
                    <strong>Opis materijala:</strong> {task.materialDescription}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="pulse-empty">
            Nema završenih taskova koji čekaju nalog za naplatu.
          </p>
        )}
        <p>
          <strong>Rad ukupno:</strong> {formatAmountValue(totalLaborCost)}
        </p>
        <p>
          <strong>Materijal ukupno:</strong>{" "}
          {formatAmountValue(totalMaterialCost)}
        </p>
        <p>
          <strong>Ukupni interni trošak:</strong> {formatAmountValue(totalCost)}
        </p>
        {activeBilling ? (
          <p>
            <strong>Nalog za naplatu:</strong>{" "}
            {BILLING_STATUS_LABELS[activeBilling.status]}
          </p>
        ) : null}
        {!activeBilling && unbilledCompletedTasks.length ? (
          <div className="pulse-modal-actions">
            <button
              className="pulse-modal-btn pulse-modal-btn-blue"
              type="button"
              onClick={() =>
                void onCreateBilling(project, unbilledCompletedTasks)
              }
            >
              POŠALJI NA NAPLATU
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}

function ClientCardDrawer({
  client,
  score,
  projects,
  tasks,
  billing,
  onClose,
  onUpdateClient,
  onCreateProject,
  onCreateTask,
  onCreateJobFromCatalog,
}: {
  client: Client;
  score: number;
  projects: Project[];
  tasks: Task[];
  billing: BillingRecord[];
  onClose: () => void;
  onUpdateClient: (patch: ClientEditFormPatch) => void;
  onCreateProject: (values: ProjectFormValues) => void | Promise<void>;
  onCreateTask: (values: CreateTaskFormValues) => void | Promise<void>;
  onCreateJobFromCatalog: (
    clientId: string,
    values: CatalogJobFormValues,
  ) => void | Promise<void>;
}) {
  const { isDemoMode } = useDemoStore();
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const [isChoosingJob, setIsChoosingJob] = useState(false);
  const [isCreatingFromCatalog, setIsCreatingFromCatalog] = useState(false);
  const [catalogJobMessage, setCatalogJobMessage] = useState("");
  const products = isDemoMode ? readDemoProducts() : readProducts();
  const processTemplates = isDemoMode
    ? readDemoProcessTemplates()
    : readProcessTemplates();

  return (
    <div className="pulse-client-drawer-content">
      <div className="pulse-client-drawer-head">
        <div>
          <h3>{client.name}</h3>
          <p>{client.city || "-"}</p>
        </div>
        <span className="pulse-pill pulse-pill-cyan">PULSE {score}</span>
      </div>
      <div className="pulse-client-drawer-actions">
        <button
          type="button"
          className="customer-project-toggle"
          onClick={() => setIsCreatingActivity((value) => !value)}
        >
          Nova aktivnost
        </button>
        <button
          type="button"
          className="customer-project-toggle"
          onClick={() => setIsChoosingJob((value) => !value)}
        >
          Novi posao
        </button>
      </div>
      {isChoosingJob ? (
        <div className="customer-job-choice">
          <button
            type="button"
            className="customer-project-action-button"
            onClick={() => {
              setIsCreatingProject(true);
              setIsCreatingFromCatalog(false);
              setCatalogJobMessage("");
            }}
          >
            Prazan projekat
          </button>
          <button
            type="button"
            className="customer-project-action-button customer-project-action-button-secondary"
            onClick={() => {
              setIsCreatingFromCatalog(true);
              setIsCreatingProject(false);
              setIsCreatingActivity(false);
              setCatalogJobMessage("");
            }}
          >
            Iz kataloga
          </button>
        </div>
      ) : null}
      {isEditingClient ? (
        <ClientEditForm
          client={client}
          onCancel={() => setIsEditingClient(false)}
          onSubmit={(patch) => {
            onUpdateClient(patch);
            setIsEditingClient(false);
          }}
        />
      ) : null}
      {isCreatingProject ? (
        <ProjectForm
          onCancel={() => setIsCreatingProject(false)}
          onSubmit={async (values) => {
            await onCreateProject(values);
            setIsCreatingProject(false);
            setIsChoosingJob(false);
          }}
        />
      ) : null}
      {isCreatingFromCatalog ? (
        <CatalogJobForm
          clientId={String(client.id)}
          products={products}
          templates={processTemplates}
          onCancel={() => setIsCreatingFromCatalog(false)}
          onSubmit={async (values) => {
            await onCreateJobFromCatalog(String(client.id), values);
            setIsCreatingFromCatalog(false);
            setIsChoosingJob(false);
            setCatalogJobMessage("Posao je kreiran iz kataloga.");
          }}
        />
      ) : null}
      {catalogJobMessage ? (
        <p className="customer-catalog-job-message">{catalogJobMessage}</p>
      ) : null}
      {isCreatingActivity ? (
        <CreateTaskForm
          onCancel={() => setIsCreatingActivity(false)}
          onSubmit={(values) => {
            onCreateTask(values);
            setIsCreatingActivity(false);
          }}
          requireProjectSelection
          projectOptions={projects.map((project) => ({
            id: project.id,
            label: project.title,
            stages: project.stages,
          }))}
        />
      ) : null}
      <ClientCardSections
        clientId={String(client.id)}
        clientName={client.name}
        clientCity={client.city}
        clientAddress={client.address}
        contacts={client.contacts}
        commercial={client.commercial}
        projects={projects}
        tasks={tasks}
        billing={billing}
        onEditClient={() => setIsEditingClient((value) => !value)}
        onAddFromCatalog={() => {
          setIsCreatingFromCatalog(true);
          setIsCreatingProject(false);
          setIsCreatingActivity(false);
          setIsChoosingJob(false);
          setCatalogJobMessage("");
        }}
      />
      <div className="pulse-modal-actions">
        <button
          className="pulse-modal-btn pulse-modal-btn-blue"
          type="button"
          onClick={onClose}
        >
          Zatvori
        </button>
      </div>
    </div>
  );
}

function TaskAssignmentModalContent({
  task,
  clients,
  projects,
  members,
  onAssignTask,
}: {
  task: Task;
  clients: Client[];
  projects: Project[];
  members: CloudWorkspaceMember[];
  onAssignTask: (task: Task, memberId: string) => void | Promise<void>;
}) {
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const client = clients.find(
    (item) => String(item.id) === String(task.clientId),
  );
  const project = projects.find((item) => item.id === task.projectId);
  const requiredRole = normalizeRoleLabel(
    task.requiredRole || task.assignedToLabel,
  );
  const sortedMembers = [...members].sort((first, second) => {
    const firstSuggested = isSuggestedAssignee(first, requiredRole) ? 0 : 1;
    const secondSuggested = isSuggestedAssignee(second, requiredRole) ? 0 : 1;
    if (firstSuggested !== secondSuggested)
      return firstSuggested - secondSuggested;
    return memberDisplayName(first).localeCompare(
      memberDisplayName(second),
      "sr",
    );
  });

  return (
    <div className="pulse-task-review-modal">
      <h3>Dodela zadatka</h3>
      <div className="pulse-task-review-head">
        <strong>{task.title}</strong>
        <span className="pulse-pill pulse-pill-red">
          {TASK_STATUS_LABELS[task.status] ?? task.status}
        </span>
      </div>
      <p>
        {client?.name || "Nepoznat klijent"} - {" "}
        {project?.title || "Nepoznat projekat"}
      </p>
      <dl className="pulse-compact-dl">
        <div>
          <dt>Rok</dt>
          <dd>{formatDate(task.dueDate)}</dd>
        </div>
        <div>
          <dt>Tražena rola</dt>
          <dd>{requiredRole}</dd>
        </div>
        <div>
          <dt>Dodeljeno</dt>
          <dd>{task.assignedToLabel || "-"}</dd>
        </div>
      </dl>

      {task.needsAssignment ? (
        <p className="pulse-task-warning">
          ⚠ Potrebna je re-delegacija. Izaberi člana tima koji preuzima ovaj
          korak.
        </p>
      ) : null}

      <label className="customer-task-form-field pulse-assignment-field">
        <span>Re-delegiraj na</span>
        <select
          value={selectedMemberId}
          onChange={(event) => setSelectedMemberId(event.target.value)}
        >
          <option value="">-- Izaberi člana tima --</option>
          {sortedMembers.map((member) => {
            const operationalRole = memberOperationalRole(member);
            const suggested = isSuggestedAssignee(member, requiredRole);
            return (
              <option key={member.user_id} value={member.user_id}>
                {memberDisplayName(member)} - {operationalRole || "BEZ ROLE"}
                {suggested ? " - preporučeno" : ""}
              </option>
            );
          })}
        </select>
      </label>

      <div className="pulse-modal-actions">
        <button
          className="pulse-modal-btn pulse-modal-btn-blue"
          type="button"
          disabled={!selectedMemberId}
          onClick={() => void onAssignTask(task, selectedMemberId)}
        >
          Sačuvaj dodelu
        </button>
      </div>
    </div>
  );
}

function AdminModal({
  state,
  clients,
  projects,
  tasks,
  billing,
  members,
  onClose,
  onCreateClient,
  onCreateProject,
  onUpdateClient,
  onCreateTask,
  onCreateJobFromCatalog,
  onCreateBillingFromProject,
  onAssignTask,
  onOpenTask,
}: {
  state: ModalState;
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  billing: BillingRecord[];
  members: CloudWorkspaceMember[];
  onClose: () => void;
  onCreateClient: (values: ClientCreateFormValues) => void | Promise<void>;
  onCreateProject: (
    clientId: string,
    values: ProjectFormValues,
  ) => void | Promise<void>;
  onUpdateClient: (
    clientId: string,
    patch: ClientEditFormPatch,
  ) => void | Promise<void>;
  onCreateTask: (
    clientId: string,
    values: CreateTaskFormValues,
  ) => void | Promise<void>;
  onCreateJobFromCatalog: (
    clientId: string,
    values: CatalogJobFormValues,
  ) => void | Promise<void>;
  onCreateBillingFromProject: (
    project: Project,
    tasksForBilling: Task[],
  ) => void | Promise<void>;
  onAssignTask: (task: Task, memberId: string) => void | Promise<void>;
  onOpenTask: (task: Task) => void;
}) {
  const [followUpTone, setFollowUpTone] = useState<FollowUpTone>("neutral");
  const [followUpCopied, setFollowUpCopied] = useState(false);

  useEffect(() => {
    if (state?.type !== "followup") return;
    setFollowUpTone(state.proposal.category === "Interno" ? "internal" : "neutral");
    setFollowUpCopied(false);
  }, [state?.type, state?.type === "followup" ? state.proposal.id : null]);

  if (!state) return null;
  const clientProjects =
    state.type === "client"
      ? projects.filter(
          (project) => project.clientId === String(state.client.id),
        )
      : [];
  const projectTasks =
    state.type === "project"
      ? tasks.filter((task) => task.projectId === state.project.id)
      : [];
  const activeBilling =
    state.type === "project"
      ? (billing.find(
          (record) =>
            record.projectId === state.project.id &&
            getBillingStatus(record) !== "closed" &&
            record.status !== "cancelled",
        ) ?? null)
      : null;

  return (
    <div className="pulse-modal-backdrop" onMouseDown={onClose}>
      <div
        className={`pulse-modal ${state.type === "client" ? "pulse-client-drawer" : ""} ${state.type === "create-client" ? "pulse-create-client-modal" : ""} ${state.type === "create-project" ? "pulse-create-project-modal" : ""}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="pulse-modal-x" type="button" onClick={onClose}>
          x
        </button>
        {state.type === "billing" ? (
          <>
            <h3>Detalji naplatnog naloga</h3>
            <p>
              <strong>Iznos</strong> - {formatAmount(state.record)}
            </p>
            <p>
              <strong>Opis</strong> - {state.record.description}
            </p>
            <p>
              <strong>Rok</strong> - {formatDate(state.record.dueDate)}
            </p>
            <p>
              <strong>Status</strong> -{" "}
              {BILLING_STATUS_LABELS[state.record.status]}
            </p>
            <p>
              <strong>Faktura</strong> - {state.record.invoiceNumber || "-"}
            </p>
          </>
        ) : null}
        {state.type === "signal-note" ? (
          <>
            <h3>{state.signal.actionLabel || "Predlog reakcije"}</h3>
            <p>
              <strong>{state.signal.entityName}</strong>
            </p>
            <p>{state.signal.message}</p>
            {state.signal.impact ? <p>{state.signal.impact}</p> : null}
            <div className="pulse-project-billing-summary">
              <p style={{ whiteSpace: "pre-wrap" }}>{state.note}</p>
            </div>
          </>
        ) : null}
        {state.type === "followup" ? (
          <>
            <h3>Follow-up predlog</h3>
            <div className="command-followup-modal-head">
              <span
                className={`command-followup-badge ${getFollowUpBadgeTone(state.proposal.category)}`}
              >
                {state.proposal.category}
              </span>
              <span className="command-followup-priority">
                Prioritet: {state.proposal.priority}
              </span>
            </div>
            <p className="command-followup-context">{state.proposal.contextLabel}</p>
            <div className="command-followup-tone-row">
              {(
                ["neutral", "warm", "direct", "internal"] as FollowUpTone[]
              ).map((tone) => (
                <button
                  key={tone}
                  type="button"
                  className={`command-followup-tone ${followUpTone === tone ? "is-active" : ""}`}
                  onClick={() => {
                    setFollowUpTone(tone);
                    setFollowUpCopied(false);
                  }}
                >
                  {getFollowUpToneLabel(tone)}
                </button>
              ))}
            </div>
            <div className="pulse-project-billing-summary command-followup-copy-box">
              <p style={{ whiteSpace: "pre-wrap" }}>
                {buildFollowUpMessage(state.proposal, followUpTone)}
              </p>
            </div>
            {followUpCopied ? (
              <p className="command-followup-feedback">Tekst je kopiran.</p>
            ) : null}
            <div className="command-followup-actions">
              <button
                type="button"
                className="command-signal-action"
                onClick={async () => {
                  await navigator.clipboard.writeText(
                    buildFollowUpMessage(state.proposal, followUpTone),
                  );
                  setFollowUpCopied(true);
                }}
              >
                Kopiraj za mail / Viber / WhatsApp
              </button>
              {canOpenFollowUpEmail(state.proposal) ? (
                <button
                  type="button"
                  className="command-signal-action"
                  onClick={() => {
                    const body = buildFollowUpMessage(state.proposal, followUpTone);
                    const mailto = `mailto:${state.proposal.recipientEmail}?subject=${encodeURIComponent(
                      state.proposal.subject,
                    )}&body=${encodeURIComponent(body)}`;
                    window.location.href = mailto;
                  }}
                >
                  Otvori email
                </button>
              ) : null}
              <button type="button" className="command-signal-action" onClick={onClose}>
                Zatvori
              </button>
            </div>
          </>
        ) : null}
        {state.type === "task" ? (
          <TaskAssignmentModalContent
            task={state.task}
            clients={clients}
            projects={projects}
            members={members}
            onAssignTask={onAssignTask}
          />
        ) : null}
        {state.type === "project" ? (
          <ProjectDetailModal
            project={state.project}
            tasks={projectTasks}
            clientName={
              clients.find(
                (client) =>
                  String(client.id) === String(state.project.clientId),
              )?.name ?? "Nepoznat klijent"
            }
            activeBilling={activeBilling}
            onCreateBilling={onCreateBillingFromProject}
          />
        ) : null}
        {state.type === "member-tasks" ? (
          <>
            <h3>{state.memberName} - taskovi</h3>
            <p>
              <strong>{state.activeCount}</strong> aktivna ?{" "}
              <strong>{state.lateCount}</strong> kasni
            </p>
            <div className="pulse-team-task-peek">
              {state.tasks.length ? (
                state.tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className="pulse-team-task-row"
                    onClick={() => onOpenTask(task)}
                  >
                    <span>{task.title}</span>
                    <small>
                      {task.projectId
                        ? projects.find((project) => project.id === task.projectId)
                            ?.title ?? "Nepoznat projekat"
                        : `${clients.find((client) => String(client.id) === String(task.clientId))?.name ?? "Nepoznat klijent"} - Ad hoc`}{" "}
                      -{" "}
                      {isTaskOverdue(task)
                        ? "Kasni"
                        : TASK_STATUS_LABELS[task.status]}
                    </small>
                  </button>
                ))
              ) : (
                <p>Nema zadataka za prikaz.</p>
              )}
            </div>
          </>
        ) : null}
        {state.type === "client" ? (
          <ClientCardDrawer
            client={state.client}
            score={state.score}
            projects={clientProjects}
            tasks={tasks}
            billing={billing}
            onClose={onClose}
            onUpdateClient={(patch) =>
              onUpdateClient(String(state.client.id), patch)
            }
            onCreateProject={(values) =>
              onCreateProject(String(state.client.id), values)
            }
            onCreateTask={(values) =>
              onCreateTask(String(state.client.id), values)
            }
            onCreateJobFromCatalog={onCreateJobFromCatalog}
          />
        ) : null}
        {state.type === "create-client" ? (
          <>
            <h3>+ Novi klijent</h3>
            <ClientCreateForm onCancel={onClose} onSubmit={onCreateClient} />
          </>
        ) : null}
        {state.type === "create-project" ? (
          <>
            <h3>+ Novi projekat</h3>
            <ProjectCreateModal
              clients={clients}
              initialClientId={state.clientId}
              onCancel={onClose}
              onSubmit={onCreateProject}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function AdminHome() {
  const navigate = useNavigate();
  const { activeWorkspace, members, isConfigured } = useCloudStore();
  const { currentUser, users } = useAuthStore();
  const { isDemoMode } = useDemoStore();
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<
    string | null
  >(null);
  const [isSignalsExpanded, setIsSignalsExpanded] = useState(false);
  const commandCenterRef = useRef<HTMLElement | null>(null);
  const signalsPanelRef = useRef<HTMLElement | null>(null);
  const billingPanelRef = useRef<HTMLButtonElement | null>(null);
  const billingOpenAmountRef = useRef<HTMLSpanElement | null>(null);
  const billingOverdueCountRef = useRef<HTMLSpanElement | null>(null);
  const billingPaidWeekAmountRef = useRef<HTMLSpanElement | null>(null);
  const carouselTrackRef = useRef<HTMLDivElement | null>(null);
  const carouselCardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const carouselPointerStartXRef = useRef<number | null>(null);
  const { clients, addClient, updateClient } = useClientStore();
  const { projects, addProject } = useProjectStore();
  const { tasks, addTask, updateTask } = useTaskStore();
  const { getAllBilling, createBillingForProject, isCloudBillingMode } =
    useBillingStore();
  const [modal, setModal] = useState<ModalState>(null);
  const [pulseTypingText, setPulseTypingText] = useState("");
  const billing = getAllBilling();
  const demoMembers = useMemo<CloudWorkspaceMember[]>(
    () =>
      users
        .filter((user) => user.role !== "admin")
        .map((user, index) => ({
          id: `demo-member-${index + 1}`,
          workspace_id: activeWorkspace?.id || "demo-workspace",
          user_id: user.id,
          role: user.role === "finance" ? "finance" : "member",
          status: "active",
          hourly_rate: user.role === "finance" ? 1800 : 1400,
          production_role: user.productionRole || null,
          display_name: user.name,
          profile: {
            id: user.id,
            email: user.email,
            full_name: user.name,
          },
        })),
    [activeWorkspace?.id, users],
  );
  const billingCollections = useMemo(
    () => getBillingCollections(billing),
    [billing],
  );

  useEffect(() => {
    const updates = tasks
      .map((task) => {
        const project = projects.find((item) => item.id === task.projectId);
        if (
          !project ||
          !isTaskBillableDone(
            task,
            project,
            billing,
            tasks.filter((item) => item.projectId === project.id),
          )
        )
          return null;
        const projectBilling = getProjectBillingRecord(project, billing);
        const billingId = project.billingId || projectBilling?.id || null;
        if (!billingId && !project.billingStatus) return null;
        return {
          ...task,
          billingState: "sent_to_billing" as const,
          billingStatus: "sent_to_billing",
          billingId,
          updatedAt: new Date().toISOString(),
        };
      })
      .filter(Boolean) as Task[];

    if (!updates.length) return;
    updates.forEach((task) => void updateTask(task));
  }, [tasks, projects, billing, updateTask]);

  useEffect(() => {
    let isMounted = true;
    const workspaceId = activeWorkspace?.id || "";

    async function preloadCatalogFromCloud() {
      if (!isConfigured || !workspaceId) return;

      try {
        const [cloudProducts, cloudTemplates] = await Promise.all([
          readProductsFromSupabase(workspaceId),
          readProcessTemplatesFromSupabase(workspaceId),
        ]);

        if (!isMounted) return;
        if (cloudProducts.length) saveProducts(cloudProducts);
        if (cloudTemplates.length) saveProcessTemplates(cloudTemplates);
      } catch {
        // Catalog cloud preload is best-effort; localStorage remains fallback.
      }
    }

    void preloadCatalogFromCloud();

    return () => {
      isMounted = false;
    };
  }, [activeWorkspace?.id, isConfigured]);

  useEffect(() => {
    const messages = [
      "PULSE analizira projekte, taskove i naplatu...",
      "Proveravam završene taskove i vrednost za naplatu...",
      "Tražim zastoje u projektima i otvorene rokove...",
      "Slažem prioritete za admin pregled...",
    ];
    const message = messages[Math.floor(Math.random() * messages.length)];
    let index = 0;
    setPulseTypingText("");
    const timer = window.setInterval(() => {
      index += 1;
      setPulseTypingText(message.slice(0, index));
      if (index >= message.length) window.clearInterval(timer);
    }, 22);
    return () => window.clearInterval(timer);
  }, [projects.length, tasks.length, billing.length]);

  const clientById = useMemo(
    () => new Map(clients.map((client) => [String(client.id), client])),
    [clients],
  );
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const clientName = (id: string) =>
    clientById.get(String(id))?.name ?? "Nepoznat klijent";
  const projectTitle = (id?: string | null) =>
    id
      ? (projectById.get(id)?.title ?? "Nepoznat projekat")
      : "Ad hoc aktivnost";

  const urgentBilling = billing.filter((record) => {
    if (record.status === "cancelled") return false;
    return getBillingStatus(record) === "overdue";
  });
  const lateTasks = getLateTasks(tasks).filter(
    (task) =>
      task.clientId &&
      clientById.has(String(task.clientId)) &&
      (!task.projectId || projectById.has(task.projectId)),
  );
  const actionRequired = useMemo(
    () => getActionRequiredTasks(tasks, billing, projects),
    [billing, projects, tasks],
  );
  const commandTaskSignals = useMemo(
    () => buildCommandCenterSignals(tasks, billing, projects),
    [billing, projects, tasks],
  );
  const riskyProjects = projects.filter((project) =>
    Boolean(findOverdueStage(project)),
  );
  const pulseSignals = useMemo<PulseSignal[]>(() => {
    const signals: PulseSignal[] = [];
    const activeProjects = projects.filter(
      (project) =>
        project.status !== "arhiviran" &&
        getProjectLifecycle(project, tasks, billing).status === "active",
    );

    urgentBilling.slice(0, 4).forEach((record) => {
      const lateBy = daysLate(record.dueDate);
      signals.push({
        id: `billing-${record.id}`,
        tone: "red",
        badge: "NAPLATA",
        title: lateBy
          ? `Naplata kasni ${lateBy} dana`
          : "Naplata čeka reakciju",
        message: `${clientName(record.clientId)} - ${formatAmount(record)} za projekat ${projectTitle(record.projectId)}`,
        actionLabel: "Otvori",
        action: () => setModal({ type: "billing", record }),
      });
    });

    riskyProjects.slice(0, 4).forEach((project) => {
      const overdueStage = findOverdueStage(project);
      const overdueDays = daysLate(getStageDueDate(overdueStage));
      signals.push({
        id: `overdue-stage-${project.id}`,
        tone: "red",
        badge: "PROJEKAT",
        title: overdueDays
          ? `Faza kasni ${overdueDays} dana`
          : "Projekat traži pažnju",
        message: `${clientName(project.clientId)} - ${project.title}${overdueStage?.name ? `: ${overdueStage.name}` : ""}`,
        actionLabel: "Otvori projekat",
        action: () => setModal({ type: "project", project }),
      });
    });

    activeProjects.forEach((project) => {
      const projectTasks = tasks.filter(
        (task) => task.projectId === project.id,
      );
      if (!projectTasks.length) return;

      const workflowSummary = getWorkflowSummary(projectTasks);
      const missingAssignmentTasks = projectTasks.filter(
        (task) =>
          task.needsAssignment ||
          String(task.assignedToLabel || "")
            .toLowerCase()
            .includes("potrebna dodela"),
      );
      missingAssignmentTasks.slice(0, 2).forEach((task) => {
        signals.push({
          id: `missing-role-${task.id}`,
          tone: "red",
          badge: "ROLA",
          title: task.title,
          message: `${project.title} - Rok: ${formatDate(task.dueDate)} - Rola: ${normalizeRoleLabel(task.requiredRole || task.assignedToLabel)}`,
          actionLabel: "Re-delegiraj",
          action: () => setModal({ type: "task", task }),
        });
      });
      const blockedStep = getBlockedStepSignal(projectTasks);
      if (blockedStep) {
        signals.push({
          id: `blocked-step-${blockedStep.task.id}`,
          tone: blockedStep.tone,
          badge: blockedStep.tone === "red" ? "BLOKADA" : "USPORAVA",
          title: blockedStep.title,
          message: `${clientName(project.clientId)} - ${project.title}: ${blockedStep.task.requiredRole || blockedStep.task.title} traje ${formatDurationShort(blockedStep.actualMinutes)} / očekivano ${formatDurationShort(blockedStep.expectedMinutes)} (${blockedStep.ratio.toFixed(1)}x)`,
          actionLabel: "Otvori task",
          action: () => setModal({ type: "task", task: blockedStep.task }),
        });
      }

      const progressSummary = getProjectProgress(projectTasks);
      const openTasks = projectTasks.filter(
        (task) =>
          !isTaskCompleted(task) &&
          !(task.status === "na_cekanju" && task.dependsOnTaskId),
      );
      const unbilledTasks = getBillableTasksForProject(
        project,
        projectTasks,
        billing,
      );
      const progress = workflowSummary.total
        ? workflowSummary.progress
        : progressSummary.progressPercent;
      const pendingValue = unbilledTasks.reduce(
        (sum, task) => sum + taskValue(task),
        0,
      );
      const activityDates = projectTasks
        .map((task) => task.completedAt || task.updatedAt || task.createdAt)
        .filter((value): value is string => Boolean(value));
      const lastActivityDate = activityDates.sort(
        (first, second) =>
          new Date(second).getTime() - new Date(first).getTime(),
      )[0];
      const idleDays = daysSince(lastActivityDate);

      if (unbilledTasks.length && idleDays >= 3) {
        signals.push({
          id: `ready-billing-${project.id}`,
          tone: "red",
          badge: "ZRELO",
          title: `Završeni taskovi čekaju ${idleDays} dana`,
          message: `${clientName(project.clientId)} - ${project.title}: ${unbilledTasks.length} taska spremna za naplatu${pendingValue ? ` (${formatAmountValue(pendingValue)})` : ""}`,
          actionLabel: "Otvori projekat",
          action: () => setModal({ type: "project", project }),
        });
      } else if (unbilledTasks.length) {
        signals.push({
          id: `fresh-billing-${project.id}`,
          tone: "yellow",
          badge: "NAPLATA",
          title: "Spremno za naplatu",
          message: `${clientName(project.clientId)} - ${project.title}: ${unbilledTasks.length} završenih taskova`,
          actionLabel: "Otvori projekat",
          action: () => setModal({ type: "project", project }),
        });
      }

      if (openTasks.length && idleDays >= 5) {
        signals.push({
          id: `blocked-${project.id}`,
          tone: "red",
          badge: "BLOKADA",
          title: `Projekat stoji ${idleDays} dana`,
          message: `${clientName(project.clientId)} - ${project.title}: ${progress}% završeno, ${openTasks.length} otvorenih taskova`,
          actionLabel: "Otvori projekat",
          action: () => setModal({ type: "project", project }),
        });
      } else if (progress >= 60 && progress < 100) {
        signals.push({
          id: `progress-${project.id}`,
          tone: "yellow",
          badge: "BITNO",
          title: `Projekat je ${progress}% završen`,
          message: `${clientName(project.clientId)} - ${project.title}: blizu završetka, proveri sledeći korak`,
          actionLabel: "Pogledaj",
          action: () => setModal({ type: "project", project }),
        });
      }

      if (progress === 100 && unbilledTasks.length) {
        signals.push({
          id: `done-unbilled-${project.id}`,
          tone: "red",
          badge: "100%",
          title: "Završeno, nije naplaćeno",
          message: `${clientName(project.clientId)} - ${project.title}: sve završeno, pošalji na naplatu`,
          actionLabel: "Naplata",
          action: () => setModal({ type: "project", project }),
        });
      }
    });

    lateTasks.slice(0, 4).forEach((task) => {
      signals.push({
        id: `late-task-${task.id}`,
        tone: "red",
        badge: "TASK",
        title: "Task kasni",
        message: `${clientName(String(task.clientId))} - ${projectTitle(task.projectId)}: ${task.title}`,
        actionLabel: "Otvori",
        action: () => setModal({ type: "task", task }),
      });
    });

    const toneWeight: Record<PulseSignalTone, number> = {
      red: 0,
      yellow: 1,
      blue: 2,
    };
    const uniqueSignals = Array.from(
      new Map(signals.map((signal) => [signal.id, signal])).values(),
    );
    return uniqueSignals
      .sort((first, second) => toneWeight[first.tone] - toneWeight[second.tone])
      .slice(0, 6);
  }, [
    projects,
    tasks,
    urgentBilling,
    riskyProjects,
    lateTasks,
    clientById,
    projectById,
  ]);
  void pulseSignals;
  const aiSignals = useMemo(
    () =>
      buildAdminAiSignals({
        clients,
        projects,
        tasks,
        billing,
        members,
      }),
    [billing, clients, members, projects, tasks],
  );
  const signalStatusHeadline = "Klikni na polja ispod";
  const commandGreetingTitle = `ZDRAVO ${(
    currentUser.name || "Admin"
  ).toUpperCase()}`;
  const actionableSignalCount = commandTaskSignals.length;
  const signalReactionLabel =
    actionableSignalCount === 1
      ? "potrebna reakcija"
      : "potrebnih reakcija";
  const followUpProposals = useMemo(
    () =>
      buildFollowUpProposals({
        clients,
        projects,
        tasks,
        billing,
        members: isDemoMode ? demoMembers : members,
      }),
    [billing, clients, demoMembers, isDemoMode, members, projects, tasks],
  );
  const validTeamTasks = tasks.filter((task) => {
    if (!task.clientId || !clientById.has(String(task.clientId))) return false;
    if (task.projectId && !projectById.has(task.projectId)) return false;
    return true;
  });
  const teamActiveTasks = validTeamTasks.filter(isTaskOpen);
  const effectiveMembers = isDemoMode ? demoMembers : members;
  const activeTeamMembers = effectiveMembers
    .filter((member) => member.status !== "invited")
    .filter((member) => member.role === "member" || member.role === "finance")
    .slice()
    .sort((first, second) =>
      memberDisplayName(first).localeCompare(memberDisplayName(second), "sr"),
    );
  const teamActiveTasksForMember = (memberId: string) =>
    teamActiveTasks.filter((task) => task.assignedToUserId === memberId);
  const billingSummaryCards = useMemo(() => {
    return [
      {
        key: "draft",
        label: "Za fakturisanje",
        amount: billingCollections.readyTotal,
        count: billingCollections.ready.length,
        tone: "blue" as const,
        filter: "draft",
      },
      {
        key: "invoiced",
        label: "Fakturisano",
        amount: billingCollections.invoicedTotal,
        count: billingCollections.invoiced.length,
        tone: "blue" as const,
        filter: "invoiced",
      },
      {
        key: "overdue",
        label: "Kasni sa naplatom",
        amount: billingCollections.overdueTotal,
        count: billingCollections.overdue.length,
        tone: "red" as const,
        filter: "overdue",
      },
      {
        key: "paid-week",
        label: "Plaćeno ove nedelje",
        amount: billingCollections.paidWeekTotal,
        count: billingCollections.paidThisWeek.length,
        tone: "green" as const,
        filter: "paid-week",
      },
    ];
  }, [billingCollections]);

  const openBillingFilter = (filter: string) => {
    navigate(`/billing?filter=${filter}`);
  };

  const commandStatusTone = useMemo(
    () => getSignalTone(aiSignals),
    [aiSignals],
  );
  const selectedMember = useMemo(() => {
    if (!activeTeamMembers.length) return null;
    return (
      activeTeamMembers.find((member) => member.user_id === selectedTeamMemberId) ??
      activeTeamMembers[0]
    );
  }, [activeTeamMembers, selectedTeamMemberId]);
  const selectedMemberIndex = selectedMember
    ? activeTeamMembers.findIndex(
        (member) => member.user_id === selectedMember.user_id,
      )
    : -1;
  const selectedMemberTasks = selectedMember
    ? teamActiveTasksForMember(selectedMember.user_id)
    : [];
  const selectedMemberLateTasks = selectedMemberTasks.filter((task) =>
    isTaskOverdue(task),
  );
  const billingCommandStats = useMemo(() => {
    const draftCard = billingSummaryCards.find((card) => card.key === "draft");
    const overdueCard = billingSummaryCards.find(
      (card) => card.key === "overdue",
    );
    const paidWeekCard = billingSummaryCards.find(
      (card) => card.key === "paid-week",
    );
    const readyCount = draftCard?.count ?? 0;
    const openAmount = draftCard?.amount ?? 0;
    const overdueCount = overdueCard?.count ?? 0;
    return {
      readyCount,
      openAmount,
      overdueCount,
      paidWeekAmount: paidWeekCard?.amount ?? 0,
      targetFilter: overdueCount ? "overdue" : "draft",
    };
  }, [billingSummaryCards]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const projectTaskCandidates = projects
      .map((project) => {
        const projectTasks = tasks.filter((task) => task.projectId === project.id);
        const unbilledTasks = getBillableTasksForProject(project, projectTasks, billing);

        return {
          projectId: project.id,
          projectTitle: project.title,
          readyTaskCount: unbilledTasks.length,
          readyAmount: unbilledTasks.reduce((sum, task) => sum + taskValue(task), 0),
        };
      })
      .filter((item) => item.readyTaskCount > 0);

    console.debug("[billing-debug]", {
      source: isCloudBillingMode ? "supabase" : "local",
      recordCount: billing.length,
      readyCount: billingCollections.ready.length,
      readyTotal: billingCollections.readyTotal,
      invoicedCount: billingCollections.invoiced.length,
      overdueCount: billingCollections.overdue.length,
      paidCount: billingCollections.paid.length,
      statuses: billing.map((record) => ({
        id: record.id,
        projectId: record.projectId,
        status: record.status,
        normalizedStatus: getBillingStatus(record),
        amount: record.amount ?? 0,
      })),
      projectTaskCandidates,
    });
  }, [billing, billingCollections, isCloudBillingMode, projects, tasks]);

  useEffect(() => {
    if (!activeTeamMembers.length) return;
    if (
      !selectedTeamMemberId ||
      !activeTeamMembers.some((member) => member.user_id === selectedTeamMemberId)
    ) {
      setSelectedTeamMemberId(activeTeamMembers[0].user_id);
    }
  }, [activeTeamMembers, selectedTeamMemberId]);

  useEffect(() => {
    if (!signalsPanelRef.current) return;

    const glowMap: Record<
      CommandStatusTone,
      { border: string; shadow: string; shadowSoft: string }
    > = {
      green: {
        border: "#4df7a1",
        shadow: "0 0 0 1px rgba(77, 247, 161, 0.35), 0 0 28px rgba(77, 247, 161, 0.22)",
        shadowSoft:
          "0 0 0 1px rgba(77, 247, 161, 0.2), 0 0 14px rgba(77, 247, 161, 0.1)",
      },
      yellow: {
        border: "#ffcc66",
        shadow: "0 0 0 1px rgba(255, 204, 102, 0.35), 0 0 28px rgba(255, 204, 102, 0.22)",
        shadowSoft:
          "0 0 0 1px rgba(255, 204, 102, 0.18), 0 0 14px rgba(255, 204, 102, 0.1)",
      },
      red: {
        border: "#ff627d",
        shadow: "0 0 0 1px rgba(255, 98, 125, 0.4), 0 0 30px rgba(255, 98, 125, 0.24)",
        shadowSoft:
          "0 0 0 1px rgba(255, 98, 125, 0.2), 0 0 16px rgba(255, 98, 125, 0.1)",
      },
    };

    const glow = glowMap[commandStatusTone];
    const ctx = gsap.context(() => {
      gsap.set(signalsPanelRef.current, {
        borderColor: glow.border,
        boxShadow: glow.shadowSoft,
      });
      gsap.to(signalsPanelRef.current, {
        boxShadow: glow.shadow,
        duration: 1.8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, commandCenterRef);

    return () => ctx.revert();
  }, [commandStatusTone]);

  useEffect(() => {
    if (!billingPanelRef.current) return;

    const amountTarget = billingCommandStats.openAmount;
    const overdueTarget = billingCommandStats.overdueCount;
    const paidWeekTarget = billingCommandStats.paidWeekAmount;
    const counters = { amount: 0, overdue: 0, paidWeek: 0 };
    const ctx = gsap.context(() => {
      gsap.fromTo(
        billingPanelRef.current,
        { y: 18, opacity: 0.7 },
        { y: 0, opacity: 1, duration: 0.7, ease: "power2.out" },
      );
      gsap.to(counters, {
        amount: amountTarget,
        overdue: overdueTarget,
        paidWeek: paidWeekTarget,
        duration: 1.3,
        ease: "power2.out",
        onUpdate: () => {
          if (billingOpenAmountRef.current) {
            billingOpenAmountRef.current.textContent = formatAmountValue(
              Math.round(counters.amount),
            );
          }
          if (billingOverdueCountRef.current) {
            billingOverdueCountRef.current.textContent = String(
              Math.round(counters.overdue),
            );
          }
          if (billingPaidWeekAmountRef.current) {
            billingPaidWeekAmountRef.current.textContent = formatAmountValue(
              Math.round(counters.paidWeek),
            );
          }
        },
      });
      gsap.to(".command-billing-stat", {
        y: -2,
        boxShadow:
          "0 0 0 1px rgba(96, 165, 250, 0.16), 0 18px 30px rgba(15, 23, 42, 0.22)",
        duration: 1.4,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: 0.08,
      });
    }, commandCenterRef);

    return () => ctx.revert();
  }, [billingCommandStats]);

  useEffect(() => {
    if (!carouselTrackRef.current || selectedMemberIndex < 0) return;

    const ctx = gsap.context(() => {
      carouselCardRefs.current.forEach((card, index) => {
        if (!card) return;
        const offset = index - selectedMemberIndex;
        const absOffset = Math.abs(offset);
        const isActive = offset === 0;
        const limitedOffset = Math.max(-2, Math.min(2, offset));

        gsap.to(card, {
          xPercent: -50 + limitedOffset * 50,
          y: absOffset === 0 ? 0 : absOffset === 1 ? 14 : 24,
          rotateY: limitedOffset * -38,
          scale: isActive ? 1 : absOffset === 1 ? 0.82 : 0.66,
          opacity:
            absOffset > 2 ? 0 : absOffset === 2 ? 0.16 : absOffset === 1 ? 0.58 : 1,
          zIndex: 100 - absOffset,
          filter:
            absOffset === 0
              ? "blur(0px)"
              : absOffset === 1
                ? "blur(0.4px)"
                : "blur(1.2px)",
          duration: 0.65,
          ease: "power3.out",
          transformPerspective: 1200,
          transformOrigin: "center center",
        });
      });
    }, commandCenterRef);

    return () => ctx.revert();
  }, [activeTeamMembers, selectedMemberIndex]);

  const shiftSelectedMember = (direction: -1 | 1) => {
    if (!activeTeamMembers.length || selectedMemberIndex < 0) return;
    const nextIndex =
      direction < 0
        ? selectedMemberIndex <= 0
          ? activeTeamMembers.length - 1
          : selectedMemberIndex - 1
        : selectedMemberIndex >= activeTeamMembers.length - 1
          ? 0
          : selectedMemberIndex + 1;
    setSelectedTeamMemberId(activeTeamMembers[nextIndex]?.user_id ?? null);
  };

  const handleCarouselPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    carouselPointerStartXRef.current = event.clientX;
  };

  const handleCarouselPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (carouselPointerStartXRef.current === null) return;
    const deltaX = event.clientX - carouselPointerStartXRef.current;
    carouselPointerStartXRef.current = null;
    if (Math.abs(deltaX) < 36) return;
    shiftSelectedMember(deltaX > 0 ? -1 : 1);
  };

  const openSignalCard = (signal: AiPulseSignal) => {
    if (signal.actionType === "open_billing" || signal.actionType === "billing_summary") {
      openBillingFilter("draft");
      return;
    }
    if (signal.relatedTaskId) {
      navigate(`/tasks/${signal.relatedTaskId}`);
      return;
    }
    if (signal.relatedProjectId) {
      const project = projects.find((item) => item.id === signal.relatedProjectId);
      if (project) {
        setModal({ type: "project", project });
      }
    }
  };

  const openSignalNote = (signal: AiPulseSignal) => {
    if (signal.actionType === "follow_up") {
      const matchingProposal =
        followUpProposals.find(
          (proposal) =>
            (signal.relatedTaskId && proposal.relatedTaskId === signal.relatedTaskId) ||
            (signal.relatedProjectId &&
              proposal.relatedProjectId === signal.relatedProjectId) ||
            (signal.relatedClientId &&
              proposal.relatedClientId === signal.relatedClientId),
        ) ?? null;

      if (matchingProposal) {
        setModal({
          type: "followup",
          proposal: matchingProposal,
        });
        return;
      }
    }

    const note = buildSignalSuggestion(signal);
    if (!note) {
      openSignalCard(signal);
      return;
    }
    setModal({
      type: "signal-note",
      signal,
      note,
    });
  };

  const handleCreateClient = async (values: ClientCreateFormValues) => {
    const nextId =
      Math.max(0, ...clients.map((client) => Number(client.id) || 0)) + 1;
    const savedClient = await addClient({
      id: nextId,
      name: values.name,
      city: values.city,
      address: values.address,
      contacts: values.contacts,
      commercial: values.commercial,
    });
    if (savedClient) {
      setModal(null);
    }
  };

  const handleCreateProject = async (
    clientId: string,
    values: ProjectFormValues,
  ) => {
    const templateId = getTemplateIdForProjectType(values.type);
    const projectId = `project-${crypto.randomUUID?.() || Date.now()}`;
    const savedProject = await addProject({
      id: projectId,
      clientId,
      title: values.title.trim() || "Novi projekat",
      type: values.type || undefined,
      frequency: values.frequency || undefined,
      value: values.value.trim() ? Number(values.value) : undefined,
      status: "aktivan",
      templateId,
      stages: buildStagesFromTemplate(templateId),
    });
    if (savedProject) {
      setModal(null);
    }
  };

  const handleCreateTask = async (
    clientId: string,
    values: CreateTaskFormValues,
  ) => {
    const timestamp = new Date().toISOString();
    const taskId = `task-${crypto.randomUUID?.() || Date.now()}`;
    await addTask({
      id: taskId,
      clientId,
      projectId: values.projectId,
      title: values.title.trim() || "Nova aktivnost",
      description: values.description.trim(),
      type: values.type || undefined,
      assignedToUserId: values.assignedToUserId,
      assignedToLabel: values.assignedToLabel.trim(),
      dueDate: values.dueDate || undefined,
      stageId: values.stageId || undefined,
      status: "dodeljen",
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      billingState: values.billingState,
    });
  };

  const handleAssignTask = async (task: Task, memberId: string) => {
    const member = members.find((item) => item.user_id === memberId);
    if (!member) return;
    const now = new Date().toISOString();
    const label = `${memberDisplayName(member)} - ${memberOperationalRole(member)}`;
    await updateTask({
      ...task,
      assignedToUserId: member.user_id,
      assignedToLabel: label,
      needsAssignment: false,
      status:
        task.status === "na_cekanju" && !task.dependsOnTaskId
          ? "dodeljen"
          : task.status,
      updatedAt: now,
    });
    setModal(null);
  };

  const handleCreateJobFromCatalog = async (
    clientId: string,
    values: CatalogJobFormValues,
  ) => {
    const products = isDemoMode ? readDemoProducts() : readProducts();
    const templates = isDemoMode
      ? readDemoProcessTemplates()
      : readProcessTemplates();
    const product = products.find(
      (item) =>
        item.id === values.productId &&
        item.status === "active" &&
        isProductVisibleForClient(item, clientId),
    );
    const template = product?.processTemplateId
      ? templates.find((item) => item.id === product.processTemplateId)
      : undefined;
    const quantity = Number(values.quantity.replace(",", "."));

    if (
      !product ||
      !template ||
      !template.steps.length ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    )
      return;

    const payload = buildCatalogJobPayload(
      {
        clientId,
        product,
        template,
        title: values.title,
        dueDate: values.dueDate || undefined,
        quantity,
        fileLink: values.fileLink,
        note: values.note,
      },
      members.map((member) => ({
        id: member.user_id,
        name:
          member.display_name ||
          member.profile?.full_name ||
          member.profile?.email ||
          member.user_id,
        productionRole: member.production_role || null,
      })),
    );

    const savedProject = await addProject(payload.project);
    if (!savedProject) return;

    await Promise.all(
      payload.tasks.map((task) =>
        addTask({ ...task, projectId: savedProject.id }),
      ),
    );
  };

  const handleCreateBillingFromProject = async (
    project: Project,
    tasksForBilling: Task[],
  ) => {
    const totalTimeMinutes = tasksForBilling.reduce(
      (sum, task) => sum + (task.timeSpentMinutes ?? 0),
      0,
    );
    const totalLaborCost = tasksForBilling.reduce(
      (sum, task) => sum + (task.laborCost ?? 0),
      0,
    );
    const totalMaterialCost = tasksForBilling.reduce(
      (sum, task) => sum + (task.materialCost ?? 0),
      0,
    );
    const totalCost = totalLaborCost + totalMaterialCost;
    const marginPercent = 30;
    const amountForFinance = Math.round(totalCost * (1 + marginPercent / 100));
    const record = await createBillingForProject(project.id, {
      description: `Nalog za naplatu - ${project.title}`,
      amount: amountForFinance,
      currency: "RSD",
      dueDate: null,
      invoiceNumber: "",
      taskCount: tasksForBilling.length,
      totalTimeMinutes,
      totalLaborCost,
      totalMaterialCost,
      totalCost,
      marginPercent,
      netAmount: amountForFinance,
    });
    const client = clientById.get(String(project.clientId));
    const financeMember = members.find((member) => member.role === "finance");
    const supabase = getSupabaseClient();

    if (record && supabase && activeWorkspace?.id) {
      await supabase.from("billing_records").upsert(
        {
          id: record.id,
          workspace_id: activeWorkspace.id,
          client_id: String(project.clientId),
          project_id: String(project.id),
          client_name: client?.name || record.clientName || "",
          project_name: project.title,
          description: record.description,
          amount: amountForFinance,
          currency: "RSD",
          due_date: null,
          status: "ready",
          invoice_number: "",
          task_count: tasksForBilling.length,
          total_tasks: tasksForBilling.length,
          total_time_minutes: totalTimeMinutes,
          total_time: totalTimeMinutes,
          total_labor_cost: totalLaborCost,
          labor_cost: totalLaborCost,
          total_material_cost: totalMaterialCost,
          total_material: totalMaterialCost,
          total_cost: totalCost,
          margin_percent: marginPercent,
          margin: marginPercent,
          net_amount: totalCost,
          total_with_margin: amountForFinance,
          suggested_invoice_amount: amountForFinance,
          assigned_finance_user_id: financeMember?.user_id || null,
          source: "pulse",
          created_at: record.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString(),
          invoiced_at: null,
          paid_at: null,
        },
        { onConflict: "id" },
      );
    }

    if (record) {
      await Promise.all(
        tasksForBilling.map((task) =>
          Promise.resolve(
            updateTask({
              ...task,
              billingState: "sent_to_billing",
              billingStatus: "sent_to_billing",
              billingId: record.id,
              updatedAt: new Date().toISOString(),
            }),
          ),
        ),
      );
    }
    setModal({
      type: "billing",
      record: record || {
        id: "",
        clientId: project.clientId,
        projectId: project.id,
        description: project.title,
        amount: totalCost,
        currency: "RSD",
        dueDate: null,
        status: "draft",
        invoiceNumber: "",
        totalLaborCost,
        totalMaterialCost,
        totalCost,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  };

  return (
    <section
      className="pulse-phone-screen admin-phone-screen command-center-screen"
      ref={commandCenterRef}
    >
      <div className="command-center-shell">
        <section
          ref={signalsPanelRef}
          className={`command-panel command-signals-panel is-${commandStatusTone}`}
        >
          <button
            type="button"
            className="command-signals-summary"
            onClick={() => setIsSignalsExpanded((current) => !current)}
          >
            <div className="command-panel-kicker">Live command feed</div>
            <div className="command-panel-title-row">
              <h3>{commandGreetingTitle}</h3>
              <span className={`command-status-chip is-${commandStatusTone}`}>
                {commandStatusTone === "red"
                  ? "Hitno"
                  : commandStatusTone === "yellow"
                    ? "Rizik"
                    : "Stabilno"}
              </span>
            </div>
            <div className="pulse-ai-line command-ai-line">
              <span className="pulse-ai-cursor">|</span>
              {pulseTypingText || "PULSE analizira..."}
            </div>
            <p className="command-signal-headline">{signalStatusHeadline}</p>
            <div className="command-signal-stats">
              <div>
                <strong>{actionRequired.overdueTasks.length}</strong>
                <span>kasnih taskova</span>
              </div>
              <div>
                <strong>{urgentBilling.length}</strong>
                <span>naplata alarm</span>
              </div>
              <div>
                <strong>{actionableSignalCount}</strong>
                <span>{signalReactionLabel}</span>
              </div>
            </div>
          </button>
          <div
            className={`command-signal-drawer ${isSignalsExpanded ? "is-open" : ""}`}
          >
            {aiSignals.length ? (
              aiSignals.map((signal) => (
                <article
                  key={signal.id}
                  className={`command-signal-item is-${signal.severity}`}
                  onClick={() => openSignalCard(signal)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openSignalCard(signal);
                    }
                  }}
                >
                  <div className="command-signal-item-top">
                    <strong>{signal.entityName}</strong>
                    <span className={`command-signal-badge is-${signal.severity}`}>
                      {signal.severity === "red"
                        ? "Potrebna reakcija"
                        : signal.severity === "yellow"
                          ? "Prati"
                          : "Pod kontrolom"}
                    </span>
                  </div>
                  <p>{signal.message}</p>
                  {signal.impact ? <small>{signal.impact}</small> : null}
                  {signal.actionLabel ? (
                    <button
                      type="button"
                      className="command-signal-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        openSignalNote(signal);
                      }}
                    >
                      {signal.actionLabel}
                    </button>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="pulse-empty command-inline-empty">
                Sve je pod kontrolom. Nema kriticnih signala trenutno.
              </p>
            )}
          </div>
        </section>

        <div className="command-center-grid">
          <button
            ref={billingPanelRef}
            type="button"
            className="command-panel command-billing-panel"
            onClick={() => openBillingFilter(billingCommandStats.targetFilter)}
          >
            <div className="command-panel-kicker">Cash visibility</div>
            <div className="command-panel-title-row">
              <h3>NAPLATA</h3>
              <span className="command-link-hint">
                {billingCommandStats.readyCount} za fakturisanje
              </span>
            </div>
            <div className="command-billing-body">
              <div className="command-billing-metrics">
                <div className="command-billing-stat">
                  <span>Otvoren iznos</span>
                  <strong ref={billingOpenAmountRef}>
                    {formatAmountValue(billingCommandStats.openAmount)}
                  </strong>
                </div>
                <div className="command-billing-stat">
                  <span>Overdue stavke</span>
                  <strong ref={billingOverdueCountRef}>
                    {billingCommandStats.overdueCount}
                  </strong>
                </div>
                <div className="command-billing-stat">
                  <span>Placeno ove nedelje</span>
                  <strong ref={billingPaidWeekAmountRef}>
                    {formatAmountValue(billingCommandStats.paidWeekAmount)}
                  </strong>
                </div>
              </div>
            </div>
          </button>

          <section className="command-panel command-team-panel">
            <div className="command-team-header">
              <button
                type="button"
                className="command-title-link"
                onClick={() => navigate("/workspace")}
              >
                <span>MOJ TIM</span>
                <span className="command-title-arrow" aria-hidden="true">
                  ›
                </span>
              </button>
              <span className="command-carousel-hint">
                Otvori workspace • klik ili prevuci karticu
              </span>
            </div>
            <div
              ref={carouselTrackRef}
              className="command-team-carousel"
              aria-label="Carousel clanova tima"
              onPointerDown={handleCarouselPointerDown}
              onPointerUp={handleCarouselPointerUp}
              onPointerLeave={() => {
                carouselPointerStartXRef.current = null;
              }}
            >
              {activeTeamMembers.length ? (
                activeTeamMembers.map((member, index) => {
                  const isActive = selectedMember?.user_id === member.user_id;
                  const activeTasks = teamActiveTasksForMember(member.user_id);
                  return (
                    <button
                      key={member.id || member.user_id}
                      ref={(node) => {
                        carouselCardRefs.current[index] = node;
                      }}
                      type="button"
                      className={`command-team-card ${isActive ? "is-active" : ""}`}
                      onClick={() => setSelectedTeamMemberId(member.user_id)}
                    >
                      <span className="command-team-avatar">
                        {memberInitials(member)}
                      </span>
                      <strong>{memberDisplayName(member)}</strong>
                      <small>{memberOperationalRole(member)}</small>
                      <span className="command-team-meta">
                        {activeTasks.length} aktivna
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="pulse-empty command-inline-empty">
                  Nema clanova tima u workspace-u.
                </p>
              )}
            </div>
          </section>

          <section className="command-panel command-task-panel">
            <div className="command-task-header">
              <div>
                <span className="command-panel-kicker">Assigned focus</span>
                <h3>
                  {selectedMember
                    ? memberDisplayName(selectedMember)
                    : "Izaberi clana tima"}
                </h3>
              </div>
              <div className="command-task-stats">
                <span>{selectedMemberTasks.length} aktivna</span>
                <span>{selectedMemberLateTasks.length} kasni</span>
              </div>
            </div>
            <div className="command-task-scroll">
              {selectedMemberTasks.length ? (
                selectedMemberTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    className={`command-task-card ${isTaskOverdue(task) ? "is-late" : ""}`}
                    onClick={() => navigate(`/tasks/${task.id}`)}
                  >
                    <div className="command-task-card-top">
                      <strong>{task.title}</strong>
                      <span>{TASK_STATUS_LABELS[task.status]}</span>
                    </div>
                    <small>
                      {task.projectId
                        ? projectTitle(task.projectId)
                        : `${clientName(String(task.clientId))} · Ad hoc`}
                    </small>
                    <div className="command-task-card-meta">
                      <span>Rok: {formatDate(task.dueDate)}</span>
                      <span>
                        {isTaskOverdue(task) ? "Kasni" : "Na vreme"}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <p className="pulse-empty command-inline-empty">
                  Nema aktivnih taskova za prikaz.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>

      <AdminModal
        state={modal}
        clients={clients}
        projects={projects}
        tasks={tasks}
        billing={billing}
        members={members}
        onClose={() => setModal(null)}
        onCreateClient={handleCreateClient}
        onCreateProject={handleCreateProject}
        onUpdateClient={async (clientId, patch) => {
          await updateClient(clientId, patch);
        }}
        onCreateTask={handleCreateTask}
        onCreateJobFromCatalog={handleCreateJobFromCatalog}
        onCreateBillingFromProject={handleCreateBillingFromProject}
        onAssignTask={handleAssignTask}
        onOpenTask={(task) => setModal({ type: "task", task })}
      />
    </section>
  );
}

export default AdminHome;

