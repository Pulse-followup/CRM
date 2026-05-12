export type ProductStatus = 'active' | 'archived'
export type ProductClientScope = 'all' | 'selected'

export type ProductItem = {
  id: string
  title: string
  category: string
  description: string
  price: number
  currency: 'RSD' | 'EUR'
  productionTime: string
  processTemplateId?: string
  clientScope?: ProductClientScope
  clientIds?: string[]
  imageDataUrl?: string
  status: ProductStatus
  createdAt: string
}

export type ProductFormValues = {
  title: string
  category: string
  description: string
  price: string
  currency: 'RSD' | 'EUR'
  productionTime: string
  processTemplateId?: string
  clientScope?: ProductClientScope
  clientIds?: string[]
  imageDataUrl?: string
}
