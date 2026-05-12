export const BUSINESS_TYPE_LABELS = {
  apoteka: 'Apoteka',
  maloprodaja: 'Maloprodaja',
  ugostiteljstvo: 'Ugostiteljstvo',
  usluge: 'Usluge',
  drzavne_institucije: 'Drzavne institucije',
  proizvodnja: 'Proizvodnja',
  distribucija: 'Distribucija',
  ostalo: 'Ostalo',
} as const

export const REVENUE_BAND_LABELS = {
  small: 'Mali',
  medium: 'Srednji',
  large: 'Veliki',
} as const

export const DECISION_LEVEL_LABELS = {
  owner: 'Vlasnik',
  management: 'Management',
  local: 'Lokalno',
} as const

export const RELATIONSHIP_LEVEL_LABELS = {
  new: 'Novi klijent',
  communication: 'Imamo komunikaciju',
  trust: 'Izgradjeno poverenje',
} as const

export const INNOVATION_READY_LABELS = {
  yes: 'Da',
  no: 'Ne',
} as const

export const BUSINESS_TYPE_OPTIONS = Object.entries(BUSINESS_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export const REVENUE_BAND_OPTIONS = Object.entries(REVENUE_BAND_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export const DECISION_LEVEL_OPTIONS = Object.entries(DECISION_LEVEL_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export const RELATIONSHIP_LEVEL_OPTIONS = Object.entries(RELATIONSHIP_LEVEL_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
)

export const INNOVATION_READY_OPTIONS = Object.entries(INNOVATION_READY_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
)
