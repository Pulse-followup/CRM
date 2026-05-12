import type { Client } from './types'

export const mockClients: Record<string, Client> = {
  '1': {
    id: 1,
    name: 'Pharma Plus',
    city: 'Beograd',
    address: 'Bulevar Mihajla Pupina 18',
    contacts: [
      {
        name: 'Milica Stojanovic',
        role: 'Marketing menadzer',
        email: 'milica@pharmaplus.demo',
        phone: '+381 60 220 1100',
      },
    ],
    commercial: {
      businessType: 'farmacija',
      revenueBand: 'high',
      employeeCount: 85,
      locationCount: 12,
      decisionLevel: 'director',
      relationshipLevel: 'trusted',
      innovationReady: 'yes',
    },
  },
  '2': {
    id: 2,
    name: 'Green Bite Cafe',
    city: 'Novi Sad',
    address: 'Bulevar oslobodjenja 77',
    contacts: [
      {
        name: 'Nikola Vasic',
        role: 'Vlasnik',
        email: 'nikola@greenbite.demo',
        phone: '+381 64 401 0099',
      },
    ],
    commercial: {
      businessType: 'ugostiteljstvo',
      revenueBand: 'medium',
      employeeCount: 22,
      locationCount: 2,
      decisionLevel: 'owner',
      relationshipLevel: 'communication',
      innovationReady: 'yes',
    },
  },
  '3': {
    id: 3,
    name: 'FitZone Gym',
    city: 'Nis',
    address: 'Vizantijski bulevar 41',
    contacts: [
      {
        name: 'Ivana Petrovic',
        role: 'Brend menadzer',
        email: 'ivana@fitzone.demo',
        phone: '+381 63 600 720',
      },
    ],
    commercial: {
      businessType: 'fitness',
      revenueBand: 'medium',
      employeeCount: 35,
      locationCount: 4,
      decisionLevel: 'manager',
      relationshipLevel: 'warm',
      innovationReady: 'pilot',
    },
  },
}
