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

export type TaskBillingState =
  | 'not_billable'
  | 'ready_for_billing'
  | 'sent_to_billing'
  | 'billed'

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
  /** Operativna rola potrebna za task iz šablona. Ovo nije systemRole korisnika. */
  requiredRole?: string
  dueDate?: string
  stageId?: string
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  timeSpentMinutes?: number
  materialCost?: number
  materialDescription?: string
  laborCost?: number
  billingStatus?: string
  billingState?: TaskBillingState
  billingId?: string | null
  source?: 'template' | 'manual'
  sourceProductId?: string
  sourceProductTitle?: string
  sourceTemplateId?: string
  sourceTemplateTitle?: string
  sourceTemplateStepId?: string
  /** Redosled taska u automatskom workflow-u. */
  sequenceOrder?: number
  /** Task koji mora biti zavrsen pre aktivacije ovog taska. */
  dependsOnTaskId?: string
  /** Kada je task postao aktivan za rad. */
  activatedAt?: string | null
  /** Procena trajanja koraka iz sablona. */
  estimatedMinutes?: number
}
