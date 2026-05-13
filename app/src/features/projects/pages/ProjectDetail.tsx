import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BillingCard from "../../billing/components/BillingCard";
import { BILLING_STATUS_LABELS } from "../../billing/billingLabels";
import {
  getBillingGateMessage,
  getBillableTasksForProject,
} from "../../billing/billingGate";
import { useBillingStore } from "../../billing/billingStore";
import { readProducts } from "../../products/productStorage";
import { useCloudStore } from "../../cloud/cloudStore";
import { getSupabaseClient } from "../../../lib/supabaseClient";
import "../../clients/pages/client-detail.css";
import CreateTaskForm from "../../tasks/components/CreateTaskForm";
import type { CreateTaskFormValues } from "../../tasks/components/CreateTaskForm";
import { getTasksByProject as selectTasksByProject } from "../../tasks/taskSelectors";
import { useTaskStore } from "../../tasks/taskStore";
import { TASK_STATUS_LABELS } from "../../tasks/taskLabels";
import { isTaskCompleted } from "../../tasks/taskLifecycle";
import type { Task } from "../../tasks/types";
import { PROJECT_STATUS_LABELS, PROJECT_TYPE_LABELS } from "../projectLabels";
import { getProjectLifecycle, getProjectProgress } from "../projectLifecycle";
import { useProjectStore } from "../projectStore";
import { trackEvent } from "../../usage/usageTracker";

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("sr-RS")} RSD`;
}

function formatDueDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sr-RS", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function getTaskRoleLabel(task: Task) {
  const rawLabel = task.requiredRole || task.assignedToLabel || "Rola nije dodeljena";
  return (
    String(rawLabel)
      .replace(/\s*·?\s*potrebna dodela.*$/i, "")
      .replace(/\s*·?\s*bez dodele.*$/i, "")
      .trim() || "Rola nije dodeljena"
  );
}

function getTaskDoneLabel(task: Task) {
  if (isTaskCompleted(task)) {
    return `Uradjeno ${formatShortDate(task.completedAt || task.updatedAt)} · ${getTaskRoleLabel(task)}`;
  }
  if (
    task.needsAssignment ||
    String(task.assignedToLabel || "").toLowerCase().includes("potrebna dodela")
  ) {
    return `Potrebna dodela · ${getTaskRoleLabel(task)}`;
  }
  return `${TASK_STATUS_LABELS[task.status]} · ${getTaskRoleLabel(task)}`;
}

function getTaskTimelineTone(task: Task) {
  if (isTaskCompleted(task)) return "done";
  if (
    task.needsAssignment ||
    String(task.assignedToLabel || "").toLowerCase().includes("potrebna dodela")
  ) {
    return "warning";
  }
  if (task.status === "u_radu" || task.status === "dodeljen") return "active";
  return "muted";
}

function getProjectDueDate(projectDueDate: string | undefined, tasks: Task[]) {
  if (projectDueDate) return projectDueDate;
  const datedTasks = tasks
    .map((task) => task.dueDate)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return datedTasks[0];
}

function getWorkflowSummary(tasks: Task[]) {
  const workflowTasks = tasks
    .filter((task) => task.source === "template" || task.sequenceOrder)
    .slice()
    .sort(
      (first, second) =>
        (first.sequenceOrder || 999) - (second.sequenceOrder || 999),
    );
  const workflowProgress = getProjectProgress(workflowTasks);
  const activeTask = workflowTasks.find(
    (task) => task.status === "dodeljen" || task.status === "u_radu",
  );

  return {
    total: workflowProgress.totalTasks,
    completed: workflowProgress.completedTasks,
    activeTask,
    progress: workflowProgress.progressPercent,
  };
}

function ProjectDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const projectId = id ?? "";
  const { getProjectById } = useProjectStore();
  const { activeWorkspace, members } = useCloudStore();
  const project = getProjectById(projectId);
  const { tasks: allTasks, updateTask, addTask } = useTaskStore();
  const { getActiveBillingByProjectId, createBillingForProject, billing } = useBillingStore();
  const tasks = selectTasksByProject(allTasks, projectId);
  const activeBilling = getActiveBillingByProjectId(projectId);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isCreatingBilling, setIsCreatingBilling] = useState(false);
  const [marginPercent, setMarginPercent] = useState("30");
  const products = readProducts();
  const sourceProduct = products.find((product) => product.id === project?.sourceProductId);
  const projectSourceProductTitle = project?.sourceProductTitle || sourceProduct?.title || "";
  const workflowSummary = useMemo(() => getWorkflowSummary(tasks), [tasks]);
  const projectProgress = useMemo(() => getProjectProgress(tasks), [tasks]);
  const lifecycle = project ? getProjectLifecycle(project, tasks, billing) : null;
  const projectDueDate = getProjectDueDate(project?.dueDate, tasks);
  const projectUnitPrice = project?.unitPrice || sourceProduct?.price || 0;
  const projectQuantity =
    project?.quantity ||
    (projectUnitPrice && project?.value ? Math.round(project.value / projectUnitPrice) : 0);
  const projectTotalValue =
    project?.value ||
    (projectUnitPrice && projectQuantity ? projectUnitPrice * projectQuantity : 0);
  const projectCategory =
    project?.sourceProductCategory ||
    sourceProduct?.category ||
    (project?.type ? PROJECT_TYPE_LABELS[project.type] : "");
  const projectHasBilling = Boolean(lifecycle?.hasBilling);
  const billableTasks = useMemo(
    () =>
      project && !projectHasBilling
        ? getBillableTasksForProject(project, tasks, activeBilling ? [activeBilling] : [])
        : [],
    [activeBilling, project, projectHasBilling, tasks],
  );
  const billingGateMessage = project ? getBillingGateMessage(project, tasks) : "";
  const isProjectInSetup = lifecycle?.status === "setup";
  const displayProgressPercent = workflowSummary.total
    ? workflowSummary.progress
    : projectProgress.progressPercent;
  const displayProgressTotal = workflowSummary.total || projectProgress.totalTasks;
  const displayProgressCompleted = workflowSummary.total
    ? workflowSummary.completed
    : projectProgress.completedTasks;

  const billingPreview = useMemo(() => {
    const totalTimeMinutes = billableTasks.reduce(
      (sum, task) => sum + (task.timeSpentMinutes ?? 0),
      0,
    );
    const totalLaborCost = billableTasks.reduce(
      (sum, task) => sum + (task.laborCost ?? 0),
      0,
    );
    const totalMaterialCost = billableTasks.reduce(
      (sum, task) => sum + (task.materialCost ?? 0),
      0,
    );
    const netAmount = totalLaborCost + totalMaterialCost;
    const commercialAmount =
      typeof projectTotalValue === "number" && Number.isFinite(projectTotalValue) && projectTotalValue > 0
        ? Math.round(projectTotalValue)
        : 0;
    const margin = Number(marginPercent);
    const suggestedAmount =
      commercialAmount > 0
        ? commercialAmount
        : Number.isFinite(margin)
          ? Math.round(netAmount * (1 + margin / 100))
          : netAmount;
    return {
      taskCount: billableTasks.length,
      totalTimeMinutes,
      totalLaborCost,
      totalMaterialCost,
      netAmount,
      commercialAmount,
      suggestedAmount,
      marginPercent: commercialAmount > 0 ? 0 : Number.isFinite(margin) ? margin : 0,
    };
  }, [billableTasks, marginPercent]);

  useEffect(() => {
    if (!projectId) return;
    trackEvent("project_opened", {
      entityType: "project",
      entityId: projectId,
    });
  }, [projectId]);

  const handleCreateTask = (values: CreateTaskFormValues) => {
    if (!project) return;
    const timestamp = new Date().toISOString();
    const activeStage = project.stages?.find((stage) => stage.status === "active");
    const nextTask: Task = {
      id: makeId("task"),
      clientId: project.clientId,
      projectId: project.id,
      title: values.title.trim() || "Novi task",
      description: values.description.trim(),
      type: values.type || undefined,
      assignedToUserId: values.assignedToUserId,
      assignedToLabel: values.assignedToLabel.trim(),
      dueDate: values.dueDate || undefined,
      stageId: values.stageId || activeStage?.id,
      status: "dodeljen",
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      billingState: values.billingState,
    };
    void addTask(nextTask);
    setIsCreatingTask(false);
  };

  const handleCreateBilling = async () => {
    if (!project || billingPreview.taskCount === 0) return;
    const record = await createBillingForProject(project.id, {
      description: `Nalog za naplatu - ${project.title}`,
      amount: billingPreview.suggestedAmount,
      currency: "RSD",
      dueDate: null,
      invoiceNumber: "",
      taskCount: billingPreview.taskCount,
      totalTimeMinutes: billingPreview.totalTimeMinutes,
      totalLaborCost: billingPreview.totalLaborCost,
      totalMaterialCost: billingPreview.totalMaterialCost,
      totalCost: billingPreview.netAmount,
      marginPercent: billingPreview.marginPercent,
      netAmount: billingPreview.suggestedAmount,
    });
    const financeMember = members.find((member) => member.role === "finance");
    const supabase = getSupabaseClient();

    if (record && supabase && activeWorkspace?.id && project) {
      await supabase.from("billing_records").upsert(
        {
          id: record.id,
          workspace_id: activeWorkspace.id,
          client_id: String(project.clientId),
          project_id: String(project.id),
          client_name: record.clientName || "",
          project_name: project.title,
          description: record.description,
          amount: billingPreview.suggestedAmount,
          currency: "RSD",
          due_date: null,
          status: "ready",
          invoice_number: "",
          task_count: billingPreview.taskCount,
          total_tasks: billingPreview.taskCount,
          total_time_minutes: billingPreview.totalTimeMinutes,
          total_time: billingPreview.totalTimeMinutes,
          total_labor_cost: billingPreview.totalLaborCost,
          labor_cost: billingPreview.totalLaborCost,
          total_material_cost: billingPreview.totalMaterialCost,
          total_material: billingPreview.totalMaterialCost,
          total_cost: billingPreview.netAmount,
          margin_percent: billingPreview.marginPercent,
          margin: billingPreview.marginPercent,
          net_amount: billingPreview.suggestedAmount,
          total_with_margin: billingPreview.suggestedAmount,
          suggested_invoice_amount: billingPreview.suggestedAmount,
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
      billableTasks.forEach((task) => {
        void updateTask({
          ...task,
          billingId: record.id,
          billingState: "sent_to_billing",
          billingStatus: "sent_to_billing",
          updatedAt: new Date().toISOString(),
        });
      });
    }
    setIsCreatingBilling(false);
  };

  if (!project) {
    return (
      <section className="page-card client-detail-shell">
        <button
          type="button"
          className="secondary-link-button"
          onClick={() => navigate("/projects")}
        >
          Nazad na projekte
        </button>
        <div className="clients-empty-state">
          <h2>Projekat nije pronadjen</h2>
          <p>Vrati se na projekte i izaberi postojeci zapis.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-card client-detail-shell project-detail-clean">
      <button
        type="button"
        className="secondary-link-button"
        onClick={() => navigate("/projects")}
      >
        Nazad na projekte
      </button>

      <header className="customer-card-header project-detail-header-clean">
        <div>
          <p className="project-detail-eyebrow">
            {projectCategory || "Projekat"}
          </p>
          <h2 className="customer-card-title">{project.title}</h2>
          <p className="customer-card-subtitle">
            Proizvod: <strong>{projectSourceProductTitle || project.title}</strong>
            {projectQuantity ? ` · Kolicina: ${projectQuantity} kom` : ""}
          </p>
          <p className="customer-source-note">
            Rok: <strong>{formatDueDate(projectDueDate)}</strong>
            {workflowSummary.activeTask ? ` · Trenutni korak: ${workflowSummary.activeTask.title}` : ""}
          </p>
        </div>
        <div className="customer-project-badges">
          <span className={`customer-status-badge is-${lifecycle?.tone || "muted"}`}>
            {lifecycle?.label || PROJECT_STATUS_LABELS[project.status]}
          </span>
          {projectTotalValue ? (
            <span className="customer-status-badge is-info">
              {formatMoney(projectTotalValue)}
            </span>
          ) : null}
        </div>
      </header>

      <section className="project-info-strip" aria-label="Osnovni podaci projekta">
        <div>
          <span>Status</span>
          <strong>{lifecycle?.label || PROJECT_STATUS_LABELS[project.status]}</strong>
        </div>
        <div>
          <span>Tip</span>
          <strong>{project.type ? PROJECT_TYPE_LABELS[project.type] : "-"}</strong>
        </div>
        <div>
          <span>Rok</span>
          <strong>{formatDueDate(projectDueDate)}</strong>
        </div>
        <div>
          <span>Vrednost</span>
          <strong>{projectTotalValue ? formatMoney(projectTotalValue) : "-"}</strong>
        </div>
        <div>
          <span>Naplata</span>
          <strong>
            {activeBilling
              ? BILLING_STATUS_LABELS[activeBilling.status]
              : project.billingStatus
                ? BILLING_STATUS_LABELS[project.billingStatus]
                : "Nije poslato"}
          </strong>
        </div>
      </section>

      <section className="customer-card-section project-progress-section">
        <div className="customer-card-section-head">
          <h3>Koraci projekta</h3>
          <span className="customer-status-badge is-muted">
            {tasks.length
              ? `${displayProgressCompleted}/${displayProgressTotal} zavrseno · ${displayProgressPercent}%`
              : "Taskovi nisu kreirani"}
          </span>
        </div>
        <div className="project-progress-bar" aria-hidden="true">
          <span style={{ width: `${tasks.length ? displayProgressPercent : 0}%` }} />
        </div>
        {isProjectInSetup ? (
          <p className="customer-source-note">
            Projekat je kreiran, ali nema taskove. Dodaj task rucno ili pokreni posao iz kataloga/procesa.
          </p>
        ) : null}
        {tasks.some(
          (task) =>
            task.needsAssignment ||
            String(task.assignedToLabel || "").toLowerCase().includes("potrebna dodela"),
        ) ? (
          <p className="customer-source-note">
            Proces ima korake koji traze rucnu dodelu role.
          </p>
        ) : null}
      </section>

      <section className="customer-card-section project-billing-strip">
        <div className="customer-card-section-head">
          <h3>Naplata</h3>
          {!activeBilling && !billingGateMessage && !isProjectInSetup ? (
            <button
              type="button"
              className="customer-project-toggle"
              onClick={() => setIsCreatingBilling((current) => !current)}
            >
              {isCreatingBilling ? "Sakrij nalog" : "Kreiraj nalog za naplatu"}
            </button>
          ) : null}
        </div>
        {isProjectInSetup ? (
          <div className="project-billing-empty">
            <span>Naplata nije dostupna dok projekat nema taskove.</span>
            {projectTotalValue ? (
              <strong>Komercijalna vrednost: {formatMoney(projectTotalValue)}</strong>
            ) : null}
          </div>
        ) : billingGateMessage ? (
          <div className="project-billing-empty">
            <span>{billingGateMessage}</span>
            {projectTotalValue ? (
              <strong>Komercijalna vrednost: {formatMoney(projectTotalValue)}</strong>
            ) : null}
          </div>
        ) : null}
        {!activeBilling && !billingGateMessage && !isProjectInSetup && isCreatingBilling ? (
          <div className="customer-card-group">
            <h4>Predlog naloga za naplatu</h4>
            <dl className="customer-card-detail-list">
              <div>
                <dt>Broj taskova</dt>
                <dd>{billingPreview.taskCount}</dd>
              </div>
              <div>
                <dt>Ukupno vreme</dt>
                <dd>{billingPreview.totalTimeMinutes} min</dd>
              </div>
              <div>
                <dt>Rad / satnice</dt>
                <dd>{formatMoney(billingPreview.totalLaborCost)}</dd>
              </div>
              <div>
                <dt>Materijal</dt>
                <dd>{formatMoney(billingPreview.totalMaterialCost)}</dd>
              </div>
              <div>
                <dt>Neto interno</dt>
                <dd>{formatMoney(billingPreview.netAmount)}</dd>
              </div>
            </dl>
            <label className="pulse-form-field">
              <span>Marza / korekcija (%)</span>
              <input
                type="number"
                value={marginPercent}
                onChange={(event) => setMarginPercent(event.target.value)}
              />
            </label>
            <p>
              <strong>Predlog iznosa za Finance:</strong>{" "}
              {formatMoney(billingPreview.suggestedAmount)}
            </p>
            <div className="pulse-modal-actions">
              <button
                className="pulse-modal-btn pulse-modal-btn-blue"
                type="button"
                onClick={handleCreateBilling}
                disabled={billingPreview.taskCount === 0}
              >
                POSALJI NA FAKTURISANJE
              </button>
              <button
                className="pulse-modal-btn pulse-modal-btn-red"
                type="button"
                onClick={() => setIsCreatingBilling(false)}
              >
                OTKAZI
              </button>
            </div>
          </div>
        ) : null}
        {activeBilling ? (
          <BillingCard record={activeBilling} projectTitle={project.title} />
        ) : !billingGateMessage && !isCreatingBilling && !isProjectInSetup ? (
          <div className="project-billing-empty">
            <span>Nalog za naplatu nije kreiran.</span>
            {projectTotalValue ? (
              <strong>Komercijalna vrednost: {formatMoney(projectTotalValue)}</strong>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="customer-card-section project-tasks-section project-task-timeline-section">
        <div className="customer-card-section-head">
          <h3>Taskovi</h3>
          {lifecycle?.status === "active" || lifecycle?.status === "setup" ? (
            <button
              type="button"
              className="customer-project-toggle"
              onClick={() => setIsCreatingTask((current) => !current)}
            >
              {isCreatingTask ? "Sakrij formu" : "Novi task"}
            </button>
          ) : null}
        </div>
        {(lifecycle?.status === "active" || lifecycle?.status === "setup") && isCreatingTask ? (
          <CreateTaskForm
            onCancel={() => setIsCreatingTask(false)}
            onSubmit={handleCreateTask}
            requireProjectSelection={false}
            initialProjectId={project.id}
            projectOptions={[
              { id: project.id, label: project.title, stages: project.stages },
            ]}
          />
        ) : null}
        <div className="project-task-timeline">
          {tasks
            .slice()
            .sort(
              (first, second) =>
                (first.sequenceOrder || 999) - (second.sequenceOrder || 999),
            )
            .map((task, index) => (
              <button
                key={task.id}
                type="button"
                className={`project-task-line is-${getTaskTimelineTone(task)}`}
                onClick={() => navigate(`/tasks/${task.id}`)}
              >
                <span className="project-task-line-index">
                  {task.sequenceOrder || index + 1}.
                </span>
                <span className="project-task-line-title">{task.title}</span>
                <span className="project-task-line-meta">
                  {getTaskDoneLabel(task)}
                </span>
              </button>
            ))}
        </div>
      </section>
    </section>
  );
}

export default ProjectDetail;
