import { mockBilling } from '../billing/mockBilling'
import { getAllClients } from '../clients/selectors'
import { getProjectsByClientId } from '../projects/selectors'
import { mockTasks } from '../tasks/mockTasks'
import { getTasksByClient } from '../tasks/taskSelectors'
import { calculateClientScore } from './scoringEngine'
import type { ClientWithScore, ScoringState } from './scoringTypes'

function buildDefaultScoringState(): ScoringState {
  const clients = getAllClients()
  const projects = clients.flatMap((client) => getProjectsByClientId(String(client.id)))
  const tasks = clients.flatMap((client) => getTasksByClient(mockTasks, String(client.id)))

  return {
    clients,
    projects,
    tasks,
    billing: mockBilling,
  }
}

export function getClientScore(clientId: string, state: ScoringState = buildDefaultScoringState()) {
  return calculateClientScore(clientId, state)
}

export function getAllClientsWithScore(
  state: ScoringState = buildDefaultScoringState(),
): ClientWithScore[] {
  return state.clients.map((client) => ({
    client,
    score: calculateClientScore(String(client.id), state),
  }))
}