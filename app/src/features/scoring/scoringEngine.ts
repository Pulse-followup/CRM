import { getProjectHealth } from '../projects/projectHealth'
import type { BillingRecord } from '../billing/types'
import type { Client, ClientContact } from '../clients/types'
import type { Project } from '../projects/types'
import type { Task } from '../tasks/types'
import type { ClientScore, ScoreBreakdown, ScorePriority, ScoringState } from './scoringTypes'

const ACTIVE_TASK_STATUSES = new Set(['dodeljen', 'u_radu', 'vracen'])
const COMPLETED_TASK_STATUSES = new Set(['zavrsen', 'poslat_na_naplatu', 'naplacen'])

function clampScore(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)))
}

function toPriority(total: number): ScorePriority {
  if (total <= 40) return 'low'
  if (total <= 70) return 'medium'
  return 'high'
}

function pushUnique(list: string[], value: string) {
  if (!list.includes(value)) {
    list.push(value)
  }
}

function isPastDue(value?: string) {
  if (!value) return false

  const dueDate = new Date(value)
  if (Number.isNaN(dueDate.getTime())) return false

  const today = new Date()
  const dueDateKey = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime()
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

  return dueDateKey < todayKey
}

function hasOwnerContact(contacts: ClientContact[]) {
  return contacts.some((contact) => {
    const role = contact.role.toLowerCase()
    return role.includes('vlasnik') || role.includes('direktor') || role.includes('owner')
  })
}

function hasFunctionalBreadth(contacts: ClientContact[]) {
  const normalizedRoles = new Set(
    contacts
      .map((contact) => contact.role.trim().toLowerCase())
      .filter(Boolean),
  )

  return normalizedRoles.size >= 2
}

function calculateCommercialScore(client: Client, positives: string[], risks: string[]) {
  const { commercial } = client

  const businessTypePoints: Record<string, number> = {
    apoteka: 7,
    maloprodaja: 6,
    ugostiteljstvo: 5,
    usluge: 4,
    drzavne_institucije: 3,
    proizvodnja: 6,
    distribucija: 5,
    ostalo: 2,
  }

  const revenuePoints: Record<string, number> = {
    small: 2,
    medium: 5,
    large: 7,
  }

  const decisionInnovationPoints: Record<string, number> = {
    yes: 5,
    no: 1,
  }

  const employeePoints =
    commercial.employeeCount && commercial.employeeCount >= 50
      ? 6
      : commercial.employeeCount && commercial.employeeCount >= 20
        ? 4
        : commercial.employeeCount && commercial.employeeCount >= 5
          ? 2
          : commercial.employeeCount && commercial.employeeCount > 0
            ? 1
            : 0

  const locationPoints =
    commercial.locationCount && commercial.locationCount >= 10
      ? 5
      : commercial.locationCount && commercial.locationCount >= 3
        ? 3
        : commercial.locationCount && commercial.locationCount > 0
          ? 1
          : 0

  const score = clampScore(
    (businessTypePoints[commercial.businessType] ?? 0) +
      (revenuePoints[commercial.revenueBand] ?? 0) +
      employeePoints +
      locationPoints +
      (decisionInnovationPoints[commercial.innovationReady] ?? 0),
    30,
  )

  if (commercial.revenueBand === 'large') {
    pushUnique(positives, 'Visok komercijalni potencijal')
  }

  if (commercial.innovationReady === 'yes') {
    pushUnique(positives, 'Otvoren za inovacije')
  }

  if (!commercial.businessType) {
    pushUnique(risks, 'Nepotpuni komercijalni podaci')
  }

  return score
}

function calculateRelationshipScore(client: Client, positives: string[], risks: string[]) {
  const { commercial, contacts } = client

  const decisionPoints: Record<string, number> = {
    owner: 5,
    management: 3,
    local: 1,
  }

  const relationshipPoints: Record<string, number> = {
    trust: 5,
    communication: 3,
    new: 1,
  }

  const ownerContactPoints = hasOwnerContact(contacts) ? 3 : 0
  const breadthPoints = hasFunctionalBreadth(contacts) ? 2 : 0

  const score = clampScore(
    (decisionPoints[commercial.decisionLevel] ?? 0) +
      (relationshipPoints[commercial.relationshipLevel] ?? 0) +
      ownerContactPoints +
      breadthPoints,
    15,
  )

  if (ownerContactPoints) {
    pushUnique(positives, 'Kontakt sa donosiocem odluka')
  } else {
    pushUnique(risks, 'Nema kontakta vlasnik/direktor')
  }

  if (breadthPoints) {
    pushUnique(positives, 'Vise funkcionalnih kontakata')
  }

  if (commercial.relationshipLevel === 'new') {
    pushUnique(risks, 'Odnos je jos u ranoj fazi')
  }

  return score
}

