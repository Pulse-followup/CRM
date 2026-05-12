import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import { mockTasks } from './mockTasks'
import { readStoredArray, writeStoredValue } from '../../shared/storage'
import { useAuthStore } from '../auth/authStore'
import { useCloudStore } from '../cloud/cloudStore'
import { useDemoStore } from '../demo/demoStore'
import { useNotificationStore } from '../notifications/notificationStore'
import { getSupabaseClient } from '../../lib/supabaseClient'
import {
  getTaskById as selectTaskById,
  getTasksByClient as selectTasksByClient,
  getTasksByProject as selectTasksByProject,
} from './taskSelectors'
import type { Task, TaskBillingState, TaskStatus, TaskType } from './types'
import { isTaskCompleted } from './taskLifecycle'

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
  // FAZA 9.1.A+B: ad hoc/client activities are valid cloud tasks even without a project.
  return Boolean(task.clientId)
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}


export function normalizeOperationalRole(value?: string | null) {
  const cleanValue = asString(value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (!cleanValue) return ''
  if (['PROIZVODNJA', 'PRODUCTION', 'RADNIK', 'RADNIK 001'].includes(cleanValue)) return 'PRODUKCIJA'
  if (['DESIGNER', 'DIZAJN'].includes(cleanValue)) return 'DIZAJNER'
  if (['LOGISTICS'].includes(cleanValue)) return 'LOGISTIKA'
  if (['MONTAA', 'MONTAZA'].includes(cleanValue)) return 'MONTAZA'
  if (['FINANSIJE'].includes(cleanValue)) return 'FINANCE'
  return cleanValue
}

export function getTaskBlockReason(
  task: Task,
  users: Array<{ id: string; role?: string; productionRole?: string | null; name?: string; email?: string }> = [],
) {
  const isActive = task.status === 'dodeljen' || task.status === 'u_radu'
  if (!isActive) return ''

  const requiredRole = normalizeOperationalRole(task.requiredRole)
  if (!requiredRole) return ''

  if (task.needsAssignment) return `Potrebna je dodela izvršioca za rolu ${requiredRole || task.requiredRole || 'koraka'}.`
  if (!task.assignedToUserId) return 'Nema dodeljenog izvršioca.'

  const assignedUser = users.find((user) => user.id === task.assignedToUserId)
  if (!assignedUser) return 'Dodeljeni korisnik više ne postoji u timu.'

  const productionRole = normalizeOperationalRole(assignedUser.productionRole)

  // Korisnik bez operativne role je wildcard izvršilac: može da preuzme bilo koju funkciju/rolu.
  if (!productionRole) return ''

  if (productionRole !== requiredRole) {
    return `Pogrešna dodela: potrebna rola je ${requiredRole}, a korisnik ima ${productionRole}.`
  }

  return ''
}

export function isTaskLogicallyBlocked(
  task: Task,
  users: Array<{ id: string; role?: string; productionRole?: string | null }> = [],
) {
  return Boolean(getTaskBlockReason(task, users))
}

function asUuidOrNull(value: string | undefined) {
  const cleanValue = value || ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanValue) ? cleanValue : null
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
    requiredRole: normalizeOperationalRole(asString(row.required_role || row.requiredRole)) || undefined,
    needsAssignment: asString(row.assigned_to_label || row.assignedToLabel).toLowerCase().includes('potrebna dodela'),
    dueDate: asString(row.due_date || row.dueDate) || undefined,
    stageId: asString(row.stage_id || row.stageId) || undefined,
    createdAt,
    updatedAt: asString(row.updated_at) || createdAt,
    completedAt: (row.completed_at as string | null | undefined) ?? null,
    finishedAt: (row.finished_at as string | null | undefined) ?? (row.finishedAt as string | null | undefined) ?? null,
    timeSpentMinutes: asNumber(row.time_spent_minutes || row.timeSpentMinutes),
    materialCost: asNumber(row.material_cost || row.materialCost),
    materialDescription: asString(row.material_description || row.materialDescription),
    laborCost: asNumber(row.labor_cost || row.laborCost),
    billingState: normalizeBillingState(row.billing_state || row.billable_status || row.billingState),
    billingStatus: asString(row.billable_status || row.billing_status || row.billingStatus),
    billingId: asString(row.billing_record_id || row.billing_id || row.billingId) || null,
    source: asString(row.source_type || row.source) === 'template' ? 'template' : 'manual',
    sourceProductId: asString(row.source_product_id || row.sourceProductId) || undefined,
    sourceTemplateId: asString(row.source_template_id || row.sourceTemplateId) || undefined,
    sourceTemplateStepId: asString(row.source_template_step_id || row.sourceTemplateStepId) || undefined,
    sequenceOrder: asNumber(row.sequence_order || row.sequenceOrder),
    dependsOnTaskId: asString(row.depends_on_task_id || row.dependsOnTaskId) || undefined,
    activatedAt: (row.activated_at as string | null | undefined) ?? (row.activatedAt as string | null | undefined) ?? null,
    estimatedMinutes: asNumber(row.estimated_minutes || row.estimatedMinutes),
  }
}

