import type { Project } from './types'

export const mockProjects: Project[] = [
  {
    id: '1',
    clientId: '1',
    title: 'Apoteka RS reklame',
    status: 'aktivan',
    type: 'Kampanja',
    frequency: 'Mesecno',
    value: 180000,
  },
  {
    id: '2',
    clientId: '1',
    title: 'Postavka pulta u Galeriji',
    status: 'aktivan',
    type: 'Usluga',
    frequency: 'Jednokratno',
    value: 95000,
  },
  {
    id: '3',
    clientId: '1',
    title: 'Pilot oznacavanja rafova',
    status: 'arhiviran',
    type: 'Odrzavanje',
    frequency: 'Kontinuirano',
    value: 42000,
  },
]
