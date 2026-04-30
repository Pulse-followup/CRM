import type { BillingStatus } from '../billing/types'

export type ProjectStatus = 'aktivan' | 'arhiviran' | 'zavrsen'

export type ProjectType = 'kampanja' | 'usluga' | 'postavka' | 'odrzavanje' | 'drugo'

export type ProjectFrequency =
  | 'jednokratno'
  | 'mesecno'
  | 'kvartalno'
  | 'godisnje'
  | 'po_potrebi'

export type ProjectTemplateId =
  | 'kampanja'
  | 'produkcija'
  | 'jednokratni'
  | 'sales'
  | 'odrzavanje'

export type ProjectStageStatus = 'locked' | 'active' | 'done'

export type ProjectStageRole =
  | 'admin'
  | 'user'
  | 'finance'
  | 'designer'
  | 'production'
  | 'logistics'
  | 'account'

export interface ProjectStage {
  id: string
  name: string
  order: number
  status: ProjectStageStatus
  defaultRole?: ProjectStageRole | string
}

export interface Project {
  id: string
  clientId: string
  title: string
  status: ProjectStatus
  type?: ProjectType
  frequency?: ProjectFrequency
  value?: number
  billingId?: string
  billingStatus?: BillingStatus
  templateId?: ProjectTemplateId
  stages?: ProjectStage[]
}