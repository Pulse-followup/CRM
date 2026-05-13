export const CHECKLIST_MINIMIZED_KEY = 'pulse.setupChecklist.minimized.v1'
export const CHECKLIST_TIPS_KEY = 'pulse.setupChecklist.tips.v1'
export const CHECKLIST_DISMISSED_KEY = 'pulse.onboarding.dismissed'
export const CHECKLIST_SUCCESS_SEEN_KEY = 'pulse.onboarding.successSeen.v1'

export function readBooleanFlag(key: string, fallback: boolean) {
  if (typeof window === 'undefined') return fallback
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return fallback
  }
}

export function writeBooleanFlag(key: string, value: boolean) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // localStorage is optional.
  }
}

export function readSeenTips() {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(CHECKLIST_TIPS_KEY) || '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

export function writeSeenTips(next: Record<string, boolean>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CHECKLIST_TIPS_KEY, JSON.stringify(next))
  } catch {
    // localStorage is optional.
  }
}

export function resetOnboardingChecklistState() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(CHECKLIST_DISMISSED_KEY)
    window.localStorage.removeItem(CHECKLIST_SUCCESS_SEEN_KEY)
    window.localStorage.removeItem(CHECKLIST_MINIMIZED_KEY)
    window.localStorage.removeItem(CHECKLIST_TIPS_KEY)
  } catch {
    // localStorage is optional.
  }
}
