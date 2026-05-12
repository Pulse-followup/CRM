import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCloudStore } from '../features/cloud/cloudStore'
import type { CloudWorkspaceMember, WorkspaceRole } from '../features/cloud/types'
import { getOverdueTasks } from '../features/tasks/taskSignals'
import { useTaskStore } from '../features/tasks/taskStore'

const PRODUCTION_ROLES = [
  'ACCOUNT',
  'DIZAJNER',
  'PRODUKCIJA',
  'LOGISTIKA',
  'PREPRESS',
  'MONTAZA',
  'FINANCE',
]

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

type WorkspaceSectionKey = 'members' | 'invite' | 'invites'

function WorkspacePage() {
  const [searchParams] = useSearchParams()
  const highlightedMemberId = searchParams.get('member')
  const cloud = useCloudStore()
  const { tasks } = useTaskStore()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('member')
  const [inviteRate, setInviteRate] = useState('')
  const [inviteProductionRole, setInviteProductionRole] = useState('')
  const [lastInviteLink, setLastInviteLink] = useState('')
  const [message, setMessage] = useState('')
  const [editingRates, setEditingRates] = useState<Record<string, string>>({})
  const [editingProductionRoles, setEditingProductionRoles] = useState<Record<string, string>>({})
  const [openSection, setOpenSection] = useState<WorkspaceSectionKey | null>(null)

  const isAdmin = cloud.membership?.role === 'admin'

  const activeTasks = useMemo(
    () => tasks.filter((task) => ['dodeljen', 'u_radu', 'na_cekanju'].includes(task.status) && !(task.status === 'na_cekanju' && task.dependsOnTaskId)),
    [tasks],
  )

  const taskStatsForMember = (memberId: string) => {
    const memberTasks = activeTasks.filter((task) => task.assignedToUserId === memberId)
    return {
      active: memberTasks.length,
      late: getOverdueTasks(memberTasks).length,
    }
  }

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Akcija nije uspela.')
    }
  }

  const handleInviteMember = async () => {
    await runAction(async () => {
      const invite = await cloud.inviteMember({
        email: inviteEmail,
        fullName: inviteName,
        role: inviteRole,
        hourlyRate: inviteRate.trim() ? Number(inviteRate) : null,
        productionRole: inviteProductionRole.trim() ? inviteProductionRole.trim().toUpperCase() : null,
      })
      if (invite) setLastInviteLink(cloud.buildInviteLink(invite))
      setInviteEmail('')
      setInviteName('')
      setInviteRate('')
      setInviteProductionRole('')
    }, 'Poziv je kreiran.')
  }

  const handleUpdateRate = async (memberId: string) => {
    const rawRate = editingRates[memberId]
    await runAction(async () => {
      await cloud.updateMemberHourlyRate(memberId, rawRate?.trim() ? Number(rawRate) : null)
    }, 'Satnica je sacuvana.')
  }

  const handleUpdateProductionRole = async (memberId: string) => {
    const rawRole = editingProductionRoles[memberId]
    await runAction(async () => {
      await cloud.updateMemberProductionRole(memberId, rawRole?.trim() ? rawRole.trim().toUpperCase() : null)
    }, 'Operativna rola je sacuvana.')
  }

  const sortedMembers = cloud.members
    .filter((member) => member.status !== 'invited')
    .slice()
    .sort((first, second) => readableName(first).localeCompare(readableName(second), 'sr'))

  if (!isAdmin) {
    return (
      <section className="page-card settings-page-shell account-page-shell workspace-page-shell workspace-command-page">
        <div className="account-page-head workspace-page-head">
          <h2>MY WORKSPACE</h2>
        </div>
        <p className="settings-error-text">Samo admin vidi workspace tim.</p>
      </section>
    )
  }

  return (
    <section className="page-card settings-page-shell account-page-shell workspace-page-shell workspace-command-page">
      <div className="account-page-head workspace-page-head">
        <h2>MY WORKSPACE</h2>
        <p>Tim, pozivi i pristup workspace-u u jednom command panelu.</p>
      </div>
      {cloud.error ? <p className="settings-error-text">{cloud.error}</p> : null}
      {message ? <p className="settings-success-text">{message}</p> : null}

      <section className="workspace-accordion">
        <article className={`workspace-collapse-card ${openSection === 'members' ? 'is-open' : ''}`}>
          <button type="button" className="workspace-collapse-toggle" onClick={() => setOpenSection((current) => current === 'members' ? null : 'members')} aria-expanded={openSection === 'members'}>
            <span className="workspace-collapse-copy">
              <strong>Useri</strong>
              <small>{cloud.activeWorkspace?.name || 'Workspace'} · clanovi i satnice</small>
            </span>
            <span className="workspace-collapse-meta">{sortedMembers.length}</span>
          </button>
          {openSection === 'members' ? (
          <div className="workspace-collapse-panel is-open">
            <section className="settings-dev-tools account-card account-workspace-box workspace-section-shell">
              <div className="settings-team-list workspace-member-list">
                {sortedMembers.length ? sortedMembers.map((member) => {
                  const stats = taskStatsForMember(member.user_id)
                  return (
                    <div key={member.id || member.user_id} className={`settings-team-row account-team-row workspace-team-row ${highlightedMemberId === member.user_id ? 'is-highlighted' : ''}`}>
                      <span><b>{readableName(member)}</b><small>{member.profile?.email || ''}</small></span>
                      <strong>{roleLabel(member.role)}</strong>
                      <em>{member.production_role || 'Bez operativne role'}</em>
                      <em>{stats.active} aktivna · {stats.late} kasni</em>
                      <select className="settings-rate-input" value={editingProductionRoles[member.id] ?? String(member.production_role ?? '')} onChange={(event) => setEditingProductionRoles((current) => ({ ...current, [member.id]: event.target.value }))} aria-label="Operativna rola">
                        <option value="">Bez operativne role</option>
                        {PRODUCTION_ROLES.map((productionRole) => <option key={productionRole} value={productionRole}>{productionRole}</option>)}
                      </select>
                      <button type="button" className="settings-secondary-button" onClick={() => void handleUpdateProductionRole(member.id)}>Sacuvaj rolu</button>
                      <input className="settings-rate-input" value={editingRates[member.id] ?? String(member.hourly_rate ?? '')} onChange={(event) => setEditingRates((current) => ({ ...current, [member.id]: event.target.value }))} placeholder="RSD/h" />
                      <button type="button" className="settings-secondary-button" onClick={() => void handleUpdateRate(member.id)}>Sacuvaj satnicu</button>
                    </div>
                  )
                }) : <p className="settings-muted-line">Nema clanova tima u workspace-u.</p>}
              </div>
            </section>
          </div>
          ) : null}
        </article>

        <article className={`workspace-collapse-card ${openSection === 'invite' ? 'is-open' : ''}`}>
          <button type="button" className="workspace-collapse-toggle" onClick={() => setOpenSection((current) => current === 'invite' ? null : 'invite')} aria-expanded={openSection === 'invite'}>
            <span className="workspace-collapse-copy">
              <strong>Pozovi novog clana</strong>
              <small>Novi clan dobija invite link za ovaj workspace</small>
            </span>
            <span className="workspace-collapse-meta">+</span>
          </button>
          {openSection === 'invite' ? (
          <div className="workspace-collapse-panel is-open">
            <section className="settings-dev-tools account-card workspace-section-shell">
              <div className="settings-form-grid">
                <label><span>Ime clana</span><input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder="npr. Marko Markovic" /></label>
                <label><span>Email clana</span><input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} /></label>
                <label><span>Rola</span><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}><option value="member">User</option><option value="finance">Finance</option><option value="admin">Admin</option></select></label>
                <label><span>Operativna rola</span><select value={inviteProductionRole} onChange={(event) => setInviteProductionRole(event.target.value)}><option value="">-- Izaberi rolu --</option>{PRODUCTION_ROLES.map((productionRole) => <option key={productionRole} value={productionRole}>{productionRole}</option>)}</select></label>
                <label><span>Vrednost radnog sata</span><input value={inviteRate} onChange={(event) => setInviteRate(event.target.value)} placeholder="npr. 1800" /></label>
                <button type="button" className="settings-secondary-button workspace-cta-button" onClick={() => void handleInviteMember()}>Kreiraj invite link</button>
                {lastInviteLink ? <div className="settings-invite-link"><span>Invite link</span><input readOnly value={lastInviteLink} onFocus={(event) => event.currentTarget.select()} /></div> : null}
              </div>
            </section>
          </div>
          ) : null}
        </article>

        <article className={`workspace-collapse-card ${openSection === 'invites' ? 'is-open' : ''}`}>
          <button type="button" className="workspace-collapse-toggle" onClick={() => setOpenSection((current) => current === 'invites' ? null : 'invites')} aria-expanded={openSection === 'invites'}>
            <span className="workspace-collapse-copy">
              <strong>Pozivi</strong>
              <small>Status kreiranih poziva</small>
            </span>
            <span className="workspace-collapse-meta">{cloud.invites.length}</span>
          </button>
          {openSection === 'invites' ? (
          <div className="workspace-collapse-panel is-open">
            <section className="settings-dev-tools account-card workspace-section-shell">
              <div className="settings-team-list">
                {cloud.invites.length ? cloud.invites.map((invite) => (
                  <div key={invite.id} className="settings-team-row account-team-row workspace-invite-row">
                    <span><b>{invite.full_name || invite.email}</b><small>{invite.full_name ? invite.email : ''}</small></span>
                    <strong>{roleLabel(invite.role)}</strong>
                    <em>{invite.production_role || 'bez operativne role'}</em>
                    <em>{invite.hourly_rate ? `${invite.hourly_rate} RSD/h` : 'bez satnice'}</em>
                    <em>{invite.status}</em>
                  </div>
                )) : <p className="settings-muted-line">Nema aktivnih poziva.</p>}
              </div>
            </section>
          </div>
          ) : null}
        </article>
      </section>
    </section>
  )
}

export default WorkspacePage
