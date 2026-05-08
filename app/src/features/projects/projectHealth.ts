import { isTaskCompleted, isTaskOpen } from '../tasks/taskLifecycle'
import type { Task } from '../tasks/types'

export type ProjectHealthKey = 'no_tasks' | 'late' | 'waiting' | 'active' | 'done'
export type ProjectHealthTone = 'muted' | 'danger' | 'warning' | 'info' | 'success'

export interface ProjectHealth {
  key: ProjectHealthKey
  label: string
  tone: ProjectHealthTone
}

function isPastDue(value?: string) {
  if (!value) return false

  const dueDate = new Date(value)
  if (Number.isNaN(dueDate.getTime())) return false

  const today = new Date()
  const dueDateKey = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime()
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  return dueDateKey < todayKey
}

export function getProjectHealth(projectId: string, tasks: Task[]): ProjectHealth {
  const projectTasks = tasks.filter((task) => task.projectId === projectId)

  if (projectTasks.length === 0) {
    return {
      key: 'no_tasks',
      label: 'Nema taskova',
      tone: 'muted',
    }
  }

  const hasLateTask = projectTasks.some((task) => isTaskOpen(task) && isPastDue(task.dueDate))

  if (hasLateTask) {
    return {
      key: 'late',
      label: 'Kasni',
      tone: 'danger',
    }
  }

  const hasWaitingTask = projectTasks.some((task) => task.status === 'na_cekanju' && !task.dependsOnTaskId)

  if (hasWaitingTask) {
    return {
      key: 'waiting',
      label: 'Na cekanju',
      tone: 'warning',
    }
  }

  const hasActiveTask = projectTasks.some(isTaskOpen)

  if (hasActiveTask) {
    return {
      key: 'active',
      label: 'U toku',
      tone: 'info',
    }
  }

  const allDone = projectTasks.length > 0 && projectTasks.every(isTaskCompleted)

  if (allDone) {
    return {
      key: 'done',
      label: 'Zavrseno',
      tone: 'success',
    }
  }

  return {
    key: 'no_tasks',
    label: 'Nema taskova',
    tone: 'muted',
  }
}
