export type BillingStatus = 'draft' | 'invoiced' | 'overdue' | 'paid' | 'cancelled'

export interface BillingRecord {
  id: string
  clientId: string
  projectId: string
  description: string
  amount: number | null
  currency: string
  dueDate: string | null
  status: BillingStatus
  invoiceNumber: string
  taskCount?: number
  totalTimeMinutes?: number
  totalLaborCost?: number
  totalMaterialCost?: number
  totalCost?: number
  marginPercent?: number
  netAmount?: number
  createdAt: string
  updatedAt: string
  invoicedAt?: string | null
  paidAt?: string | null
}

export interface CreateBillingPayload {
  description: string
  amount: number
  currency: string
  dueDate: string | null
  invoiceNumber: string
  taskCount?: number
  totalTimeMinutes?: number
  totalLaborCost?: number
  totalMaterialCost?: number
  totalCost?: number
  marginPercent?: number
  netAmount?: number
}
