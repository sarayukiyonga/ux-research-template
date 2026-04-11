const PREFIX = 'moa_ai_'

function timestamp(): string {
  return new Date().toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface CacheEntry<T> {
  data: T
  savedAt: string
}

export function loadCache<T>(key: string): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

export function saveCache<T>(key: string, data: T): string {
  const savedAt = timestamp()
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt }))
  } catch {}
  return savedAt
}

export function clearCache(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {}
}

export function clearCacheByPrefix(prefix: string): void {
  try {
    const fullPrefix = PREFIX + prefix
    Object.keys(localStorage)
      .filter((k) => k.startsWith(fullPrefix))
      .forEach((k) => localStorage.removeItem(k))
  } catch {}
}
