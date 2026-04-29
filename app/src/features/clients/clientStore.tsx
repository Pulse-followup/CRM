import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { mockClients } from './mockClients'
import { readStoredArray, writeStoredValue } from '../../shared/storage'
import type { Client } from './types'

const CLIENTS_STORAGE_KEY = 'pulse.clients.v1'

interface ClientStoreValue {
  clients: Client[]
  getAllClients: () => Client[]
  getClientById: (clientId: string) => Client | null
  addClient: (client: Client) => void
  updateClient: (clientId: string, patch: Partial<Omit<Client, 'id'>>) => void
}

const ClientStoreContext = createContext<ClientStoreValue | null>(null)

export interface ClientProviderProps {
  children: ReactNode
}

export function ClientProvider({ children }: ClientProviderProps) {
  const [clients, setClients] = useState<Client[]>(() =>
    readStoredArray(CLIENTS_STORAGE_KEY, Object.values(mockClients)),
  )

  useEffect(() => {
    writeStoredValue(CLIENTS_STORAGE_KEY, clients)
  }, [clients])

  const value = useMemo<ClientStoreValue>(
    () => ({
      clients,
      getAllClients: () => clients,
      getClientById: (clientId: string) =>
        clients.find((client) => String(client.id) === clientId) ?? null,
      addClient: (client: Client) => {
        setClients((current) => [client, ...current])
      },
      updateClient: (clientId: string, patch: Partial<Omit<Client, 'id'>>) => {
        setClients((current) =>
          current.map((currentClient) =>
            String(currentClient.id) === clientId ? { ...currentClient, ...patch } : currentClient,
          ),
        )
      },
    }),
    [clients],
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
