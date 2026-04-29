export function readStoredArray<T>(key: string, fallback: T[]): T[] {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const rawValue = window.localStorage.getItem(key)

    if (!rawValue) {
      return fallback
    }

    const parsedValue: unknown = JSON.parse(rawValue)

    return Array.isArray(parsedValue) ? (parsedValue as T[]) : fallback
  } catch {
    return fallback
  }
}

export function writeStoredValue(key: string, value: unknown) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures in mock phase and keep in-memory state alive.
  }
}
