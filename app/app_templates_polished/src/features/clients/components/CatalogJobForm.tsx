import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { isProductVisibleForClient } from '../../products/productStorage'
import type { ProductItem } from '../../products/types'
import type { ProcessTemplate } from '../../templates/types'
import { calculateDefaultDueDate, formatTemplateEstimate } from '../../workflows/createJobFromProduct'

export type CatalogJobFormValues = {
  productId: string
  title: string
  dueDate: string
  quantity: string
  fileLink: string
  note: string
}

export interface CatalogJobFormProps {
  clientId: string
  products: ProductItem[]
  templates: ProcessTemplate[]
  initialProductId?: string
  onCancel: () => void
  onSubmit: (values: CatalogJobFormValues) => void
}

const emptyValues: CatalogJobFormValues = {
  productId: '',
  title: '',
  dueDate: '',
  quantity: '1',
  fileLink: '',
  note: '',
}

type FormErrors = Partial<Record<keyof CatalogJobFormValues, string>>

function formatPrice(product: ProductItem) {
  return `${product.price.toLocaleString('sr-RS')} ${product.currency}`
}

function CatalogJobForm({ clientId, products, templates, initialProductId, onCancel, onSubmit }: CatalogJobFormProps) {
  const visibleProducts = useMemo(
    () => products.filter((product) => product.status === 'active' && isProductVisibleForClient(product, clientId)),
    [clientId, products],
  )
  const initialProduct = visibleProducts.find((product) => product.id === initialProductId) ?? visibleProducts[0]
  const [values, setValues] = useState<CatalogJobFormValues>({
    ...emptyValues,
    productId: initialProduct?.id ?? '',
    title: initialProduct?.title ?? '',
  })
  const [errors, setErrors] = useState<FormErrors>({})

  const selectedProduct = visibleProducts.find((product) => product.id === values.productId)
  const selectedTemplate = selectedProduct?.processTemplateId
    ? templates.find((template) => template.id === selectedProduct.processTemplateId)
    : undefined
  const selectedTemplateEstimate = formatTemplateEstimate(selectedTemplate)

  useEffect(() => {
    if (!selectedTemplate || values.dueDate) return
    const estimatedDueDate = calculateDefaultDueDate(selectedTemplate)
    if (estimatedDueDate) {
      setValues((current) => ({ ...current, dueDate: current.dueDate || estimatedDueDate }))
    }
  }, [selectedTemplate?.id])

  const handleChange =
    (field: keyof CatalogJobFormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const nextValue = event.target.value
      setValues((current) => ({
        ...current,
        [field]: nextValue,
        title: field === 'productId' ? visibleProducts.find((product) => product.id === nextValue)?.title ?? current.title : current.title,
      }))
      setErrors((current) => ({ ...current, [field]: '' }))
    }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: FormErrors = {}
    const quantity = Number(values.quantity.replace(',', '.'))

    if (!values.productId) nextErrors.productId = 'Izaberi proizvod iz kataloga.'
    if (!values.title.trim()) nextErrors.title = 'Naziv posla je obavezan.'
    if (!Number.isFinite(quantity) || quantity <= 0) nextErrors.quantity = 'Količina mora biti veća od nule.'
    if (!selectedProduct?.processTemplateId || !selectedTemplate) nextErrors.productId = 'Proizvod mora imati povezan šablon procesa.'
    if (selectedTemplate && !selectedTemplate.steps.length) nextErrors.productId = 'Šablon procesa nema korake.'

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    onSubmit(values)
  }

  if (!visibleProducts.length) {
    return (
      <div className="customer-task-create-form customer-catalog-job-form">
        <div className="customer-card-section-head">
          <h3>Iz kataloga</h3>
        </div>
        <p className="customer-card-empty">Nema aktivnih proizvoda za ovog klijenta. Dodaj univerzalni proizvod ili poveži proizvod sa klijentom.</p>
        <div className="customer-task-actions">
          <button type="button" className="customer-project-toggle" onClick={onCancel}>
            Zatvori
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="customer-task-create-form customer-catalog-job-form" onSubmit={handleSubmit}>
      <div className="customer-card-section-head">
        <h3>Iz kataloga</h3>
        <span className="customer-status-badge is-info">POSAO</span>
      </div>

      <label className="customer-task-form-field">
        <span>Proizvod</span>
        <select value={values.productId} onChange={handleChange('productId')}>
          {visibleProducts.map((product) => (
            <option value={product.id} key={product.id}>
              {product.title} · {formatPrice(product)}
            </option>
          ))}
        </select>
        {errors.productId ? <small className="customer-task-form-error">{errors.productId}</small> : null}
      </label>

      {selectedProduct ? (
        <div className="customer-catalog-job-product">
          <div className="customer-catalog-job-thumb">
            {selectedProduct.imageDataUrl ? <img src={selectedProduct.imageDataUrl} alt="" /> : <span>{selectedProduct.title.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div>
            <strong>{selectedProduct.title}</strong>
            <p>{selectedProduct.category} · {formatPrice(selectedProduct)}</p>
            <small>Šablon: {selectedTemplate?.title ?? 'Nije povezan'}</small>
            {selectedTemplateEstimate ? <small>Procena: {selectedTemplateEstimate}</small> : null}
          </div>
        </div>
      ) : null}

      <label className="customer-task-form-field">
        <span>Naziv posla/projekta</span>
        <input type="text" value={values.title} onChange={handleChange('title')} placeholder={selectedProduct?.title ?? 'Novi posao'} />
        {errors.title ? <small className="customer-task-form-error">{errors.title}</small> : null}
      </label>

      <div className="customer-catalog-job-grid">
        <label className="customer-task-form-field">
          <span>Rok projekta {selectedTemplateEstimate ? `(procena: ${selectedTemplateEstimate})` : ''}</span>
          <input type="date" value={values.dueDate} onChange={handleChange('dueDate')} />
        </label>
        <label className="customer-task-form-field">
          <span>Količina</span>
          <input type="number" min="1" step="1" value={values.quantity} onChange={handleChange('quantity')} />
          {errors.quantity ? <small className="customer-task-form-error">{errors.quantity}</small> : null}
        </label>
      </div>

      <label className="customer-task-form-field">
        <span>Link ka fajlu za izradu</span>
        <input type="url" value={values.fileLink} onChange={handleChange('fileLink')} placeholder="Google Drive / Dropbox / WeTransfer / shop link" />
      </label>

      <label className="customer-task-form-field">
        <span>Napomena</span>
        <textarea value={values.note} onChange={handleChange('note')} placeholder="Specifikacija, dostava, napomena za produkciju..." />
      </label>

      {selectedTemplate ? (
        <div className="customer-project-workflow-preview customer-catalog-job-steps customer-catalog-job-steps-compact">
          <div className="customer-card-section-head">
            <h3>Proces</h3>
            <span>{selectedTemplate.steps.length} koraka · {selectedTemplateEstimate}</span>
          </div>
          <p className="customer-catalog-job-summary">
            Role: {[...new Set(selectedTemplate.steps.map((step) => step.role).filter(Boolean))].join(' / ') || '-'}
          </p>
          <small>Detalji procesa se vode kroz tab „Procesi“. Ovde samo pokrećeš posao i količinu.</small>
        </div>
      ) : null}

      <div className="customer-task-actions">
        <button type="submit" className="customer-project-toggle">
          Kreiraj posao
        </button>
        <button type="button" className="customer-project-toggle" onClick={onCancel}>
          Otkaži
        </button>
      </div>
    </form>
  )
}

export default CatalogJobForm
