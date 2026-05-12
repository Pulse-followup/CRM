import type { AppUser } from './types'

export const mockUsers: AppUser[] = [
  {
    id: 'admin-1',
    name: 'Admin korisnik',
    email: 'admin@pulse.local',
    role: 'admin',
    productionRole: 'ACCOUNT',
  },
  {
    id: 'user-1',
    name: 'Operativac korisnik',
    email: 'operativa@pulse.local',
    role: 'user',
    productionRole: 'OPERATIVA',
  },
  {
    id: 'finance-1',
    name: 'Finance korisnik',
    email: 'finance@pulse.local',
    role: 'finance',
    productionRole: 'FINANSIJE',
  },
]
