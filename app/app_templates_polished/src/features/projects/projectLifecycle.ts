import { getBillingStatus } from '../billing/billingLifecycle'
import type { BillingRecord } from '../billing/types'
import { isTaskCompleted } from '../tasks/taskLifecycle'
import type { Task } from '../tasks/types'
import type { Project } from './types'

export type ProjectLifecycleStatus = 'setup' | 'active' | 'completed' | 'billing' | 'overdue' | 'closed'

export interface ProjectProgressSummary {
  totalTasks: number
  completedTasks: number
  progressPercent: number
}

export interface ProjectLifecycleSummary {
  status: ProjectLifecycleStatus
  label: string
  tone: 'info' | 'warning' | 'success' | 'muted'
  activeTaskCount: number
  completedTaskCount: number
  totalTaskCount: number
  progressPercent: number
  hasBilling: boolean
  billingStatus?: BillingRecord['status'] | 'issued' | 'closed'
  isClosed: boolean
}

function belongsToProject(task: Task, projectId: string) {
  return Boolean(task.projectId) && String(task.projectId) === String(projectId)
}

export function getProjectProgress(projectTasks: Task[]): ProjectProgressSummary {
  const totalTasks = projectTasks.length
  const completedTasks = projectTasks.filter(isTaskCompleted).length

  return {
    totalTasks,
    completedTasks,
    progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
  }
}

export function getProjectLifecycle(project: Project, tasks: Task[], billingRecords: BillingRecord[] = []): ProjectLifecycleSummary {
  const projectTasks = tasks.filter((task) => belongsToProject(task, project.id))
  const projectBilling = billingRecords.filter((record) => String(record.projectId) === String(project.id))
  const overdueBilling = projectBilling.find((record) => getBillingStatus(record) === 'overdue')
  const issuedBilling = projectBilling.find((record) => getBillingStatus(record) === 'issued')
  const closedBilling = projectBilling.find((record) => getBillingStatus(record) === 'closed')
  const progress = getProjectProgress(projectTasks)
  const openTaskCount = projectTasks.filter((task) => !isTaskCompleted(task)).length

  if (overdueBilling) {
    return {
      status: 'overdue',
      label: 'Kasni',
      tone: 'warning',
      activeTaskCount: openTaskCount,
      completedTaskCount: progress.completedTasks,
      totalTaskCount: progress.totalTasks,
      progressPercent: progress.progressPercent,
      hasBilling: true,
      billingStatus: overdueBilling.status,
      isClosed: false,
    }
  }

  if (issuedBilling) {
    return {
      status: 'billing',
      label: 'Na naplati',
      tone: 'info',
      activeTaskCount: openTaskCount,
      completedTaskCount: progress.completedTasks,
      totalTaskCount: progress.totalTasks,
      progressPercent: progress.progressPercent,
      hasBilling: true,
      billingStatus: 'issued',
      isClosed: false,
    }
  }

  if (closedBilling) {
    return {
      status: 'closed',
      label: 'Zatvoren',
      tone: 'success',
      activeTaskCount: 0,
      completedTaskCount: progress.completedTasks,
      totalTaskCount: progress.totalTasks,
      progressPercent: progress.progressPercent,
      hasBilling: true,
      billingStatus: 'closed',
      isClosed: true,
    }
  }

  if (progress.totalTasks === 0) {
    return {
      status: 'setup',
      label: 'U pripremi',
      tone: 'warning',
      activeTaskCount: 0,
      completedTaskCount: 0,
      totalTaskCount: 0,
      progressPercent: 0,
      hasBilling: false,
      isClosed: false,
    }
  }

  if (openTaskCount > 0) {
    return {
      status: 'active',
      label: 'Aktivan',
      tone: 'info',
      activeTaskCount: openTaskCount,
      completedTaskCount: progress.completedTasks,
      totalTaskCount: progress.totalTasks,
      progressPercent: progress.progressPercent,
      hasBilling: false,
      isClosed: false,
    }
  }

  return {
    status: 'completed',
    label: 'Zavrsen',
    tone: 'success',
    activeTaskCount: 0,
    completedTaskCount: progress.completedTasks,
    totalTaskCount: progress.totalTasks,
    progressPercent: progress.progressPercent,
    hasBilling: false,
    isClosed: false,
  }
}

export function getProjectLifecycleBucket(project: Project, tasks: Task[], billingRecords: BillingRecord[] = []) {
  return getProjectLifecycle(project, tasks, billingRecords).status
}

export function isProjectOperationallyActive(project: Project, tasks: Task[], billingRecords: BillingRecord[] = []) {
  return getProjectLifecycle(project, tasks, billingRecords).status === 'active'
}
