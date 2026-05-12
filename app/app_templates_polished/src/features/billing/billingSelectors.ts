import type { BillingRecord } from './types'
import { getBillingStatus } from './billingLifecycle'

const ACTIVE_BILLING_STATUSES = new Set(['ready', 'draft', 'invoiced', 'overdue'])

function isActiveBillingRecord(record: BillingRecord) {
  return record.status !== 'cancelled'
}

export function sumBillingAmount(records: BillingRecord[]) {
  return records.reduce((sum, record) => sum + (record.amount ?? 0), 0)
}

export function isBillingReadyRecord(record: BillingRecord) {
  return (
    isActiveBillingRecord(record) &&
    getBillingStatus(record) === 'issued' &&
    (record.status === 'draft' || record.status === 'ready')
  )
}

export function isBillingInvoicedRecord(record: BillingRecord) {
  return (
    isActiveBillingRecord(record) &&
    getBillingStatus(record) === 'issued' &&
    record.status === 'invoiced'
  )
}

export function isBillingOverdueRecord(record: BillingRecord) {
  return isActiveBillingRecord(record) && getBillingStatus(record) === 'overdue'
}

export function isBillingPaidRecord(record: BillingRecord) {
  return isActiveBillingRecord(record) && getBillingStatus(record) === 'closed'
}

export function isBillingPaidThisWeekRecord(record: BillingRecord) {
  if (!isBillingPaidRecord(record)) return false
  const value = record.paidAt || record.updatedAt || record.createdAt
  if (!value) return false
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekStart = new Date(today)
  const day = weekStart.getDay() || 7
  weekStart.setDate(weekStart.getDate() - day + 1)

  return date.getTime() >= weekStart.getTime()
}

export function getActiveBillingItems(records: BillingRecord[]) {
  return records.filter(isActiveBillingRecord)
}

export function getBillingReadyItems(records: BillingRecord[]) {
  return records.filter(isBillingReadyRecord)
}

export function getInvoicedItems(records: BillingRecord[]) {
  return records.filter(isBillingInvoicedRecord)
}

export function getOverdueBillingItems(records: BillingRecord[]) {
  return records.filter(isBillingOverdueRecord)
}

export function getPaidItems(records: BillingRecord[]) {
  return records.filter(isBillingPaidRecord)
}

export function getPaidThisWeekItems(records: BillingRecord[]) {
  return records.filter(isBillingPaidThisWeekRecord)
}

export function getBillingReadyTotal(records: BillingRecord[]) {
  return sumBillingAmount(getBillingReadyItems(records))
}

export function getBillingCollections(records: BillingRecord[]) {
  const active = getActiveBillingItems(records)
  const ready = getBillingReadyItems(active)
  const invoiced = getInvoicedItems(active)
  const overdue = getOverdueBillingItems(active)
  const paid = getPaidItems(active)
  const paidThisWeek = getPaidThisWeekItems(active)

  return {
    active,
    ready,
    invoiced,
    overdue,
    paid,
    paidThisWeek,
    readyTotal: sumBillingAmount(ready),
    invoicedTotal: sumBillingAmount(invoiced),
    overdueTotal: sumBillingAmount(overdue),
    paidWeekTotal: sumBillingAmount(paidThisWeek),
    openTotal: sumBillingAmount([...ready, ...invoiced, ...overdue]),
  }
}

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
      (record) => record.projectId === projectId && ACTIVE_BILLING_STATUSES.has(record.status) && getBillingStatus(record) !== 'closed',
    ) ?? null
  )
}

export function getBillingByClientId(records: BillingRecord[], clientId: string) {
  return records.filter((record) => record.clientId === clientId)
}

export function getBillingSummary(records: BillingRecord[]) {
  const collections = getBillingCollections(records)

  return {
    total: records.length,
    draft: collections.ready.length,
    invoiced: collections.invoiced.length,
    overdue: collections.overdue.length,
    paid: collections.paid.length,
    cancelled: records.filter((record) => record.status === 'cancelled').length,
    totalAmount: sumBillingAmount(collections.active),
  }
}
