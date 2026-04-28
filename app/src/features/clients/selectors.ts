import { mockClients } from './mockClients'
import type { Client } from './types'

export function getClientById(clientId: string): Client | null {
  return mockClients[clientId] ?? null
}

export function getAllClients(): Client[] {
  return Object.values(mockClients)
}
