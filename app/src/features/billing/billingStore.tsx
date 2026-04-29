import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { readStoredArray, writeStoredValue } from '../../shared/storage'
import { useProjectStore } from '../projects/projectStore'
import {
  getActiveBillingByProjectId as selectActiveBillingByProjectId,
  getAllBilling as selectAllBilling,
  getBillingByClientId as selectBillingByClientId,
  getBillingById as selectBillingById,
  getBillingByProjectId as selectBillingByProjectId,
  getBillingSummary as selectBillingSummary,
} from './billingSelectors'
import { mockBilling } from './mockBilling'
import type { BillingRecord, CreateBillingPayload } from './types'

const BILLING_STORAGE_KEY = 'pulse.billing.v1'

interface BillingStoreValue {
  billing: BillingRecord[]
  createBillingForProject: (projectId: string, payload: CreateBillingPayload) => BillingRecord | null
  updateBillingRecord: (billingId: string, patch: Partial<BillingRecord>) => BillingRecord | null
  markBillingInvoiced: (billingId: string) => BillingRecord | null
  markBillingOverdue: (billingId: string) => BillingRecord | null
  markBillingPaid: (billingId: string) => BillingRecord | null
  cancelBilling: (billingId: string) => BillingRecord | null
  getAllBilling: () => BillingRecord[]
  getBillingById: (id: string) => BillingRecord | null
  getBillingByProjectId: (projectId: string) => BillingRecord[]
  getActiveBillingByProjectId: (projectId: string) => BillingRecord | null
  getBillingByClientId: (clientId: string) => BillingRecord[]
  getBillingSummary: () => ReturnType<typeof selectBillingSummary>
}

const BillingStoreContext = createContext<BillingStoreValue | null>(null)

export function BillingProvider({ children }: PropsWithChildren) {
  const [billing, setBilling] = useState<BillingRecord[]>(() =>
    readStoredArray(BILLING_STORAGE_KEY, mockBilling),
  )
  const { getProjectById, updateProject } = useProjectStore()

  useEffect(() => {
    writeStoredValue(BILLING_STORAGE_KEY, billing)
  }, [billing])

  const syncProjectBilling = useCallback(
    (record: BillingRecord) => {
      const project = getProjectById(record.projectId)

      if (!project) {
        return
      }

      updateProject({
        ...project,
        billingId: record.id,
        billingStatus: record.status,
      })
    },
    [getProjectById, updateProject],
  )

  const createBillingForProject = useCallback(
    (projectId: string, payload: CreateBillingPayload) => {
      const existingRecord = selectActiveBillingByProjectId(billing, projectId)

      if (existingRecord) {
        return existingRecord
      }

      const project = getProjectById(projectId)

      if (!project) {
        return null
      }

      const timestamp = new Date().toISOString()
      const nextRecord: BillingRecord = {
        id: `billing-${Date.now()}`,
        clientId: project.clientId,
        projectId,
        description: payload.description.trim(),
        amount: payload.amount,
        currency: payload.currency.trim() || 'RSD',
        dueDate: payload.dueDate,
        status: 'draft',
        invoiceNumber: payload.invoiceNumber.trim(),
        totalLaborCost: payload.totalLaborCost ?? 0,
        totalMaterialCost: payload.totalMaterialCost ?? 0,
        totalCost: payload.totalCost ?? 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        invoicedAt: null,
        paidAt: null,
      }

      setBilling((current) => [nextRecord, ...current])
      syncProjectBilling(nextRecord)
      return nextRecord
    },
    [billing, getProjectById, syncProjectBilling],
  )

  const updateBillingRecord = useCallback(
    (billingId: string, patch: Partial<BillingRecord>) => {
      const currentRecord = selectBillingById(billing, billingId)

      if (!currentRecord) {
        return null
      }

      const updatedRecord: BillingRecord = {
        ...currentRecord,
        ...patch,
        updatedAt: new Date().toISOString(),
      }

      setBilling((current) =>
        current.map((record) => (record.id === billingId ? updatedRecord : record)),
      )
      syncProjectBilling(updatedRecord)
      return updatedRecord
    },
    [billing, syncProjectBilling],
  )

  const markBillingInvoiced = useCallback(
    (billingId: string) =>
      updateBillingRecord(billingId, {
        status: 'invoiced',
        invoicedAt: new Date().toISOString(),
      }),
    [updateBillingRecord],
  )

  const markBillingOverdue = useCallback(
    (billingId: string) => updateBillingRecord(billingId, { status: 'overdue' }),
    [updateBillingRecord],
  )

  const markBillingPaid = useCallback(
    (billingId: string) =>
      updateBillingRecord(billingId, {
        status: 'paid',
        paidAt: new Date().toISOString(),
      }),
    [updateBillingRecord],
  )

  const cancelBilling = useCallback(
    (billingId: string) => updateBillingRecord(billingId, { status: 'cancelled' }),
    [updateBillingRecord],
  )

  const getAllBilling = useCallback(() => selectAllBilling(billing), [billing])
  const getBillingById = useCallback((id: string) => selectBillingById(billing, id), [billing])
  const getBillingByProjectId = useCallback(
    (projectId: string) => selectBillingByProjectId(billing, projectId),
    [billing],
  )
  const getActiveBillingByProjectId = useCallback(
    (projectId: string) => selectActiveBillingByProjectId(billing, projectId),
    [billing],
  )
  const getBillingByClientId = useCallback(
    (clientId: string) => selectBillingByClientId(billing, clientId),
    [billing],
  )
  const getBillingSummary = useCallback(() => selectBillingSummary(billing), [billing])

  const value = useMemo<BillingStoreValue>(
    () => ({
      billing,
      createBillingForProject,
      updateBillingRecord,
      markBillingInvoiced,
      markBillingOverdue,
      markBillingPaid,
      cancelBilling,
      getAllBilling,
      getBillingById,
      getBillingByProjectId,
      getActiveBillingByProjectId,
      getBillingByClientId,
      getBillingSummary,
    }),
    [
      billing,
      createBillingForProject,
      updateBillingRecord,
      markBillingInvoiced,
      markBillingOverdue,
      markBillingPaid,
      cancelBilling,
      getAllBilling,
      getBillingById,
      getBillingByProjectId,
      getActiveBillingByProjectId,
      getBillingByClientId,
      getBillingSummary,
    ],
  )

  return <BillingStoreContext.Provider value={value}>{children}</BillingStoreContext.Provider>
}

export function useBillingStore() {
  const context = useContext(BillingStoreContext)

  if (!context) {
    throw new Error('useBillingStore must be used within BillingProvider')
  }

  return context
}
