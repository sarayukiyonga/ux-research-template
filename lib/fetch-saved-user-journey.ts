import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import type { JourneyForPersona } from '@/lib/user-journey-bundle'
import {
  getJourneyPairForUserFlow,
  parsePersistedJourneyCell,
  parseUserJourneySavedFilters,
  resolveCanalForSegment,
  toJourneyV3,
  USER_JOURNEY_PERSIST_V3,
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
      /** Filtros guardados (JSON string), si existen. */
      journeyFiltersRaw: string | null
    }
  | {
      ok: false
      code: 'no_sheet' | 'empty' | 'invalid_json' | 'invalid_shape' | 'no_journey_for_channel'
      detalle?: string
    }

type RowData = string[]

/** Reconstructs a UserJourneyV3Persist from multi-row Sheets data. */
function buildV3FromMultiRows(
  metaRow: RowData,
  journeyRows: RowData[]
): { v3: UserJourneyV3Persist; filtersRaw: string | null; savedAt: string } | null {
  let meta: Record<string, unknown>
  try {
    meta = JSON.parse(metaRow[4] ?? '') as Record<string, unknown>
  } catch {
    return null
  }

  const caInfo = meta.clienteActual as Record<string, unknown> | undefined
  const cpInfo = meta.clientePotencial as Record<string, unknown> | undefined
  if (!caInfo || !cpInfo) return null

  const v3: UserJourneyV3Persist = {
    version: USER_JOURNEY_PERSIST_V3,
    clienteActual: {
      catalogo: (caInfo.catalogo as UserJourneyV3Persist['clienteActual']['catalogo']) ?? [],
      canalActivoId: (caInfo.canalActivoId as string) ?? 'web',
      mapas: {},
    },
    clientePotencial: {
      catalogo: (cpInfo.catalogo as UserJourneyV3Persist['clientePotencial']['catalogo']) ?? [],
      canalActivoId: (cpInfo.canalActivoId as string) ?? 'web',
      mapas: {},
    },
  }

  for (const row of journeyRows) {
    if (row[0] !== 'journey') continue
    const seg = row[2] as 'clienteActual' | 'clientePotencial'
    const canalId = row[3]
    if ((seg === 'clienteActual' || seg === 'clientePotencial') && canalId && row[4]) {
      try {
        v3[seg].mapas[canalId] = JSON.parse(row[4]) as JourneyForPersona
      } catch { /* skip malformed */ }
    }
  }

  const filtersRaw =
    meta.filters != null && JSON.stringify(meta.filters).trim() !== '{}'
      ? JSON.stringify(meta.filters)
      : meta.filters != null
        ? JSON.stringify(meta.filters)
        : null
  return { v3, filtersRaw, savedAt: metaRow[1] ?? '' }
}

export async function fetchSavedUserJourneyFromSheets(): Promise<FetchSavedUserJourneyResult> {
  const sheets = google.sheets({ version: 'v4', auth: getAuthReadonly() })

  const sheetsMeta = await sheets.spreadsheets.get({ spreadsheetId: CEO_SHEET_ID })
  const exists = sheetsMeta.data.sheets?.some((s) => s.properties?.title === SHEET_NAME)
  if (!exists) return { ok: false, code: 'no_sheet' }

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CEO_SHEET_ID,
    range: `${SHEET_NAME}!A2:E`,
  })

  const rows = (res.data.values ?? []) as RowData[]
  if (!rows.length) return { ok: false, code: 'empty' }

  let parsed: unknown
  let filtersRaw: string | null | undefined
  let savedAt = ''

  if (rows[0][0] === 'meta') {
    // New multi-row format
    const metaRow = rows[0]
    const journeyRows = rows.slice(1)
    const result = buildV3FromMultiRows(metaRow, journeyRows)
    if (!result) return { ok: false, code: 'invalid_json' }
    parsed = result.v3
    filtersRaw = result.filtersRaw
    savedAt = result.savedAt
  } else {
    // Old single-blob format: A=savedAt, B=v3JSON, C=filtersJSON
    const row = rows[0]
    if (!row?.[1]?.trim()) return { ok: false, code: 'empty' }
    try {
      parsed = JSON.parse(row[1] as string)
    } catch {
      return { ok: false, code: 'invalid_json' }
    }
    filtersRaw = row[2] as string | undefined
    savedAt = (row[0] as string) ?? ''
  }

  const cell = parsePersistedJourneyCell(parsed)
  if (!cell) return { ok: false, code: 'invalid_shape' }

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

  const journeyFiltersRaw =
    filtersRaw != null && String(filtersRaw).trim() ? String(filtersRaw) : null
  return { ok: true, v3, pair, savedAt, journeyFiltersRaw }
}

/** Texto del journey para prompts de MoSCoW (etapas, dolores, rol; sin redacción de User Flow). */
export function journeySegmentToMoSCoWBlock(
  j: JourneyForPersona,
  titulo: string,
  canalEtiqueta: string
): string {
  const etapas = [...j.etapas]
    .sort((a, b) => a.orden - b.orden)
    .map(
      (e) =>
        `  - **Orden ${e.orden} · ${e.titulo}** — ${e.descripcion}\n    Dolores: ${e.puntosDeDolor.join('; ')}${e.canalesDeMarketing ? `\n    Canales: ${e.canalesDeMarketing}` : ''}\n    Rol MOA frente al POV (${canalEtiqueta}): ${e.rolWebFrenteAlPov}`
    )
    .join('\n')
  return `### ${titulo} — ${j.etiquetaPersona} · Canal: **${canalEtiqueta}**
Síntesis: ${j.sintesis}
Etapa clave para el POV (orden): ${j.etapaOrdenPovResuelto}

Etapas del User Journey Map:
${etapas}`
}

export function journeySegmentToPlainText(j: JourneyForPersona, titulo: string): string {
  const etapas = j.etapas
    .map((e) => {
      const canales = e.canalesDeMarketing ? ` | Canales: ${e.canalesDeMarketing}` : ''
      return `${e.orden}. ${e.titulo}: ${e.descripcion}${canales} | Web↔POV: ${e.rolWebFrenteAlPov}`
    })
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
        `  - **Orden ${e.orden} · ${e.titulo}** — ${e.descripcion}\n    Dolores: ${e.puntosDeDolor.join('; ')}${e.canalesDeMarketing ? `\n    Canales de marketing: ${e.canalesDeMarketing}` : ''}\n    Rol de MOA (${canalEtiqueta}) frente al POV: ${e.rolWebFrenteAlPov}`
    )
    .join('\n')
  return `### ${titulo} — ${j.etiquetaPersona}
Síntesis del journey: ${j.sintesis}
**Etapa en que MOA (${canalEtiqueta}) aporta más al POV (orden): ${j.etapaOrdenPovResuelto}**

Etapas del User Journey Map en **${canalEtiqueta}** (el User Flow debe basarse en este orden y contenido; cada rectángulo del diagrama debe corresponder de forma explícita a una o varias etapas contiguas; las flechas son las acciones o transiciones coherentes con el relato en este canal):
${etapas}`
}
