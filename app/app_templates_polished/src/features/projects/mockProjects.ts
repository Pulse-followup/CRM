import type { Project } from './types'

export const mockProjects: Project[] = [
  {
    id: '1',
    clientId: '1',
    title: 'Apoteka RS reklame',
    status: 'aktivan',
    type: 'kampanja',
    frequency: 'mesecno',
    value: 180000,
  },
  {
    id: '2',
    clientId: '1',
    title: 'Postavka pulta u Galeriji',
    status: 'aktivan',
    type: 'postavka',
    frequency: 'jednokratno',
    value: 95000,
  },
  {
    id: '3',
    clientId: '1',
    title: 'Pilot oznacavanja rafova',
    status: 'arhiviran',
    type: 'odrzavanje',
    frequency: 'po_potrebi',
    value: 42000,
  },
]
