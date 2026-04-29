import type { Role } from '../../types/role'

export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
}
