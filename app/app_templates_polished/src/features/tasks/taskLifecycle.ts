import type { Task, TaskStatus } from './types'

export type TaskLifecycleStatus = 'assigned' | 'in_progress' | 'waiting' | 'review' | 'billable' | 'archived'

export const ACTIVE_TASK_STATUSES: TaskStatus[] = ['dodeljen', 'u_radu', 'na_cekanju', 'vracen']
export const COMPLETED_TASK_STATUSES: TaskStatus[] = ['zavrsen', 'poslat_na_naplatu', 'naplacen']

export function isWorkflowWaitingTask(task: Task) {
  return task.status === 'na_cekanju' && Boolean(task.dependsOnTaskId)
}

export function isAdHocClientTask(task: Task) {
  return Boolean(task.clientId) && !task.projectId
}

export function isTaskOpen(task: Task) {
  return ACTIVE_TASK_STATUSES.includes(task.status) && !isWorkflowWaitingTask(task)
}

export function isTaskCompleted(task: Task) {
  const normalizedStatus = String(task.status || '').toLowerCase()
  return (
    normalizedStatus === 'completed' ||
    normalizedStatus === 'zavrsen' ||
    COMPLETED_TASK_STATUSES.includes(task.status) ||
    Boolean(task.completedAt) ||
    Boolean(task.finishedAt)
  )
}

export function isTaskArchived(task: Task) {
  return task.status === 'naplacen' || task.billingState === 'billed'
}

export function isTaskNonBillable(task: Task) {
  return task.billingState === 'not_billable' || !task.billingState
}

export function isTaskReadyForReview(task: Task) {
  return isTaskCompleted(task) && !isTaskArchived(task) && isTaskNonBillable(task)
}

export function getTaskLifecycleStatus(task: Task): TaskLifecycleStatus {
  if (isTaskArchived(task)) return 'archived'
  if (task.billingState === 'ready_for_billing' || task.billingState === 'sent_to_billing') return 'billable'
  if (isTaskCompleted(task)) return 'review'
  if (task.status === 'na_cekanju') return 'waiting'
  if (task.status === 'u_radu') return 'in_progress'
  return 'assigned'
}

export function getTaskContextLabel(task: Task, clientName: string, projectName?: string | null) {
  if (task.projectId && projectName) return projectName
  if (isAdHocClientTask(task)) return `${clientName} · Ad hoc`
  return projectName || 'Bez projekta'
}
