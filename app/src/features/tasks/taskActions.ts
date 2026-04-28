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
  }
}

export function pauseTask(task: Task): Task {
  if (task.status !== 'u_radu') return task

  return {
    ...task,
    status: 'na_cekanju',
  }
}

export function resumeTask(task: Task): Task {
  if (task.status !== 'na_cekanju' && task.status !== 'vracen') return task

  return {
    ...task,
    status: 'u_radu',
  }
}

export function completeTask(task: Task, payload: CompleteTaskPayload): Task {
  if (task.status !== 'u_radu') return task

  return {
    ...task,
    status: 'zavrsen',
    timeSpentMinutes: payload.timeSpentMinutes,
    materialCost: payload.materialCost,
    materialDescription: payload.materialDescription || '',
  }
}
