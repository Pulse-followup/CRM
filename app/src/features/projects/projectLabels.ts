import type { ProjectFrequency, ProjectStatus, ProjectType } from './types'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  kampanja: 'Kampanja',
  prodaja: 'Prodaja',
  usluga: 'Usluga',
  postavka: 'Postavka',
  odrzavanje: 'Odrzavanje',
  drugo: 'Drugo',
}

export const PROJECT_FREQUENCY_LABELS: Record<ProjectFrequency, string> = {
  jednokratno: 'Jednokratno',
  mesecno: 'Mesecno',
  kvartalno: 'Kvartalno',
  godisnje: 'Godisnje',
  po_potrebi: 'Po potrebi',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  aktivan: 'Aktivan',
  zavrsen: 'Zavrsen',
  arhiviran: 'Arhiviran',
}
