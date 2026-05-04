import type { Task } from './types'

export interface CompleteTaskPayload {
  timeSpentMinutes: number
  materialCost: number
  materialDescription?: string
}

export function startTask(task: Task): Task {
  if (task.status !== 'dodeljen') return task

  return {
    ...task,
    status: 'u_radu',
    activatedAt: task.activatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function pauseTask(task: Task): Task {
  if (task.status !== 'u_radu') return task

  return {
    ...task,
    status: 'na_cekanju',
    updatedAt: new Date().toISOString(),
  }
}

export function resumeTask(task: Task): Task {
  if (task.status !== 'na_cekanju' && task.status !== 'vracen') return task

  return {
    ...task,
    status: 'u_radu',
    updatedAt: new Date().toISOString(),
  }
}

export function completeTask(task: Task, payload: CompleteTaskPayload): Task {
  if (task.status !== 'u_radu') return task

  const completedAt = new Date().toISOString()

  return {
    ...task,
    status: 'zavrsen',
    timeSpentMinutes: payload.timeSpentMinutes,
    materialCost: payload.materialCost,
    materialDescription: payload.materialDescription || '',
    completedAt,
    updatedAt: completedAt,
    billingState: task.billingState ?? 'not_billable',
  }
}