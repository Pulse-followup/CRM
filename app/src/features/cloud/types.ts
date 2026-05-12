import type { WorkspacePlanType } from '../subscription/plan'

export type WorkspaceRole = 'admin' | 'finance' | 'member'
export type WorkspaceInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired'
export type WorkspaceMemberStatus = 'invited' | 'active'

export interface CloudProfile {
  id: string
  email: string
  full_name?: string | null
  created_at?: string
  updated_at?: string
}

export interface CloudWorkspace {
  id: string
  name: string
  owner_user_id: string
  plan_type?: WorkspacePlanType | null
  created_at?: string
  updated_at?: string
}

export interface CloudWorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  status: WorkspaceMemberStatus
  hourly_rate: number | null
  production_role?: string | null
  display_name?: string | null
  joined_at?: string | null
  created_at?: string
  profile?: CloudProfile | null
}

export interface CloudWorkspaceInvite {
  id: string
  workspace_id: string
  email: string
  full_name?: string | null
  role: WorkspaceRole
  hourly_rate: number | null
  production_role?: string | null
  invited_by_user_id: string
  status: WorkspaceInviteStatus
  created_at?: string
}
