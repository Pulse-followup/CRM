import type { AppUser } from './types'

export const mockUsers: AppUser[] = [
  {
    id: 'admin-1',
    name: 'Admin korisnik',
    email: 'admin@pulse.local',
    role: 'admin',
  },
  {
    id: 'user-1',
    name: 'Operativac korisnik',
    email: 'operativa@pulse.local',
    role: 'user',
  },
  {
    id: 'finance-1',
    name: 'Finance korisnik',
    email: 'finance@pulse.local',
    role: 'finance',
  },
]
