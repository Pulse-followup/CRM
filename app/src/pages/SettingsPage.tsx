import { useRef, useState } from 'react'
import { useCloudStore } from '../features/cloud/cloudStore'
import { useClientStore } from '../features/clients/clientStore'
import { useProjectStore } from '../features/projects/projectStore'
import { useTaskStore } from '../features/tasks/taskStore'
import { useBillingStore } from '../features/billing/billingStore'
import type { WorkspaceRole } from '../features/cloud/types'

const STORAGE_KEYS = ['pulse.clients.v1', 'pulse.projects.v1', 'pulse.tasks.v1', 'pulse.billing.v1']

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
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member')
  const [inviteRate, setInviteRate] = useState('')
  const [lastInviteLink, setLastInviteLink] = useState('')
  const [message, setMessage] = useState('')
  const [editingRates, setEditingRates] = useState<Record<string, string>>({})

  const isAdmin = cloud.membership?.role === 'admin'
  const cloudStatus = !cloud.isConfigured
    ? 'Supabase nije konfigurisan.'
    : !cloud.user
      ? 'Nisi ulogovan.'
      : !cloud.activeWorkspace
        ? 'Ulogovan, ali nema aktivan workspace.'
        : `${cloud.activeWorkspace.name} • ${cloud.membership?.role || 'bez role'}`

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setMessage('')
    try { await action(); setMessage(successMessage) } catch (error) { setMessage(error instanceof Error ? error.message : 'Akcija nije uspela.') }
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
    }, 'Sync je zavrsen.')
  }

  const handleAuthSubmit = async (mode: 'login' | 'signup') => {
    await runAction(async () => {
      if (mode === 'login') await cloud.signIn({ email: authEmail, password: authPassword })
      else await cloud.signUp({ email: authEmail, password: authPassword })
    }, mode === 'login' ? 'Ulogovan si.' : 'Nalog je kreiran. Ako Supabase trazi potvrdu emaila, potvrdi pa se uloguj.')
  }

  const handleInviteMember = async () => {
    await runAction(async () => {
      const invite = await cloud.inviteMember({ email: inviteEmail, fullName: inviteName, role: inviteRole, hourlyRate: inviteRate.trim() ? Number(inviteRate) : null })
      if (invite) setLastInviteLink(cloud.buildInviteLink(invite))
      setInviteEmail('')
      setInviteName('')
      setInviteRate('')
    }, 'Poziv je kreiran.')
  }

  const handleCreateWorkspace = async () => {
    await runAction(async () => { await cloud.createWorkspace({ name: workspaceName }); setWorkspaceName('') }, 'Workspace je kreiran.')
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

  return (
    <section className="page-card settings-page-shell">
      <h2>Podesavanja</h2>
      <section className="settings-dev-tools settings-cloud-panel">
        <div className="settings-dev-tools-head">
          <h3>Workspace cloud</h3>
          <p>{cloudStatus}</p>
          {cloud.error ? <p className="settings-error-text">{cloud.error}</p> : null}
          {message ? <p className="settings-success-text">{message}</p> : null}
        </div>

        {!cloud.isConfigured ? <div className="settings-help-box">Dodaj <code>VITE_SUPABASE_URL</code> i <code>VITE_SUPABASE_ANON_KEY</code> u <code>.env.local</code>.</div> : null}

        {cloud.isConfigured && !cloud.user ? (
          <div className="settings-form-grid">
            <label><span>Email</span><input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} /></label>
            <label><span>Lozinka</span><input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} /></label>
            <div className="settings-button-row"><button type="button" className="settings-secondary-button" onClick={() => void handleAuthSubmit('login')}>Login</button><button type="button" className="settings-secondary-button" onClick={() => void handleAuthSubmit('signup')}>Kreiraj nalog</button></div>
          </div>
        ) : null}

        {cloud.user ? <div className="settings-button-row"><button type="button" className="settings-secondary-button" onClick={() => void handleSyncAll()}>SYNC sve</button><button type="button" className="settings-danger-button" onClick={() => void cloud.signOut()}>Logout</button></div> : null}

        {cloud.user && cloud.rememberedInviteId ? <div className="settings-help-box"><strong>Pronadjen invite link.</strong><button type="button" className="settings-secondary-button" onClick={() => void cloud.acceptInvite()}>Prihvati poziv u workspace</button></div> : null}

        {cloud.user && !cloud.activeWorkspace ? <div className="settings-form-grid"><label><span>Naziv workspace-a</span><input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} /></label><button type="button" className="settings-secondary-button" onClick={() => void handleCreateWorkspace()}>Kreiraj workspace</button></div> : null}

        {cloud.activeWorkspace && isAdmin ? (
          <div className="settings-form-grid">
            <h4>Pozovi clana tima</h4>
            <label><span>Ime clana</span><input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="npr. Marko Markovic" /></label>
            <label><span>Email clana</span><input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label>
            <label><span>Rola</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}><option value="member">User</option><option value="finance">Finance</option><option value="admin">Admin</option></select></label>
            <label><span>Vrednost radnog sata</span><input value={inviteRate} onChange={(event) => setInviteRate(event.target.value)} placeholder="npr. 1800" /></label>
            <button type="button" className="settings-secondary-button" onClick={() => void handleInviteMember()}>Kreiraj invite link</button>
            {lastInviteLink ? <div className="settings-invite-link"><span>Invite link</span><input readOnly value={lastInviteLink} onFocus={(event) => event.currentTarget.select()} /></div> : null}
          </div>
        ) : null}

        {cloud.activeWorkspace ? (
          <div className="settings-help-box">
            <strong>Status sync-a</strong>
            <p>Klijenti: {clientStore.cloudReadStatus} • Projekti: {projectStore.cloudReadStatus} • Taskovi: {taskStore.cloudReadStatus} • Naplata: {billingStore.cloudReadStatus}</p>
          </div>
        ) : null}

        {cloud.activeWorkspace ? (
          <div className="settings-team-list">
            <h4>Clanovi workspace-a</h4>
            {['admin', 'finance', 'member'].map((role) => (
              <div key={role} className="settings-role-group">
                <h5>{role === 'member' ? 'User' : role}</h5>
                {cloud.members.filter((member) => member.role === role).map((member) => (
                  <div key={member.id || member.user_id} className="settings-team-row">
                    <span>{member.profile?.full_name || member.profile?.email || member.user_id}</span>
                    <strong>{member.role === 'member' ? 'user' : member.role}</strong>
                    {isAdmin ? <input className="settings-rate-input" value={editingRates[member.id] ?? String(member.hourly_rate ?? '')} onChange={(event) => setEditingRates((current) => ({ ...current, [member.id]: event.target.value }))} placeholder="RSD/h" /> : <em>{member.hourly_rate ? `${member.hourly_rate} RSD/h` : 'bez satnice'}</em>}
                    {isAdmin ? <button type="button" className="settings-secondary-button" onClick={() => void handleUpdateRate(member.id)}>Sacuvaj satnicu</button> : null}
                  </div>
                ))}
              </div>
            ))}
            {isAdmin && cloud.invites.length ? <h4>Pozivi</h4> : null}
            {isAdmin && cloud.invites.map((invite) => <div key={invite.id} className="settings-team-row"><span>{invite.full_name || invite.email}<small>{invite.full_name ? invite.email : ''}</small></span><strong>{invite.status}</strong><em>{invite.hourly_rate ? `${invite.hourly_rate} RSD/h` : 'bez satnice'}</em></div>)}
          </div>
        ) : null}
      </section>

      <section className="settings-dev-tools"><div className="settings-dev-tools-head"><h3>Import / Export</h3><p>Rezervna kopija lokalnih podataka.</p></div><div className="settings-backup-actions"><button type="button" className="settings-secondary-button" onClick={handleExportData}>Export podataka</button><button type="button" className="settings-secondary-button" onClick={() => importInputRef.current?.click()}>Import podataka</button><input ref={importInputRef} type="file" accept="application/json,.json" className="settings-hidden-file-input" /></div></section>
    </section>
  )
}

export default SettingsPage
