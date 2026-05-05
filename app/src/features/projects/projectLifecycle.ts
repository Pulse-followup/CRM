import type { BillingRecord } from '../billing/types'
import { getActiveTasks, getCompletedTasks } from '../tasks/taskSelectors'
import type { Task } from '../tasks/types'
import type { Project } from './types'

export type ProjectLifecycleStatus = 'active' | 'billing' | 'completed'

export interface ProjectLifecycleSummary {
  status: ProjectLifecycleStatus
  label: string
  tone: 'info' | 'warning' | 'success' | 'muted'
  activeTaskCount: number
  completedTaskCount: number
  totalTaskCount: number
  hasBilling: boolean
  billingStatus?: BillingRecord['status']
}

const BILLING_ACTIVE_STATUSES = new Set<BillingRecord['status']>(['ready', 'draft', 'invoiced', 'overdue'])
const BILLING_DONE_STATUSES = new Set<BillingRecord['status']>(['paid'])

export function getProjectLifecycle(project: Project, tasks: Task[], billingRecords: BillingRecord[] = []): ProjectLifecycleSummary {
  const projectTasks = tasks.filter((task) => String(task.projectId) === String(project.id))
  const projectBilling = billingRecords.filter((record) => String(record.projectId) === String(project.id))
  const activeBilling = projectBilling.find((record) => BILLING_ACTIVE_STATUSES.has(record.status))
  const paidBilling = projectBilling.find((record) => BILLING_DONE_STATUSES.has(record.status))
  const activeTaskCount = getActiveTasks(projectTasks).length
  const completedTaskCount = getCompletedTasks(projectTasks).length
  const totalTaskCount = projectTasks.length

  if (activeBilling) {
    return {
      status: 'billing',
      label: 'Na naplati',
      tone: activeBilling.status === 'overdue' ? 'warning' : 'info',
      activeTaskCount,
      completedTaskCount,
      totalTaskCount,
      hasBilling: true,
      billingStatus: activeBilling.status,
    }
  }

  if (activeTaskCount > 0) {
    return {
      status: 'active',
      label: 'Aktivan',
      tone: 'info',
      activeTaskCount,
      completedTaskCount,
      totalTaskCount,
      hasBilling: Boolean(paidBilling || project.billingId),
      billingStatus: paidBilling?.status || project.billingStatus,
    }
  }

  return {
    status: 'completed',
    label: paidBilling ? 'Zatvoren' : 'Završen',
    tone: paidBilling ? 'success' : 'success',
    activeTaskCount,
    completedTaskCount,
    totalTaskCount,
    hasBilling: Boolean(paidBilling || project.billingId),
    billingStatus: paidBilling?.status || project.billingStatus,
  }
}

export function getProjectLifecycleBucket(project: Project, tasks: Task[], billingRecords: BillingRecord[] = []) {
  return getProjectLifecycle(project, tasks, billingRecords).status
}
