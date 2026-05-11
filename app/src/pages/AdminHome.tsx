import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBillingStatus } from "../features/billing/billingLifecycle";
import { BILLING_STATUS_LABELS } from "../features/billing/billingLabels";
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
  readProcessTemplates,
  readProcessTemplatesFromSupabase,
  saveProcessTemplates,
} from "../features/templates/templateStorage";
import { buildCatalogJobPayload } from "../features/workflows/createJobFromProduct";
import { TASK_STATUS_LABELS } from "../features/tasks/taskLabels";
import { isTaskCompleted, isTaskOpen } from "../features/tasks/taskLifecycle";
import { getLateTasks } from "../features/tasks/taskSelectors";
import { useTaskStore } from "../features/tasks/taskStore";
import type { Task } from "../features/tasks/types";
import CreateTaskForm, {
  type CreateTaskFormValues,
} from "../features/tasks/components/CreateTaskForm";
import { useCloudStore } from "../features/cloud/cloudStore";
import { getSupabaseClient } from "../lib/supabaseClient";
import "../features/clients/pages/client-detail.css";

type ModalState =
  | { type: "task"; task: Task }
  | { type: "project"; project: Project }
  | { type: "billing"; record: BillingRecord }
  | { type: "client"; client: Client; score: number }
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

function isPaidThisWeek(record: BillingRecord) {
  if (getBillingStatus(record) !== "closed") return false;
  const value = record.paidAt || record.updatedAt || record.createdAt;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  const day = weekStart.getDay() || 7;
  weekStart.setDate(weekStart.getDate() - day + 1);

  return date.getTime() >= weekStart.getTime();
}

