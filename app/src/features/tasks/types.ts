export type TaskStatus =
  | 'dodeljen'
  | 'u_radu'
  | 'na_cekanju'
  | 'zavrsen'
  | 'vracen'
  | 'poslat_na_naplatu'
  | 'naplacen'

export type TaskType =
  | 'poziv'
  | 'mail'
  | 'sastanak'
  | 'follow_up'
  | 'ponuda'
  | 'naplata'
  | 'interni_zadatak'
  | 'drugo'

export interface Task {
  id: string
  clientId: string
  projectId: string
  title: string
  description?: string
  type?: TaskType
  status: TaskStatus
  assignedToUserId?: string
  assignedToLabel?: string
  dueDate?: string
  timeSpentMinutes?: number
  materialCost?: number
  materialDescription?: string
  laborCost?: number
  billingStatus?: string
}
