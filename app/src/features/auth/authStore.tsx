import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { useCloudStore } from '../cloud/cloudStore'
import { mockUsers } from './mockUsers'
import type { AppUser } from './types'

const CURRENT_USER_STORAGE_KEY = 'pulse.currentUser.v1'
const DEFAULT_USER = mockUsers[0]

interface AuthStoreValue {
  users: AppUser[]
  currentUser: AppUser
  setCurrentUser: (userId: string) => void
  isCloudUser: boolean
}

const AuthStoreContext = createContext<AuthStoreValue | null>(null)

function readStoredUserId() {
  if (typeof window === 'undefined') {
    return DEFAULT_USER.id
  }

  try {
    return window.localStorage.getItem(CURRENT_USER_STORAGE_KEY) || DEFAULT_USER.id
  } catch {
    return DEFAULT_USER.id
  }
}

function writeStoredUserId(userId: string) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId)
  } catch {
    // Keep app usable even if localStorage is unavailable.
  }
}

function workspaceRoleToAppRole(role?: string): AppUser['role'] {
  if (role === 'admin') return 'admin'
  if (role === 'finance') return 'finance'
  return 'user'
}

function profileName(email: string, fullName?: string | null, role?: AppUser["role"]) {
  const cleanName = fullName?.trim() || ""
  if (cleanName && !cleanName.includes("@")) return cleanName

  if (role === "finance") return "Finansije"
  if (role === "admin") return "Admin"
  if (role === "user") return "Radnik"

  const localPart = email.split("@")[0]?.trim()
  return localPart || email
}

export function AuthProvider({ children }: PropsWithChildren) {
  const cloud = useCloudStore()
  const [currentUserId, setCurrentUserId] = useState<string>(() => readStoredUserId())

  useEffect(() => {
    writeStoredUserId(currentUserId)
  }, [currentUserId])

  const cloudUsers = useMemo<AppUser[]>(() => {
    if (!cloud.activeWorkspace || !cloud.members.length) return []

    return cloud.members.map((member) => {
      const email = member.profile?.email || member.user_id
      return {
        id: member.user_id,
        role: workspaceRoleToAppRole(member.role),
        name: profileName(email, member.display_name || member.profile?.full_name, workspaceRoleToAppRole(member.role)),
        email,
      }
    })
  }, [cloud.activeWorkspace, cloud.members])

  const cloudCurrentUser = useMemo<AppUser | null>(() => {
    if (!cloud.user || !cloud.membership) return null
    const email = cloud.profile?.email || cloud.user.email || cloud.user.id

    return {
      id: cloud.user.id,
      role: workspaceRoleToAppRole(cloud.membership.role),
      name: profileName(email, cloud.membership?.display_name || cloud.profile?.full_name, workspaceRoleToAppRole(cloud.membership.role)),
      email,
    }
  }, [cloud.membership, cloud.profile, cloud.user])

  const users = cloudCurrentUser ? cloudUsers : mockUsers
  const currentUser = cloudCurrentUser || mockUsers.find((user) => user.id === currentUserId) || DEFAULT_USER

  const setCurrentUser = useCallback(
    (userId: string) => {
      if (cloudCurrentUser) {
        return
      }

      if (!mockUsers.some((user) => user.id === userId)) {
        return
      }

      setCurrentUserId(userId)
    },
    [cloudCurrentUser],
  )

  const value = useMemo<AuthStoreValue>(
    () => ({
      users,
      currentUser,
      setCurrentUser,
      isCloudUser: Boolean(cloudCurrentUser),
    }),
    [cloudCurrentUser, currentUser, setCurrentUser, users],
  )

  return <AuthStoreContext.Provider value={value}>{children}</AuthStoreContext.Provider>
}

export function useAuthStore() {
  const context = useContext(AuthStoreContext)

  if (!context) {
    throw new Error('useAuthStore must be used within AuthProvider')
  }

  return context
}
