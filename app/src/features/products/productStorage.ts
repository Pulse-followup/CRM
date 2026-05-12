import { readStoredArray, writeStoredValue } from '../../shared/storage'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { ProductItem, ProductClientScope } from './types'

export const PRODUCT_STORAGE_KEY = 'pulse.products.v1'

export const demoProducts: ProductItem[] = [
  {
    id: 'prod-demo-social-launch',
    title: 'Social launch paket',
    category: 'Digitalna kampanja',
    description: 'Paket za lansiranje nove lokacije kroz reels, story set i community objavu.',
    price: 38000,
    currency: 'RSD',
    productionTime: '3 dana',
    processTemplateId: 'tpl-demo-social-launch',
    clientScope: 'all',
    clientIds: [],
    status: 'active',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
  {
    id: 'prod-demo-opening-kit',
    title: 'Opening promo kit',
    category: 'Event / Branding',
    description: 'Mini promo paket za otvaranje lokacije: key visual, promo video i POS set.',
    price: 126000,
    currency: 'RSD',
    productionTime: '5 dana',
    processTemplateId: 'tpl-demo-opening-kit',
    clientScope: 'all',
    clientIds: [],
    status: 'active',
    createdAt: '2026-05-01T00:00:00.000Z',
  },
]

function asString(value: unknown) {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function asNumber(value: unknown) {
  const next = Number(value ?? 0)
  return Number.isFinite(next) ? next : 0
}

function normalizeCurrency(value: unknown): 'RSD' | 'EUR' {
  return asString(value).toUpperCase() === 'EUR' ? 'EUR' : 'RSD'
}

function normalizeClientScope(value: unknown): ProductClientScope {
  return asString(value) === 'selected' ? 'selected' : 'all'
}

export function isUuid(value: string | undefined) {
  const cleanValue = value || ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanValue)
}

function asUuidOrNull(value: string | undefined) {
  const cleanValue = value || ''
  return isUuid(cleanValue) ? cleanValue : null
}

export function readProducts() {
  return readStoredArray<ProductItem>(PRODUCT_STORAGE_KEY, demoProducts)
}

export function readDemoProducts() {
  return demoProducts
}

export function saveProducts(products: ProductItem[]) {
  writeStoredValue(PRODUCT_STORAGE_KEY, products)
}

export function isProductVisibleForClient(product: ProductItem, clientId: string) {
  const scope = product.clientScope ?? 'all'
  if (scope === 'all') return true
  return (product.clientIds ?? []).includes(clientId)
}

export async function readProductsFromSupabase(workspaceId: string): Promise<ProductItem[]> {
  const supabase = getSupabaseClient()
  if (!supabase || !workspaceId) return []

  const { data: productRows, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (productError) throw productError

  const products = Array.isArray(productRows) ? productRows : []
  const productIds = products.map((row) => asString(row.id)).filter(Boolean)
  let clientIdsByProductId = new Map<string, string[]>()

  if (productIds.length) {
    const { data: clientRows, error: clientError } = await supabase
      .from('product_clients')
      .select('product_id, client_id')
      .in('product_id', productIds)

    if (clientError) throw clientError

    clientIdsByProductId = (clientRows || []).reduce((map, row) => {
      const productId = asString(row.product_id)
      const clientId = asString(row.client_id)
      if (!productId || !clientId) return map
      const current = map.get(productId) || []
      map.set(productId, [...current, clientId])
      return map
    }, new Map<string, string[]>())
  }

  return products.map((row) => {
    const id = asString(row.id)
    const clientScope = normalizeClientScope(row.client_scope)

    return {
      id,
      title: asString(row.title),
      category: asString(row.category),
      description: asString(row.description),
      price: asNumber(row.price),
      currency: normalizeCurrency(row.currency),
      productionTime: asString(row.delivery_time_label),
      processTemplateId: asString(row.source_template_id || row.template_id) || undefined,
      clientScope,
      clientIds: clientScope === 'selected' ? clientIdsByProductId.get(id) || [] : [],
      imageDataUrl: asString(row.image_data_url) || undefined,
      status: row.is_active === false ? 'archived' : 'active',
      createdAt: asString(row.created_at) || new Date().toISOString(),
    }
  })
}

function productToSupabaseRow(product: ProductItem, workspaceId: string) {
  return {
    id: product.id,
    workspace_id: workspaceId,
    title: product.title,
    category: product.category || null,
    description: product.description || null,
    price: product.price ?? 0,
    currency: product.currency || 'RSD',
    delivery_time_label: product.productionTime || null,
    image_data_url: product.imageDataUrl || null,
    client_scope: product.clientScope || 'all',
    source_template_id: asUuidOrNull(product.processTemplateId),
    template_id: asUuidOrNull(product.processTemplateId),
    is_active: product.status !== 'archived',
    updated_at: new Date().toISOString(),
  }
}

function productFromSupabaseRow(row: Record<string, unknown>, fallback?: ProductItem): ProductItem {
  const clientScope = normalizeClientScope(row.client_scope ?? fallback?.clientScope)

  return {
    id: asString(row.id) || fallback?.id || crypto.randomUUID?.() || `prod-${Date.now()}`,
    title: asString(row.title) || fallback?.title || '',
    category: asString(row.category) || fallback?.category || '',
    description: asString(row.description) || fallback?.description || '',
    price: asNumber(row.price ?? fallback?.price),
    currency: normalizeCurrency(row.currency ?? fallback?.currency),
    productionTime: asString(row.delivery_time_label) || fallback?.productionTime || '',
    processTemplateId: asString(row.source_template_id || row.template_id) || fallback?.processTemplateId || undefined,
    clientScope,
    clientIds: clientScope === 'selected' ? fallback?.clientIds || [] : [],
    imageDataUrl: asString(row.image_data_url) || fallback?.imageDataUrl || undefined,
    status: row.is_active === false ? 'archived' : fallback?.status || 'active',
    createdAt: asString(row.created_at) || fallback?.createdAt || new Date().toISOString(),
  }
}

async function syncProductClientsInSupabase(productId: string, product: ProductItem) {
  const supabase = getSupabaseClient()
  if (!supabase) return

  const { error: deleteClientsError } = await supabase.from('product_clients').delete().eq('product_id', productId)
  if (deleteClientsError) throw deleteClientsError

  if (product.clientScope === 'selected' && product.clientIds?.length) {
    const { error: clientsError } = await supabase.from('product_clients').insert(
      product.clientIds.map((clientId) => ({ product_id: productId, client_id: clientId })),
    )
    if (clientsError) throw clientsError
  }
}

export async function upsertProductToSupabase(workspaceId: string, product: ProductItem) {
  const supabase = getSupabaseClient()
  if (!supabase || !workspaceId) return product

  const payload = productToSupabaseRow(product, workspaceId)

  if (isUuid(product.id)) {
    const { id: _productId, ...updatePayload } = payload
    const { data, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', product.id)
      .eq('workspace_id', workspaceId)
      .select()
      .maybeSingle()

    if (error) throw error

    if (data) {
      await syncProductClientsInSupabase(product.id, product)
      return productFromSupabaseRow(data, product)
    }

    const { data: insertedData, error: insertError } = await supabase
      .from('products')
      .insert(payload)
      .select()
      .single()

    if (insertError) throw insertError

    const insertedProduct = productFromSupabaseRow(insertedData, product)
    await syncProductClientsInSupabase(insertedProduct.id, insertedProduct)
    return insertedProduct
  }

  const { id: _localId, ...insertPayload } = payload
  const { data, error } = await supabase
    .from('products')
    .insert(insertPayload)
    .select()
    .single()

  if (error) throw error

  const savedProduct = productFromSupabaseRow(data, product)
  await syncProductClientsInSupabase(savedProduct.id, savedProduct)
  return savedProduct
}

export async function deleteProductFromSupabase(workspaceId: string, productId: string) {
  const supabase = getSupabaseClient()
  if (!supabase || !workspaceId || !productId) return { deleted: false, skipped: true }

  if (!isUuid(productId)) {
    return { deleted: false, skipped: true }
  }

  const { error: clientDeleteError } = await supabase
    .from('product_clients')
    .delete()
    .eq('product_id', productId)

  if (clientDeleteError) throw clientDeleteError

  const { data, error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('workspace_id', workspaceId)
    .select('id')

  if (error) throw error

  return { deleted: Array.isArray(data) && data.length > 0, skipped: false }
}
