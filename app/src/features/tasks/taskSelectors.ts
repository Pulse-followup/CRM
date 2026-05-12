import type { AppUser } from '../auth/types'
import type { Task, TaskBillingState, TaskStatus } from './types'
import { isTaskCompleted, isTaskOpen, isWorkflowWaitingTask } from './taskLifecycle'
import { getOverdueTasks, isTaskOverdue } from './taskSignals'

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getAllTasks(tasks: Task[]) {
  return tasks
}

export function getTaskById(tasks: Task[], taskId: string) {
  return tasks.find((task) => task.id === taskId) ?? null
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
  return isTaskOpen(task)
}

export function isTaskDone(task: Task) {
  return isTaskCompleted(task)
}

export function isTaskLate(task: Task, referenceDate: Date = new Date()) {
  return isTaskActive(task) && isTaskOverdue(task, referenceDate)
}

export function isTaskDueToday(task: Task, referenceDate: Date = new Date()) {
  if (!isTaskActive(task) || !task.dueDate) {
    return false
  }

  return task.dueDate === getDateKey(referenceDate)
}

export function getLateTasks(tasks: Task[], referenceDate: Date = new Date()) {
  return getOverdueTasks(tasks, referenceDate).filter(isTaskActive)
}

export function getTodayTasks(tasks: Task[], referenceDate: Date = new Date()) {
  return tasks.filter((task) => isTaskDueToday(task, referenceDate))
}

export function getActiveTasks(tasks: Task[]) {
  return tasks.filter(isTaskActive)
}

export function getCompletedTasks(tasks: Task[]) {
  return tasks.filter(isTaskCompleted)
}

export function getTasksReadyForBilling(tasks: Task[]) {
  return tasks.filter((task) => task.billingState === 'ready_for_billing')
}

export function getTasksByBillingState(tasks: Task[], billingState: TaskBillingState) {
  return tasks.filter((task) => task.billingState === billingState)
}


export function getCompletedTasksForUser(tasks: Task[], user: Pick<AppUser, 'id' | 'name'>) {
  return getTasksByUser(tasks, user.id, user.name).filter(isTaskCompleted)
}

export function getVisibleTasksForUser(tasks: Task[], user: Pick<AppUser, 'id' | 'name'>) {
  return getTasksByUser(tasks, user.id, user.name).filter(
    (task) => !isTaskCompleted(task) && (!task.billingState || task.billingState !== 'billed'),
  )
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

  const completedTasks = getCompletedTasksForUser(tasks, user)
    .sort((first, second) => new Date(second.completedAt || second.updatedAt || second.createdAt).getTime() - new Date(first.completedAt || first.updatedAt || first.createdAt).getTime())
    .slice(0, 10)

  return {
    late: lateTasks,
    today: todayTasks,
    inProgress: inProgressTasks,
    completed: completedTasks,
  }
}