function mapTaskToSupabaseRow(task: Task, workspaceId: string, userId?: string | null) {
  return {
    id: task.id,
    workspace_id: workspaceId,
    client_id: task.clientId,
    project_id: task.projectId || null,
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
    source_type: task.source || 'manual',
    source_product_id: asUuidOrNull(task.sourceProductId),
    source_template_id: asUuidOrNull(task.sourceTemplateId),
    source_template_step_id: asUuidOrNull(task.sourceTemplateStepId),
    required_role: normalizeOperationalRole(task.requiredRole) || null,
    file_link: task.description?.match(/https?:\/\/[^\s]+/)?.[0] || null,
    sequence_order: task.sequenceOrder || null,
    depends_on_task_id: task.dependsOnTaskId || null,
    activated_at: task.activatedAt || null,
    estimated_minutes: task.estimatedMinutes || null,
  }
}


function shouldActivateNextTask(updatedTask: Task) {
  return updatedTask.status === 'zavrsen' && Boolean(updatedTask.projectId)
}

function activateNextWorkflowTask(updatedTask: Task, allTasks: Task[]) {
  if (!shouldActivateNextTask(updatedTask)) return null
  const nextTask = allTasks
    .filter((task) => task.projectId === updatedTask.projectId && task.dependsOnTaskId === updatedTask.id && task.status === 'na_cekanju')
    .sort((first, second) => (first.sequenceOrder || 0) - (second.sequenceOrder || 0))[0]

  if (!nextTask) return null
  const now = new Date().toISOString()
  return {
    ...nextTask,
    status: 'dodeljen' as TaskStatus,
    activatedAt: now,
    updatedAt: now,
  }
}

function getTaskAssigneeNotification(task: Task) {
  if (!task.assignedToUserId) return null
  return {
    recipientUserId: task.assignedToUserId,
    type: 'task_assigned' as const,
    title: 'Dodeljen ti je task',
    body: task.title || 'Otvoren je novi task za tebe.',
    entityType: 'task' as const,
    entityId: task.id,
  }
}

function getTaskAdminRecipientIds(
  membersOrUsers: Array<{ user_id?: string; id?: string; role?: string }>,
) {
  return Array.from(
    new Set(
      membersOrUsers
        .filter((item) => item.role === 'admin' || item.role === 'finance')
        .map((item) => item.user_id || item.id)
        .filter((value): value is string => Boolean(value)),
    ),
  )
}

function getTaskTakenNotifications(
  task: Task,
  recipientIds: string[],
  assignedLabel?: string,
) {
  return recipientIds.map((recipientUserId) => ({
    recipientUserId,
    type: 'task_taken' as const,
    title: 'Task je preuzet',
    body: assignedLabel
      ? `${assignedLabel} je preuzeo/la task "${task.title || 'Task'}".`
      : `Task "${task.title || 'Task'}" je preuzet.`,
    entityType: 'task' as const,
    entityId: task.id,
  }))
}

function getTaskCompletedNotifications(task: Task, recipientIds: string[]) {
  return recipientIds.map((recipientUserId) => ({
    recipientUserId,
    type: 'task_completed' as const,
    title: 'Task je zavrsen',
    body: task.title || 'Jedan task je oznacen kao zavrsen.',
    entityType: 'task' as const,
    entityId: task.id,
  }))
}

