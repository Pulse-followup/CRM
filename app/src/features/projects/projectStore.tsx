import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { mockProjects } from './mockProjects'
import { readStoredArray, writeStoredValue } from '../../shared/storage'
import { useCloudStore } from '../cloud/cloudStore'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { Project, ProjectFrequency, ProjectStatus, ProjectType } from './types'

const PROJECTS_STORAGE_KEY = 'pulse.projects.v1'

type CloudReadStatus = 'local' | 'loading' | 'cloud' | 'cloud-empty' | 'fallback' | 'error'

interface ProjectStoreValue {
  projects: Project[]
  cloudReadStatus: CloudReadStatus
  cloudReadError: string | null
  refreshProjectsFromCloud: () => Promise<void>
  getProjectById: (projectId: string) => Project | null
  getProjectsByClientId: (clientId: string) => Project[]
  addProject: (project: Project) => Promise<Project | null> | Project | null
  updateProject: (project: Project) => Promise<Project | null> | Project | null
  archiveProject: (projectId: string) => Promise<void> | void
  restoreProject: (projectId: string) => Promise<void> | void
}

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null)

export interface ProjectProviderProps {
  children: ReactNode
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function asNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined
  const next = Number(value)
  return Number.isFinite(next) ? next : undefined
}

function normalizeStatus(row: Record<string, unknown>): ProjectStatus {
  if (row.archived === true || row.status === 'arhiviran' || row.status === 'archived') return 'arhiviran'
  if (row.status === 'zavrsen' || row.status === 'done' || row.status === 'completed') return 'zavrsen'
  return 'aktivan'
}

function normalizeType(value: unknown): ProjectType | undefined {
  const normalized = asString(value).toLowerCase()
  if (['kampanja', 'prodaja', 'usluga', 'postavka', 'odrzavanje', 'drugo'].includes(normalized)) {
    return normalized as ProjectType
  }
  return undefined
}

function normalizeFrequency(value: unknown): ProjectFrequency | undefined {
  const normalized = asString(value).toLowerCase()
  if (['jednokratno', 'mesecno', 'kvartalno', 'godisnje', 'po_potrebi'].includes(normalized)) {
    return normalized as ProjectFrequency
  }
  return undefined
}

function mapProjectRowToReact(row: Record<string, unknown>): Project {
  return {
    id: asString(row.id),
    clientId: asString(row.client_id || row.clientId),
    title: asString(row.name || row.title),
    status: normalizeStatus(row),
    type: normalizeType(row.type),
    frequency: normalizeFrequency(row.frequency),
    value: asNumber(row.estimated_value || row.value),
    billingId: asString(row.billing_id || row.billingId) || undefined,
    billingStatus: (asString(row.billing_status || row.billingStatus) || undefined) as Project['billingStatus'],
  }
}

