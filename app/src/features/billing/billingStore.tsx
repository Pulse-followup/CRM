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
import { useCloudStore } from '../cloud/cloudStore'
import { useProjectStore } from '../projects/projectStore'
import { getSupabaseClient } from '../../lib/supabaseClient'
import {
  getActiveBillingByProjectId as selectActiveBillingByProjectId,
  getAllBilling as selectAllBilling,
  getBillingByClientId as selectBillingByClientId,
  getBillingById as selectBillingById,
  getBillingByProjectId as selectBillingByProjectId,
  getBillingSummary as selectBillingSummary,
} from './billingSelectors'
import { mockBilling } from './mockBilling'
import type { BillingRecord, BillingStatus, CreateBillingPayload } from './types'

const BILLING_STORAGE_KEY = 'pulse.billing.v1'

type CloudReadStatus = 'local' | 'loading' | 'cloud' | 'cloud-empty' | 'error'

interface BillingStoreValue {
  billing: BillingRecord[]
  isCloudBillingMode: boolean
  cloudReadStatus: CloudReadStatus
  cloudReadError: string | null
  refreshBillingFromCloud: () => Promise<void>
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

function isDueDateOverdue(dueDate?: string | null) {
  if (!dueDate) return false
  const date = new Date(dueDate)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

function normalizeRuntimeStatus(record: BillingRecord): BillingRecord {
  if (record.status === 'invoiced' && isDueDateOverdue(record.dueDate)) {
    return { ...record, status: 'overdue' }
  }
  return record
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function asNumberOrNull(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function normalizeBillingStatus(value: unknown): BillingStatus {
  const status = asString(value)
  if (['draft', 'invoiced', 'overdue', 'paid', 'cancelled'].includes(status)) return status as BillingStatus
  return 'draft'
}

function mapBillingRowToReact(row: Record<string, unknown>): BillingRecord {
  const createdAt = asString(row.created_at) || new Date().toISOString()
  return normalizeRuntimeStatus({
    id: asString(row.id),
    clientId: asString(row.client_id || row.clientId),
    projectId: asString(row.project_id || row.projectId),
    description: asString(row.description),
    amount: asNumberOrNull(row.amount),
    currency: asString(row.currency) || 'RSD',
    dueDate: asString(row.due_date || row.dueDate) || null,
    status: normalizeBillingStatus(row.status),
    invoiceNumber: asString(row.invoice_number || row.invoiceNumber),
    taskCount: asNumberOrNull(row.task_count || row.taskCount) ?? 0,
    totalTimeMinutes: asNumberOrNull(row.total_time_minutes || row.totalTimeMinutes) ?? 0,
    totalLaborCost: asNumberOrNull(row.total_labor_cost || row.totalLaborCost) ?? 0,
    totalMaterialCost: asNumberOrNull(row.total_material_cost || row.totalMaterialCost) ?? 0,
    totalCost: asNumberOrNull(row.total_cost || row.totalCost) ?? 0,
    marginPercent: asNumberOrNull(row.margin_percent || row.marginPercent) ?? 0,
    netAmount: asNumberOrNull(row.net_amount || row.netAmount) ?? 0,
    createdAt,
    updatedAt: asString(row.updated_at) || createdAt,
    invoicedAt: (row.invoiced_at as string | null | undefined) ?? null,
    paidAt: (row.paid_at as string | null | undefined) ?? null,
  })
}

function mapBillingToSupabaseRow(record: BillingRecord, workspaceId: string) {
  return {
    id: record.id,
    workspace_id: workspaceId,
    client_id: record.clientId,
    project_id: record.projectId,
    description: record.description || '',
    amount: record.amount,
    currency: record.currency || 'RSD',
    due_date: record.dueDate || null,
    status: record.status,
    invoice_number: record.invoiceNumber || '',
    task_count: record.taskCount ?? 0,
    total_time_minutes: record.totalTimeMinutes ?? 0,
    total_labor_cost: record.totalLaborCost ?? 0,
    total_material_cost: record.totalMaterialCost ?? 0,
    total_cost: record.totalCost ?? 0,
    margin_percent: record.marginPercent ?? 0,
    net_amount: record.netAmount ?? record.totalCost ?? 0,
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: record.updatedAt || new Date().toISOString(),
    invoiced_at: record.invoicedAt || null,
    paid_at: record.paidAt || null,
  }
}

export function BillingProvider({ children }: PropsWithChildren) {
  const { isConfigured, activeWorkspace } = useCloudStore()
  const isCloudBillingMode = Boolean(isConfigured && activeWorkspace?.id)
  const [localBilling, setLocalBilling] = useState<BillingRecord[]>(() =>
    readStoredArray(BILLING_STORAGE_KEY, mockBilling).map(normalizeRuntimeStatus),
  )
  const [cloudBilling, setCloudBilling] = useState<BillingRecord[]>([])
  const [cloudReadStatus, setCloudReadStatus] = useState<CloudReadStatus>('local')
  const [cloudReadError, setCloudReadError] = useState<string | null>(null)
  const billing = isCloudBillingMode ? cloudBilling : localBilling
  const { getProjectById, updateProject } = useProjectStore()

  useEffect(() => {
    if (!isCloudBillingMode) {
      writeStoredValue(BILLING_STORAGE_KEY, localBilling)
    }
  }, [isCloudBillingMode, localBilling])

  const persistCloudBilling = useCallback(
    async (record: BillingRecord) => {
      if (!isCloudBillingMode || !activeWorkspace?.id) return
      const supabase = getSupabaseClient()
      if (!supabase) return
      const { error } = await supabase
        .from('billing_records')
        .upsert(mapBillingToSupabaseRow(record, activeWorkspace.id), { onConflict: 'id' })
      if (error) {
        setCloudReadStatus('error')
        setCloudReadError(error.message)
      }
    },
    [activeWorkspace?.id, isCloudBillingMode],
  )

  const refreshBillingFromCloud = useCallback(async () => {
    const supabase = getSupabaseClient()
    if (!isConfigured || !supabase || !activeWorkspace?.id) {
      setCloudReadStatus('local')
      setCloudReadError(null)
      return
    }

    setCloudReadStatus('loading')
    setCloudReadError(null)

    const { data, error } = await supabase
      .from('billing_records')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .order('created_at', { ascending: false })

    if (error) {
      setCloudBilling([])
      setCloudReadStatus('error')
      setCloudReadError(error.message || 'Naplata nije ucitana iz Supabase-a.')
      return
    }

    const nextBilling = Array.isArray(data)
      ? data.map((row) => mapBillingRowToReact(row as Record<string, unknown>)).filter((record) => record.id && record.clientId && record.projectId)
      : []

    setCloudBilling(nextBilling)
    setCloudReadStatus(nextBilling.length ? 'cloud' : 'cloud-empty')

    nextBilling
      .filter((record) => record.status === 'overdue')
      .forEach((record) => void persistCloudBilling(record))
  }, [activeWorkspace?.id, isConfigured, persistCloudBilling])

  useEffect(() => {
    if (isCloudBillingMode) {
      setCloudBilling([])
      void refreshBillingFromCloud()
    }
  }, [activeWorkspace?.id, isCloudBillingMode, refreshBillingFromCloud])

  useEffect(() => {
    if (isCloudBillingMode) return
    setLocalBilling((current) => current.map(normalizeRuntimeStatus))
  }, [isCloudBillingMode])

  const syncProjectBilling = useCallback(
    (record: BillingRecord) => {
      const project = getProjectById(record.projectId)
      if (!project) return
      updateProject({
        ...project,
        billingId: record.id,
        billingStatus: record.status,
      })
    },
    [getProjectById, updateProject],
  )

  const replaceRecord = useCallback(
    (record: BillingRecord) => {
      const normalizedRecord = normalizeRuntimeStatus(record)
      if (isCloudBillingMode) {
        setCloudBilling((current) => {
          const exists = current.some((item) => item.id === normalizedRecord.id)
          return exists
            ? current.map((item) => (item.id === normalizedRecord.id ? normalizedRecord : item))
            : [normalizedRecord, ...current]
        })
        void persistCloudBilling(normalizedRecord)
      } else {
        setLocalBilling((current) => {
          const exists = current.some((item) => item.id === normalizedRecord.id)
          return exists
            ? current.map((item) => (item.id === normalizedRecord.id ? normalizedRecord : item))
            : [normalizedRecord, ...current]
        })
      }
      syncProjectBilling(normalizedRecord)
      return normalizedRecord
    },
    [isCloudBillingMode, persistCloudBilling, syncProjectBilling],
  )

  const createBillingForProject = useCallback(
    (projectId: string, payload: CreateBillingPayload) => {
      const existingRecord = selectActiveBillingByProjectId(billing, projectId)
      if (existingRecord) return existingRecord

      const project = getProjectById(projectId)
      if (!project) return null

      const timestamp = new Date().toISOString()
      const nextRecord: BillingRecord = {
        id: `billing-${Date.now()}`,
        clientId: project.clientId,
        projectId,
        description: payload.description.trim(),
        amount: Number.isFinite(payload.amount) ? payload.amount : null,
        currency: payload.currency.trim() || 'RSD',
        dueDate: payload.dueDate,
        status: 'draft',
        invoiceNumber: payload.invoiceNumber.trim(),
        taskCount: payload.taskCount ?? 0,
        totalTimeMinutes: payload.totalTimeMinutes ?? 0,
        totalLaborCost: payload.totalLaborCost ?? 0,
        totalMaterialCost: payload.totalMaterialCost ?? 0,
        totalCost: payload.totalCost ?? 0,
        marginPercent: payload.marginPercent ?? 0,
        netAmount: payload.netAmount ?? payload.totalCost ?? payload.amount ?? 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        invoicedAt: null,
        paidAt: null,
      }

      return replaceRecord(nextRecord)
    },
    [billing, getProjectById, replaceRecord],
  )

  const updateBillingRecord = useCallback(
    (billingId: string, patch: Partial<BillingRecord>) => {
      const currentRecord = selectBillingById(billing, billingId)
      if (!currentRecord) return null

      return replaceRecord({
        ...currentRecord,
        ...patch,
        updatedAt: new Date().toISOString(),
      })
    },
    [billing, replaceRecord],
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

  const getAllBilling = useCallback(() => selectAllBilling(billing.map(normalizeRuntimeStatus)), [billing])
  const getBillingById = useCallback((id: string) => selectBillingById(billing, id), [billing])
  const getBillingByProjectId = useCallback((projectId: string) => selectBillingByProjectId(billing, projectId), [billing])
  const getActiveBillingByProjectId = useCallback((projectId: string) => selectActiveBillingByProjectId(billing, projectId), [billing])
  const getBillingByClientId = useCallback((clientId: string) => selectBillingByClientId(billing, clientId), [billing])
  const getBillingSummary = useCallback(() => selectBillingSummary(billing.map(normalizeRuntimeStatus)), [billing])

  const value = useMemo<BillingStoreValue>(
    () => ({
      billing,
      isCloudBillingMode,
      cloudReadStatus,
      cloudReadError,
      refreshBillingFromCloud,
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
      isCloudBillingMode,
      cloudReadStatus,
      cloudReadError,
      refreshBillingFromCloud,
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
  if (!context) throw new Error('useBillingStore must be used within BillingProvider')
  return context
}
