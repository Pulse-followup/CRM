import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, MouseEvent } from 'react'
import {
  deleteProcessTemplateFromSupabase,
  readProcessTemplates,
  readProcessTemplatesFromSupabase,
  saveProcessTemplates,
  upsertProcessTemplateToSupabase,
} from '../features/templates/templateStorage'
import type { ProcessTemplate, ProcessTemplateFormValues, ProcessTemplateStep, ProcessTemplateStepFormValues } from '../features/templates/types'
import { useCloudStore } from '../features/cloud/cloudStore'

const PRODUCTION_ROLES = [
  'ACCOUNT',
  'DIZAJNER',
  'PRODUKCIJA',
  'LOGISTIKA',
  'PREPRESS',
  'MONTAŽA',
  'FINANCE',
]

function normalizeProductionRole(role?: string) {
  const normalized = role?.trim().toLowerCase()
  const map: Record<string, string> = {
    account: 'ACCOUNT',
    dizajner: 'DIZAJNER',
    designer: 'DIZAJNER',
    produkcija: 'PRODUKCIJA',
    proizvodnja: 'PRODUKCIJA',
    production: 'PRODUKCIJA',
    logistika: 'LOGISTIKA',
    logistics: 'LOGISTIKA',
    prepress: 'PREPRESS',
    montaza: 'MONTAŽA',
    'montaža': 'MONTAŽA',
    finance: 'FINANCE',
    finansije: 'FINANCE',
  }
  if (!normalized) return ''
  return map[normalized] || role?.trim().toUpperCase() || ''
}

const emptyTemplateForm: ProcessTemplateFormValues = {
  title: '',
  description: '',
  projectType: '',
}

const emptyStepForm: ProcessTemplateStepFormValues = {
  title: '',
  role: '',
  estimatedMinutes: '',
}

