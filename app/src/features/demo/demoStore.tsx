import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import { useCloudStore } from '../cloud/cloudStore'

const DEMO_READ_ONLY_COPY =
  'Ovo je demo workspace. Kreirajte svoj workspace za punu funkcionalnost.'

interface DemoStoreValue {
  isDemoMode: boolean
  readOnlyMessage: string | null
  showReadOnlyNotice: (message?: string) => void
  dismissReadOnlyNotice: () => void
}

const DemoStoreContext = createContext<DemoStoreValue | null>(null)

export function DemoProvider({ children }: PropsWithChildren) {
  const cloud = useCloudStore()
  const [readOnlyMessage, setReadOnlyMessage] = useState<string | null>(null)

  const isDemoMode = !cloud.user || !cloud.activeWorkspace

  const dismissReadOnlyNotice = useCallback(() => {
    setReadOnlyMessage(null)
  }, [])

  const showReadOnlyNotice = useCallback((message?: string) => {
    setReadOnlyMessage(message || DEMO_READ_ONLY_COPY)
  }, [])

  useEffect(() => {
    if (!readOnlyMessage) return undefined

    const timer = window.setTimeout(() => {
      setReadOnlyMessage(null)
    }, 2600)

    return () => window.clearTimeout(timer)
  }, [readOnlyMessage])

  const value = useMemo<DemoStoreValue>(
    () => ({
      isDemoMode,
      readOnlyMessage,
      showReadOnlyNotice,
      dismissReadOnlyNotice,
    }),
    [dismissReadOnlyNotice, isDemoMode, readOnlyMessage, showReadOnlyNotice],
  )

  return (
    <DemoStoreContext.Provider value={value}>
      {children}
      {readOnlyMessage ? (
        <div className="demo-readonly-modal-backdrop" role="presentation" onClick={dismissReadOnlyNotice}>
          <div
            className="demo-readonly-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-readonly-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="demo-readonly-kicker">DEMO WORKSPACE</div>
            <h3 id="demo-readonly-title">Read-only pregled</h3>
            <p>{readOnlyMessage}</p>
            <button type="button" className="demo-readonly-button" onClick={dismissReadOnlyNotice}>
              Razumem
            </button>
          </div>
        </div>
      ) : null}
    </DemoStoreContext.Provider>
  )
}

export function useDemoStore() {
  const context = useContext(DemoStoreContext)

  if (!context) {
    throw new Error('useDemoStore must be used within DemoProvider')
  }

  return context
}

export { DEMO_READ_ONLY_COPY }
