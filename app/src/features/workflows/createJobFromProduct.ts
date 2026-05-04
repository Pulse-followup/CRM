import type { ProductItem } from '../products/types'
import type { Project } from '../projects/types'
import type { Task } from '../tasks/types'
import type { ProcessTemplate } from '../templates/types'

export type CatalogJobDraft = {
  clientId: string
  product: ProductItem
  template: ProcessTemplate
  title: string
  dueDate?: string
  quantity: number
  fileLink?: string
  note?: string
}

export type CatalogJobPayload = {
  project: Project
  tasks: Task[]
}

export type CatalogJobTeamMember = {
  id: string
  name: string
  productionRole?: string | null
}

function safeId(prefix: string) {
  const randomId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${randomId}`
}

export const WORKDAY_MINUTES = 8 * 60

export function calculateTemplateEstimateMinutes(template: ProcessTemplate | null | undefined) {
  return (template?.steps || []).reduce((sum, step) => sum + (Number(step.estimatedMinutes) || 0), 0)
}

export function calculateTemplateEstimateDays(template: ProcessTemplate | null | undefined) {
  const totalMinutes = calculateTemplateEstimateMinutes(template)
  return totalMinutes > 0 ? Math.max(1, Math.ceil(totalMinutes / WORKDAY_MINUTES)) : 0
}

export function formatTemplateEstimate(template: ProcessTemplate | null | undefined) {
  const totalMinutes = calculateTemplateEstimateMinutes(template)
  if (!totalMinutes) return ''
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10
  const days = calculateTemplateEstimateDays(template)
  return `${days} ${days === 1 ? 'dan' : 'dana'} (${totalHours}h)`
}

function addCalendarDaysIso(startDate: Date, days: number) {
  const nextDate = new Date(startDate)
  nextDate.setHours(12, 0, 0, 0)
  nextDate.setDate(nextDate.getDate() + Math.max(0, days))
  return nextDate.toISOString().slice(0, 10)
}

export function calculateDefaultDueDate(template: ProcessTemplate | null | undefined, startDate = new Date()) {
  const days = calculateTemplateEstimateDays(template)
  return days ? addCalendarDaysIso(startDate, days) : ''
}

function calculateStepDueDate(template: ProcessTemplate, stepIndex: number, startDate = new Date()) {
  const sortedSteps = [...template.steps].sort((firstStep, secondStep) => firstStep.order - secondStep.order)
  const cumulativeMinutes = sortedSteps
    .slice(0, stepIndex + 1)
    .reduce((sum, step) => sum + (Number(step.estimatedMinutes) || 0), 0)
  const days = cumulativeMinutes > 0 ? Math.max(1, Math.ceil(cumulativeMinutes / WORKDAY_MINUTES)) : 0
  return days ? addCalendarDaysIso(startDate, days) : undefined
}


function normalizeRoleLabel(role?: string) {
  const value = role?.trim()
  if (!value) return 'BEZ ROLE'

  const roleMap: Record<string, string> = {
    admin: 'ADMIN',
    account: 'ACCOUNT',
    user: 'OPERATIVA',
    finance: 'FINANSIJE',
    designer: 'DIZAJNER',
    dizajner: 'DIZAJNER',
    production: 'PROIZVODNJA',
    produkcija: 'PROIZVODNJA',
    logistics: 'LOGISTIKA',
    logistika: 'LOGISTIKA',
  }

  const normalizedKey = value.toLowerCase()
  return roleMap[normalizedKey] || value.toUpperCase()
}

function findMemberByProductionRole(role: string, members: CatalogJobTeamMember[] = []) {
  const normalizedRole = normalizeRoleLabel(role)
  return members.find((member) => normalizeRoleLabel(member.productionRole || '') === normalizedRole) || null
}

function buildTaskDescription(draft: CatalogJobDraft, stepTitle: string) {
  const lines = [
    `Proizvod: ${draft.product.title}`,
    `Korak procesa: ${stepTitle}`,
    `Količina: ${draft.quantity}`,
    `Procena iz šablona: ${formatTemplateEstimate(draft.template) || '-'}`,
  ]

  if (draft.fileLink?.trim()) lines.push(`Link ka fajlu: ${draft.fileLink.trim()}`)
  if (draft.note?.trim()) lines.push(`Napomena: ${draft.note.trim()}`)

  return lines.join('\n')
}

export function buildCatalogJobPayload(draft: CatalogJobDraft, teamMembers: CatalogJobTeamMember[] = []): CatalogJobPayload {
  const timestamp = new Date().toISOString()
  const projectId = safeId('project')
  const sortedSteps = [...draft.template.steps].sort((firstStep, secondStep) => firstStep.order - secondStep.order)

  const project: Project = {
    id: projectId,
    clientId: draft.clientId,
    title: draft.title.trim() || draft.product.title,
    type: 'prodaja',
    frequency: 'jednokratno',
    value: draft.product.price * draft.quantity,
    status: 'aktivan',
    source: 'product',
    sourceProductId: draft.product.id,
    sourceProductTitle: draft.product.title,
    sourceTemplateId: draft.template.id,
    sourceTemplateTitle: draft.template.title,
    templateId: draft.template.id,
    stages: sortedSteps.map((step, index) => ({
      id: `stage-${projectId}-${step.id}`,
      name: step.title,
      order: index + 1,
      status: index === 0 ? 'active' : 'locked',
      defaultRole: normalizeRoleLabel(step.role),
    })),
  }

  const tasks: Task[] = sortedSteps.map((step, index) => {
    const requiredRole = normalizeRoleLabel(step.role)
    const matchedMember = findMemberByProductionRole(requiredRole, teamMembers)

    return {
      id: safeId('task'),
      clientId: draft.clientId,
      projectId,
      title: step.title,
      description: buildTaskDescription(draft, step.title),
      type: 'interni_zadatak',
      status: 'dodeljen',
      assignedToUserId: matchedMember?.id,
      assignedToLabel: matchedMember?.name || requiredRole,
      requiredRole,
      dueDate: calculateStepDueDate(draft.template, index) || draft.dueDate || undefined,
      stageId: project.stages?.[index]?.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: null,
      billingState: 'not_billable',
      source: 'template',
      sourceProductId: draft.product.id,
      sourceProductTitle: draft.product.title,
      sourceTemplateId: draft.template.id,
      sourceTemplateTitle: draft.template.title,
      sourceTemplateStepId: step.id,
    }
  })

  return { project, tasks }
}
