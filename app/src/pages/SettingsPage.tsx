import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCloudStore } from '../features/cloud/cloudStore'
import { useClientStore } from '../features/clients/clientStore'
import { useProjectStore } from '../features/projects/projectStore'
import { useTaskStore } from '../features/tasks/taskStore'
import { useBillingStore } from '../features/billing/billingStore'
import type { CloudWorkspaceMember, WorkspaceRole } from '../features/cloud/types'

const STORAGE_KEYS = ['pulse.clients.v1', 'pulse.projects.v1', 'pulse.tasks.v1', 'pulse.billing.v1']

function roleLabel(role?: string | null) {
  if (role === 'admin') return 'Admin'
  if (role === 'finance') return 'Finance'
  return 'User'
}

function readableName(member: CloudWorkspaceMember) {
  const profileName = member.profile?.full_name?.trim()
  const displayName = member.display_name?.trim()
  const email = member.profile?.email?.trim()

  if (displayName) return displayName
  if (profileName && !profileName.includes('@')) return profileName
  if (email) return email
  return member.user_id || 'Clan tima'
}

function SettingsPage() {
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const cloud = useCloudStore()
  const clientStore = useClientStore()
  const projectStore = useProjectStore()
  const taskStore = useTaskStore()
  const billingStore = useBillingStore()

  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [profileName, setProfileName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member')
  const [inviteRate, setInviteRate] = useState('')
  const [lastInviteLink, setLastInviteLink] = useState('')
  const [message, setMessage] = useState('')
  const [editingRates, setEditingRates] = useState<Record<string, string>>({})

  const isAdmin = cloud.membership?.role === 'admin'
  const cloudConnected = cloud.isConfigured && Boolean(cloud.user && cloud.activeWorkspace)
  const loggedEmail = cloud.user?.email || cloud.profile?.email || '-'
  const visibleName = cloud.profile?.full_name && !cloud.profile.full_name.includes('@') ? cloud.profile.full_name : ''

  useEffect(() => {
    setProfileName(visibleName)
  }, [visibleName])

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

  const handleAuthSubmit = async (mode: 'login' | 'signup') => {
    await runAction(async () => {
      if (mode === 'login') await cloud.signIn({ email: authEmail, password: authPassword })
      else await cloud.signUp({ email: authEmail, password: authPassword })
    }, mode === 'login' ? 'Ulogovan si.' : 'Nalog je kreiran. Ako Supabase trazi potvrdu emaila, potvrdi pa se uloguj.')
  }

  const handleInviteMember = async () => {
    await runAction(async () => {
      const invite = await cloud.inviteMember({
        email: inviteEmail,
        fullName: inviteName,
        role: inviteRole,
        hourlyRate: inviteRate.trim() ? Number(inviteRate) : null,
      })
      if (invite) setLastInviteLink(cloud.buildInviteLink(invite))
      setInviteEmail('')
      setInviteName('')
      setInviteRate('')
    }, 'Poziv je kreiran.')
  }

  const handleCreateWorkspace = async () => {
    await runAction(async () => {
      await cloud.createWorkspace({ name: workspaceName })
      setWorkspaceName('')
    }, 'Workspace je kreiran.')
  }

  const handleSaveName = async () => {
    await runAction(async () => {
      await cloud.updateProfileName(profileName)
    }, 'Ime je sacuvano.')
  }

  const handleUpdateRate = async (memberId: string) => {
    const rawRate = editingRates[memberId]
    await runAction(async () => {
      await cloud.updateMemberHourlyRate(memberId, rawRate?.trim() ? Number(rawRate) : null)
    }, 'Satnica je sacuvana.')
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
    <section className="page-card settings-page-shell account-page-shell">
      <div className="account-page-head">
        <Link className="settings-home-link" to="/">Home</Link>
        <h2>Moj nalog</h2>
      </div>

      {cloud.error ? <p className="settings-error-text">{cloud.error}</p> : null}
      {message ? <p className="settings-success-text">{message}</p> : null}

      <section className="settings-dev-tools settings-cloud-panel account-card">
        <div className="settings-dev-tools-head">
          <h3>Login / Password</h3>
          {cloud.user ? <p>Ulogovan: <strong>{loggedEmail}</strong></p> : <p>Uloguj se ili kreiraj nalog.</p>}
        </div>

        {!cloud.isConfigured ? (
          <div className="settings-help-box">Dodaj <code>VITE_SUPABASE_URL</code> i <code>VITE_SUPABASE_ANON_KEY</code> u <code>.env.local</code>.</div>
        ) : null}

        {cloud.isConfigured && !cloud.user ? (
          <div className="settings-form-grid">
            <label><span>Email</span><input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} /></label>
            <label><span>Password</span><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} /></label>
            <div className="settings-button-row"><button type="button" className="settings-secondary-button" onClick={() => void handleAuthSubmit('login')}>Login</button><button type="button" className="settings-secondary-button" onClick={() => void handleAuthSubmit('signup')}>Kreiraj nalog</button></div>
          </div>
        ) : null}

        {cloud.user ? (
          <div className="account-info-grid">
            <label><span>Ime</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="npr. Dragan" /></label>
            <button type="button" className="settings-secondary-button" onClick={() => void handleSaveName()}>Sacuvaj ime</button>
            <div><span>Workspace</span><strong>{cloud.activeWorkspace?.name || '-'}</strong></div>
            <div><span>Uloga</span><strong>{roleLabel(cloud.membership?.role)}</strong></div>
            <div><span>SYNC</span><strong className={cloudConnected ? 'settings-success-inline' : 'settings-warning-inline'}>{cloudConnected ? 'Cloud povezan' : 'Cloud nije povezan'}</strong></div>
          </div>
        ) : null}

        {cloud.user && cloud.rememberedInviteId ? <div className="settings-help-box"><strong>Pronadjen invite link.</strong><button type="button" className="settings-secondary-button" onClick={() => void cloud.acceptInvite()}>Prihvati poziv u workspace</button></div> : null}

        {cloud.user && !cloud.activeWorkspace ? <div className="settings-form-grid"><label><span>Workspace</span><input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Naziv organizacije" /></label><button type="button" className="settings-secondary-button" onClick={() => void handleCreateWorkspace()}>Kreiraj workspace</button></div> : null}

        {cloud.user ? <div className="settings-button-row"><button type="button" className="settings-secondary-button" onClick={() => void handleSyncAll()}>SYNC sve</button><button type="button" className="settings-danger-button" onClick={() => void cloud.signOut()}>Logout</button></div> : null}

        {cloud.activeWorkspace ? (
          <div className="settings-help-box account-sync-box">
            <strong>Status sync-a</strong>
            <p>Klijenti: {clientStore.cloudReadStatus} • Projekti: {projectStore.cloudReadStatus} • Taskovi: {taskStore.cloudReadStatus} • Naplata: {billingStore.cloudReadStatus}</p>
          </div>
        ) : null}
      </section>

      <section className="settings-dev-tools account-card">
        <div className="settings-dev-tools-head"><h3>Import / Export podataka iz baze</h3><p>Rezervna kopija lokalnih podataka.</p></div>
        <div className="settings-backup-actions"><button type="button" className="settings-secondary-button" onClick={handleExportData}>Export podataka</button><button type="button" className="settings-secondary-button" onClick={() => importInputRef.current?.click()}>Import podataka</button><input ref={importInputRef} type="file" accept="application/json,.json" className="settings-hidden-file-input" onChange={(event) => void handleImportData(event)} /></div>
      </section>

      {cloud.activeWorkspace && isAdmin ? (
        <details className="settings-dev-tools account-card account-workspace-box">
          <summary>MY WORKSPACE</summary>

          <details className="account-collapsible" open>
            <summary>Clanovi workspace-a</summary>
            <div className="settings-team-list">
              {['admin', 'finance', 'member'].map((role) => (
                <div key={role} className="settings-role-group">
                  <h5>{roleLabel(role)}</h5>
                  {cloud.members.filter((member) => member.role === role).map((member) => (
                    <div key={member.id || member.user_id} className="settings-team-row account-team-row">
                      <span><b>{readableName(member)}</b><small>{member.profile?.email || ''}</small></span>
                      <strong>{roleLabel(member.role)}</strong>
                      <input className="settings-rate-input" value={editingRates[member.id] ?? String(member.hourly_rate ?? '')} onChange={(event) => setEditingRates((current) => ({ ...current, [member.id]: event.target.value }))} placeholder="RSD/h" />
                      <button type="button" className="settings-secondary-button" onClick={() => void handleUpdateRate(member.id)}>Sacuvaj</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>

          <details className="account-collapsible">
            <summary>Pozovi clana tima</summary>
            <div className="settings-form-grid">
              <label><span>Ime clana</span><input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="npr. Marko Markovic" /></label>
              <label><span>Email clana</span><input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label>
              <label><span>Rola</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}><option value="member">User</option><option value="finance">Finance</option><option value="admin">Admin</option></select></label>
              <label><span>Vrednost radnog sata</span><input value={inviteRate} onChange={(event) => setInviteRate(event.target.value)} placeholder="npr. 1800" /></label>
              <button type="button" className="settings-secondary-button" onClick={() => void handleInviteMember()}>Kreiraj invite link</button>
              {lastInviteLink ? <div className="settings-invite-link"><span>Invite link</span><input readOnly value={lastInviteLink} onFocus={(event) => event.currentTarget.select()} /></div> : null}
            </div>
          </details>

          <details className="account-collapsible">
            <summary>Pozivi</summary>
            <div className="settings-team-list">
              {cloud.invites.length ? cloud.invites.map((invite) => <div key={invite.id} className="settings-team-row account-team-row"><span><b>{invite.full_name || invite.email}</b><small>{invite.full_name ? invite.email : ''}</small></span><strong>{roleLabel(invite.role)}</strong><em>{invite.hourly_rate ? `${invite.hourly_rate} RSD/h` : 'bez satnice'}</em><em>{invite.status}</em></div>) : <p className="settings-muted-line">Nema aktivnih poziva.</p>}
            </div>
          </details>
        </details>
      ) : null}
    </section>
  )
}

export default SettingsPage
