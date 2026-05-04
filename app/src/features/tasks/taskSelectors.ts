import type { AppUser } from '../auth/types'
import type { Task, TaskBillingState, TaskStatus } from './types'

const ACTIVE_TASK_STATUSES: TaskStatus[] = ['dodeljen', 'u_radu', 'na_cekanju', 'vracen']
const COMPLETED_TASK_STATUSES: TaskStatus[] = ['zavrsen', 'poslat_na_naplatu', 'naplacen']

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseDateOnly(value?: string) {
  if (!value) {
    return null
  }

  const parsed = new Date(`${value}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getAllTasks(tasks: Task[]) {
  return tasks
}

export function getTaskById(tasks: Task[], taskId: string) {
  return tasks.find((task) => task.id === taskId) ?? null
}

export function isWorkflowWaitingTask(task: Task) {
  return task.status === 'na_cekanju' && Boolean(task.dependsOnTaskId)
}

export function getTasksByUser(tasks: Task[], userId: string, fallbackName?: string) {
  return tasks.filter((task) => {
    if (isWorkflowWaitingTask(task)) return false

    if (task.assignedToUserId) {
      return task.assignedToUserId === userId
    }

    return Boolean(fallbackName && task.assignedToLabel === fallbackName)
  })
}

export function getTasksByStatus(tasks: Task[], status: TaskStatus) {
  return tasks.filter((task) => task.status === status)
}

export function getTasksByClient(tasks: Task[], clientId: string) {
  return tasks.filter((task) => task.clientId === clientId)
}

export function getTasksByProject(tasks: Task[], projectId: string) {
  return tasks.filter((task) => task.projectId === projectId)
}

export function getTasksByStage(tasks: Task[], stageId: string) {
  return tasks.filter((task) => task.stageId === stageId)
}

export function getTasksWithoutStage(tasks: Task[]) {
  return tasks.filter((task) => !task.stageId)
}

export function isTaskActive(task: Task) {
  return ACTIVE_TASK_STATUSES.includes(task.status) && !isWorkflowWaitingTask(task)
}

export function isTaskDone(task: Task) {
  return task.status === 'zavrsen'
}

export function isTaskLate(task: Task, referenceDate: Date = new Date()) {
  if (!isTaskActive(task) || !task.dueDate) {
    return false
  }

  const dueDate = parseDateOnly(task.dueDate)

  if (!dueDate) {
    return false
  }

  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)

  return dueDate.getTime() < today.getTime()
}

export function isTaskDueToday(task: Task, referenceDate: Date = new Date()) {
  if (!isTaskActive(task) || !task.dueDate) {
    return false
  }

  return task.dueDate === getDateKey(referenceDate)
}

export function getLateTasks(tasks: Task[], referenceDate: Date = new Date()) {
  return tasks.filter((task) => isTaskLate(task, referenceDate))
}

export function getTodayTasks(tasks: Task[], referenceDate: Date = new Date()) {
  return tasks.filter((task) => isTaskDueToday(task, referenceDate))
}

export function getActiveTasks(tasks: Task[]) {
  return tasks.filter(isTaskActive)
}

export function getCompletedTasks(tasks: Task[]) {
  return tasks.filter((task) => COMPLETED_TASK_STATUSES.includes(task.status))
}

export function getTasksReadyForBilling(tasks: Task[]) {
  return tasks.filter((task) => task.billingState === 'ready_for_billing')
}

export function getTasksByBillingState(tasks: Task[], billingState: TaskBillingState) {
  return tasks.filter((task) => task.billingState === billingState)
}

export function getUserTaskBuckets(tasks: Task[], user: Pick<AppUser, 'id' | 'name'>) {
  const userTasks = getTasksByUser(tasks, user.id, user.name)
  const lateTasks = getLateTasks(userTasks)
  const todayTasks = getTodayTasks(userTasks)
  const lateIds = new Set(lateTasks.map((task) => task.id))
  const todayIds = new Set(todayTasks.map((task) => task.id))
  const inProgressTasks = getActiveTasks(userTasks).filter(
    (task) => !lateIds.has(task.id) && !todayIds.has(task.id),
  )

  return {
    late: lateTasks,
    today: todayTasks,
    inProgress: inProgressTasks,
  }
}
