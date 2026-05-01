import type { BillingRecord } from './types'

const ACTIVE_BILLING_STATUSES = new Set(['ready', 'draft', 'invoiced', 'overdue'])

export function getAllBilling(records: BillingRecord[]) {
  return records
}

export function getBillingById(records: BillingRecord[], id: string) {
  return records.find((record) => record.id === id) ?? null
}

export function getBillingByProjectId(records: BillingRecord[], projectId: string) {
  return records.filter((record) => record.projectId === projectId)
}

export function getActiveBillingByProjectId(records: BillingRecord[], projectId: string) {
  return (
    records.find(
      (record) => record.projectId === projectId && ACTIVE_BILLING_STATUSES.has(record.status),
    ) ?? null
  )
}

export function getBillingByClientId(records: BillingRecord[], clientId: string) {
  return records.filter((record) => record.clientId === clientId)
}

export function getBillingSummary(records: BillingRecord[]) {
  return records.reduce(
    (summary, record) => ({
      total: summary.total + 1,
      draft: summary.draft + (record.status === 'draft' || record.status === 'ready' ? 1 : 0),
      invoiced: summary.invoiced + (record.status === 'invoiced' ? 1 : 0),
      overdue: summary.overdue + (record.status === 'overdue' ? 1 : 0),
      paid: summary.paid + (record.status === 'paid' ? 1 : 0),
      cancelled: summary.cancelled + (record.status === 'cancelled' ? 1 : 0),
      totalAmount: summary.totalAmount + (record.amount ?? 0),
    }),
    {
      total: 0,
      draft: 0,
      invoiced: 0,
      overdue: 0,
      paid: 0,
      cancelled: 0,
      totalAmount: 0,
    },
  )
}
