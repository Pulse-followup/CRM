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
import { useAuthStore } from '../auth/authStore'
import { useCloudStore } from '../cloud/cloudStore'
import { useNotificationStore } from '../notifications/notificationStore'
import { useProjectStore } from '../projects/projectStore'
import { useTaskStore } from '../tasks/taskStore'
import { getBillingStatus } from './billingLifecycle'
import { isProjectFinishedForBilling, isSingleShotProject } from './billingGate'
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
  createBillingForProject: (projectId: string, payload: CreateBillingPayload) => Promise<BillingRecord | null>
  updateBillingRecord: (billingId: string, patch: Partial<BillingRecord>) => Promise<BillingRecord | null>
  markBillingInvoiced: (billingId: string) => Promise<BillingRecord | null>
  markBillingOverdue: (billingId: string) => Promise<BillingRecord | null>
  markBillingPaid: (billingId: string) => Promise<BillingRecord | null>
  cancelBilling: (billingId: string) => Promise<BillingRecord | null>
  getAllBilling: () => BillingRecord[]
  getBillingById: (id: string) => BillingRecord | null
  getBillingByProjectId: (projectId: string) => BillingRecord[]
  getActiveBillingByProjectId: (projectId: string) => BillingRecord | null
  getBillingByClientId: (clientId: string) => BillingRecord[]
  getBillingSummary: () => ReturnType<typeof selectBillingSummary>
}

const BillingStoreContext = createContext<BillingStoreValue | null>(null)

function normalizeRuntimeStatus(record: BillingRecord): BillingRecord {
  if (getBillingStatus(record) === 'closed' && record.status !== 'paid') {
    return { ...record, status: 'paid' }
  }
  if (getBillingStatus(record) === 'overdue' && record.status !== 'overdue') {
    return { ...record, status: 'overdue' }
  }
  return record
}

function isActiveOrClosedBilling(record?: BillingRecord | null) {
  return Boolean(record && record.status !== 'cancelled')
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
  const status = asString(value).toLowerCase()
  if (status === 'za_fakturisanje' || status === 'za-fakturisanje' || status === 'ready_for_invoice' || status === 'sent_to_finance') return 'ready'
  if (status === 'fakturisano' || status === 'invoiced') return 'invoiced'
  if (status === 'placeno' || status === 'paid') return 'paid'
  if (status === 'kasni' || status === 'overdue') return 'overdue'
  if (status === 'otkazano' || status === 'cancelled') return 'cancelled'
  if (status === 'draft' || status === 'ready') return status as BillingStatus
  return 'ready'
}

