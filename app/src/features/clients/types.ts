export interface ClientContact {
  name: string
  role: string
  email: string
  phone: string
}

export interface CommercialInputs {
  businessType: string
  revenueBand: string
  employeeCount: number | null
  locationCount: number | null
  decisionLevel: string
  relationshipLevel: string
  innovationReady: string
}

export interface Client {
  id: number
  name: string
  city: string
  address: string
  contacts: ClientContact[]
  commercial: CommercialInputs
}
