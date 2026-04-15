import type { SurveyFilters } from '@/lib/sheets'

/** Misma forma que usa `FilterBar` en las páginas de encuesta. */
export type SurveySegmentKey = 'clientes' | 'potenciales'

export interface SegmentSurveyFilters {
  gender: 'all' | 'men' | 'women' | 'nonBinary'
  ageRanges: string[]
  painValues: string[]
}

export const DEFAULT_SEGMENT_FILTERS: SegmentSurveyFilters = {
  gender: 'all',
  ageRanges: [],
  painValues: [],
}

const STORAGE_KEY: Record<SurveySegmentKey, string> = {
  clientes: 'moa-survey-filters-v1-clientes',
  potenciales: 'moa-survey-filters-v1-potenciales',
}

export const SEGMENT_FILTERS_CHANGED_EVENT = 'moa-segment-filters-changed'

function parseStored(raw: string | null): SegmentSurveyFilters {
  if (!raw) return DEFAULT_SEGMENT_FILTERS
  try {
    const o = JSON.parse(raw) as Partial<SegmentSurveyFilters>
    if (!o || typeof o !== 'object') return DEFAULT_SEGMENT_FILTERS
    const gender = o.gender
    const okGender =
      gender === 'all' || gender === 'men' || gender === 'women' || gender === 'nonBinary'
        ? gender
        : DEFAULT_SEGMENT_FILTERS.gender
    const ageRanges = Array.isArray(o.ageRanges) ? o.ageRanges.filter((x) => typeof x === 'string') : []
    const painValues = Array.isArray(o.painValues) ? o.painValues.filter((x) => typeof x === 'string') : []
    return { gender: okGender, ageRanges, painValues }
  } catch {
    return DEFAULT_SEGMENT_FILTERS
  }
}

/** Lectura segura (SSR / sin window → defaults). */
export function readSegmentSurveyFilters(segment: SurveySegmentKey): SegmentSurveyFilters {
  if (typeof window === 'undefined') return DEFAULT_SEGMENT_FILTERS
  return parseStored(localStorage.getItem(STORAGE_KEY[segment]))
}

export function writeSegmentSurveyFilters(segment: SurveySegmentKey, filters: SegmentSurveyFilters): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY[segment], JSON.stringify(filters))
  window.dispatchEvent(new Event(SEGMENT_FILTERS_CHANGED_EVENT))
}

/** Cuerpo para APIs que filtran filas de Sheets. */
export function segmentFiltersToApi(filters: SegmentSurveyFilters): SurveyFilters {
  const out: SurveyFilters = {}
  if (filters.gender && filters.gender !== 'all') out.gender = filters.gender
  if (filters.ageRanges.length > 0) out.ageRanges = filters.ageRanges
  if (filters.painValues.length > 0) out.painValues = filters.painValues
  return out
}

const GENDER_LABEL: Record<string, string> = {
  all: 'Todos',
  men: 'Hombres',
  women: 'Mujeres',
  nonBinary: 'No binario',
}

/** Texto breve para banners (solo lectura). */
export function describeSegmentFiltersInline(f: SegmentSurveyFilters): string {
  const parts: string[] = []
  if (f.gender !== 'all') parts.push(GENDER_LABEL[f.gender] ?? f.gender)
  if (f.ageRanges.length) parts.push(`Edad: ${f.ageRanges.join(', ')}`)
  if (f.painValues.length) parts.push(`Dolor: ${f.painValues.join(', ')}`)
  return parts.length ? parts.join(' · ') : 'Sin filtros (todas las respuestas)'
}
