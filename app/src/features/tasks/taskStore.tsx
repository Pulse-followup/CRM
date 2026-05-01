import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { mockTasks } from './mockTasks'
import { readStoredArray, writeStoredValue } from '../../shared/storage'
import { useCloudStore } from '../cloud/cloudStore'
import { getSupabaseClient } from '../../lib/supabaseClient'
import {
  getTaskById as selectTaskById,
  getTasksByClient as selectTasksByClient,
  getTasksByProject as selectTasksByProject,
} from './taskSelectors'
import type { Task, TaskBillingState, TaskStatus, TaskType } from './types'

const TASKS_STORAGE_KEY = 'pulse.tasks.v1'

type CloudReadStatus = 'local' | 'loading' | 'cloud' | 'cloud-empty' | 'error'

interface TaskStoreValue {
  tasks: Task[]
  isCloudTaskMode: boolean
  cloudReadStatus: CloudReadStatus
  cloudReadError: string | null
  refreshTasksFromCloud: () => Promise<void>
  getTaskById: (taskId: string) => Task | null
  getTasksByProjectId: (projectId: string) => Task[]
  getTasksByClientId: (clientId: string) => Task[]
  updateTask: (task: Task) => Promise<void> | void
  addTask: (task: Task) => Promise<Task | null> | Task | null
}

const TaskStoreContext = createContext<TaskStoreValue | null>(null)

function isValidCloudLinkedTask(task: Task) {
  return Boolean(task.clientId && task.projectId)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function asNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  const next = Number(value)
  return Number.isFinite(next) ? next : undefined
}

function normalizeTaskType(value: unknown): TaskType | undefined {
  const normalized = asString(value)
  const allowed: TaskType[] = ['poziv', 'mail', 'sastanak', 'follow_up', 'ponuda', 'naplata', 'interni_zadatak', 'drugo']
  return allowed.includes(normalized as TaskType) ? (normalized as TaskType) : undefined
}

function normalizeTaskStatus(value: unknown): TaskStatus {
  const normalized = asString(value)
  const allowed: TaskStatus[] = ['dodeljen', 'u_radu', 'na_cekanju', 'zavrsen', 'vracen', 'poslat_na_naplatu', 'naplacen']
  return allowed.includes(normalized as TaskStatus) ? (normalized as TaskStatus) : 'dodeljen'
}

function normalizeBillingState(value: unknown): TaskBillingState | undefined {
  const normalized = asString(value)
  if (normalized === 'ready_for_billing') return 'ready_for_billing'
  if (normalized === 'sent_to_billing') return 'sent_to_billing'
  if (normalized === 'billed') return 'billed'
  if (normalized === 'not_billable') return 'not_billable'
  if (normalized === 'pending_review') return 'ready_for_billing'
  return undefined
}

function mapTaskRowToReact(row: Record<string, unknown>): Task {
  const createdAt = asString(row.created_at) || new Date().toISOString()
  return {
    id: asString(row.id),
    clientId: asString(row.client_id || row.clientId),
    projectId: asString(row.project_id || row.projectId),
    title: asString(row.title) || 'Task',
    description: asString(row.description),
    type: normalizeTaskType(row.action_type || row.type),
    status: normalizeTaskStatus(row.status),
    assignedToUserId: asString(row.assigned_to_user_id || row.assignedToUserId) || undefined,
    assignedToLabel: asString(row.assigned_to_label || row.assignedToLabel) || undefined,
    dueDate: asString(row.due_date || row.dueDate) || undefined,
    stageId: asString(row.stage_id || row.stageId) || undefined,
    createdAt,
    updatedAt: asString(row.updated_at) || createdAt,
    completedAt: (row.completed_at as string | null | undefined) ?? null,
    timeSpentMinutes: asNumber(row.time_spent_minutes || row.timeSpentMinutes),
    materialCost: asNumber(row.material_cost || row.materialCost),
    materialDescription: asString(row.material_description || row.materialDescription),
    laborCost: asNumber(row.labor_cost || row.laborCost),
    billingState: normalizeBillingState(row.billing_state || row.billable_status || row.billingState),
    billingStatus: asString(row.billable_status || row.billing_status || row.billingStatus),
    billingId: asString(row.billing_record_id || row.billing_id || row.billingId) || null,
  }
}

function mapTaskToSupabaseRow(task: Task, workspaceId: string, userId?: string | null) {
  return {
    id: task.id,
    workspace_id: workspaceId,
    client_id: task.clientId,
    project_id: task.projectId,
    action_type: task.type || 'drugo',
    title: task.title || 'Task',
    description: task.description || '',
    assigned_to_user_id: task.assignedToUserId || null,
    assigned_to_label: task.assignedToLabel || '',
    created_by_user_id: userId || null,
    created_by_label: '',
    due_date: task.dueDate || null,
    status: task.status || 'dodeljen',
    time_spent_minutes: task.timeSpentMinutes || 0,
    labor_cost: task.laborCost || 0,
    material_cost: task.materialCost || 0,
    material_description: task.materialDescription || '',
    billable_status: task.billingState || task.billingStatus || 'not_billable',
    billing_state: task.billingState || 'not_billable',
    billing_id: task.billingId || null,
    billing_record_id: task.billingId || null,
    archived: false,
    created_at: task.createdAt || new Date().toISOString(),
    updated_at: task.updatedAt || new Date().toISOString(),
    completed_at: task.completedAt || null,
    stage_id: task.stageId || null,
  }
}

