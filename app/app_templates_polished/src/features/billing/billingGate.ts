import type { Project } from '../projects/types'
import { isTaskCompleted } from '../tasks/taskLifecycle'
import type { Task } from '../tasks/types'
import type { BillingRecord } from './types'

export function isCoveredBillingStatus(status?: string | null) {
  const normalized = String(status || '').toLowerCase()
  return Boolean(normalized && normalized !== 'cancelled' && normalized !== 'otkazano')
}

export function getProjectBillingRecord(project: Project, billing: BillingRecord[]) {
  return billing.find((record) => record.projectId === project.id && isCoveredBillingStatus(record.status)) ?? null
}

export function isProjectCoveredByBilling(project: Project, billing: BillingRecord[]) {
  return Boolean((project.billingId && isCoveredBillingStatus(project.billingStatus)) || getProjectBillingRecord(project, billing))
}

export function isSingleShotProject(project?: Project | null) {
  return !project || project.frequency === 'jednokratno' || project.source === 'product'
}

export function getWorkflowTasks(tasks: Task[]) {
  return tasks
    .filter((task) => task.source === 'template' || task.sequenceOrder)
    .slice()
    .sort((first, second) => (first.sequenceOrder || 999) - (second.sequenceOrder || 999))
}

export function isProjectFinishedForBilling(projectTasks: Task[]) {
  const workflowTasks = getWorkflowTasks(projectTasks)
  const tasksToCheck = workflowTasks.length ? workflowTasks : projectTasks
  return tasksToCheck.length > 0 && tasksToCheck.every(isTaskCompleted)
}

export function isTaskBillableDone(task: Task, project?: Project, billing: BillingRecord[] = [], projectTasks: Task[] = []) {
  if (!isTaskCompleted(task)) return false
  if (task.billingState === 'not_billable' || (!task.projectId && !task.billingState)) return false
  if (task.billingState === 'sent_to_billing' || task.billingState === 'billed' || task.billingId) return false
  if (project && isProjectCoveredByBilling(project, billing)) return false
  if (project && isSingleShotProject(project) && !isProjectFinishedForBilling(projectTasks)) return false
  return true
}

export function getBillableTasksForProject(project: Project, projectTasks: Task[], billing: BillingRecord[] = []) {
  return projectTasks.filter((task) => isTaskBillableDone(task, project, billing, projectTasks))
}

export function getBillingGateMessage(project: Project, projectTasks: Task[]) {
  if (!isSingleShotProject(project)) return ''
  const workflowTasks = getWorkflowTasks(projectTasks)
  const tasksToCheck = workflowTasks.length ? workflowTasks : projectTasks
  if (!tasksToCheck.length) return ''
  const completed = tasksToCheck.filter(isTaskCompleted).length
  if (completed === tasksToCheck.length) return ''
  return `Jednokratni projekat: naplata se otvara tek kada svi obavezni koraci budu zavrseni (${completed}/${tasksToCheck.length}).`
}
