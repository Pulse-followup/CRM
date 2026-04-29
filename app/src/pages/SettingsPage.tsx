import { useRef } from 'react'

const CLIENTS_STORAGE_KEY = 'pulse.clients.v1'
const PROJECTS_STORAGE_KEY = 'pulse.projects.v1'
const TASKS_STORAGE_KEY = 'pulse.tasks.v1'
const STORAGE_KEYS = [CLIENTS_STORAGE_KEY, PROJECTS_STORAGE_KEY, TASKS_STORAGE_KEY]

interface BackupPayload {
  version: number
  exportedAt: string
  clients: unknown[]
  projects: unknown[]
  tasks: unknown[]
}

function SettingsPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const readStoredArray = (key: string) => {
    try {
      const rawValue = window.localStorage.getItem(key)
      if (!rawValue) return []

      const parsedValue: unknown = JSON.parse(rawValue)
      return Array.isArray(parsedValue) ? parsedValue : []
    } catch {
      return []
    }
  }

  const handleResetLocalData = () => {
    const confirmed = window.confirm(
      'Da li sigurno zelis da obrises lokalne React podatke i vratis aplikaciju na mock seed?',
    )

    if (!confirmed) {
      return
    }

    try {
      STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key))
    } catch {
      // Keep reload behavior even if localStorage is unavailable.
    }

    window.location.assign('/CRM/')
  }

  const handleExportData = () => {
    const payload: BackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      clients: readStoredArray(CLIENTS_STORAGE_KEY),
      projects: readStoredArray(PROJECTS_STORAGE_KEY),
      tasks: readStoredArray(TASKS_STORAGE_KEY),
    }

    const json = JSON.stringify(payload, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    const formattedDate = new Date().toISOString().slice(0, 10)

    link.href = url
    link.download = `pulse-backup-${formattedDate}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const handleOpenImport = () => {
    importInputRef.current?.click()
  }

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const rawText = await file.text()
      const parsedValue: unknown = JSON.parse(rawText)

      if (
        !parsedValue ||
        typeof parsedValue !== 'object' ||
        !Array.isArray((parsedValue as BackupPayload).clients) ||
        !Array.isArray((parsedValue as BackupPayload).projects) ||
        !Array.isArray((parsedValue as BackupPayload).tasks)
      ) {
        window.alert('Backup fajl nije validan.')
        event.target.value = ''
        return
      }

      const confirmed = window.confirm(
        'Da li sigurno zelis da uvezes backup i pregazis lokalne React podatke?',
      )

      if (!confirmed) {
        event.target.value = ''
        return
      }

      window.localStorage.setItem(
        CLIENTS_STORAGE_KEY,
        JSON.stringify((parsedValue as BackupPayload).clients),
      )
      window.localStorage.setItem(
        PROJECTS_STORAGE_KEY,
        JSON.stringify((parsedValue as BackupPayload).projects),
      )
      window.localStorage.setItem(
        TASKS_STORAGE_KEY,
        JSON.stringify((parsedValue as BackupPayload).tasks),
      )

      event.target.value = ''
      window.location.assign('/CRM/')
    } catch {
      window.alert('Backup fajl nije validan JSON.')
      event.target.value = ''
    }
  }

  return (
    <section className="page-card settings-page-shell">
      <h2>Podesavanja</h2>

      <section className="settings-dev-tools">
        <div className="settings-dev-tools-head">
          <h3>Developer alati</h3>
          <p>Reset lokalnog React state-a i povratak na mock seed podatke.</p>
        </div>

        <button
          type="button"
          className="settings-danger-button"
          onClick={handleResetLocalData}
        >
          Resetuj lokalne podatke
        </button>

        <div className="settings-backup-actions">
          <button
            type="button"
            className="settings-secondary-button"
            onClick={handleExportData}
          >
            Export podataka
          </button>
          <button
            type="button"
            className="settings-secondary-button"
            onClick={handleOpenImport}
          >
            Import podataka
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="settings-hidden-file-input"
            onChange={handleImportData}
          />
        </div>
      </section>
    </section>
  )
}

export default SettingsPage