function mapProjectToSupabaseRow(project: Project, workspaceId: string) {
  return {
    id: project.id,
    workspace_id: workspaceId,
    client_id: project.clientId,
    name: project.title || 'Novi projekat',
    type: project.type || null,
    frequency: project.frequency || null,
    estimated_value: project.value ?? null,
    status: project.status || 'aktivan',
    billing_id: project.billingId || null,
    billing_status: project.billingStatus || null,
    archived: project.status === 'arhiviran',
    archived_at: project.status === 'arhiviran' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const { isConfigured, activeWorkspace } = useCloudStore()
  const isCloudMode = Boolean(isConfigured && activeWorkspace?.id)
  const [projects, setProjects] = useState<Project[]>(() =>
    readStoredArray(PROJECTS_STORAGE_KEY, mockProjects),
  )
  const [cloudReadStatus, setCloudReadStatus] = useState<CloudReadStatus>('local')
  const [cloudReadError, setCloudReadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCloudMode) {
      writeStoredValue(PROJECTS_STORAGE_KEY, projects)
    }
  }, [isCloudMode, projects])

  useEffect(() => {
    if (isCloudMode) {
      setProjects([])
    }
  }, [isCloudMode])

  const refreshProjectsFromCloud = useCallback(async () => {
    const supabase = getSupabaseClient()

    if (!isConfigured || !supabase || !activeWorkspace?.id) {
      setCloudReadStatus('local')
      setCloudReadError(null)
      return
    }

    setCloudReadStatus('loading')
    setCloudReadError(null)

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .order('created_at', { ascending: false })

    if (error) {
      setCloudReadStatus('error')
      setCloudReadError(error.message || 'Projekti nisu ucitani iz Supabase-a.')
      return
    }

    const nextProjects = Array.isArray(data)
      ? data
          .map((row) => mapProjectRowToReact(row as Record<string, unknown>))
          .filter((project) => project.id && project.clientId && project.title)
      : []

    setProjects(nextProjects)
    setCloudReadStatus(nextProjects.length ? 'cloud' : 'cloud-empty')
  }, [activeWorkspace?.id, isConfigured])

  useEffect(() => {
    void refreshProjectsFromCloud()
  }, [refreshProjectsFromCloud])

  const addProject = useCallback(async (project: Project) => {
    if (isCloudMode) {
      if (!activeWorkspace?.id) return null
      const supabase = getSupabaseClient()
      if (!supabase) return null

      const nextProject: Project = {
        ...project,
        id: project.id || `project-${crypto.randomUUID?.() || Date.now()}`,
        status: project.status || 'aktivan',
      }

      const { data, error } = await supabase
        .from('projects')
        .insert({ ...mapProjectToSupabaseRow(nextProject, activeWorkspace.id), created_at: new Date().toISOString() })
        .select('*')
        .single()

      if (error) {
        setCloudReadStatus('error')
        setCloudReadError(error.message || 'Projekat nije sacuvan u Supabase.')
        return null
      }

      const savedProject = mapProjectRowToReact(data as Record<string, unknown>)
      setProjects((current) => [savedProject, ...current.filter((item) => item.id !== savedProject.id)])
      setCloudReadStatus('cloud')
      setCloudReadError(null)
      return savedProject
    }

    setProjects((current) => [...current, project])
    return project
  }, [activeWorkspace?.id, isCloudMode])

  const updateProject = useCallback(async (project: Project) => {
    if (isCloudMode) {
      if (!activeWorkspace?.id) return null
      const supabase = getSupabaseClient()
      if (!supabase) return null

      const { data, error } = await supabase
        .from('projects')
        .update(mapProjectToSupabaseRow(project, activeWorkspace.id))
        .eq('id', project.id)
        .eq('workspace_id', activeWorkspace.id)
        .select('*')
        .single()

      if (error) {
        setCloudReadStatus('error')
        setCloudReadError(error.message || 'Projekat nije azuriran u Supabase.')
        return null
      }

      const savedProject = mapProjectRowToReact(data as Record<string, unknown>)
      setProjects((current) => current.map((item) => (item.id === savedProject.id ? savedProject : item)))
      setCloudReadStatus('cloud')
      setCloudReadError(null)
      return savedProject
    }

    setProjects((current) => current.map((item) => (item.id === project.id ? project : item)))
    return project
  }, [activeWorkspace?.id, isCloudMode])

  const archiveProject = useCallback(async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId)
    if (!project) return
    await updateProject({ ...project, status: 'arhiviran' })
  }, [projects, updateProject])

  const restoreProject = useCallback(async (projectId: string) => {
    const project = projects.find((item) => item.id === projectId)
    if (!project) return
    await updateProject({ ...project, status: 'aktivan' })
  }, [projects, updateProject])

  const value = useMemo<ProjectStoreValue>(
    () => ({
      projects,
      cloudReadStatus,
      cloudReadError,
      refreshProjectsFromCloud,
      getProjectById: (projectId: string) =>
        projects.find((project) => project.id === projectId) ?? null,
      getProjectsByClientId: (clientId: string) =>
        projects.filter((project) => project.clientId === clientId),
      addProject,
      updateProject,
      archiveProject,
      restoreProject,
    }),
    [addProject, archiveProject, cloudReadError, cloudReadStatus, projects, refreshProjectsFromCloud, restoreProject, updateProject],
  )

  return <ProjectStoreContext.Provider value={value}>{children}</ProjectStoreContext.Provider>
}

export function useProjectStore() {
  const context = useContext(ProjectStoreContext)

  if (!context) {
    throw new Error('useProjectStore must be used within ProjectProvider')
  }

  return context
}
