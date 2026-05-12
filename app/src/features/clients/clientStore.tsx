import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { mockClients } from './mockClients'
import { readStoredArray, writeStoredValue } from '../../shared/storage'
import { useCloudStore } from '../cloud/cloudStore'
import { useDemoStore } from '../demo/demoStore'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { Client, ClientContact, CommercialInputs } from './types'

const CLIENTS_STORAGE_KEY = 'pulse.clients.v1'

type CloudReadStatus = 'local' | 'loading' | 'cloud' | 'cloud-empty' | 'fallback' | 'error'

interface ClientStoreValue {
  clients: Client[]
  cloudReadStatus: CloudReadStatus
  cloudReadError: string | null
  refreshClientsFromCloud: () => Promise<void>
  getAllClients: () => Client[]
  getClientById: (clientId: string) => Client | null
  addClient: (client: Client) => Promise<Client | null> | Client | null
  updateClient: (clientId: string, patch: Partial<Omit<Client, 'id'>>) => Promise<Client | null> | Client | null
}

const ClientStoreContext = createContext<ClientStoreValue | null>(null)

export interface ClientProviderProps {
  children: ReactNode
}

function asNumber(value: unknown, fallback: number | null = null) {
  if (value === undefined || value === null || value === '') return fallback
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function normalizeContact(rawContact: Record<string, unknown>): ClientContact {
  return {
    name: asString(rawContact.name || rawContact.contactPerson || rawContact.person),
    role: asString(rawContact.role || rawContact.contactRole || rawContact.function),
    email: asString(rawContact.email || rawContact.contactEmail),
    phone: asString(rawContact.phone || rawContact.contactPhone),
    note: asString(rawContact.note),
  }
}

function extractContacts(row: Record<string, unknown>): ClientContact[] {
  const payment = row.payment && typeof row.payment === 'object' ? (row.payment as Record<string, unknown>) : {}
  const paymentContacts = Array.isArray(payment.contacts) ? payment.contacts : []
  const rowContacts = Array.isArray(row.contacts) ? row.contacts : paymentContacts
  const contacts = rowContacts
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map(normalizeContact)
    .filter((contact) => contact.name || contact.email || contact.phone || contact.role)

  if (contacts.length) return contacts

  const fallbackContact = normalizeContact({
    name: row.contact_person,
    role: row.contact_role,
    email: row.contact_email,
    phone: row.contact_phone,
  })

  return fallbackContact.name || fallbackContact.email || fallbackContact.phone || fallbackContact.role
    ? [fallbackContact]
    : []
}

function extractCommercial(row: Record<string, unknown>): CommercialInputs {
  const payment = row.payment && typeof row.payment === 'object' ? (row.payment as Record<string, unknown>) : {}
  const paymentCommercial =
    payment.commercialInputs && typeof payment.commercialInputs === 'object'
      ? (payment.commercialInputs as Record<string, unknown>)
      : {}
  const rowCommercial =
    row.commercial_inputs && typeof row.commercial_inputs === 'object'
      ? (row.commercial_inputs as Record<string, unknown>)
      : {}
  const commercial = { ...paymentCommercial, ...rowCommercial }

  return {
    businessType: asString(row.business_type || commercial.businessType || commercial.business_type),
    revenueBand: asString(row.company_size || commercial.revenueBand || commercial.revenue_band),
    employeeCount: asNumber(row.employee_count || commercial.employeeCount || commercial.employee_count),
    locationCount: asNumber(row.location_count || commercial.locationCount || commercial.location_count),
    decisionLevel: asString(row.decision_model || commercial.decisionLevel || commercial.decision_level),
    relationshipLevel: asString(row.relationship_strength || commercial.relationshipLevel || commercial.relationship_level),
    innovationReady: asString(row.pilot_readiness || commercial.innovationReady || commercial.innovation_ready),
  }
}

function mapClientRowToReact(row: Record<string, unknown>): Client {
  return {
    id: Number(row.id),
    name: asString(row.name),
    city: asString(row.client_city || row.city),
    address: asString(row.client_address || row.address),
    contacts: extractContacts(row),
    commercial: extractCommercial(row),
  }
}

function mapClientToSupabaseRow(client: Client, workspaceId: string, userId?: string | null) {
  const primaryContact = client.contacts?.[0]
  const commercial = client.commercial

  return {
    id: client.id,
    workspace_id: workspaceId,
    owner_user_id: userId || null,
    created_by_user_id: userId || null,
    name: client.name || 'Novi klijent',
    client_city: client.city || '',
    client_address: client.address || '',
    contact_person: primaryContact?.name || '',
    contact_role: primaryContact?.role || '',
    contact_phone: primaryContact?.phone || '',
    contact_email: primaryContact?.email || '',
    company_size: commercial?.revenueBand || '',
    decision_model: commercial?.decisionLevel || '',
    business_type: commercial?.businessType || '',
    relationship_strength: commercial?.relationshipLevel || '',
    pilot_readiness: commercial?.innovationReady || '',
    payment: { contacts: client.contacts || [], commercialInputs: commercial || {} },
    updated_at: new Date().toISOString(),
  }
}

export function ClientProvider({ children }: ClientProviderProps) {
  const { isConfigured, activeWorkspace, user } = useCloudStore()
  const { isDemoMode, showReadOnlyNotice } = useDemoStore()
  const isCloudMode = Boolean(isConfigured && activeWorkspace?.id)
  const [clients, setClients] = useState<Client[]>(() =>
    isDemoMode ? Object.values(mockClients) : readStoredArray(CLIENTS_STORAGE_KEY, Object.values(mockClients)),
  )
  const [cloudReadStatus, setCloudReadStatus] = useState<CloudReadStatus>('local')
  const [cloudReadError, setCloudReadError] = useState<string | null>(null)

  useEffect(() => {
    if (!isCloudMode && !isDemoMode) {
      writeStoredValue(CLIENTS_STORAGE_KEY, clients)
    }
  }, [clients, isCloudMode, isDemoMode])

  useEffect(() => {
    if (isCloudMode) {
      setClients([])
    }
  }, [isCloudMode])

  useEffect(() => {
    if (isDemoMode) {
      setClients(Object.values(mockClients))
    }
  }, [isDemoMode])

  const refreshClientsFromCloud = useCallback(async () => {
    const supabase = getSupabaseClient()

    if (!isConfigured || !supabase || !activeWorkspace?.id) {
      setCloudReadStatus('local')
      setCloudReadError(null)
      return
    }

    setCloudReadStatus('loading')
    setCloudReadError(null)

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('workspace_id', activeWorkspace.id)
      .order('created_at', { ascending: false })

    if (error) {
      setCloudReadStatus('error')
      setCloudReadError(error.message || 'Klijenti nisu ucitani iz Supabase-a.')
      return
    }

    const nextClients = Array.isArray(data)
      ? data
          .map((row) => mapClientRowToReact(row as Record<string, unknown>))
          .filter((client) => Number.isFinite(client.id) && client.name)
      : []

    setClients(nextClients)
    setCloudReadStatus(nextClients.length ? 'cloud' : 'cloud-empty')
  }, [activeWorkspace?.id, isConfigured])

  useEffect(() => {
    void refreshClientsFromCloud()
  }, [refreshClientsFromCloud])

  const value = useMemo<ClientStoreValue>(
    () => ({
      clients,
      cloudReadStatus,
      cloudReadError,
      refreshClientsFromCloud,
      getAllClients: () => clients,
      getClientById: (clientId: string) =>
        clients.find((client) => String(client.id) === clientId) ?? null,
      addClient: async (client: Client) => {
        if (isDemoMode) {
          showReadOnlyNotice()
          return null
        }

        if (isCloudMode) {
          if (!activeWorkspace?.id || !user?.id) return null
          const supabase = getSupabaseClient()
          if (!supabase) return null

          const { data, error } = await supabase
            .from('clients')
            .insert({ ...mapClientToSupabaseRow(client, activeWorkspace.id, user.id), created_at: new Date().toISOString() })
            .select('*')
            .single()

          if (error) {
            setCloudReadStatus('error')
            setCloudReadError(error.message || 'Klijent nije sacuvan u Supabase.')
            return null
          }

          const savedClient = mapClientRowToReact(data as Record<string, unknown>)
          setClients((current) => [savedClient, ...current.filter((item) => item.id !== savedClient.id)])
          setCloudReadStatus('cloud')
          setCloudReadError(null)
          return savedClient
        }

        setClients((current) => [client, ...current])
        return client
      },
      updateClient: async (clientId: string, patch: Partial<Omit<Client, 'id'>>) => {
        if (isDemoMode) {
          showReadOnlyNotice()
          return null
        }

        const existingClient = clients.find((client) => String(client.id) === clientId)
        if (!existingClient) return null
        const nextClient = { ...existingClient, ...patch }

        if (isCloudMode) {
          if (!activeWorkspace?.id || !user?.id) return null
          const supabase = getSupabaseClient()
          if (!supabase) return null

          const { data, error } = await supabase
            .from('clients')
            .update(mapClientToSupabaseRow(nextClient, activeWorkspace.id, user.id))
            .eq('id', Number(clientId))
            .eq('workspace_id', activeWorkspace.id)
            .select('*')
            .single()

          if (error) {
            setCloudReadStatus('error')
            setCloudReadError(error.message || 'Klijent nije azuriran u Supabase.')
            return null
          }

          const savedClient = mapClientRowToReact(data as Record<string, unknown>)
          setClients((current) => current.map((currentClient) => currentClient.id === savedClient.id ? savedClient : currentClient))
          setCloudReadStatus('cloud')
          setCloudReadError(null)
          return savedClient
        }

        setClients((current) =>
          current.map((currentClient) =>
            String(currentClient.id) === clientId ? nextClient : currentClient,
          ),
        )
        return nextClient
      },
    }),
    [activeWorkspace?.id, clients, cloudReadError, cloudReadStatus, isCloudMode, isDemoMode, refreshClientsFromCloud, showReadOnlyNotice, user?.id],
  )

  return <ClientStoreContext.Provider value={value}>{children}</ClientStoreContext.Provider>
}

export function useClientStore() {
  const context = useContext(ClientStoreContext)

  if (!context) {
    throw new Error('useClientStore must be used within ClientProvider')
  }

  return context
}
