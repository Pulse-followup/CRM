import type { BillingRecord } from '../billing/types'
import type { Client } from '../clients/types'
import type { Project } from '../projects/types'
import type { Task } from '../tasks/types'

export type ScorePriority = 'low' | 'medium' | 'high'

export interface ScoreBreakdown {
  commercial: number
  relationship: number
  projects: number
  tasks: number
  billing: number
}

export interface ScoreSignals {
  positives: string[]
  risks: string[]
}

export interface ClientScore {
  total: number
  breakdown: ScoreBreakdown
  priority: ScorePriority
  signals: ScoreSignals
}

export interface ScoringState {
  clients: Client[]
  projects: Project[]
  tasks: Task[]
  billing: BillingRecord[]
}

export interface ClientWithScore {
  client: Client
  score: ClientScore
}
