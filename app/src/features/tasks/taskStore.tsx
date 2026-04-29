import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { mockTasks } from './mockTasks'
import { readStoredArray, writeStoredValue } from '../../shared/storage'
import type { Task } from './types'

const TASKS_STORAGE_KEY = 'pulse.tasks.v1'

export interface TaskStoreValue {
  tasks: Task[]
  getTaskById: (taskId: string) => Task | null
  getTasksByProjectId: (projectId: string) => Task[]
  getTasksByClientId: (clientId: string) => Task[]
  updateTask: (updatedTask: Task) => void
  addTask: (task: Task) => void
}

const TaskStoreContext = createContext<TaskStoreValue | null>(null)

export function TaskProvider({ children }: PropsWithChildren) {
  const [tasks, setTasks] = useState<Task[]>(() => readStoredArray(TASKS_STORAGE_KEY, mockTasks))

  useEffect(() => {
    writeStoredValue(TASKS_STORAGE_KEY, tasks)
  }, [tasks])

  const getTaskById = useCallback(
    (taskId: string) => tasks.find((task) => task.id === taskId) ?? null,
    [tasks],
  )

  const getTasksByProjectId = useCallback(
    (projectId: string) => tasks.filter((task) => task.projectId === projectId),
    [tasks],
  )

  const getTasksByClientId = useCallback(
    (clientId: string) => tasks.filter((task) => task.clientId === clientId),
    [tasks],
  )

  const updateTask = useCallback((updatedTask: Task) => {
    setTasks((current) =>
      current.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
    )
  }, [])

  const addTask = useCallback((task: Task) => {
    setTasks((current) => [task, ...current])
  }, [])

  const value = useMemo<TaskStoreValue>(
    () => ({
      tasks,
      getTaskById,
      getTasksByProjectId,
      getTasksByClientId,
      updateTask,
      addTask,
    }),
    [tasks, getTaskById, getTasksByProjectId, getTasksByClientId, updateTask, addTask],
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
