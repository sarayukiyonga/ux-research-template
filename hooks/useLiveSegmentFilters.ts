'use client'

import { useState, useEffect } from 'react'
import {
  type SurveySegmentKey,
  type SegmentSurveyFilters,
  readSegmentSurveyFilters,
  DEFAULT_SEGMENT_FILTERS,
  SEGMENT_FILTERS_CHANGED_EVENT,
} from '@/lib/segment-survey-filters'

/**
 * Filtros guardados en localStorage para un segmento, actualizados al cambiar
 * en la encuesta o al volver el foco a la ventana.
 */
export function useLiveSegmentFilters(segment: SurveySegmentKey): SegmentSurveyFilters {
  const [f, setF] = useState<SegmentSurveyFilters>(DEFAULT_SEGMENT_FILTERS)

  useEffect(() => {
    const sync = () => setF(readSegmentSurveyFilters(segment))
    sync()
    window.addEventListener(SEGMENT_FILTERS_CHANGED_EVENT, sync)
    window.addEventListener('focus', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SEGMENT_FILTERS_CHANGED_EVENT, sync)
      window.removeEventListener('focus', sync)
      window.removeEventListener('storage', sync)
    }
  }, [segment])

  return f
}