export function TaskProvider({ children }: PropsWithChildren) {
  const { isConfigured, activeWorkspace, user, members } = useCloudStore()
  const { isDemoMode, showReadOnlyNotice } = useDemoStore()
  const { users } = useAuthStore()
  const { createNotifications } = useNotificationStore()
  const isCloudTaskMode = Boolean(isConfigured && activeWorkspace?.id)
  const [localTasks, setLocalTasks] = useState<Task[]>(() =>
    isDemoMode ? mockTasks : readStoredArray(TASKS_STORAGE_KEY, mockTasks),
  )
  const [cloudTasks, setCloudTasks] = useState<Task[]>([])
  const [cloudReadStatus, setCloudReadStatus] = useState<CloudReadStatus>('local')
  const [cloudReadError, setCloudReadError] = useState<string | null>(null)

  const tasks = useMemo(
    () => (isCloudTaskMode ? cloudTasks.filter(isValidCloudLinkedTask) : localTasks),
    [cloudTasks, isCloudTaskMode, localTasks],
  )

  useEffect(() => {
    if (!isCloudTaskMode && !isDemoMode) {
      writeStoredValue(TASKS_STORAGE_KEY, localTasks)
    }
  }, [isCloudTaskMode, isDemoMode, localTasks])

  useEffect(() => {
    if (isDemoMode) {
      setLocalTasks(mockTasks)
    }
  }, [isDemoMode])

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
          .filter((task) => task.id && task.clientId)
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
      if (isDemoMode) {
        showReadOnlyNotice()
        return
      }

      const now = new Date().toISOString()
      const previousTask = tasks.find((task) => task.id === updatedTask.id) || null
      const normalizedTask: Task =
        (updatedTask.status === 'dodeljen' || updatedTask.status === 'u_radu') && !updatedTask.activatedAt
          ? { ...updatedTask, activatedAt: now, updatedAt: updatedTask.updatedAt || now }
          : { ...updatedTask, updatedAt: updatedTask.updatedAt || now }

      if (isCloudTaskMode) {
        if (!activeWorkspace?.id || !normalizedTask.clientId) return
        let nextTaskToActivate: Task | null = null
        setCloudTasks((current) => {
          nextTaskToActivate = activateNextWorkflowTask(normalizedTask, current)
          return current.map((task) => {
            if (task.id === normalizedTask.id) return normalizedTask
            if (nextTaskToActivate && task.id === nextTaskToActivate.id) return nextTaskToActivate
            return task
          })
        })
        const supabase = getSupabaseClient()
        if (supabase) {
          const taskUpdates = [normalizedTask, nextTaskToActivate].filter(Boolean) as Task[]
          for (const taskToSave of taskUpdates) {
            const { error } = await supabase
              .from('tasks')
              .update(mapTaskToSupabaseRow({ ...taskToSave, updatedAt: taskToSave.updatedAt || new Date().toISOString() }, activeWorkspace.id, user?.id))
              .eq('id', taskToSave.id)
              .eq('workspace_id', activeWorkspace.id)
            if (error) {
              setCloudReadStatus('error')
              setCloudReadError(error.message)
              break
            }
          }
        }
        const notifications = []
        const adminAndFinanceIds = getTaskAdminRecipientIds(members)
        const assigneeChanged = normalizedTask.assignedToUserId && previousTask?.assignedToUserId !== normalizedTask.assignedToUserId
        if (assigneeChanged) {
          const assignedNotification = getTaskAssigneeNotification(normalizedTask)
          if (assignedNotification) notifications.push(assignedNotification)
        }
        const justTaken =
          previousTask?.status !== 'u_radu' &&
          normalizedTask.status === 'u_radu'
        if (justTaken) {
          notifications.push(
            ...getTaskTakenNotifications(normalizedTask, adminAndFinanceIds, normalizedTask.assignedToLabel),
          )
        }
        const justCompleted = previousTask ? !isTaskCompleted(previousTask) && isTaskCompleted(normalizedTask) : false
        if (justCompleted) {
          notifications.push(...getTaskCompletedNotifications(normalizedTask, adminAndFinanceIds))
        }
        if (notifications.length) {
          void createNotifications(notifications)
        }
        return
      }

      setLocalTasks((current) => {
        const nextTaskToActivate = activateNextWorkflowTask(normalizedTask, current)
        return current.map((task) => {
          if (task.id === normalizedTask.id) return normalizedTask
          if (nextTaskToActivate && task.id === nextTaskToActivate.id) return nextTaskToActivate
          return task
        })
      })
      const notifications = []
      const adminAndFinanceIds = getTaskAdminRecipientIds(users)
      const assigneeChanged = normalizedTask.assignedToUserId && previousTask?.assignedToUserId !== normalizedTask.assignedToUserId
      if (assigneeChanged) {
        const assignedNotification = getTaskAssigneeNotification(normalizedTask)
        if (assignedNotification) notifications.push(assignedNotification)
      }
      const justTaken =
        previousTask?.status !== 'u_radu' &&
        normalizedTask.status === 'u_radu'
      if (justTaken) {
        notifications.push(
          ...getTaskTakenNotifications(normalizedTask, adminAndFinanceIds, normalizedTask.assignedToLabel),
        )
      }
      const justCompleted = previousTask ? !isTaskCompleted(previousTask) && isTaskCompleted(normalizedTask) : false
      if (justCompleted) {
        notifications.push(...getTaskCompletedNotifications(normalizedTask, adminAndFinanceIds))
      }
      if (notifications.length) {
        void createNotifications(notifications)
      }
    },
    [activeWorkspace?.id, createNotifications, isCloudTaskMode, isDemoMode, members, showReadOnlyNotice, tasks, user?.id, users],
  )

  const addTask = useCallback(
    async (task: Task) => {
      if (isDemoMode) {
        showReadOnlyNotice()
        return null
      }

      if (isCloudTaskMode) {
        if (!activeWorkspace?.id || !task.clientId) return null
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
          const assignedNotification = getTaskAssigneeNotification(savedTask)
          if (assignedNotification) void createNotifications([assignedNotification])
          return savedTask
        }
        return nextTask
      }

      setLocalTasks((current) => [task, ...current])
      const assignedNotification = getTaskAssigneeNotification(task)
      if (assignedNotification) void createNotifications([assignedNotification])
      return task
    },
    [activeWorkspace?.id, createNotifications, isCloudTaskMode, isDemoMode, showReadOnlyNotice, user?.id],
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
