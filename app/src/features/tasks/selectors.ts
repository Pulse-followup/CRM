import { mockTasks } from './mockTasks'
import type { Task } from './types'

export function getTasksByProjectId(projectId: string): Task[] {
  return mockTasks.filter((task) => task.projectId === projectId)
}

export function getTasksByClientId(clientId: string): Task[] {
  return mockTasks.filter((task) => task.clientId === clientId)
}

export function getTaskById(taskId: string): Task | null {
  return mockTasks.find((task) => task.id === taskId) ?? null
}
