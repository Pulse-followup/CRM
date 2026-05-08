import type { BillingRecord } from './types'

export type BillingLifecycleStatus = 'none' | 'issued' | 'overdue' | 'closed' | 'cancelled'

function toDateKey(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function getBillingStatus(invoice?: BillingRecord | null): BillingLifecycleStatus {
  if (!invoice) return 'none'

  const normalizedStatus = String(invoice.status || '').toLowerCase()
  if (normalizedStatus === 'cancelled' || normalizedStatus === 'otkazano') return 'cancelled'
  if (normalizedStatus === 'paid' || normalizedStatus === 'closed' || normalizedStatus === 'placeno' || invoice.paidAt) {
    return 'closed'
  }

  const dueDateKey = toDateKey(invoice.dueDate)
  const today = new Date()
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  if (dueDateKey !== null && dueDateKey < todayKey) {
    return 'overdue'
  }

  return 'issued'
}
