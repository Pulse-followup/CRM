import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { mockUsers } from './mockUsers'
import type { AppUser } from './types'

const CURRENT_USER_STORAGE_KEY = 'pulse.currentUser.v1'
const DEFAULT_USER = mockUsers[0]

interface AuthStoreValue {
  users: AppUser[]
  currentUser: AppUser
  setCurrentUser: (userId: string) => void
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

export function AuthProvider({ children }: PropsWithChildren) {
  const [currentUserId, setCurrentUserId] = useState<string>(() => readStoredUserId())

  useEffect(() => {
    writeStoredUserId(currentUserId)
  }, [currentUserId])

  const currentUser =
    mockUsers.find((user) => user.id === currentUserId) ?? DEFAULT_USER

  const setCurrentUser = useCallback((userId: string) => {
    if (!mockUsers.some((user) => user.id === userId)) {
      return
    }

    setCurrentUserId(userId)
  }, [])

  const value = useMemo<AuthStoreValue>(
    () => ({
      users: mockUsers,
      currentUser,
      setCurrentUser,
    }),
    [currentUser, setCurrentUser],
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
