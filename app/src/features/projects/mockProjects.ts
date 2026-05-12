import type { Project } from './types'

export const mockProjects: Project[] = [
  {
    id: '1',
    clientId: '1',
    title: 'Letnja kampanja',
    status: 'aktivan',
    type: 'kampanja',
    frequency: 'jednokratno',
    value: 480000,
    dueDate: '2026-05-24',
  },
  {
    id: '2',
    clientId: '2',
    title: 'Otvaranje nove lokacije',
    status: 'aktivan',
    type: 'postavka',
    frequency: 'jednokratno',
    value: 920000,
    dueDate: '2026-05-30',
  },
]
