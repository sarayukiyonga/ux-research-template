import {
  getMVPScopePersist,
  normalizeMVPStoredJson,
  type MVPBundlePersist,
} from '@/lib/mvp-types'
import { newCardSortingId, type CardSortingCard } from '@/lib/card-sorting-types'

/** Tarjetas únicas por texto (insensible a mayúsculas), a partir de la matriz MVP del ámbito indicado. */
export function mvpBundleToCardSortingCards(bundle: MVPBundlePersist, scope: string): CardSortingCard[] {
  const persist = getMVPScopePersist(bundle, scope)
  const seen = new Set<string>()
  const cards: CardSortingCard[] = []
  for (const n of persist.notas) {
    const t = n.texto.trim().slice(0, 160)
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    cards.push({ id: newCardSortingId('card'), label: t })
  }
  return cards
}

export function mvpSavedPayloadToCards(payload: unknown, scope: string): CardSortingCard[] {
  if (!payload || typeof payload !== 'object') return []
  const o = payload as Record<string, unknown>
  const saved = o.saved as Record<string, unknown> | undefined
  const raw = saved?.bundle
  if (!raw) return []
  return mvpBundleToCardSortingCards(normalizeMVPStoredJson(raw), scope)
}
