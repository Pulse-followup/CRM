const APP_OWNER_EMAILS = ['dragan@retailmediacenter.com']

function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase()
}

export function isUsageOwnerEmail(email?: string | null) {
  const normalized = normalizeEmail(email)
  return normalized ? APP_OWNER_EMAILS.includes(normalized) : false
}
