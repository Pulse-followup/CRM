export type WorkspacePlanType = 'FREE' | 'PRO'

export const WORKSPACE_PLAN_LIMITS = {
  FREE: {
    clients: 3,
    members: 5,
  },
  PRO: {
    clients: Number.POSITIVE_INFINITY,
    members: Number.POSITIVE_INFINITY,
  },
} as const

export function normalizePlanType(value: unknown): WorkspacePlanType {
  return String(value || '').toUpperCase() === 'PRO' ? 'PRO' : 'FREE'
}

export function getWorkspaceLimits(planType: WorkspacePlanType | null | undefined) {
  return WORKSPACE_PLAN_LIMITS[normalizePlanType(planType)]
}

export function formatClientUsage(count: number, planType: WorkspacePlanType | null | undefined) {
  if (normalizePlanType(planType) === 'PRO') return 'PRO ACTIVE'
  return `${count} / ${WORKSPACE_PLAN_LIMITS.FREE.clients} klijenta iskorišćeno`
}

export function formatMemberUsage(count: number, planType: WorkspacePlanType | null | undefined) {
  if (normalizePlanType(planType) === 'PRO') return 'PRO ACTIVE'
  return `${count} / ${WORKSPACE_PLAN_LIMITS.FREE.members} članova iskorišćeno`
}
