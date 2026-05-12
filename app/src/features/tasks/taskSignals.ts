import { getBillingReadyItems } from "../billing/billingSelectors";
import type { BillingRecord } from "../billing/types";
import type { Project } from "../projects/types";
import { isTaskCompleted } from "./taskLifecycle";
import type { Task } from "./types";

export type CommandCenterTaskSignal = {
  id: string;
  kind: "task_overdue" | "billing_ready";
  severity: "red" | "yellow";
  taskId?: string;
  projectId?: string;
  message: string;
};

function getTaskDueValue(task: Task) {
  const candidate = task as Task & {
    due_date?: string | null;
    deadline?: string | null;
    deleted?: boolean;
  };

  return candidate.dueDate || candidate.due_date || candidate.deadline || null;
}

export function getTaskDueDateValue(task: Task) {
  return getTaskDueValue(task);
}

function isDeletedTask(task: Task) {
  const candidate = task as Task & { deleted?: boolean };
  return Boolean(candidate.deleted);
}

function normalizeDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dayKey(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isTaskOverdue(task: Task, referenceDate: Date = new Date()) {
  if (isDeletedTask(task)) return false;
  if (isTaskCompleted(task)) return false;

  const rawStatus = String(task.status || "").toLowerCase();
  if (
    rawStatus === "completed" ||
    rawStatus === "paid" ||
    rawStatus === "archived" ||
    rawStatus === "naplacen" ||
    rawStatus === "zavrsen"
  ) {
    return false;
  }

  const dueValue = getTaskDueValue(task);
  const dueDate = normalizeDate(dueValue);
  if (!dueDate) return false;

  return dayKey(dueDate) < dayKey(referenceDate);
}

export function getTaskOverdueDays(task: Task, referenceDate: Date = new Date()) {
  if (!isTaskOverdue(task, referenceDate)) return 0;

  const dueValue = getTaskDueValue(task);
  const dueDate = normalizeDate(dueValue);
  if (!dueDate) return 0;

  return Math.max(
    0,
    Math.floor((dayKey(referenceDate) - dayKey(dueDate)) / 86400000),
  );
}

export function getOverdueTasks(tasks: Task[], referenceDate: Date = new Date()) {
  return tasks.filter((task) => isTaskOverdue(task, referenceDate));
}

export function getActionRequiredTasks(
  tasks: Task[],
  billingRecords: BillingRecord[],
  projects: Project[],
  referenceDate: Date = new Date(),
) {
  const overdueTasks = getOverdueTasks(tasks, referenceDate);
  const readyBilling = getBillingReadyItems(billingRecords);
  const projectIds = new Set(projects.map((project) => project.id));

  return {
    overdueTasks,
    readyBilling,
    affectedProjectCount: new Set(
      overdueTasks
        .map((task) => task.projectId)
        .filter((projectId): projectId is string => Boolean(projectId && projectIds.has(projectId))),
    ).size,
  };
}

export function buildCommandCenterSignals(
  tasks: Task[],
  billingRecords: BillingRecord[],
  projects: Project[],
  referenceDate: Date = new Date(),
): CommandCenterTaskSignal[] {
  const { overdueTasks, readyBilling } = getActionRequiredTasks(
    tasks,
    billingRecords,
    projects,
    referenceDate,
  );

  const overdueSignals = overdueTasks.map((task) => ({
    id: `task-overdue-${task.id}`,
    kind: "task_overdue" as const,
    severity: "red" as const,
    taskId: task.id,
    projectId: task.projectId || undefined,
    message: `${task.title || "Task"} kasni.`,
  }));

  const billingSignals = readyBilling.map((record) => ({
    id: `billing-ready-${record.id}`,
    kind: "billing_ready" as const,
    severity: "yellow" as const,
    projectId: record.projectId || undefined,
    message: `${record.projectName || record.description || "Naplata"} je spremna za fakturisanje.`,
  }));

  return [...overdueSignals, ...billingSignals];
}
