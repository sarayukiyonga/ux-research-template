import { MOSCOW_SCOPE_ALL } from '@/lib/moscow-types'

export const CARD_SORTING_CONFIG_VERSION = 1 as const

export interface CardSortingCard {
  id: string
  /** Texto visible (página, sección o funcionalidad web). */
  label: string
}

export interface CardSortingCategory {
  id: string
  label: string
}

export interface CardSortingConfig {
  version: typeof CARD_SORTING_CONFIG_VERSION
  cards: CardSortingCard[]
  categories: CardSortingCategory[]
  /** Ámbito MVP / MoSCoW (`all` = vista combinada «Todos los canales»). */
  mvpScope?: string
  /** Etiqueta legible del ámbito (p. ej. para participantes). */
  mvpScopeLabel?: string
}

export function newCardSortingId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function defaultCardSortingCategories(): CardSortingCategory[] {
  return [
    { id: 'def_menu', label: 'Menú principal / muy visible' },
    { id: 'def_linked', label: 'Accesible desde otra página' },
    { id: 'def_secondary', label: 'Contenido secundario' },
    { id: 'def_out', label: 'Fuera de la web o dudoso' },
  ]
}

export function defaultCardSortingConfig(): CardSortingConfig {
  return {
    version: CARD_SORTING_CONFIG_VERSION,
    cards: [],
    categories: defaultCardSortingCategories(),
    mvpScope: MOSCOW_SCOPE_ALL,
    mvpScopeLabel: 'Todos los canales',
  }
}

function normalizeCard(raw: unknown): CardSortingCard | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const label = typeof o.label === 'string' ? o.label.trim().slice(0, 160) : ''
  if (!label) return null
  return {
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newCardSortingId('card'),
    label,
  }
}

function normalizeCategory(raw: unknown): CardSortingCategory | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const label = typeof o.label === 'string' ? o.label.trim().slice(0, 120) : ''
  if (!label) return null
  return {
    id: typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newCardSortingId('cat'),
    label,
  }
}

export function normalizeCardSortingConfig(raw: unknown): CardSortingConfig {
  const base = defaultCardSortingConfig()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const cards = Array.isArray(o.cards)
    ? (o.cards.map(normalizeCard).filter(Boolean) as CardSortingCard[]).slice(0, 120)
    : []
  const catsRaw = Array.isArray(o.categories) ? o.categories : []
  const categories = (catsRaw.map(normalizeCategory).filter(Boolean) as CardSortingCategory[]).slice(0, 40)
  const mvpScopeRaw = o.mvpScope
  const mvpScope =
    typeof mvpScopeRaw === 'string' && mvpScopeRaw.trim() ? mvpScopeRaw.trim() : MOSCOW_SCOPE_ALL
  const mvpScopeLabelRaw = o.mvpScopeLabel
  const mvpScopeLabel =
    typeof mvpScopeLabelRaw === 'string' && mvpScopeLabelRaw.trim()
      ? mvpScopeLabelRaw.trim().slice(0, 120)
      : mvpScope === MOSCOW_SCOPE_ALL
        ? 'Todos los canales'
        : mvpScope
  return {
    version: CARD_SORTING_CONFIG_VERSION,
    cards,
    categories: categories.length > 0 ? categories : base.categories,
    mvpScope,
    mvpScopeLabel,
  }
}
