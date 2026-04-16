import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import type { JourneyForPersona, UserJourneyBundle } from '@/lib/user-journey-bundle'
import {
  getJourneyPairForUserFlow,
  parsePersistedJourneyCell,
  parseUserJourneySavedFilters,
  resolveCanalForSegment,
  toJourneyV3,
  type FlowJourneyPair,
  type UserJourneyV3Persist,
} from '@/lib/user-journey-persist'

const SHEET_NAME = 'user-journey'

function getAuthReadonly() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export type { JourneyEtapa, JourneyForPersona, UserJourneyBundle } from '@/lib/user-journey-bundle'
export type { FlowJourneyPair, UserJourneyV3Persist } from '@/lib/user-journey-persist'

export type FetchSavedUserJourneyResult =
  | {
      ok: true
      savedAt: string
      v3: UserJourneyV3Persist
      pair: FlowJourneyPair
      /** Celda C2 de user-journey (JSON de filtros guardados), si existe. */
      journeyFiltersRaw: string | null
    }
  | {
      ok: false
      code: 'no_sheet' | 'empty' | 'invalid_json' | 'invalid_shape' | 'no_journey_for_channel'
      detalle?: string
    }

export async function fetchSavedUserJourneyFromSheets(): Promise<FetchSavedUserJourneyResult> {
  const sheets = google.sheets({ version: 'v4', auth: getAuthReadonly() })

  const meta = await sheets.spreadsheets.get({ spreadsheetId: CEO_SHEET_ID })
  const exists = meta.data.sheets?.some((s) => s.properties?.title === SHEET_NAME)
  if (!exists) return { ok: false, code: 'no_sheet' }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CEO_SHEET_ID,
    range: `${SHEET_NAME}!A2:C2`,
  })

  const row = res.data.values?.[0]
  if (!row?.[1]?.trim()) return { ok: false, code: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(row[1] as string)
  } catch {
    return { ok: false, code: 'invalid_json' }
  }

  const cell = parsePersistedJourneyCell(parsed)
  if (!cell) return { ok: false, code: 'invalid_shape' }

  const filtersRaw = row[2]
  const v3 = toJourneyV3(cell)
  const pair = getJourneyPairForUserFlow(cell, filtersRaw)
  if (!pair) {
    const f = parseUserJourneySavedFilters(filtersRaw)
    const ca = resolveCanalForSegment(f, v3, 'clienteActual')
    const cp = resolveCanalForSegment(f, v3, 'clientePotencial')
    const ja = Boolean(v3.clienteActual.mapas[ca])
    const jp = Boolean(v3.clientePotencial.mapas[cp])
    let detalle = ''
    if (!ja && !jp) detalle = `Falta mapa en cliente actual (canal «${ca}») y en cliente potencial (canal «${cp}»).`
    else if (!ja) detalle = `Falta mapa de cliente actual para el canal «${ca}».`
    else detalle = `Falta mapa de cliente potencial para el canal «${cp}».`
    return { ok: false, code: 'no_journey_for_channel', detalle }
  }

  const journeyFiltersRaw = row[2] != null && String(row[2]).trim() ? String(row[2]) : null
  return { ok: true, v3, pair, savedAt: (row[0] as string) ?? '', journeyFiltersRaw }
}

export function journeySegmentToPlainText(j: JourneyForPersona, titulo: string): string {
  const etapas = j.etapas
    .map((e) => `${e.orden}. ${e.titulo}: ${e.descripcion} | Web↔POV: ${e.rolWebFrenteAlPov}`)
    .join('\n')
  return `### ${titulo}\n${j.etiquetaPersona}\nSíntesis: ${j.sintesis}\nEtapas:\n${etapas}`
}

export function journeySegmentToFlowGrounding(
  j: JourneyForPersona,
  titulo: string,
  options?: { canalEtiqueta?: string }
): string {
  const canalEtiqueta = options?.canalEtiqueta ?? 'la web'
  const etapas = [...j.etapas]
    .sort((a, b) => a.orden - b.orden)
    .map(
      (e) =>
        `  - **Orden ${e.orden} · ${e.titulo}** — ${e.descripcion}\n    Dolores: ${e.puntosDeDolor.join('; ')}\n    Rol de MOA (${canalEtiqueta}) frente al POV: ${e.rolWebFrenteAlPov}`
    )
    .join('\n')
  return `### ${titulo} — ${j.etiquetaPersona}
Síntesis del journey: ${j.sintesis}
**Etapa en que MOA (${canalEtiqueta}) aporta más al POV (orden): ${j.etapaOrdenPovResuelto}**

Etapas del User Journey Map en **${canalEtiqueta}** (el User Flow debe basarse en este orden y contenido; cada rectángulo del diagrama debe corresponder de forma explícita a una o varias etapas contiguas; las flechas son las acciones o transiciones coherentes con el relato en este canal):
${etapas}`
}
