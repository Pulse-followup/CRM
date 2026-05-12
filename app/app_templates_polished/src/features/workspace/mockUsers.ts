export type WorkspaceUserRole = 'admin' | 'user' | 'finance'

export interface WorkspaceUser {
  id: string
  name: string
  role: WorkspaceUserRole
}

export const mockUsers: WorkspaceUser[] = [
  { id: 'user-1', name: 'Marko', role: 'user' },
  { id: 'user-2', name: 'Jelena', role: 'user' },
  { id: 'finance-1', name: 'Finansije', role: 'finance' },
  { id: 'admin-1', name: 'Admin', role: 'admin' },
]
