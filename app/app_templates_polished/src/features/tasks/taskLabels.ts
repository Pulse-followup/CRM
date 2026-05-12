import type { TaskStatus, TaskType } from './types'

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  poziv: 'Poziv',
  mail: 'Mail',
  sastanak: 'Sastanak',
  follow_up: 'Follow-up',
  ponuda: 'Ponuda',
  naplata: 'Naplata',
  interni_zadatak: 'Interni zadatak',
  drugo: 'Drugo',
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  dodeljen: 'Dodeljen',
  u_radu: 'U radu',
  na_cekanju: 'Na cekanju',
  zavrsen: 'Zavrsen',
  vracen: 'Vracen',
  poslat_na_naplatu: 'Poslat na naplatu',
  naplacen: 'Naplacen',
}
