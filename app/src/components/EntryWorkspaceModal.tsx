import { useState } from 'react'
import { useCloudStore } from '../features/cloud/cloudStore'

function EntryWorkspaceModal() {
  const cloud = useCloudStore()
  const [name, setName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [message, setMessage] = useState('')

  const shouldShow = cloud.isConfigured && Boolean(cloud.user) && !cloud.activeWorkspace && !cloud.rememberedInviteId
  if (!shouldShow) return null

  const submit = async () => {
    setMessage('')
    try {
      const cleanName = name.trim()
      const cleanWorkspaceName = workspaceName.trim()
      if (!cleanName || !cleanWorkspaceName) {
        setMessage('Popuni ime i naziv organizacije.')
        return
      }
      await cloud.updateProfileName(cleanName)
      await cloud.createWorkspace({ name: cleanWorkspaceName })
      setName('')
      setWorkspaceName('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nije uspelo kreiranje workspace-a.')
    }
  }

  return (
    <div className="pulse-modal-backdrop">
      <div className="pulse-modal pulse-entry-modal" onMouseDown={(event) => event.stopPropagation()}>
        <h3>Dobro došao u PULSE</h3>
        <p>Tvoj personalni biznis asistent</p>
        <label className="pulse-form-field"><span>Kako se zoveš?</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="npr. Dragan" /></label>
        <label className="pulse-form-field"><span>Kako se zove tvoja organizacija?</span><input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="npr. Retail Media Center" /></label>
        {message ? <p className="settings-error-text">{message}</p> : null}
        <div className="pulse-modal-actions"><button className="pulse-modal-btn pulse-modal-btn-blue" type="button" onClick={() => void submit()}>ZAPOČNI</button></div>
      </div>
    </div>
  )
}

export default EntryWorkspaceModal
