import type { Client } from './types'

export const mockClients: Record<string, Client> = {
  '1': {
    id: 1,
    name: 'Extra Care',
    city: 'Beograd',
    address: 'Bulevar umetnosti 12',
    contacts: [
      {
        name: 'Matija Jovanovic',
        role: 'Vlasnik',
        email: 'matija@extracare.rs',
        phone: '+381 60 123 4567',
      },
      {
        name: 'Tamara Nikolic',
        role: 'Marketing',
        email: 'tamara@extracare.rs',
        phone: '+381 64 555 1020',
      },
    ],
    commercial: {
      businessType: 'Apoteka',
      revenueBand: 'Srednji',
      employeeCount: 24,
      locationCount: 3,
      decisionLevel: 'Vlasnik',
      relationshipLevel: 'Imamo komunikaciju',
      innovationReady: 'Da',
    },
  },
}
