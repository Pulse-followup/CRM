import { readStoredArray, writeStoredValue } from '../../shared/storage'

export const INTERNAL_FOLLOWUPS_STORAGE_KEY = 'pulse.internalFollowups.v1'

export interface InternalFollowUpLogRecord {
  id: string
  type: 'internal_followup'
  mode: 'internal'
  taskId: string
  projectId: string
  clientId: string
  assignedUserId: string
  assignedUserName: string
  message: string
  tone: string
  createdAt: string
  createdBy: string
  read: boolean
}

export function appendInternalFollowUpLog(record: InternalFollowUpLogRecord) {
  const current = readStoredArray<InternalFollowUpLogRecord>(INTERNAL_FOLLOWUPS_STORAGE_KEY, [])
  writeStoredValue(INTERNAL_FOLLOWUPS_STORAGE_KEY, [record, ...current].slice(0, 300))
}