function createCloudSafeId(prefix: string) {
  return crypto.randomUUID?.() || `${prefix}-${Date.now()}`
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}min` : `${hours}h`
}

function TemplatesPage() {
  const cloud = useCloudStore()
  const workspaceId = cloud.activeWorkspace?.id || ''
  const isCloudTemplatesMode = Boolean(cloud.isConfigured && workspaceId)
  const [templates, setTemplates] = useState<ProcessTemplate[]>(() => readProcessTemplates())
  const [query, setQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [templateForm, setTemplateForm] = useState<ProcessTemplateFormValues>(emptyTemplateForm)
  const [formSteps, setFormSteps] = useState<ProcessTemplateStep[]>([])
  const [stepForm, setStepForm] = useState<ProcessTemplateStepFormValues>(emptyStepForm)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id ?? null)
  const [formError, setFormError] = useState('')
  const [stepError, setStepError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadTemplatesFromCloud() {
      if (!isCloudTemplatesMode) {
        setSyncMessage('')
        return
      }

      try {
        setSyncMessage('Učitavam procese iz Supabase-a...')
        const cloudTemplates = await readProcessTemplatesFromSupabase(workspaceId)
        if (!isMounted) return

        if (cloudTemplates.length) {
          setTemplates(cloudTemplates)
          saveProcessTemplates(cloudTemplates)
          setSelectedTemplateId((current) => current && cloudTemplates.some((template) => template.id === current) ? current : cloudTemplates[0]?.id ?? null)
          setSyncMessage('Procesi su učitani iz Supabase-a.')
          return
        }

        setSyncMessage('Supabase procesi su prazni. Lokalni šabloni ostaju kao dev fallback.')
      } catch (error) {
        if (!isMounted) return
        setSyncMessage(error instanceof Error ? `Supabase sync greška: ${error.message}` : 'Supabase sync greška.')
      }
    }

    void loadTemplatesFromCloud()

    return () => {
      isMounted = false
    }
  }, [isCloudTemplatesMode, workspaceId])

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0]

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return templates

    return templates.filter((template) => {
      const haystack = `${template.title} ${template.projectType} ${template.description}`.toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [templates, query])

  const persistTemplates = (nextTemplates: ProcessTemplate[]) => {
    setTemplates(nextTemplates)
    saveProcessTemplates(nextTemplates)
  }

  const persistTemplateToCloud = (template: ProcessTemplate) => {
    if (!isCloudTemplatesMode) return

    void upsertProcessTemplateToSupabase(workspaceId, template)
      .then(() => setSyncMessage('Proces je sačuvan u Supabase.'))
      .catch((error) => {
        setSyncMessage(error instanceof Error ? `Supabase sync greška: ${error.message}` : 'Proces nije sačuvan u Supabase.')
      })
  }

  const resetTemplateForm = () => {
    setEditingTemplateId(null)
    setTemplateForm(emptyTemplateForm)
    setFormSteps([])
    setStepForm(emptyStepForm)
    setFormError('')
    setStepError('')
  }

  const openNewTemplateForm = () => {
    resetTemplateForm()
    setIsFormOpen(true)
  }

  const closeTemplateForm = () => {
    resetTemplateForm()
    setIsFormOpen(false)
  }

  const startEditTemplate = (template: ProcessTemplate) => {
    setEditingTemplateId(template.id)
    setSelectedTemplateId(template.id)
    setTemplateForm({
      title: template.title,
      projectType: template.projectType,
      description: template.description,
    })
    setFormSteps(template.steps.slice().sort((a, b) => a.order - b.order).map((step) => ({ ...step, role: normalizeProductionRole(step.role) || step.role })))
    setStepForm(emptyStepForm)
    setFormError('')
    setStepError('')
    setIsFormOpen(true)
  }

  const duplicateTemplate = (template: ProcessTemplate) => {
    const duplicatedTemplate: ProcessTemplate = {
      ...template,
      id: createCloudSafeId('tpl'),
      title: `${template.title} kopija`,
      status: 'active',
      createdAt: new Date().toISOString(),
      steps: template.steps.map((step, index) => ({
        ...step,
        id: createCloudSafeId('step'),
        role: normalizeProductionRole(step.role) || step.role,
        order: index + 1,
      })),
    }
    const nextTemplates = [duplicatedTemplate, ...templates]
    persistTemplates(nextTemplates)
    persistTemplateToCloud(duplicatedTemplate)
    setSelectedTemplateId(duplicatedTemplate.id)
  }

  const deleteTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    if (!window.confirm(`Obrisati šablon "${template.title}"? Postojeći projekti i taskovi ostaju sačuvani.`)) return

    const nextTemplates = templates.filter((item) => item.id !== templateId)
    persistTemplates(nextTemplates)
    if (isCloudTemplatesMode) {
      void deleteProcessTemplateFromSupabase(workspaceId, templateId)
        .then(() => setSyncMessage('Proces je obrisan iz Supabase.'))
        .catch((error) => {
          setSyncMessage(error instanceof Error ? `Supabase sync greška: ${error.message}` : 'Proces nije obrisan iz Supabase.')
        })
    }
    if (selectedTemplateId === templateId) setSelectedTemplateId(nextTemplates[0]?.id ?? null)
    if (editingTemplateId === templateId) closeTemplateForm()
  }

  const handleFormStepSubmit = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()

    const title = stepForm.title.trim()
    const role = normalizeProductionRole(stepForm.role)
    const estimatedMinutes = Number(stepForm.estimatedMinutes.replace(',', '.'))

    if (!title || !role) {
      setStepError('Naziv koraka i rola su obavezni.')
      return
    }

    if (!Number.isFinite(estimatedMinutes) || estimatedMinutes <= 0) {
      setStepError('Procena vremena mora biti broj veći od nule.')
      return
    }

    const nextOrder = formSteps.length + 1
    setFormSteps((current) => [
      ...current,
      {
        id: createCloudSafeId('step-draft'),
        title,
        role,
        estimatedMinutes,
        order: nextOrder,
      },
    ])
    setStepForm(emptyStepForm)
    setStepError('')
  }

  const normalizeStepOrder = (steps: ProcessTemplateStep[]) =>
    steps.map((step, index) => ({ ...step, order: index + 1 }))

  const removeFormStep = (stepId: string) => {
    setFormSteps((current) => normalizeStepOrder(current.filter((step) => step.id !== stepId)))
  }

  const moveFormStep = (stepId: string, direction: 'up' | 'down') => {
    setFormSteps((current) => {
      const currentIndex = current.findIndex((step) => step.id === stepId)
      if (currentIndex < 0) return current

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (nextIndex < 0 || nextIndex >= current.length) return current

      const nextSteps = [...current]
      const targetStep = nextSteps[currentIndex]
      nextSteps[currentIndex] = nextSteps[nextIndex]
      nextSteps[nextIndex] = targetStep

      return normalizeStepOrder(nextSteps)
    })
  }

  const handleTemplateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = templateForm.title.trim()
    const projectType = templateForm.projectType.trim()

    if (!title || !projectType) {
      setFormError('Naziv šablona i tip projekta su obavezni.')
      return
    }

    const normalizedSteps = formSteps.map((step, index) => ({
      ...step,
      id: step.id,
      role: normalizeProductionRole(step.role) || step.role,
      order: index + 1,
    }))

    if (editingTemplateId) {
      const nextTemplates = templates.map((template) =>
        template.id === editingTemplateId
          ? {
              ...template,
              title,
              projectType,
              description: templateForm.description.trim(),
              steps: normalizedSteps,
            }
          : template,
      )
      persistTemplates(nextTemplates)
      const savedTemplate = nextTemplates.find((template) => template.id === editingTemplateId)
      if (savedTemplate) persistTemplateToCloud(savedTemplate)
      setSelectedTemplateId(editingTemplateId)
      closeTemplateForm()
      return
    }

    const newTemplate: ProcessTemplate = {
      id: createCloudSafeId('tpl'),
      title,
      projectType,
      description: templateForm.description.trim(),
      status: 'active',
      steps: normalizedSteps,
      createdAt: new Date().toISOString(),
    }

    const nextTemplates = [newTemplate, ...templates]
    persistTemplates(nextTemplates)
    persistTemplateToCloud(newTemplate)
    setSelectedTemplateId(newTemplate.id)
    closeTemplateForm()
  }

  return (
    <section className="pulse-phone-screen templates-page-shell">
      <div className="templates-page-header">
        <div>
          <p className="pulse-kicker">OPERATIVNI FLOW</p>
          <h2>Procesi</h2>
          <p>Definišite korake procesa koji će se automatski pretvoriti u taskove.</p>
        </div>
        <button type="button" className="pulse-primary-btn" onClick={openNewTemplateForm}>
          + NOVI ŠABLON
        </button>
      </div>

      {syncMessage ? <p className="templates-empty-text">{syncMessage}</p> : null}

      <div className="templates-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pretraga po nazivu, tipu ili opisu"
        />
      </div>

      {isFormOpen ? (
        <section className="pulse-section templates-form">
          <div className="pulse-section-head">
            <h3>{editingTemplateId ? 'Izmeni šablon' : 'Novi šablon'}</h3>
            <button type="button" className="pulse-outline-btn" onClick={closeTemplateForm}>
              ZATVORI
            </button>
          </div>

          <form onSubmit={handleTemplateSubmit}>
            <div className="templates-form-grid">
              <label>
                Naziv šablona
                <input
                  value={templateForm.title}
                  onChange={(event) => {
                    setTemplateForm((current) => ({ ...current, title: event.target.value }))
                    setFormError('')
                  }}
                  placeholder="npr. Digitalna štampa — standard"
                />
              </label>
              <label>
                Tip projekta
                <input
                  value={templateForm.projectType}
                  onChange={(event) => {
                    setTemplateForm((current) => ({ ...current, projectType: event.target.value }))
                    setFormError('')
                  }}
                  placeholder="npr. Štampa / POSM / Event"
                />
              </label>
              <label className="templates-form-wide">
                Opis
                <textarea
                  value={templateForm.description}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, description: event.target.value }))}
                  rows={3}
                  placeholder="Kratko objasni kada se koristi ovaj proces"
                />
              </label>
            </div>

            <div className="templates-steps-block templates-form-steps-block">
              <div className="pulse-section-head">
                <h4>Koraci procesa</h4>
                <span>{formSteps.length}</span>
              </div>

              {formSteps.length ? (
                <div className="templates-steps-list">
                  {formSteps.map((step, index) => (
                    <div className="templates-step-row templates-step-row-edit" key={step.id}>
                      <span>{step.order}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.role} · {formatMinutes(step.estimatedMinutes)}</p>
                      </div>
                      <div className="templates-step-actions">
                        <button
                          type="button"
                          onClick={() => moveFormStep(step.id, 'up')}
                          disabled={index === 0}
                          aria-label="Pomeri korak gore"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveFormStep(step.id, 'down')}
                          disabled={index === formSteps.length - 1}
                          aria-label="Pomeri korak dole"
                        >
                          ↓
                        </button>
                        <button type="button" onClick={() => removeFormStep(step.id)} aria-label="Obriši korak">
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="templates-empty-text">Dodaj korake koji će kasnije postati taskovi.</p>
              )}
            </div>

            <div className="templates-step-form">
              <label>
                Naziv koraka
                <input
                  value={stepForm.title}
                  onChange={(event) => {
                    setStepForm((current) => ({ ...current, title: event.target.value }))
                    setStepError('')
                  }}
                  placeholder="npr. Prepress"
                />
              </label>
              <label>
                Operativna rola
                <select
                  value={stepForm.role}
                  onChange={(event) => {
                    setStepForm((current) => ({ ...current, role: event.target.value }))
                    setStepError('')
                  }}
                >
                  <option value="">-- Izaberi rolu --</option>
                  {PRODUCTION_ROLES.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </label>
              <label>
                Vreme min
                <input
                  value={stepForm.estimatedMinutes}
                  onChange={(event) => {
                    setStepForm((current) => ({ ...current, estimatedMinutes: event.target.value }))
                    setStepError('')
                  }}
                  inputMode="numeric"
                  placeholder="45"
                />
              </label>
              {stepError ? <p className="templates-error-text">{stepError}</p> : null}
              <button type="button" className="pulse-primary-btn" onClick={handleFormStepSubmit}>
                DODAJ KORAK
              </button>
            </div>

            {formError ? <p className="templates-error-text">{formError}</p> : null}

            <button type="submit" className="pulse-primary-btn">
              {editingTemplateId ? 'SAČUVAJ IZMENE' : 'SAČUVAJ ŠABLON'}
            </button>
          </form>
        </section>
      ) : null}

      {!isFormOpen ? (
        <div className="templates-layout">
          <div className="pulse-section pulse-section-blue templates-list-section">
          <div className="pulse-section-head">
            <h3>Procesi</h3>
            <span>{filteredTemplates.length} šablona</span>
          </div>

          <div className="templates-grid">
            {filteredTemplates.map((template) => (
              <article
                className={`templates-card ${selectedTemplate?.id === template.id ? 'templates-card-active' : ''}`}
                key={template.id}
              >
                <button type="button" onClick={() => setSelectedTemplateId(template.id)}>
                  <div>
                    <h4>{template.title}</h4>
                    <p>{template.projectType}</p>
                  </div>
                  <span>{template.steps.length} koraka</span>
                </button>
              </article>
            ))}
          </div>
        </div>

        <aside className="pulse-section templates-detail-section">
          {selectedTemplate ? (
            <>
              <div className="pulse-section-head">
                <h3>Detalj šablona</h3>
                <span>{selectedTemplate.status === 'active' ? 'Aktivan' : 'Arhiviran'}</span>
              </div>

              <div className="templates-detail-block">
                <h4>{selectedTemplate.title}</h4>
                <p>{selectedTemplate.description || 'Nema dodatnog opisa.'}</p>
                <small>Tip projekta: {selectedTemplate.projectType}</small>
              </div>

              <div className="templates-steps-block">
                <div className="pulse-section-head">
                  <h4>Koraci procesa</h4>
                  <span>{selectedTemplate.steps.length}</span>
                </div>

                {selectedTemplate.steps.length ? (
                  <div className="templates-steps-list">
                    {selectedTemplate.steps
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((step) => (
                        <div className="templates-step-row" key={step.id}>
                          <span>{step.order}</span>
                          <div>
                            <strong>{step.title}</strong>
                            <p>{step.role} · {formatMinutes(step.estimatedMinutes)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="templates-empty-text">Ovaj šablon još nema korake. Klikni IZMENI i dodaj ih.</p>
                )}
              </div>

              <div className="templates-detail-actions">
                <button type="button" className="pulse-outline-btn" onClick={() => startEditTemplate(selectedTemplate)}>
                  IZMENI
                </button>
                <button type="button" className="pulse-outline-btn" onClick={() => duplicateTemplate(selectedTemplate)}>
                  DUPLIRAJ
                </button>
                <button type="button" className="pulse-outline-btn" onClick={() => deleteTemplate(selectedTemplate.id)}>
                  OBRIŠI
                </button>
              </div>
            </>
          ) : (
            <div className="templates-empty-card">
              <h4>Nema šablona</h4>
              <p>Dodaj prvi proces da kasnije može da pravi automatske taskove.</p>
            </div>
          )}
        </aside>
        </div>
      ) : null}
    </section>
  )
}

export default TemplatesPage
