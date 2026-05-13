import { getSupabaseClient } from '../../lib/supabaseClient'

export type UsageEventType =
  | 'app_opened'
  | 'login_success'
  | 'demo_opened'
  | 'client_opened'
  | 'project_opened'
  | 'task_opened'
  | 'task_created'
  | 'task_completed'
  | 'billing_opened'
  | 'invite_created'
  | 'notification_clicked'
  | 'push_enabled'
  | 'onboarding_completed'

type UsageContext = {
  workspaceId?: string | null
  userId?: string | null
  userEmail?: string | null
  isDemoMode?: boolean
}

type TrackEventPayload = {
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
  workspaceId?: string | null
  userId?: string | null
  userEmail?: string | null
}

let usageContext: UsageContext = {}

export function setUsageTrackingContext(nextContext: UsageContext) {
  usageContext = {
    workspaceId: nextContext.workspaceId || null,
    userId: nextContext.userId || null,
    userEmail: nextContext.userEmail || null,
    isDemoMode: Boolean(nextContext.isDemoMode),
  }
}

export function trackEvent(eventType: UsageEventType, payload: TrackEventPayload = {}) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    console.warn('[usage] Supabase client nije dostupan za', eventType)
    return
  }

  const row = {
    workspace_id: payload.workspaceId ?? usageContext.workspaceId ?? null,
    user_id: payload.userId ?? usageContext.userId ?? null,
    user_email: payload.userEmail ?? usageContext.userEmail ?? null,
    event_type: eventType,
    entity_type: payload.entityType ?? null,
    entity_id: payload.entityId ?? null,
    metadata: {
      ...(usageContext.isDemoMode ? { demoMode: true } : {}),
      ...(payload.metadata || {}),
    },
  }

  queueMicrotask(() => {
    void (async () => {
      try {
        const { error } = await supabase.from('usage_events').insert(row)
        if (error) {
          console.warn('[usage] insert failed for', eventType, error.message)
        }
      } catch (error) {
        console.warn('[usage] insert crashed for', eventType, error)
      }
    })()
  })
}
