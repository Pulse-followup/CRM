import { mockProjects } from './mockProjects'
import type { Project } from './types'

export function getProjectsByClientId(clientId: string): Project[] {
  return mockProjects.filter((project) => project.clientId === clientId)
}

export function getProjectById(projectId: string): Project | null {
  return mockProjects.find((project) => project.id === projectId) ?? null
}