function makeBillingId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `billing-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function mapBillingRowToReact(row: Record<string, unknown>): BillingRecord {
  const createdAt = asString(row.created_at) || new Date().toISOString()
  const totalCost = asNumberOrNull(row.total_cost ?? row.totalCost) ?? 0
  const amount = asNumberOrNull(row.amount ?? row.invoice_amount ?? row.suggested_invoice_amount ?? row.total_with_margin ?? row.net_amount ?? totalCost)
  return normalizeRuntimeStatus({
    id: asString(row.id),
    clientId: asString(row.client_id ?? row.clientId),
    projectId: asString(row.project_id ?? row.projectId),
    clientName: asString(row.client_name ?? row.clientName),
    projectName: asString(row.project_name ?? row.projectName),
    description: asString(row.description ?? row.invoice_description ?? row.project_name ?? row.projectName),
    amount,
    currency: asString(row.currency) || 'RSD',
    dueDate: asString(row.due_date ?? row.dueDate) || null,
    status: normalizeBillingStatus(row.status),
    invoiceNumber: asString(row.invoice_number ?? row.invoiceNumber),
    taskCount: asNumberOrNull(row.task_count ?? row.taskCount ?? row.total_tasks) ?? 0,
    totalTimeMinutes: asNumberOrNull(row.total_time_minutes ?? row.totalTimeMinutes ?? row.total_time) ?? 0,
    totalLaborCost: asNumberOrNull(row.total_labor_cost ?? row.totalLaborCost ?? row.labor_cost) ?? 0,
    totalMaterialCost: asNumberOrNull(row.total_material_cost ?? row.totalMaterialCost ?? row.total_material) ?? 0,
    totalCost,
    marginPercent: asNumberOrNull(row.margin_percent ?? row.marginPercent ?? row.margin) ?? 0,
    netAmount: asNumberOrNull(row.net_amount ?? row.netAmount ?? row.total_with_margin ?? amount ?? totalCost) ?? 0,
    createdAt,
    updatedAt: asString(row.updated_at) || createdAt,
    invoicedAt: (row.invoiced_at as string | null | undefined) ?? null,
    paidAt: (row.paid_at as string | null | undefined) ?? null,
  })
}

function mapBillingToSupabaseRow(record: BillingRecord, workspaceId: string) {
  const amount = record.amount ?? record.netAmount ?? record.totalCost ?? 0
  return {
    id: record.id,
    workspace_id: workspaceId,
    client_id: String(record.clientId || ''),
    project_id: String(record.projectId || ''),
    client_name: record.clientName || '',
    project_name: record.projectName || record.description || '',
    description: record.description || '',
    amount,
    currency: record.currency || 'RSD',
    due_date: record.dueDate || null,
    status: normalizeBillingStatus(record.status),
    invoice_number: record.invoiceNumber || '',
    invoice_description: record.description || '',
    invoice_amount: amount,
    task_count: record.taskCount ?? 0,
    total_tasks: record.taskCount ?? 0,
    total_time_minutes: record.totalTimeMinutes ?? 0,
    total_time: record.totalTimeMinutes ?? 0,
    total_labor_cost: record.totalLaborCost ?? 0,
    labor_cost: record.totalLaborCost ?? 0,
    total_material_cost: record.totalMaterialCost ?? 0,
    total_material: record.totalMaterialCost ?? 0,
    total_cost: record.totalCost ?? 0,
    margin_percent: record.marginPercent ?? 0,
    margin: record.marginPercent ?? 0,
    net_amount: record.netAmount ?? record.totalCost ?? amount,
    total_with_margin: amount,
    suggested_invoice_amount: amount,
    source: 'pulse',
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: record.updatedAt || new Date().toISOString(),
    invoiced_at: record.invoicedAt || null,
    paid_at: record.paidAt || null,
  }
}

function mapBillingToMinimalSupabaseRow(record: BillingRecord, workspaceId: string) {
  const amount = record.amount ?? record.netAmount ?? record.totalCost ?? 0
  return {
    id: record.id,
    workspace_id: workspaceId,
    client_id: String(record.clientId || ''),
    project_id: String(record.projectId || ''),
    description: record.description || record.projectName || '',
    amount,
    currency: record.currency || 'RSD',
    due_date: record.dueDate || null,
    status: normalizeBillingStatus(record.status),
    invoice_number: record.invoiceNumber || '',
    total_labor_cost: record.totalLaborCost ?? 0,
    total_material_cost: record.totalMaterialCost ?? 0,
    total_cost: record.totalCost ?? 0,
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: record.updatedAt || new Date().toISOString(),
    invoiced_at: record.invoicedAt || null,
    paid_at: record.paidAt || null,
  }
}

function mergeBillingRows(records: BillingRecord[]) {
  const map = new Map<string, BillingRecord>()
  records.forEach((record) => {
    if (!record.id) return
    map.set(record.id, record)
  })
  return Array.from(map.values()).sort((left, right) => (right.createdAt || '').localeCompare(left.createdAt || ''))
}

export function BillingProvider({ children }: PropsWithChildren) {
  const { isConfigured, activeWorkspace, members } = useCloudStore()
  const { users } = useAuthStore()
  const { createNotifications } = useNotificationStore()
  const isCloudBillingMode = Boolean(isConfigured && activeWorkspace?.id)
  const [localBilling, setLocalBilling] = useState<BillingRecord[]>(() =>
    readStoredArray(BILLING_STORAGE_KEY, mockBilling).map(normalizeRuntimeStatus),
  )
  const [cloudBilling, setCloudBilling] = useState<BillingRecord[]>([])
  const [cloudReadStatus, setCloudReadStatus] = useState<CloudReadStatus>('local')
  const [cloudReadError, setCloudReadError] = useState<string | null>(null)
  const billing = isCloudBillingMode ? cloudBilling : localBilling
  const { getProjectById, updateProject } = useProjectStore()
  const { getTasksByProjectId } = useTaskStore()

  useEffect(() => {
    if (!isCloudBillingMode) {
      writeStoredValue(BILLING_STORAGE_KEY, localBilling)
    }
  }, [isCloudBillingMode, localBilling])

  const persistCloudBilling = useCallback(
    async (record: BillingRecord) => {
      if (!isCloudBillingMode || !activeWorkspace?.id) return null
      const supabase = getSupabaseClient()
      if (!supabase) return null

      const fullRow = mapBillingToSupabaseRow(record, activeWorkspace.id)
      let savedRow: Record<string, unknown> | null = null
      let lastError: { message?: string } | null = null

      const first = await supabase.from('billing_records').upsert(fullRow, { onConflict: 'id' }).select('*').single()
      if (first.error) {
        lastError = first.error
        const minimalRow = mapBillingToMinimalSupabaseRow(record, activeWorkspace.id)
        const second = await supabase.from('billing_records').upsert(minimalRow, { onConflict: 'id' }).select('*').single()
        if (second.error) {
          lastError = second.error
        } else {
          savedRow = second.data as Record<string, unknown>
        }
      } else {
        savedRow = first.data as Record<string, unknown>
      }

      if (!savedRow) {
        // Last-resort compatibility with the old legacy table. Finance read also checks this table.
        const legacy = await supabase.from('billing').upsert(mapBillingToMinimalSupabaseRow(record, activeWorkspace.id), { onConflict: 'id' }).select('*').single()
        if (legacy.error) {
          setCloudReadStatus('error')
          setCloudReadError(legacy.error.message || lastError?.message || 'Nalog za naplatu nije upisan u Supabase.')
          return null
        }
        savedRow = legacy.data as Record<string, unknown>
      }

      const savedRecord = mapBillingRowToReact(savedRow)
      setCloudBilling((current) => mergeBillingRows([savedRecord, ...current]))
      setCloudReadStatus('cloud')
      setCloudReadError(null)
      return savedRecord
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

    const recordQuery = await supabase
      .from('billing_records')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .order('created_at', { ascending: false })

    const legacyQuery = await supabase
      .from('billing')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .order('created_at', { ascending: false })

    if (recordQuery.error && legacyQuery.error) {
      setCloudBilling([])
      setCloudReadStatus('error')
      setCloudReadError(recordQuery.error.message || legacyQuery.error.message || 'Naplata nije ucitana iz Supabase-a.')
      return
    }

    // IMPORTANT:
    // Legacy table can contain an older row with the same id/status = ready.
    // Put legacy FIRST and billing_records SECOND so billing_records wins in mergeBillingRows().
    const records = [
      ...(Array.isArray(legacyQuery.data) ? legacyQuery.data : []),
      ...(Array.isArray(recordQuery.data) ? recordQuery.data : []),
    ]
      .map((row) => mapBillingRowToReact(row as Record<string, unknown>))
      .filter((record) => record.id)

    const nextBilling = mergeBillingRows(records)
    setCloudBilling(nextBilling)
    setCloudReadStatus(nextBilling.length ? 'cloud' : 'cloud-empty')

    nextBilling.filter((record) => record.status === 'overdue').forEach((record) => void persistCloudBilling(record))
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

      // Billing is the source of truth for the financial end of the project lifecycle.
      // Paid billing means the commercial flow is closed. We keep the old ProjectStatus
      // enum compatible by storing it as zavrsen, while ProjectLifecycle renders it as
      // "Zatvoren" from billingStatus === paid.
      updateProject({
        ...project,
        status: getBillingStatus(record) === 'closed' ? 'zavrsen' : project.status,
        billingId: record.id,
        billingStatus: record.status,
      })
    },
    [getProjectById, updateProject],
  )

  const replaceRecord = useCallback(
    async (record: BillingRecord) => {
      const normalizedRecord = normalizeRuntimeStatus(record)
      const previousRecord = selectBillingById(billing, record.id)
      let savedRecord = normalizedRecord

      if (isCloudBillingMode) {
        setCloudBilling((current) => mergeBillingRows([normalizedRecord, ...current]))
        const persistedRecord = await persistCloudBilling(normalizedRecord)
        if (persistedRecord) {
          savedRecord = {
            ...normalizedRecord,
            ...persistedRecord,
            id: persistedRecord.id || normalizedRecord.id,
            clientId: persistedRecord.clientId || normalizedRecord.clientId,
            projectId: persistedRecord.projectId || normalizedRecord.projectId,
            status: normalizeBillingStatus(persistedRecord.status || normalizedRecord.status),
          }
          setCloudBilling((current) => mergeBillingRows([savedRecord, ...current]))
        }
      } else {
        setLocalBilling((current) => mergeBillingRows([normalizedRecord, ...current]))
      }

      syncProjectBilling(savedRecord)
      const previousStatus = previousRecord ? getBillingStatus(previousRecord) : 'none'
      const nextStatus = getBillingStatus(savedRecord)
      if (previousStatus !== 'overdue' && nextStatus === 'overdue') {
        const recipientUserIds = isCloudBillingMode
          ? Array.from(new Set(members.filter((member) => member.role === 'admin' || member.role === 'finance').map((member) => member.user_id)))
          : Array.from(new Set(users.filter((appUser) => appUser.role === 'admin' || appUser.role === 'finance').map((appUser) => appUser.id)))
        if (recipientUserIds.length) {
          void createNotifications(
            recipientUserIds.map((recipientUserId) => ({
              recipientUserId,
              type: 'invoice_overdue' as const,
              title: 'Faktura kasni',
              body: savedRecord.projectName || savedRecord.description || 'Jedan nalog za naplatu je usao u kasnjenje.',
              entityType: 'billing' as const,
              entityId: savedRecord.id,
            })),
          )
        }
      }
      return savedRecord
    },
    [billing, createNotifications, isCloudBillingMode, members, persistCloudBilling, syncProjectBilling, users],
  )

  const createBillingForProject = useCallback(
    async (projectId: string, payload: CreateBillingPayload) => {
      // One project must not generate multiple billing records.
      // Any non-cancelled billing record (ready/draft/invoiced/overdue/paid) owns the project.
      const existingRecord = selectBillingByProjectId(billing, projectId).find(isActiveOrClosedBilling)
      if (existingRecord) return existingRecord

      const project = getProjectById(projectId)
      if (!project) return null

      const projectTasks = getTasksByProjectId(projectId)
      if (isSingleShotProject(project) && !isProjectFinishedForBilling(projectTasks)) {
        return null
      }

      const timestamp = new Date().toISOString()
      const nextRecord: BillingRecord = {
        id: makeBillingId(),
        clientId: String(project.clientId),
        projectId: String(projectId),
        clientName: '',
        projectName: project.title,
        description: payload.description.trim() || `Nalog za naplatu - ${project.title}`,
        amount: Number.isFinite(payload.amount) ? payload.amount : null,
        currency: payload.currency.trim() || 'RSD',
        dueDate: payload.dueDate,
        status: 'ready',
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

      return await replaceRecord(nextRecord)
    },
    [billing, getProjectById, getTasksByProjectId, replaceRecord],
  )

  const updateBillingRecord = useCallback(
    async (billingId: string, patch: Partial<BillingRecord>) => {
      const currentRecord = selectBillingById(billing, billingId)
      if (!currentRecord) return null

      return await replaceRecord({
        ...currentRecord,
        ...patch,
        status: patch.status ? normalizeBillingStatus(patch.status) : currentRecord.status,
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
