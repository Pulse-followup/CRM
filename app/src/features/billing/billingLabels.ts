import type { BillingStatus } from './types'

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  draft: 'Za fakturisanje',
  invoiced: 'Fakturisano',
  overdue: 'Kasni',
  paid: 'Placeno',
  cancelled: 'Otkazano',
}

export const BILLING_STATUS_TONES: Record<BillingStatus, 'muted' | 'info' | 'warning' | 'success' | 'danger'> = {
  draft: 'info',
  invoiced: 'muted',
  overdue: 'warning',
  paid: 'success',
  cancelled: 'danger',
}
