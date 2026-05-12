import { useRef, useState } from 'react'
import { useBillingStore } from '../features/billing/billingStore'
import { useClientStore } from '../features/clients/clientStore'
import { useCloudStore } from '../features/cloud/cloudStore'
import { useProjectStore } from '../features/projects/projectStore'
import { useTaskStore } from '../features/tasks/taskStore'

const STORAGE_KEYS = ['pulse.clients.v1', 'pulse.projects.v1', 'pulse.tasks.v1', 'pulse.billing.v1']

function DataPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const cloud = useCloudStore()
  const clientStore = useClientStore()
  const projectStore = useProjectStore()
  const taskStore = useTaskStore()
  const billingStore = useBillingStore()
  const [message, setMessage] = useState('')

  const cloudConnected = cloud.isConfigured && Boolean(cloud.user && cloud.activeWorkspace)

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Akcija nije uspela.')
    }
  }

  const handleSyncAll = async () => {
    await runAction(async () => {
      await cloud.refreshWorkspace()
      await Promise.all([
        clientStore.refreshClientsFromCloud(),
        projectStore.refreshProjectsFromCloud(),
        taskStore.refreshTasksFromCloud(),
        billingStore.refreshBillingFromCloud(),
      ])
    }, 'SYNC je zavrsen.')
  }

  const handleExportData = () => {
    const payload = Object.fromEntries(STORAGE_KEYS.map((key) => [key, JSON.parse(window.localStorage.getItem(key) || '[]')]))
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), payload }, null, 2)], { type: 'application/json' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pulse-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
    setMessage('Export je pripremljen.')
  }

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const parsed = JSON.parse(await file.text()) as { payload?: Record<string, unknown> }
      Object.entries(parsed.payload || {}).forEach(([key, value]) => {
        if (STORAGE_KEYS.includes(key)) window.localStorage.setItem(key, JSON.stringify(value))
      })
      setMessage('Import je zavrsen. Uradi refresh aplikacije.')
    } catch {
      setMessage('Import nije uspeo. Proveri JSON fajl.')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section className="page-card settings-page-shell account-page-shell data-page-shell">
      <div className="account-page-head"><h2>DATA</h2></div>
      {message ? <p className="settings-success-text">{message}</p> : null}
      {cloud.error ? <p className="settings-error-text">{cloud.error}</p> : null}

      <section className="settings-dev-tools account-card">
        <div className="settings-dev-tools-head"><h3>SYNC</h3><p>Rucno osvezavanje cloud podataka.</p></div>
        <div className="account-info-grid">
          <div><span>Status</span><strong className={cloudConnected ? 'settings-success-inline' : 'settings-warning-inline'}>{cloudConnected ? 'Cloud povezan' : 'Cloud nije povezan'}</strong></div>
          <div><span>Workspace</span><strong>{cloud.activeWorkspace?.name || '-'}</strong></div>
        </div>
        <div className="settings-button-row"><button type="button" className="settings-secondary-button" onClick={() => void handleSyncAll()}>SYNC sve</button></div>
        {cloud.activeWorkspace ? <div className="settings-help-box account-sync-box"><strong>Status sync-a</strong><p>Klijenti: {clientStore.cloudReadStatus} • Projekti: {projectStore.cloudReadStatus} • Taskovi: {taskStore.cloudReadStatus} • Naplata: {billingStore.cloudReadStatus}</p></div> : null}
      </section>

      <section className="settings-dev-tools account-card">
        <div className="settings-dev-tools-head"><h3>Import / Export podataka</h3><p>Rezervna kopija lokalnih podataka.</p></div>
        <div className="settings-backup-actions">
          <button type="button" className="settings-secondary-button" onClick={handleExportData}>Export podataka</button>
          <button type="button" className="settings-secondary-button" onClick={() => importInputRef.current?.click()}>Import podataka</button>
          <input ref={importInputRef} type="file" accept="application/json,.json" className="settings-hidden-file-input" onChange={(event) => void handleImportData(event)} />
        </div>
      </section>
    </section>
  )
}

export default DataPage
