import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gsap } from 'gsap'
import type { ChangeEvent, FormEvent } from 'react'
import { useClientStore } from '../features/clients/clientStore'
import { compressProductImage } from '../features/products/imageCompress'
import {
  deleteProductFromSupabase,
  isUuid,
  readProducts,
  readProductsFromSupabase,
  saveProducts,
  upsertProductToSupabase,
} from '../features/products/productStorage'
import {
  getProcessTemplateLabel,
  readProcessTemplates,
  readProcessTemplatesFromSupabase,
  saveProcessTemplates,
} from '../features/templates/templateStorage'
import type { ProductFormValues, ProductItem } from '../features/products/types'
import { useCloudStore } from '../features/cloud/cloudStore'
import { formatTemplateEstimate } from '../features/workflows/createJobFromProduct'

const emptyForm: ProductFormValues = {
  title: '',
  category: '',
  description: '',
  price: '',
  currency: 'RSD',
  productionTime: '',
  processTemplateId: '',
  clientScope: 'all',
  clientIds: [],
}

function formatPrice(product: ProductItem) {
  return `${product.price.toLocaleString('sr-RS')} ${product.currency}`
}

function createCloudSafeId(prefix: string) {
  return crypto.randomUUID?.() || `${prefix}-${Date.now()}`
}

function getProductClientScopeLabel(product: ProductItem, clientNameById: Map<string, string>) {
  const scope = product.clientScope ?? 'all'
  const clientIds = product.clientIds ?? []

  if (scope === 'all' || !clientIds.length) return 'Svi klijenti'

  return clientIds
    .map((clientId) => clientNameById.get(clientId) ?? `Klijent ${clientId}`)
    .join(', ')
}

