import type { AppUser } from './types'

export const mockUsers: AppUser[] = [
  {
    id: 'admin-1',
    name: 'Dragan',
    email: 'dragan@novamedia.demo',
    role: 'admin',
    productionRole: 'ACCOUNT',
  },
  {
    id: 'user-1',
    name: 'Jelena',
    email: 'jelena@novamedia.demo',
    role: 'user',
    productionRole: 'OPERATIVA',
  },
  {
    id: 'user-2',
    name: 'Marko',
    email: 'marko@novamedia.demo',
    role: 'user',
    productionRole: 'DIZAJNER',
  },
  {
    id: 'user-3',
    name: 'Stefan',
    email: 'stefan@novamedia.demo',
    role: 'user',
    productionRole: 'PRODUKCIJA',
  },
  {
    id: 'finance-1',
    name: 'Ana',
    email: 'ana@novamedia.demo',
    role: 'finance',
    productionRole: 'FINANSIJE',
  },
]