function calculateProjectScore(projects: Project[], tasks: Task[], positives: string[], risks: string[]) {
  const activeProjects = projects.filter((project) => project.status === 'aktivan')
  const totalValue = activeProjects.reduce((sum, project) => sum + (project.value ?? 0), 0)
  const healthKeys = projects.map((project) => getProjectHealth(project.id, tasks).key)
  const hasLateProject = healthKeys.includes('late')
  const hasWaitingProject = healthKeys.includes('waiting')
  const hasActiveProjectHealth = healthKeys.includes('active')
  const allDone = healthKeys.length > 0 && healthKeys.every((key) => key === 'done')

  const countPoints =
    activeProjects.length >= 3 ? 7 : activeProjects.length === 2 ? 5 : activeProjects.length === 1 ? 3 : 0

  const valuePoints = totalValue >= 200000 ? 7 : totalValue >= 100000 ? 5 : totalValue > 0 ? 3 : 0

  const healthPoints = hasLateProject
    ? 0
    : hasWaitingProject
      ? 2
      : allDone
        ? 6
        : hasActiveProjectHealth
          ? 4
          : 0

  const score = clampScore(countPoints + valuePoints + healthPoints, 20)

  if (activeProjects.length > 0) {
    pushUnique(positives, 'Aktivni projekti')
  } else {
    pushUnique(risks, 'Nema aktivnih projekata')
  }

  if (hasLateProject) {
    pushUnique(risks, 'Kasne obaveze')
  }

  if (allDone && projects.length > 0) {
    pushUnique(positives, 'Projekti uredno zavrseni')
  }

  return score
}

function calculateTaskScore(tasks: Task[], positives: string[], risks: string[]) {
  const activeTasks = tasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.status) || (task.status === 'na_cekanju' && !task.dependsOnTaskId))
  const completedTasks = tasks.filter((task) => COMPLETED_TASK_STATUSES.has(task.status))
  const lateTasks = activeTasks.filter((task) => isPastDue(task.dueDate))
  const recentActivityTasks = tasks.filter((task) => typeof task.timeSpentMinutes === 'number' && task.timeSpentMinutes > 0)

  const activePoints =
    activeTasks.length >= 5 ? 6 : activeTasks.length >= 3 ? 4 : activeTasks.length >= 1 ? 2 : 0
  const completedPoints =
    completedTasks.length >= 5 ? 8 : completedTasks.length >= 3 ? 6 : completedTasks.length >= 1 ? 3 : 0
  const momentumPoints = recentActivityTasks.length >= 3 ? 6 : recentActivityTasks.length >= 1 ? 3 : 0
  const latePenalty = Math.min(6, lateTasks.length * 3)

  const score = clampScore(activePoints + completedPoints + momentumPoints - latePenalty, 20)

  if (completedTasks.length > 0) {
    pushUnique(positives, 'Zavrseni taskovi')
  }

  if (recentActivityTasks.length > 0) {
    pushUnique(positives, 'Postoji radni momentum')
  } else {
    pushUnique(risks, 'Nema aktivnosti')
  }

  if (lateTasks.length > 0) {
    pushUnique(risks, 'Kasne obaveze')
  }

  return score
}

function calculateBillingScore(records: BillingRecord[], positives: string[], risks: string[]) {
  const paidCount = records.filter((record) => record.status === 'paid').length
  const invoicedCount = records.filter((record) => record.status === 'invoiced').length
  const draftCount = records.filter((record) => record.status === 'draft').length
  const overdueCount = records.filter((record) => record.status === 'overdue').length
  const cancelledCount = records.filter((record) => record.status === 'cancelled').length

  const score = clampScore(
    paidCount * 5 + invoicedCount * 3 + draftCount * 2 - overdueCount * 4 - cancelledCount * 3,
    15,
  )

  if (paidCount > 0) {
    pushUnique(positives, 'Placanja uredna')
  }

  if (draftCount > 0 || invoicedCount > 0) {
    pushUnique(positives, 'Aktivna naplata')
  }

  if (overdueCount > 0) {
    pushUnique(risks, 'Postoje kasnjenja u naplati')
  }

  if (cancelledCount > 0) {
    pushUnique(risks, 'Otkazani billing nalozi')
  }

  return score
}

export function calculateClientScore(clientId: string, state: ScoringState): ClientScore {
  const client = state.clients.find((item) => String(item.id) === clientId)

  if (!client) {
    const emptyBreakdown: ScoreBreakdown = {
      commercial: 0,
      relationship: 0,
      projects: 0,
      tasks: 0,
      billing: 0,
    }

    return {
      total: 0,
      breakdown: emptyBreakdown,
      priority: 'low',
      signals: {
        positives: [],
        risks: ['Klijent nije pronadjen'],
      },
    }
  }

  const clientProjects = state.projects.filter((project) => project.clientId === clientId)
  const clientTasks = state.tasks.filter((task) => task.clientId === clientId)
  const clientBilling = state.billing.filter((record) => record.clientId === clientId)
  const positives: string[] = []
  const risks: string[] = []

  const breakdown: ScoreBreakdown = {
    commercial: calculateCommercialScore(client, positives, risks),
    relationship: calculateRelationshipScore(client, positives, risks),
    projects: calculateProjectScore(clientProjects, clientTasks, positives, risks),
    tasks: calculateTaskScore(clientTasks, positives, risks),
    billing: calculateBillingScore(clientBilling, positives, risks),
  }

  const total = clampScore(
    breakdown.commercial +
      breakdown.relationship +
      breakdown.projects +
      breakdown.tasks +
      breakdown.billing,
    100,
  )

  return {
    total,
    breakdown,
    priority: toPriority(total),
    signals: {
      positives,
      risks,
    },
  }
}
