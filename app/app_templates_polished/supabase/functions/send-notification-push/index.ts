import { createClient } from 'npm:@supabase/supabase-js@2'
import { GoogleAuth } from 'npm:google-auth-library@9'

type NotificationRow = {
  id: string
  workspace_id: string
  recipient_user_id: string
  title: string
  body: string
  entity_type: 'task' | 'billing'
  entity_id: string
}

type DeviceTokenRow = {
  token: string
  recipient_user_id: string
}

type FcmErrorResponse = {
  error?: {
    status?: string
    message?: string
    details?: Array<{
      errorCode?: string
    }>
  }
}

type RequestBody = {
  workspaceId?: string
  notificationIds?: string[]
  appBaseUrl?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(status: number, payload: Record<string, unknown>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getEntityLink(notification: NotificationRow) {
  if (notification.entity_type === 'task') return `tasks/${notification.entity_id}`
  return 'billing'
}

async function getAccessToken() {
  const serviceAccountJson = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') || ''
  if (!serviceAccountJson) {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON nije postavljen.')
  }

  const auth = new GoogleAuth({
    credentials: JSON.parse(serviceAccountJson),
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  })

  const token = await auth.getAccessToken()
  if (!token) throw new Error('FCM access token nije dobijen.')
  return token
}

async function verifyCallerMembership(
  authorizationHeader: string | null,
  workspaceId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  if (!authorizationHeader) return null

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        Authorization: authorizationHeader,
      },
    },
  })

  const token = authorizationHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return null

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userData.user.id)
    .maybeSingle()

  if (membershipError || !membership) return null
  return userData.user
}

async function sendPushMessage(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  link: string,
  notificationId: string,
  entityType: NotificationRow['entity_type'],
  entityId: string,
  iconUrl: string,
) {
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title,
          body,
        },
        data: {
          link,
          title,
          body,
          notificationId,
          entityType,
          entityId,
        },
        webpush: {
          headers: {
            Urgency: 'high',
            TTL: '2419200',
          },
          notification: {
            title,
            body,
            icon: iconUrl,
            badge: iconUrl,
          },
          fcm_options: {
            link,
          },
        },
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let parsed: FcmErrorResponse | null = null
    try {
      parsed = JSON.parse(errorText) as FcmErrorResponse
    } catch {
      parsed = null
    }
    const error = new Error(`FCM send failed: ${response.status} ${errorText}`) as Error & {
      status?: string
      errorCode?: string
    }
    error.status = parsed?.error?.status
    error.errorCode = parsed?.error?.details?.[0]?.errorCode
    throw error
  }
}

function isRevokableTokenError(error: unknown) {
  const candidate = error as { status?: string; errorCode?: string; message?: string }
  return (
    candidate?.status === 'NOT_FOUND' ||
    candidate?.errorCode === 'UNREGISTERED' ||
    candidate?.message?.includes('registration token is not a valid FCM registration token') ||
    candidate?.message?.includes('Requested entity was not found')
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  const firebaseProjectId = Deno.env.get('FCM_PROJECT_ID') || ''

  if (!supabaseUrl || !serviceRoleKey || !firebaseProjectId) {
    return jsonResponse(500, { error: 'Missing Supabase or Firebase env config.' })
  }

  let body: RequestBody
  try {
    body = await request.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON payload.' })
  }

  const workspaceId = (body.workspaceId || '').trim()
  const notificationIds = Array.isArray(body.notificationIds)
    ? body.notificationIds.map((item) => String(item || '').trim()).filter(Boolean)
    : []
  const appBaseUrl = (body.appBaseUrl || '').trim()

  if (!workspaceId || !notificationIds.length) {
    return jsonResponse(400, { error: 'workspaceId and notificationIds are required.' })
  }

  const caller = await verifyCallerMembership(
    request.headers.get('Authorization'),
    workspaceId,
    supabaseUrl,
    serviceRoleKey,
  )

  if (!caller) {
    return jsonResponse(401, { error: 'Unauthorized workspace member.' })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: notifications, error: notificationsError } = await supabase
    .from('notifications')
    .select('id, workspace_id, recipient_user_id, title, body, entity_type, entity_id')
    .eq('workspace_id', workspaceId)
    .in('id', notificationIds)

  if (notificationsError) {
    return jsonResponse(500, { error: notificationsError.message })
  }

  const typedNotifications = (notifications || []) as NotificationRow[]
  if (!typedNotifications.length) {
    return jsonResponse(200, { sent: 0, skipped: notificationIds.length })
  }

  const recipientIds = Array.from(new Set(typedNotifications.map((item) => item.recipient_user_id)))
  const { data: deviceTokens, error: tokensError } = await supabase
    .from('device_tokens')
    .select('token, recipient_user_id')
    .eq('workspace_id', workspaceId)
    .in('recipient_user_id', recipientIds)
    .is('revoked_at', null)

  if (tokensError) {
    return jsonResponse(500, { error: tokensError.message })
  }

  const tokenMap = new Map<string, string[]>()
  ;((deviceTokens || []) as DeviceTokenRow[]).forEach((row) => {
    const current = tokenMap.get(row.recipient_user_id) || []
    current.push(row.token)
    tokenMap.set(row.recipient_user_id, current)
  })

  const accessToken = await getAccessToken()
  let sent = 0
  let skipped = 0
  let failed = 0
  const revokedTokens = new Set<string>()

  for (const notification of typedNotifications) {
    const recipientTokens = tokenMap.get(notification.recipient_user_id) || []
    if (!recipientTokens.length) {
      skipped += 1
      continue
    }

    const relativeLink = getEntityLink(notification)
    const normalizedBaseUrl = appBaseUrl || 'https://example.com/'
    const absoluteLink = new URL(relativeLink, normalizedBaseUrl).toString()
    const iconUrl = new URL('icon-192.png', normalizedBaseUrl).toString()

    for (const token of recipientTokens) {
      try {
        await sendPushMessage(
          accessToken,
          firebaseProjectId,
          token,
          notification.title,
          notification.body,
          absoluteLink,
          notification.id,
          notification.entity_type,
          notification.entity_id,
          iconUrl,
        )
        sent += 1
      } catch (error) {
        failed += 1
        if (isRevokableTokenError(error)) {
          revokedTokens.add(token)
        }
        console.error('push send failed', notification.id, token, error)
      }
    }
  }

  if (revokedTokens.size) {
    const revokedAt = new Date().toISOString()
    const { error: revokeError } = await supabase
      .from('device_tokens')
      .update({ revoked_at: revokedAt, updated_at: revokedAt })
      .eq('workspace_id', workspaceId)
      .in('token', Array.from(revokedTokens))

    if (revokeError) {
      console.error('device token revoke failed', revokeError)
    }
  }

  return jsonResponse(200, {
    sent,
    skipped,
    failed,
    revokedTokens: revokedTokens.size,
  })
})
