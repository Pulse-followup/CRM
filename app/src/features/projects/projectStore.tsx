import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { mockProjects } from './mockProjects'
import { readStoredArray, writeStoredValue } from '../../shared/storage'
import type { Project } from './types'

const PROJECTS_STORAGE_KEY = 'pulse.projects.v1'

interface ProjectStoreValue {
  projects: Project[]
  getProjectById: (projectId: string) => Project | null
  getProjectsByClientId: (clientId: string) => Project[]
  addProject: (project: Project) => void
  updateProject: (project: Project) => void
  archiveProject: (projectId: string) => void
  restoreProject: (projectId: string) => void
}

const ProjectStoreContext = createContext<ProjectStoreValue | null>(null)

export interface ProjectProviderProps {
  children: ReactNode
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projects, setProjects] = useState<Project[]>(() =>
    readStoredArray(PROJECTS_STORAGE_KEY, mockProjects),
  )

  useEffect(() => {
    writeStoredValue(PROJECTS_STORAGE_KEY, projects)
  }, [projects])

  const value = useMemo<ProjectStoreValue>(
    () => ({
      projects,
      getProjectById: (projectId: string) =>
        projects.find((project) => project.id === projectId) ?? null,
      getProjectsByClientId: (clientId: string) =>
        projects.filter((project) => project.clientId === clientId),
      addProject: (project: Project) => {
        setProjects((current) => [...current, project])
      },
      updateProject: (project: Project) => {
        setProjects((current) =>
          current.map((currentProject) =>
            currentProject.id === project.id ? project : currentProject,
          ),
        )
      },
      archiveProject: (projectId: string) => {
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId ? { ...project, status: 'arhiviran' } : project,
          ),
        )
      },
      restoreProject: (projectId: string) => {
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId && project.status === 'arhiviran'
              ? { ...project, status: 'aktivan' }
              : project,
          ),
        )
      },
    }),
    [projects],
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