export function TaskProvider({ children }: PropsWithChildren) {
  const { isConfigured, activeWorkspace, user } = useCloudStore()
  const isCloudTaskMode = Boolean(isConfigured && activeWorkspace?.id)
  const [localTasks, setLocalTasks] = useState<Task[]>(() => readStoredArray(TASKS_STORAGE_KEY, mockTasks))
  const [cloudTasks, setCloudTasks] = useState<Task[]>([])
  const [cloudReadStatus, setCloudReadStatus] = useState<CloudReadStatus>('local')
  const [cloudReadError, setCloudReadError] = useState<string | null>(null)

  const tasks = useMemo(
    () => (isCloudTaskMode ? cloudTasks.filter(isValidCloudLinkedTask) : localTasks),
    [cloudTasks, isCloudTaskMode, localTasks],
  )

  useEffect(() => {
    if (!isCloudTaskMode) {
      writeStoredValue(TASKS_STORAGE_KEY, localTasks)
    }
  }, [isCloudTaskMode, localTasks])

  const refreshTasksFromCloud = useCallback(async () => {
    const supabase = getSupabaseClient()

    if (!isConfigured || !supabase || !activeWorkspace?.id) {
      setCloudReadStatus('local')
      setCloudReadError(null)
      return
    }

    setCloudReadStatus('loading')
    setCloudReadError(null)

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .eq('archived', false)
      .order('created_at', { ascending: false })

    if (error) {
      setCloudReadStatus('error')
      setCloudReadError(error.message || 'Taskovi nisu ucitani iz Supabase-a.')
      setCloudTasks([])
      return
    }

    const nextTasks = Array.isArray(data)
      ? data
          .map((row) => mapTaskRowToReact(row as Record<string, unknown>))
          .filter((task) => task.id && task.clientId && task.projectId)
      : []

    setCloudTasks(nextTasks)
    setCloudReadStatus(nextTasks.length ? 'cloud' : 'cloud-empty')
  }, [activeWorkspace?.id, isConfigured])

  useEffect(() => {
    if (isCloudTaskMode) {
      setCloudTasks([])
      void refreshTasksFromCloud()
    }
  }, [isCloudTaskMode, activeWorkspace?.id, refreshTasksFromCloud])

  const getTaskById = useCallback((taskId: string) => selectTaskById(tasks, taskId), [tasks])

  const getTasksByProjectId = useCallback(
    (projectId: string) => selectTasksByProject(tasks, projectId),
    [tasks],
  )

  const getTasksByClientId = useCallback(
    (clientId: string) => selectTasksByClient(tasks, clientId),
    [tasks],
  )

  const updateTask = useCallback(
    async (updatedTask: Task) => {
      if (isCloudTaskMode) {
        if (!activeWorkspace?.id || !isValidCloudLinkedTask(updatedTask)) return
        setCloudTasks((current) => current.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
        const supabase = getSupabaseClient()
        if (supabase) {
          const { error } = await supabase
            .from('tasks')
            .update(mapTaskToSupabaseRow({ ...updatedTask, updatedAt: new Date().toISOString() }, activeWorkspace.id, user?.id))
            .eq('id', updatedTask.id)
            .eq('workspace_id', activeWorkspace.id)
          if (error) {
            setCloudReadStatus('error')
            setCloudReadError(error.message)
          }
        }
        return
      }

      setLocalTasks((current) => current.map((task) => (task.id === updatedTask.id ? updatedTask : task)))
    },
    [activeWorkspace?.id, isCloudTaskMode, user?.id],
  )

  const addTask = useCallback(
    async (task: Task) => {
      if (isCloudTaskMode) {
        if (!activeWorkspace?.id || !isValidCloudLinkedTask(task)) return null
        const supabase = getSupabaseClient()
        const nextTask = { ...task, id: task.id || `task-${Date.now()}` }
        setCloudTasks((current) => [nextTask, ...current])
        if (supabase) {
          const { data, error } = await supabase
            .from('tasks')
            .insert(mapTaskToSupabaseRow(nextTask, activeWorkspace.id, user?.id))
            .select('*')
            .single()
          if (error) {
            setCloudTasks((current) => current.filter((item) => item.id !== nextTask.id))
            setCloudReadStatus('error')
            setCloudReadError(error.message)
            return null
          }
          const savedTask = mapTaskRowToReact(data as Record<string, unknown>)
          setCloudTasks((current) => [savedTask, ...current.filter((item) => item.id !== nextTask.id)])
          setCloudReadStatus('cloud')
          return savedTask
        }
        return nextTask
      }

      setLocalTasks((current) => [task, ...current])
      return task
    },
    [activeWorkspace?.id, isCloudTaskMode, user?.id],
  )

  const value = useMemo<TaskStoreValue>(
    () => ({
      tasks,
      isCloudTaskMode,
      cloudReadStatus,
      cloudReadError,
      refreshTasksFromCloud,
      getTaskById,
      getTasksByProjectId,
      getTasksByClientId,
      updateTask,
      addTask,
    }),
    [tasks, isCloudTaskMode, cloudReadStatus, cloudReadError, refreshTasksFromCloud, getTaskById, getTasksByProjectId, getTasksByClientId, updateTask, addTask],
  )

  return <TaskStoreContext.Provider value={value}>{children}</TaskStoreContext.Provider>
}

export function useTaskStore() {
  const context = useContext(TaskStoreContext)

  if (!context) {
    throw new Error('useTaskStore must be used within a TaskProvider')
  }

  return context
}
