import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useClientStore } from '../clientStore'
import { useProjectStore } from '../../projects/projectStore'
import type { Project } from '../../projects/types'
import ProjectForm, { type ProjectFormValues } from '../../projects/components/ProjectForm'
import { buildStagesFromTemplate, getTemplateIdForProjectType } from '../../projects/projectTemplates'
import CatalogJobForm, { type CatalogJobFormValues } from '../components/CatalogJobForm'
import { isProductVisibleForClient, readProducts, readProductsFromSupabase, saveProducts } from '../../products/productStorage'
import { readProcessTemplates, readProcessTemplatesFromSupabase, saveProcessTemplates } from '../../templates/templateStorage'
import { buildCatalogJobPayload } from '../../workflows/createJobFromProduct'
import { useTaskStore } from '../../tasks/taskStore'
import { useCloudStore } from '../../cloud/cloudStore'
import './client-detail.css'

type JobMode = 'choice' | 'blank' | 'catalog'

function ClientCreateJobPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const clientId = id ?? ''
  const { getClientById } = useClientStore()
  const { addProject } = useProjectStore()
  const { addTask } = useTaskStore()
  const cloud = useCloudStore()
  const [mode, setMode] = useState<JobMode>('choice')
  const [message, setMessage] = useState('')
  const client = getClientById(clientId)
  const products = readProducts()
  const processTemplates = readProcessTemplates()

  useEffect(() => {
    let isMounted = true
    const workspaceId = cloud.activeWorkspace?.id || ''

    async function preloadCatalogFromCloud() {
      if (!cloud.isConfigured || !workspaceId) return

      try {
        const [cloudProducts, cloudTemplates] = await Promise.all([
          readProductsFromSupabase(workspaceId),
          readProcessTemplatesFromSupabase(workspaceId),
        ])

        if (!isMounted) return
        if (cloudProducts.length) saveProducts(cloudProducts)
        if (cloudTemplates.length) saveProcessTemplates(cloudTemplates)
      } catch {
        // Local catalog remains fallback.
      }
    }

    void preloadCatalogFromCloud()

    return () => {
      isMounted = false
    }
  }, [cloud.activeWorkspace?.id, cloud.isConfigured])

  const goBack = () => navigate(clientId ? `/clients/${clientId}` : '/clients')

  const handleCreateProject = async (values: ProjectFormValues) => {
    if (!client) return

    const templateId = getTemplateIdForProjectType(values.type)
    const nextProject: Project = {
      id: `project-${Date.now()}`,
      clientId: String(client.id),
      title: values.title.trim() || 'Novi projekat',
      type: values.type || undefined,
      frequency: values.frequency || undefined,
      value: values.value.trim() ? Number(values.value) : undefined,
      status: 'aktivan',
      templateId,
      stages: buildStagesFromTemplate(templateId),
    }

    const savedProject = await Promise.resolve(addProject(nextProject))
    if (!savedProject) {
      setMessage('Projekat nije sačuvan. Proveri konekciju/Supabase i pokušaj ponovo.')
      return
    }

    navigate(`/clients/${client.id}`)
  }

  const handleCreateJobFromCatalog = async (values: CatalogJobFormValues) => {
    if (!client) return

    const product = products.find((item) => item.id === values.productId && item.status === 'active' && isProductVisibleForClient(item, String(client.id)))
    const template = product?.processTemplateId
      ? processTemplates.find((item) => item.id === product.processTemplateId)
      : undefined
    const quantity = Number(values.quantity.replace(',', '.'))

    if (!product || !template || !template.steps.length || !Number.isFinite(quantity) || quantity <= 0) {
      setMessage('Posao nije kreiran. Proveri proizvod, šablon procesa i količinu.')
      return
    }

    const payload = buildCatalogJobPayload({
      clientId: String(client.id),
      product,
      template,
      title: values.title,
      dueDate: values.dueDate || undefined,
      quantity,
      fileLink: values.fileLink,
      note: values.note,
    }, cloud.members.map((member) => ({
      id: member.user_id,
      name: member.display_name || member.profile?.full_name || member.profile?.email || member.user_id,
      productionRole: member.production_role || null,
    })))

    const savedProject = await Promise.resolve(addProject(payload.project))

    if (!savedProject) {
      setMessage('Projekat nije sačuvan. Taskovi nisu kreirani.')
      return
    }

    await Promise.all(payload.tasks.map((task) => Promise.resolve(addTask({ ...task, projectId: savedProject.id }))))
    navigate(`/clients/${client.id}`)
  }

  if (!client) {
    return (
      <section className="page-card client-detail-shell pulse-create-flow-page">
        <button type="button" className="secondary-link-button" onClick={() => navigate('/clients')}>
          Nazad na klijente
        </button>
        <div className="clients-empty-state">
          <h2>Klijent nije pronađen</h2>
          <p>Vrati se na listu klijenata i izaberi postojeći zapis.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="page-card client-detail-shell pulse-create-flow-page">
      <button type="button" className="secondary-link-button" onClick={goBack}>
        Nazad na klijenta
      </button>
      <div className="pulse-create-flow-head">
        <span>Novi posao</span>
        <h2>{client.name}</h2>
        <p>Kreiraj prazan projekat ili posao iz kataloga proizvoda.</p>
      </div>
      {message ? <p className="customer-catalog-job-message">{message}</p> : null}

      {mode === 'choice' ? (
        <div className="customer-job-choice pulse-create-flow-choice">
          <button type="button" className="customer-project-action-button" onClick={() => setMode('blank')}>
            Prazan projekat
          </button>
          <button type="button" className="customer-project-action-button customer-project-action-button-secondary" onClick={() => setMode('catalog')}>
            Iz kataloga
          </button>
        </div>
      ) : null}

      {mode === 'blank' ? <ProjectForm onCancel={() => setMode('choice')} onSubmit={handleCreateProject} /> : null}
      {mode === 'catalog' ? (
        <CatalogJobForm
          clientId={String(client.id)}
          products={products}
          templates={processTemplates}
          onCancel={() => setMode('choice')}
          onSubmit={handleCreateJobFromCatalog}
        />
      ) : null}
    </section>
  )
}

export default ClientCreateJobPage
