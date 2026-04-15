import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import type { JourneyForPersona, UserJourneyBundle } from '@/lib/user-journey-bundle'
import { isUserJourneyBundle } from '@/lib/user-journey-bundle'

const SHEET_NAME = 'user-journey'

function getAuthReadonly() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export type { JourneyEtapa, JourneyForPersona, UserJourneyBundle } from '@/lib/user-journey-bundle'

export type FetchSavedUserJourneyResult =
  | { ok: true; data: UserJourneyBundle; savedAt: string }
  | { ok: false; code: 'no_sheet' | 'empty' | 'invalid_json' | 'invalid_shape' }

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

  if (!isUserJourneyBundle(parsed)) return { ok: false, code: 'invalid_shape' }

  return { ok: true, data: parsed, savedAt: (row[0] as string) ?? '' }
}

export function journeySegmentToPlainText(j: JourneyForPersona, titulo: string): string {
  const etapas = j.etapas
    .map((e) => `${e.orden}. ${e.titulo}: ${e.descripcion} | Web↔POV: ${e.rolWebFrenteAlPov}`)
    .join('\n')
  return `### ${titulo}\n${j.etiquetaPersona}\nSíntesis: ${j.sintesis}\nEtapas:\n${etapas}`
}

/** Texto para prompts de User Flow: exige alinear el diagrama con las etapas del journey. */
export function journeySegmentToFlowGrounding(j: JourneyForPersona, titulo: string): string {
  const etapas = [...j.etapas]
    .sort((a, b) => a.orden - b.orden)
    .map(
      (e) =>
        `  - **Orden ${e.orden} · ${e.titulo}** — ${e.descripcion}\n    Dolores: ${e.puntosDeDolor.join('; ')}\n    Web frente al POV: ${e.rolWebFrenteAlPov}`
    )
    .join('\n')
  return `### ${titulo} — ${j.etiquetaPersona}
Síntesis del journey: ${j.sintesis}
**Etapa en que la web resuelve el POV (orden): ${j.etapaOrdenPovResuelto}**

Etapas del User Journey Map (el User Flow debe basarse en este orden y contenido; cada rectángulo del diagrama debe corresponder de forma explícita a una o varias etapas contiguas; las flechas son los clics que encadenan pantallas alineadas con el relato):
${etapas}`
}