function ProductsPage() {
  const { clients } = useClientStore()
  const navigate = useNavigate()
  const productsListRef = useRef<HTMLDivElement | null>(null)
  const cloud = useCloudStore()
  const workspaceId = cloud.activeWorkspace?.id || ''
  const isCloudProductsMode = Boolean(cloud.isConfigured && workspaceId)
  const [products, setProducts] = useState<ProductItem[]>(() => readProducts())
  const [query, setQuery] = useState('')
  const [clientFilter, setClientFilter] = useState('all')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(products[0]?.id ?? null)
  const [form, setForm] = useState<ProductFormValues>(emptyForm)
  const [imageMessage, setImageMessage] = useState('')
  const [formError, setFormError] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [processTemplates, setProcessTemplates] = useState(() => readProcessTemplates())

  useEffect(() => {
    let isMounted = true

    async function loadProductsFromCloud() {
      if (!isCloudProductsMode) {
        setSyncMessage('')
        return
      }

      try {
        setSyncMessage('Učitavam proizvode iz Supabase-a...')
        const [cloudProducts, cloudTemplates] = await Promise.all([
          readProductsFromSupabase(workspaceId),
          readProcessTemplatesFromSupabase(workspaceId),
        ])
        if (!isMounted) return

        if (cloudTemplates.length) {
          setProcessTemplates(cloudTemplates)
          saveProcessTemplates(cloudTemplates)
        }

        if (cloudProducts.length) {
          setProducts(cloudProducts)
          saveProducts(cloudProducts)
          setSelectedProductId((current) => current && cloudProducts.some((product) => product.id === current) ? current : cloudProducts[0]?.id ?? null)
          setSyncMessage('Proizvodi su učitani iz Supabase-a.')
          return
        }

        setSyncMessage('Supabase katalog je prazan. Lokalni proizvodi ostaju kao dev fallback.')
      } catch (error) {
        if (!isMounted) return
        setSyncMessage(error instanceof Error ? `Supabase sync greška: ${error.message}` : 'Supabase sync greška.')
      }
    }

    void loadProductsFromCloud()

    return () => {
      isMounted = false
    }
  }, [isCloudProductsMode, workspaceId])

  const clientNameById = useMemo(
    () => new Map(clients.map((client) => [String(client.id), client.name])),
    [clients],
  )

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0]
  const selectedProcessTemplate = selectedProduct?.processTemplateId
    ? processTemplates.find((template) => template.id === selectedProduct.processTemplateId)
    : undefined

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return products.filter((product) => {
      const haystack = `${product.title} ${product.category} ${product.description}`.toLowerCase()
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery)
      const scope = product.clientScope ?? 'all'
      const clientIds = product.clientIds ?? []
      const matchesClient =
        clientFilter === 'all' || scope === 'all' || clientIds.includes(clientFilter)

      return matchesQuery && matchesClient
    })
  }, [products, query, clientFilter])


  useEffect(() => {
    const root = productsListRef.current
    if (!root) return undefined

    const ctx = gsap.context(() => {
      const cards = Array.from(root.querySelectorAll<HTMLElement>('.products-card'))
      gsap.fromTo(
        cards,
        { autoAlpha: 0, y: 20, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, ease: 'power3.out', stagger: 0.06 },
      )
    }, root)

    return () => ctx.revert()
  }, [filteredProducts.length, query, clientFilter])

  const persistProducts = (nextProducts: ProductItem[]) => {
    setProducts(nextProducts)
    saveProducts(nextProducts)
  }

  const persistProductToCloudWithHydration = (product: ProductItem) => {
    if (!isCloudProductsMode) return

    void upsertProductToSupabase(workspaceId, product)
      .then((savedProduct) => {
        if (savedProduct && savedProduct.id !== product.id) {
          setProducts((current) => {
            const nextProducts = current.map((item) => (item.id === product.id ? savedProduct : item))
            saveProducts(nextProducts)
            return nextProducts
          })
          setSelectedProductId(savedProduct.id)
          if (editingProductId === product.id) setEditingProductId(savedProduct.id)
        }
        setSyncMessage('Proizvod je sačuvan u Supabase.')
      })
      .catch((error) => {
        setSyncMessage(error instanceof Error ? `Supabase sync greška: ${error.message}` : 'Proizvod nije sačuvan u Supabase.')
      })
  }

  const persistProductToCloud = (product: ProductItem) => {
    if (!isCloudProductsMode) return

    void upsertProductToSupabase(workspaceId, product)
      .then(() => setSyncMessage('Proizvod je sačuvan u Supabase.'))
      .catch((error) => {
        setSyncMessage(error instanceof Error ? `Supabase sync greška: ${error.message}` : 'Proizvod nije sačuvan u Supabase.')
      })
  }

  void persistProductToCloud

  const getTemplateProductionTime = (templateId?: string) => {
    const template = processTemplates.find((item) => item.id === templateId)
    return formatTemplateEstimate(template)
  }

  const handleFormChange = (field: keyof ProductFormValues, value: string) => {
    setForm((current) => {
      if (field !== 'processTemplateId') return { ...current, [field]: value }

      const estimatedProductionTime = getTemplateProductionTime(value)
      return {
        ...current,
        processTemplateId: value,
        productionTime: estimatedProductionTime || current.productionTime,
      }
    })
    setFormError('')
  }

  const handleClientScopeChange = (value: 'all' | 'selected') => {
    setForm((current) => ({
      ...current,
      clientScope: value,
      clientIds: value === 'all' ? [] : current.clientIds ?? [],
    }))
    setFormError('')
  }

  const toggleClientInForm = (clientId: string) => {
    setForm((current) => {
      const currentClientIds = current.clientIds ?? []
      const nextClientIds = currentClientIds.includes(clientId)
        ? currentClientIds.filter((id) => id !== clientId)
        : [...currentClientIds, clientId]

      return { ...current, clientIds: nextClientIds }
    })
    setFormError('')
  }

  const openNewProductForm = () => {
    setEditingProductId(null)
    setForm(emptyForm)
    setImageMessage('')
    setFormError('')
    setIsFormOpen(true)
  }

  const closeProductForm = () => {
    setEditingProductId(null)
    setForm(emptyForm)
    setImageMessage('')
    setFormError('')
    setIsFormOpen(false)
  }

  const startEditProduct = (product: ProductItem) => {
    setEditingProductId(product.id)
    setSelectedProductId(product.id)
    setForm({
      title: product.title,
      category: product.category,
      description: product.description,
      price: String(product.price),
      currency: product.currency,
      productionTime: product.productionTime,
      processTemplateId: product.processTemplateId ?? '',
      clientScope: product.clientScope ?? 'all',
      clientIds: product.clientIds ?? [],
      imageDataUrl: product.imageDataUrl,
    })
    setImageMessage('')
    setFormError('')
    setIsFormOpen(true)
  }

  const duplicateProduct = (product: ProductItem) => {
    const duplicatedProduct: ProductItem = {
      ...product,
      id: createCloudSafeId('prod'),
      title: `${product.title} kopija`,
      createdAt: new Date().toISOString(),
    }
    const nextProducts = [duplicatedProduct, ...products]
    persistProducts(nextProducts)
    persistProductToCloudWithHydration(duplicatedProduct)
    setSelectedProductId(duplicatedProduct.id)
  }

  const deleteProduct = (productId: string) => {
    const product = products.find((item) => item.id === productId)
    if (!product) return
    if (!window.confirm(`Obrisati proizvod "${product.title}"? Postojeći projekti i taskovi ostaju sačuvani.`)) return

    const nextProducts = products.filter((item) => item.id !== productId)
    persistProducts(nextProducts)

    if (isCloudProductsMode) {
      if (!isUuid(productId)) {
        setSyncMessage('Lokalni dev proizvod je obrisan. Supabase brisanje nije potrebno za fallback stavke.')
      } else {
        void deleteProductFromSupabase(workspaceId, productId)
          .then((result) => {
            if (result?.deleted) {
              setSyncMessage('Proizvod je obrisan iz Supabase.')
              return
            }
            setSyncMessage('Proizvod nije pronađen u Supabase; uklonjen je iz lokalnog prikaza.')
          })
          .catch((error) => {
            persistProducts(products)
            setSelectedProductId(productId)
            setSyncMessage(error instanceof Error ? `Supabase sync greška: ${error.message}` : 'Proizvod nije obrisan iz Supabase.')
          })
      }
    }

    if (selectedProductId === productId) setSelectedProductId(nextProducts[0]?.id ?? null)
    if (editingProductId === productId) closeProductForm()
  }

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setImageMessage('Kompresujem sliku...')
      const imageDataUrl = await compressProductImage(file)
      setForm((current) => ({ ...current, imageDataUrl }))
      setImageMessage('Slika je kompresovana i spremna.')
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : 'Slika nije mogla da se obradi.')
    } finally {
      event.target.value = ''
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const title = form.title.trim()
    const category = form.category.trim()
    const productionTime = form.productionTime.trim()
    const price = Number(form.price.replace(',', '.'))
    const clientScope = form.clientScope ?? 'all'
    const clientIds = form.clientIds ?? []

    if (!title || !category || !productionTime) {
      setFormError('Naziv, kategorija i rok izrade su obavezni.')
      return
    }

    if (!Number.isFinite(price) || price < 0) {
      setFormError('Cena mora biti broj.')
      return
    }

    if (clientScope === 'selected' && !clientIds.length) {
      setFormError('Izaberi bar jednog klijenta ili promeni dostupnost na Svi klijenti.')
      return
    }

    if (editingProductId) {
      const nextProducts = products.map((product) =>
        product.id === editingProductId
          ? {
              ...product,
              title,
              category,
              description: form.description.trim(),
              price,
              currency: form.currency,
              productionTime,
              processTemplateId: form.processTemplateId || undefined,
              clientScope,
              clientIds: clientScope === 'all' ? [] : clientIds,
              imageDataUrl: form.imageDataUrl,
            }
          : product,
      )
      persistProducts(nextProducts)
      const savedProduct = nextProducts.find((product) => product.id === editingProductId)
      if (savedProduct) persistProductToCloudWithHydration(savedProduct)
      setSelectedProductId(editingProductId)
      closeProductForm()
      return
    }

    const newProduct: ProductItem = {
      id: createCloudSafeId('prod'),
      title,
      category,
      description: form.description.trim(),
      price,
      currency: form.currency,
      productionTime,
      processTemplateId: form.processTemplateId || undefined,
      clientScope,
      clientIds: clientScope === 'all' ? [] : clientIds,
      imageDataUrl: form.imageDataUrl,
      status: 'active',
      createdAt: new Date().toISOString(),
    }

    const nextProducts = [newProduct, ...products]
    persistProducts(nextProducts)
    persistProductToCloudWithHydration(newProduct)
    setSelectedProductId(newProduct.id)
    closeProductForm()
  }

  return (
    <section className="pulse-phone-screen products-page-shell products-command-page">
      <div className="products-command-header">
        <button type="button" className="products-dashboard-link" onClick={() => navigate('/')}>
          ← Dashboard
        </button>
        <div className="products-command-title-row">
          <div>
            <p className="products-eyebrow">CATALOG COMMAND VIEW</p>
            <h2>PROIZVODI</h2>
            <p>Katalog ponuda i šablona poslova</p>
          </div>
          <button type="button" className="pulse-primary-btn products-new-button" onClick={openNewProductForm}>
            + Novi proizvod
          </button>
        </div>
      </div>

      <div className="products-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pretraga po nazivu, kategoriji ili opisu"
        />
      </div>

      {syncMessage ? <p className="products-help-text">{syncMessage}</p> : null}

      <div className="products-client-filter">
        <span>Dostupnost</span>
        <button
          type="button"
          className={`products-client-chip ${clientFilter === 'all' ? 'products-client-chip-active' : ''}`}
          onClick={() => setClientFilter('all')}
        >
          Svi
        </button>
        {clients.map((client) => {
          const clientId = String(client.id)
          return (
            <button
              type="button"
              className={`products-client-chip ${clientFilter === clientId ? 'products-client-chip-active' : ''}`}
              key={client.id}
              onClick={() => setClientFilter(clientId)}
            >
              {client.name}
            </button>
          )
        })}
      </div>

      {isFormOpen ? (
        <form className="pulse-section products-form" onSubmit={handleSubmit}>
          <div className="pulse-section-head">
            <h3>{editingProductId ? 'Izmeni proizvod' : 'Novi proizvod'}</h3>
            <button type="button" className="pulse-outline-btn" onClick={closeProductForm}>
              ZATVORI
            </button>
          </div>

          <div className="products-form-grid">
            <label>
              Naziv proizvoda
              <input value={form.title} onChange={(event) => handleFormChange('title', event.target.value)} />
            </label>
            <label>
              Kategorija
              <input
                value={form.category}
                onChange={(event) => handleFormChange('category', event.target.value)}
                placeholder="npr. Štampa / POSM / Branding"
              />
            </label>
            <label>
              Cena
              <input
                value={form.price}
                onChange={(event) => handleFormChange('price', event.target.value)}
                inputMode="decimal"
                placeholder="8500"
              />
            </label>
            <label>
              Valuta
              <select value={form.currency} onChange={(event) => handleFormChange('currency', event.target.value)}>
                <option value="RSD">RSD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label>
              Rok izrade
              <input
                value={form.productionTime}
                onChange={(event) => handleFormChange('productionTime', event.target.value)}
                placeholder="npr. 2-3 dana"
              />
            </label>
            <label>
              Šablon procesa
              <select
                value={form.processTemplateId}
                onChange={(event) => handleFormChange('processTemplateId', event.target.value)}
              >
                <option value="">Bez šablona za sada</option>
                {processTemplates.map((template) => (
                  <option value={template.id} key={template.id}>
                    {template.title}
                  </option>
                ))}
              </select>
              {form.processTemplateId ? <span>Procena iz šablona: {getTemplateProductionTime(form.processTemplateId) || 'nema unetih vremena'}</span> : null}
            </label>

            <fieldset className="products-form-wide products-client-scope-field">
              <legend>Dostupno za klijente</legend>
              <div className="products-scope-toggle">
                <button
                  type="button"
                  className={`products-client-chip ${form.clientScope !== 'selected' ? 'products-client-chip-active' : ''}`}
                  onClick={() => handleClientScopeChange('all')}
                >
                  Svi klijenti
                </button>
                <button
                  type="button"
                  className={`products-client-chip ${form.clientScope === 'selected' ? 'products-client-chip-active' : ''}`}
                  onClick={() => handleClientScopeChange('selected')}
                >
                  Izabrani klijenti
                </button>
              </div>
              {form.clientScope === 'selected' ? (
                <div className="products-client-picker">
                  {clients.map((client) => {
                    const clientId = String(client.id)
                    const isSelected = (form.clientIds ?? []).includes(clientId)
                    return (
                      <button
                        type="button"
                        className={`products-client-chip ${isSelected ? 'products-client-chip-active' : ''}`}
                        key={client.id}
                        onClick={() => toggleClientInForm(clientId)}
                      >
                        {client.name}
                      </button>
                    )
                  })}
                </div>
              ) : null}
            </fieldset>

            <label className="products-image-field">
              Slika proizvoda
              <input type="file" accept="image/*" onChange={handleImageChange} />
              <span>Slika se automatski smanjuje na max 250px JPEG.</span>
            </label>
            <label className="products-form-wide">
              Opis
              <textarea
                value={form.description}
                onChange={(event) => handleFormChange('description', event.target.value)}
                rows={4}
                placeholder="Kratak opis proizvoda/usluge"
              />
            </label>
          </div>

          {form.imageDataUrl ? (
            <div className="products-image-preview">
              <img src={form.imageDataUrl} alt="Preview proizvoda" />
              <button type="button" className="pulse-outline-btn" onClick={() => setForm((current) => ({ ...current, imageDataUrl: undefined }))}>
                UKLONI SLIKU
              </button>
            </div>
          ) : null}

          {imageMessage ? <p className="products-help-text">{imageMessage}</p> : null}
          {formError ? <p className="products-error-text">{formError}</p> : null}

          <button type="submit" className="pulse-primary-btn">
            {editingProductId ? 'SAČUVAJ IZMENE' : 'SAČUVAJ PROIZVOD'}
          </button>
        </form>
      ) : null}

      <div className="products-layout">
        <div className="pulse-section pulse-section-blue products-list-section">
          <div className="pulse-section-head">
            <h3>Katalog</h3>
            <span>{filteredProducts.length} stavki</span>
          </div>

          <div className="products-grid" ref={productsListRef}>
            {filteredProducts.map((product) => (
              <article
                className={`products-card ${selectedProduct?.id === product.id ? 'products-card-active' : ''}`}
                key={product.id}
              >
                <button type="button" onClick={() => setSelectedProductId(product.id)} aria-label={`Prikaži detalje proizvoda ${product.title}`}>
                  <div className="products-card-image">
                    {product.imageDataUrl ? <img src={product.imageDataUrl} alt={product.title} /> : <span>{product.title.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div className="products-card-body">
                    <h4>{product.title}</h4>
                    <p>{product.category}</p>
                    <strong>{formatPrice(product)}</strong>
                    <small>Rok: {product.productionTime}</small>
                    <small>{getProductClientScopeLabel(product, clientNameById)}</small>
                  </div>
                </button>
              </article>
            ))}
          </div>
        </div>

        <aside className="pulse-section products-detail-section">
          {selectedProduct ? (
            <>
              <div className="pulse-section-head">
                <h3>Detalj proizvoda</h3>
                <span>{selectedProduct.status === 'active' ? 'Aktivan' : 'Arhiviran'}</span>
              </div>

              <div className="products-detail-hero">
                <div className="products-detail-image">
                  {selectedProduct.imageDataUrl ? (
                    <img src={selectedProduct.imageDataUrl} alt={selectedProduct.title} />
                  ) : (
                    <span>{selectedProduct.title.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h4>{selectedProduct.title}</h4>
                  <p>{selectedProduct.category}</p>
                  <strong>{formatPrice(selectedProduct)}</strong>
                </div>
              </div>

              <div className="products-detail-block">
                <h4>Osnovno</h4>
                <p>{selectedProduct.description || 'Nema dodatnog opisa.'}</p>
                <p>Rok izrade: <strong>{selectedProduct.productionTime}</strong></p>
                <p>Šablon: <strong>{getProcessTemplateLabel(selectedProduct.processTemplateId, processTemplates)}</strong></p>
                {selectedProcessTemplate ? <p>Procena iz šablona: <strong>{formatTemplateEstimate(selectedProcessTemplate) || '-'}</strong></p> : null}
                <p>Dostupnost: <strong>{getProductClientScopeLabel(selectedProduct, clientNameById)}</strong></p>
              </div>

              <div className="products-detail-block products-process-block">
                <h4>Proces izrade</h4>
                {selectedProcessTemplate ? (
                  <>
                    <p>Šablon: <strong>{selectedProcessTemplate.title}</strong></p>
                    <ol className="products-process-steps">
                      {[...selectedProcessTemplate.steps]
                        .sort((firstStep, secondStep) => firstStep.order - secondStep.order)
                        .map((step) => (
                          <li key={step.id}>
                            <span>{step.title}</span>
                            <small>{step.role} · {step.estimatedMinutes} min</small>
                          </li>
                        ))}
                    </ol>
                  </>
                ) : (
                  <p>Ovaj proizvod još nije povezan sa šablonom procesa. Izaberi šablon u formi proizvoda.</p>
                )}
              </div>

              <div className="products-detail-actions">
                <button type="button" className="pulse-outline-btn" onClick={() => startEditProduct(selectedProduct)}>
                  IZMENI
                </button>
                <button type="button" className="pulse-outline-btn" onClick={() => duplicateProduct(selectedProduct)}>
                  DUPLIRAJ
                </button>
                <button type="button" className="pulse-outline-btn" onClick={() => deleteProduct(selectedProduct.id)}>
                  OBRIŠI
                </button>
              </div>
            </>
          ) : (
            <div className="products-empty-card">
              <h4>Nema proizvoda</h4>
              <p>Dodaj prvi proizvod da katalog postane aktivan.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

export default ProductsPage