function billingAmountSum(records: BillingRecord[]) {
  return records.reduce((sum, record) => sum + (record.amount ?? 0), 0);
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
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const [isChoosingJob, setIsChoosingJob] = useState(false);
  const [isCreatingFromCatalog, setIsCreatingFromCatalog] = useState(false);
  const [catalogJobMessage, setCatalogJobMessage] = useState("");
  const products = readProducts();
  const processTemplates = readProcessTemplates();

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
        {client?.name || "Nepoznat klijent"} —{" "}
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
                {memberDisplayName(member)} · {operationalRole || "BEZ ROLE"}
                {suggested ? " · preporučeno" : ""}
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
              <strong>{state.activeCount}</strong> aktivna ·{" "}
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
                        : `${clients.find((client) => String(client.id) === String(task.clientId))?.name ?? "Nepoznat klijent"} · Ad hoc`}{" "}
                      ·{" "}
                      {isOverdueDate(task.dueDate)
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
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<
    string | null
  >(null);
  const { clients, addClient, updateClient } = useClientStore();
  const { projects, addProject } = useProjectStore();
  const { tasks, addTask, updateTask } = useTaskStore();
  const { getAllBilling, createBillingForProject } = useBillingStore();
  const [modal, setModal] = useState<ModalState>(null);
  const [pulseTypingText, setPulseTypingText] = useState("");
  const billing = getAllBilling();

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
      task.projectId &&
      clientById.has(String(task.clientId)) &&
      projectById.has(task.projectId),
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
        message: `${clientName(record.clientId)} — ${formatAmount(record)} za projekat ${projectTitle(record.projectId)}`,
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
        message: `${clientName(project.clientId)} — ${project.title}${overdueStage?.name ? `: ${overdueStage.name}` : ""}`,
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
          message: `${project.title} · Rok: ${formatDate(task.dueDate)} · Rola: ${normalizeRoleLabel(task.requiredRole || task.assignedToLabel)}`,
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
          message: `${clientName(project.clientId)} — ${project.title}: ${blockedStep.task.requiredRole || blockedStep.task.title} traje ${formatDurationShort(blockedStep.actualMinutes)} / očekivano ${formatDurationShort(blockedStep.expectedMinutes)} (${blockedStep.ratio.toFixed(1)}x)`,
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
          message: `${clientName(project.clientId)} — ${project.title}: ${unbilledTasks.length} taska spremna za naplatu${pendingValue ? ` (${formatAmountValue(pendingValue)})` : ""}`,
          actionLabel: "Otvori projekat",
          action: () => setModal({ type: "project", project }),
        });
      } else if (unbilledTasks.length) {
        signals.push({
          id: `fresh-billing-${project.id}`,
          tone: "yellow",
          badge: "NAPLATA",
          title: "Spremno za naplatu",
          message: `${clientName(project.clientId)} — ${project.title}: ${unbilledTasks.length} završenih taskova`,
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
          message: `${clientName(project.clientId)} — ${project.title}: ${progress}% završeno, ${openTasks.length} otvorenih taskova`,
          actionLabel: "Otvori projekat",
          action: () => setModal({ type: "project", project }),
        });
      } else if (progress >= 60 && progress < 100) {
        signals.push({
          id: `progress-${project.id}`,
          tone: "yellow",
          badge: "BITNO",
          title: `Projekat je ${progress}% završen`,
          message: `${clientName(project.clientId)} — ${project.title}: blizu završetka, proveri sledeći korak`,
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
          message: `${clientName(project.clientId)} — ${project.title}: sve završeno, pošalji na naplatu`,
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
        message: `${clientName(String(task.clientId))} — ${projectTitle(task.projectId)}: ${task.title}`,
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
  const validTeamTasks = tasks.filter((task) => {
    if (!task.clientId || !clientById.has(String(task.clientId))) return false;
    if (task.projectId && !projectById.has(task.projectId)) return false;
    return true;
  });
  const teamActiveTasks = validTeamTasks.filter(isTaskOpen);
  const activeTeamMembers = members
    .filter((member) => member.status !== "invited")
    .filter((member) => member.role === "member")
    .slice()
    .sort((first, second) =>
      memberDisplayName(first).localeCompare(memberDisplayName(second), "sr"),
    );
  const teamActiveTasksForMember = (memberId: string) =>
    teamActiveTasks.filter((task) => task.assignedToUserId === memberId);
  const openWorkspaceMember = (memberId: string) => {
    navigate(`/workspace?member=${encodeURIComponent(memberId)}`);
  };
  const billingSummaryCards = useMemo(() => {
    const activeBillingRecords = billing.filter(
      (record) => record.status !== "cancelled",
    );
    const readyRecords = activeBillingRecords.filter(
      (record) =>
        getBillingStatus(record) === "issued" &&
        (record.status === "ready" || record.status === "draft"),
    );
    const invoicedRecords = activeBillingRecords.filter(
      (record) =>
        getBillingStatus(record) === "issued" && record.status === "invoiced",
    );
    const overdueRecords = activeBillingRecords.filter(
      (record) => getBillingStatus(record) === "overdue",
    );
    const paidThisWeekRecords = activeBillingRecords.filter(
      (record) => getBillingStatus(record) === "closed" && isPaidThisWeek(record),
    );

    return [
      {
        key: "draft",
        label: "Za fakturisanje",
        amount: billingAmountSum(readyRecords),
        count: readyRecords.length,
        tone: "blue" as const,
        filter: "draft",
      },
      {
        key: "invoiced",
        label: "Fakturisano",
        amount: billingAmountSum(invoicedRecords),
        count: invoicedRecords.length,
        tone: "blue" as const,
        filter: "invoiced",
      },
      {
        key: "overdue",
        label: "Kasni sa naplatom",
        amount: billingAmountSum(overdueRecords),
        count: overdueRecords.length,
        tone: "red" as const,
        filter: "overdue",
      },
      {
        key: "paid-week",
        label: "Plaćeno ove nedelje",
        amount: billingAmountSum(paidThisWeekRecords),
        count: paidThisWeekRecords.length,
        tone: "green" as const,
        filter: "paid-week",
      },
    ];
  }, [billing]);

  const openBillingFilter = (filter: string) => {
    navigate(`/billing?filter=${filter}`);
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
    const label = `${memberDisplayName(member)} · ${memberOperationalRole(member)}`;
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
    const products = readProducts();
    const templates = readProcessTemplates();
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
    <section className="pulse-phone-screen admin-phone-screen">
      <h2>Pregled poslovanja</h2>
      <section className="pulse-panel pulse-panel-red pulse-signals-panel">
        <h3>HITNO – BITNO !!!</h3>
        <div className="pulse-ai-line">
          <span className="pulse-ai-cursor">▌</span>
          {pulseTypingText || "PULSE analizira..."}
        </div>
        <div className="pulse-list">
          {pulseSignals.length ? (
            pulseSignals.map((signal) => (
              <article
                className={`pulse-item pulse-signal-card pulse-signal-${signal.tone}`}
                key={signal.id}
              >
                <div className="pulse-item-title-row">
                  <h4>{signal.title}</h4>
                  <span
                    className={`pulse-pill ${signal.tone === "red" ? "pulse-pill-red" : signal.tone === "yellow" ? "pulse-pill-blue" : "pulse-pill-cyan"}`}
                  >
                    {signal.badge}
                  </span>
                </div>
                <p>{signal.message}</p>
                <button
                  className="pulse-outline-btn pulse-card-open"
                  type="button"
                  onClick={signal.action}
                >
                  {signal.actionLabel}
                </button>
              </article>
            ))
          ) : (
            <p className="pulse-empty">
              Sve je pod kontrolom. Nema kritičnih signala trenutno.
            </p>
          )}
        </div>
      </section>
      <section className="pulse-panel pulse-panel-green pulse-team-overview-panel">
        <h3>MOJ TIM</h3>
        <div className="pulse-team-bubbles" aria-label="Filter po clanu tima">
          <button
            type="button"
            className={`pulse-team-bubble ${selectedTeamMemberId === null ? "is-active" : ""}`}
            onClick={() => setSelectedTeamMemberId(null)}
          >
            Svi
          </button>
          {activeTeamMembers.map((member) => (
            <button
              key={member.id || member.user_id}
              type="button"
              className={`pulse-team-bubble ${selectedTeamMemberId === member.user_id ? "is-active" : ""}`}
              onClick={() => setSelectedTeamMemberId(member.user_id)}
            >
              {memberDisplayName(member)}
            </button>
          ))}
        </div>
        <div className="pulse-team-grid">
          {activeTeamMembers.length ? (
            activeTeamMembers
              .filter(
                (member) =>
                  !selectedTeamMemberId ||
                  member.user_id === selectedTeamMemberId,
              )
              .map((member) => {
                const activeMemberTasks = teamActiveTasksForMember(
                  member.user_id,
                );
                const lateMemberTasks = activeMemberTasks.filter((task) =>
                  isOverdueDate(task.dueDate),
                );
                return (
                  <article
                    className={`pulse-team-member-card ${lateMemberTasks.length ? "has-late" : ""}`}
                    key={member.id || member.user_id}
                    onClick={() => openWorkspaceMember(member.user_id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === "Enter")
                        openWorkspaceMember(member.user_id);
                    }}
                  >
                    <div className="pulse-team-member-head">
                      <div className="pulse-team-member-id">
                        <span className="pulse-team-avatar">
                          {memberInitials(member)}
                        </span>
                        <div>
                          <h4>{memberDisplayName(member)}</h4>
                          <p>{memberOperationalRole(member)}</p>
                        </div>
                      </div>
                      <span
                        className={
                          lateMemberTasks.length
                            ? "pulse-team-status is-late"
                            : "pulse-team-status"
                        }
                      >
                        {lateMemberTasks.length
                          ? `${lateMemberTasks.length} kasni`
                          : "OK"}
                      </span>
                    </div>
                    <div className="pulse-team-member-stats">
                      <span>
                        <strong>{activeMemberTasks.length}</strong> aktivna
                      </span>
                      <span>
                        <strong>{lateMemberTasks.length}</strong> kasni
                      </span>
                    </div>
                    <button
                      type="button"
                      className="pulse-outline-btn pulse-team-tasks-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setModal({
                          type: "member-tasks",
                          memberName: memberDisplayName(member),
                          tasks: activeMemberTasks,
                          activeCount: activeMemberTasks.length,
                          lateCount: lateMemberTasks.length,
                        });
                      }}
                    >
                      Taskovi
                    </button>
                  </article>
                );
              })
          ) : (
            <p className="pulse-empty">Nema clanova tima u workspace-u.</p>
          )}
        </div>
      </section>
      <section className="pulse-panel pulse-panel-white pulse-admin-billing-summary-panel">
        <h3>NAPLATA</h3>
        <div className="admin-billing-summary-grid">
          {billingSummaryCards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`admin-billing-summary-card is-${card.tone}`}
              onClick={() => openBillingFilter(card.filter)}
            >
              <span className="admin-billing-summary-amount">
                {formatAmountValue(card.amount)}
              </span>
              <span className="admin-billing-summary-label">{card.label}</span>
              <span className="admin-billing-summary-count">
                {card.count} nalog{card.count === 1 ? "" : "a"}
              </span>
            </button>
          ))}
        </div>
      </section>

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

