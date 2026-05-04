export const PRODUCTION_ROLES = [
  'ACCOUNT',
  'DIZAJNER',
  'PRODUKCIJA',
  'LOGISTIKA',
  'PREPRESS',
  'MONTAŽA',
  'FINANCE',
] as const

export type ProductionRole = (typeof PRODUCTION_ROLES)[number]

const ROLE_ALIASES: Record<string, ProductionRole> = {
  admin: 'ACCOUNT',
  account: 'ACCOUNT',
  prodaja: 'ACCOUNT',
  komercijala: 'ACCOUNT',
  user: 'PRODUKCIJA',
  operativa: 'PRODUKCIJA',
  designer: 'DIZAJNER',
  design: 'DIZAJNER',
  dizajn: 'DIZAJNER',
  dizajner: 'DIZAJNER',
  graficki_dizajner: 'DIZAJNER',
  grafički_dizajner: 'DIZAJNER',
  production: 'PRODUKCIJA',
  produkcija: 'PRODUKCIJA',
  proizvodnja: 'PRODUKCIJA',
  proizvodjac: 'PRODUKCIJA',
  proizvođač: 'PRODUKCIJA',
  logistics: 'LOGISTIKA',
  logistika: 'LOGISTIKA',
  isporuka: 'LOGISTIKA',
  delivery: 'LOGISTIKA',
  prepress: 'PREPRESS',
  priprema: 'PREPRESS',
  priprema_za_stampu: 'PREPRESS',
  priprema_za_štampu: 'PREPRESS',
  montaza: 'MONTAŽA',
  montaža: 'MONTAŽA',
  installation: 'MONTAŽA',
  finance: 'FINANCE',
  finansije: 'FINANCE',
  naplata: 'FINANCE',
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_')
}

export function normalizeProductionRole(role?: string | null) {
  const value = role?.trim()
  if (!value) return ''

  const directMatch = PRODUCTION_ROLES.find((productionRole) => productionRole === value.toUpperCase())
  if (directMatch) return directMatch

  return ROLE_ALIASES[normalizeKey(value)] || value.toUpperCase()
}

export function isKnownProductionRole(role?: string | null) {
  const normalizedRole = normalizeProductionRole(role)
  return Boolean(normalizedRole && PRODUCTION_ROLES.includes(normalizedRole as ProductionRole))
}
