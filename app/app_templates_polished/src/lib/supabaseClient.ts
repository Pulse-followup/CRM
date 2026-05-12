import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type RuntimeConfig = {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  url?: string
  anonKey?: string
}

declare global {
  interface Window {
    SUPABASE_CONFIG?: RuntimeConfig
  }
}

let client: SupabaseClient | null = null

export function getSupabaseConfig() {
  const runtimeConfig = typeof window !== 'undefined' ? window.SUPABASE_CONFIG : undefined
  const url = import.meta.env.VITE_SUPABASE_URL || runtimeConfig?.SUPABASE_URL || runtimeConfig?.url || ''
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY || runtimeConfig?.SUPABASE_ANON_KEY || runtimeConfig?.anonKey || ''

  return { url, anonKey, isConfigured: Boolean(url && anonKey) }
}

export function getSupabaseClient() {
  const { url, anonKey, isConfigured } = getSupabaseConfig()

  if (!isConfigured) {
    return null
  }

  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  }

  return client
}
