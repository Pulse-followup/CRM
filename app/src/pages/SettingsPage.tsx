import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCloudStore } from '../features/cloud/cloudStore'
import { useClientStore } from '../features/clients/clientStore'
import { formatClientUsage, normalizePlanType } from '../features/subscription/plan'

function roleLabel(role?: string | null) {
  if (role === 'admin') return 'Admin'
  if (role === 'finance') return 'Finance'
  return 'User'
}

function readableName(profileName?: string | null, fallback?: string | null) {
  const cleanName = profileName?.trim()
  if (cleanName && !cleanName.includes('@')) return cleanName
  return fallback || '-'
}

function SettingsPage() {
  const cloud = useCloudStore()
  const { clients } = useClientStore()
  const navigate = useNavigate()
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [message, setMessage] = useState('')

  const loggedEmail = cloud.user?.email || cloud.profile?.email || '-'
  const displayName = readableName(cloud.profile?.full_name, loggedEmail)
  const planType = normalizePlanType(cloud.activeWorkspace?.plan_type)
  const planBadge = planType === 'PRO' ? 'PRO ACTIVE' : formatClientUsage(clients.length, planType)

  const runAction = async (action: () => Promise<void>, successMessage: string) => {
    setMessage('')
    try {
      await action()
      setMessage(successMessage)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Akcija nije uspela.')
    }
  }

  const handleAuthSubmit = async (mode: 'login' | 'signup') => {
    await runAction(async () => {
      if (mode === 'login') {
        await cloud.signIn({ email: authEmail, password: authPassword })
        navigate('/', { replace: true })
      } else {
        await cloud.signUp({ email: authEmail, password: authPassword })
      }
    }, mode === 'login' ? 'Ulogovan si.' : 'Nalog je kreiran. Ako Supabase trazi potvrdu emaila, potvrdi pa se uloguj.')
  }

  const handleCreateWorkspace = async () => {
    await runAction(async () => {
      await cloud.createWorkspace({ name: workspaceName })
      setWorkspaceName('')
    }, 'Workspace je kreiran.')
  }

  return (
    <section className="page-card settings-page-shell account-page-shell">
      <div className="account-page-head">
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
            <div className="settings-button-row">
              <button type="button" className="settings-secondary-button" onClick={() => void handleAuthSubmit('login')}>Login</button>
              <button type="button" className="settings-secondary-button" onClick={() => void handleAuthSubmit('signup')}>Kreiraj nalog</button>
            </div>
          </div>
        ) : null}

        {cloud.user ? (
          <div className="account-info-grid">
            <div><span>Ime</span><strong>{displayName}</strong></div>
            <div><span>Email</span><strong>{loggedEmail}</strong></div>
            <div><span>Workspace</span><strong>{cloud.activeWorkspace?.name || '-'}</strong></div>
            <div><span>Uloga</span><strong>{roleLabel(cloud.membership?.role)}</strong></div>
            <div><span>PLAN</span><strong>{planType}</strong></div>
            <div><span>Workspace status</span><strong>{planBadge}</strong></div>
          </div>
        ) : null}

        {cloud.user && cloud.rememberedInviteId ? (
          <div className="settings-help-box">
            <strong>Pronadjen invite link.</strong>
            <button type="button" className="settings-secondary-button" onClick={() => void cloud.acceptInvite()}>Prihvati poziv u workspace</button>
          </div>
        ) : null}

        {cloud.user && !cloud.activeWorkspace ? (
          <div className="settings-form-grid">
            <label><span>Workspace</span><input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Naziv organizacije" /></label>
            <button type="button" className="settings-secondary-button" onClick={() => void handleCreateWorkspace()}>Kreiraj workspace</button>
          </div>
        ) : null}

        {cloud.user ? <div className="settings-button-row"><button type="button" className="settings-danger-button" onClick={() => void cloud.signOut()}>Logout</button></div> : null}
      </section>
    </section>
  )
}

export default SettingsPage
