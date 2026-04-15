/** Filtros de encuesta tal como se guardan en Sheets (sin importar componentes cliente). */
export type SurveyAiFiltersPayload = {
  gender: string
  ageRanges: string[]
  painValues: string[]
}

export function stableFiltersKey(f: SurveyAiFiltersPayload): string {
  return JSON.stringify({
    gender: f.gender ?? 'all',
    ageRanges: [...(f.ageRanges ?? [])].sort(),
    painValues: [...(f.painValues ?? [])].sort(),
  })
}

export function toSurveyAiFiltersPayload(f: {
  gender: string
  ageRanges: string[]
  painValues?: string[]
}): SurveyAiFiltersPayload {
  return {
    gender: f.gender,
    ageRanges: f.ageRanges ?? [],
    painValues: f.painValues ?? [],
  }
}
