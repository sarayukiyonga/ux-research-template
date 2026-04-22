import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { fetchCeoInterviewPlaintext } from '@/lib/fetch-ceo-interview-plaintext'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'
import { SHEET_ID, SHEET_RANGE, DEMOGRAPHIC_COLUMNS, QUESTIONS } from '@/lib/questions'
import { CLIENT } from '@/lib/client-config'
import {
  POTENTIAL_SHEET_ID,
  POTENTIAL_SHEET_RANGE,
  POTENTIAL_DEMOGRAPHIC_COLUMNS,
  POTENTIAL_QUESTIONS,
} from '@/lib/potential-questions'
import type { SurveyFilters } from '@/lib/sheets'
import { fetchSavedInsights, insightsToPlainText } from '@/lib/fetch-saved-insights'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

const PersonaSchema = z.object({
  nombre: z.string().describe('Nombre ficticio representativo del segmento'),
  genero: z
    .enum(['mujer', 'hombre', 'no_binario'])
    .describe('Debe coincidir con el género modal indicado en DATOS ENCUESTA FILTRADOS (mujer/hombre/no_binario).'),
  edad: z
    .number()
    .describe(
      'Edad en años: entero dentro de la franja de edad más frecuente en DATOS ENCUESTA FILTRADOS (usa el valor sugerido o uno muy cercano en esa franja).'
    ),
  educacion: z.string().describe('Nivel de estudios plausible; si no hay dato en encuesta, infiere con moderación alineado al resto.'),
  ubicacion: z.string().describe(`Zona o contexto de vida (p. ej. ${CLIENT.location} / ${CLIENT.locationRegion}) alineado con ${CLIENT.name}`),
  ocupacion: z.string().describe('Ocupación principal: prioriza lo que aparece en DATOS ENCUESTA (ocupaciones citadas); complementa con insights si hace falta.'),
  tags: z
    .array(z.string().max(20))
    .min(4)
    .max(6)
    .describe('4-6 rasgos muy breves alineados sobre todo con los insights'),
  frase: z
    .string()
    .max(130)
    .describe('Frase en primera persona que sintetice la esencia según insights + encuesta'),
  motivaciones: z
    .array(z.string().max(90))
    .min(4)
    .max(5)
    .describe('4-5 motivaciones: principalmente de los insights'),
  necesidades: z
    .array(z.string().max(90))
    .min(4)
    .max(5)
    .describe('4-5 necesidades: principalmente de los insights'),
  puntosDeDolor: z
    .array(z.string().max(90))
    .min(4)
    .max(5)
    .describe('4-5 puntos de dolor: insights; en potenciales puedes apoyarte en dolor crónico / barreras de la encuesta si aplica'),
  personalidad: z.object({
    introvertidoExtrovertido: z.number().min(1).max(5),
    pensamientoSentimiento: z.number().min(1).max(5),
    organizadoEspontaneo: z.number().min(1).max(5),
    seguroInseguro: z.number().min(1).max(5),
    intuitivoObservador: z.number().min(1).max(5),
  }),
  habilidadesTecnicas: z.object({
    internet: z.number().min(1).max(5),
    redesSociales: z.number().min(1).max(5),
    comprasOnline: z.number().min(1).max(5),
  }),
  canalesBusquedaSolucion: z
    .array(z.string().max(80))
    .min(2)
    .max(10)
    .describe(
      'Medios o canales por los que esta persona **busca información o soluciones** a sus necesidades (p. ej. Google/web, Instagram, recomendación del médico, boca a boca en el barrio, WhatsApp, email). Infiero de **encuesta filtrada** (barreras, confianza, cómo descubren servicios) y de **insights**; nombres breves y realistas para el segmento.'
    ),
})

const schema = z.object({
  clienteActual: PersonaSchema.describe('Cliente actual: insights clientes + datos encuesta clientes filtrada'),
  clientePotencial: PersonaSchema.describe('Cliente potencial: insights potenciales + datos encuesta potencial filtrada'),
})

function clientGender(row: string[]): string | null {
  if ((row[DEMOGRAPHIC_COLUMNS.men] ?? '').trim()) return 'men'
  if ((row[DEMOGRAPHIC_COLUMNS.women] ?? '').trim()) return 'women'
  if ((row[DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()) return 'nonBinary'
  return null
}
function clientAge(row: string[]): string {
  return (
    (row[DEMOGRAPHIC_COLUMNS.men] ?? '').trim() ||
    (row[DEMOGRAPHIC_COLUMNS.women] ?? '').trim() ||
    (row[DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()
  )
}
function potentialGender(row: string[]): string | null {
  if ((row[POTENTIAL_DEMOGRAPHIC_COLUMNS.men] ?? '').trim()) return 'men'
  if ((row[POTENTIAL_DEMOGRAPHIC_COLUMNS.women] ?? '').trim()) return 'women'
  if ((row[POTENTIAL_DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()) return 'nonBinary'
  return null
}
function potentialAge(row: string[]): string {
  return (
    (row[POTENTIAL_DEMOGRAPHIC_COLUMNS.men] ?? '').trim() ||
    (row[POTENTIAL_DEMOGRAPHIC_COLUMNS.women] ?? '').trim() ||
    (row[POTENTIAL_DEMOGRAPHIC_COLUMNS.nonBinary] ?? '').trim()
  )
}

const PAIN_COL = POTENTIAL_QUESTIONS.find((q) => q.id === 1)!.columnIndex

function countMap(arr: (string | null)[]): Record<string, number> {
  const m: Record<string, number> = {}
  for (const a of arr) {
    const k = (a ?? '').trim()
    if (!k) continue
    m[k] = (m[k] ?? 0) + 1
  }
  return m
}

function topCounts(m: Record<string, number>, n: number): [string, number][] {
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
}

function ageModalMidpoint(modalLabel: string): number | null {
  const t = modalLabel.trim()
  const range = t.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (range) {
    const lo = parseInt(range[1], 10)
    const hi = parseInt(range[2], 10)
    if (!Number.isNaN(lo) && !Number.isNaN(hi)) return Math.round((lo + hi) / 2)
  }
  const one = t.match(/^(\d{1,3})\b/)
  if (one) {
    const v = parseInt(one[1], 10)
    if (!Number.isNaN(v)) return v
  }
  return null
}

function genderModalToPersona(g: 'men' | 'women' | 'nonBinary' | null): 'mujer' | 'hombre' | 'no_binario' {
  if (g === 'men') return 'hombre'
  if (g === 'women') return 'mujer'
  return 'no_binario'
}

/** Texto compacto: demografía filtrada + muestras de encuesta que no suelen estar en insights. */
async function buildClientSurveyContext(filters: SurveyFilters): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: SHEET_RANGE })
  let rows = (res.data.values ?? []).slice(1).filter((r) => r.some(Boolean))

  if (filters.gender && filters.gender !== 'all') {
    rows = rows.filter((row) => clientGender(row) === filters.gender)
  }
  if (filters.ageRanges?.length) {
    rows = rows.filter((row) => filters.ageRanges!.includes(clientAge(row)))
  }

  const genders = rows.map(clientGender).filter(Boolean) as ('men' | 'women' | 'nonBinary')[]
  const genderCount = { men: 0, women: 0, nonBinary: 0 }
  genders.forEach((g) => { genderCount[g] += 1 })
  const ages = rows.map(clientAge).filter((a) => a.trim())
  const ageCount = countMap(ages)
  const ageTop = topCounts(ageCount, 8)
  const modalAgeLabel = ageTop[0]?.[0] ?? ''
  const ageHint = ageModalMidpoint(modalAgeLabel)

  let modalGenderKey: 'men' | 'women' | 'nonBinary' | null = null
  const pairs: [keyof typeof genderCount, 'men' | 'women' | 'nonBinary'][] = [
    ['women', 'women'],
    ['men', 'men'],
    ['nonBinary', 'nonBinary'],
  ]
  let best = -1
  for (const [k, key] of pairs) {
    const c = genderCount[k]
    if (c > best) {
      best = c
      modalGenderKey = key
    }
  }
  if (best === 0) modalGenderKey = null

  const occQ = QUESTIONS.find((q) => q.id === 2)
  const occCounts: Record<string, number> = {}
  if (occQ) {
    rows.forEach((r) => {
      const t = (r[occQ.columnIndex] ?? '').trim()
      if (t.length < 2) return
      const k = t.slice(0, 80)
      occCounts[k] = (occCounts[k] ?? 0) + 1
    })
  }
  const occTop = topCounts(occCounts, 8)

  const sampleOpen = (colIndex: number, title: string, max = 5) => {
    const seen = new Set<string>()
    const lines: string[] = []
    for (const r of rows) {
      const t = (r[colIndex] ?? '').trim()
      if (t.length < 8 || seen.has(t)) continue
      seen.add(t)
      lines.push(`  - ${t.slice(0, 120)}${t.length > 120 ? '…' : ''}`)
      if (lines.length >= max) break
    }
    return lines.length ? `${title}:\n${lines.join('\n')}` : ''
  }

  const extra = [
    sampleOpen(5, 'Muestras · salud/médicos antes (Q3)'),
    sampleOpen(7, 'Muestras · barreras gimnasio convencional (Q5)'),
  ]
    .filter(Boolean)
    .join('\n\n')

  const lines = [
    `Respuestas en este corte: ${rows.length}`,
    `Distribución género (filtrado): hombres=${genderCount.men}, mujeres=${genderCount.women}, no binario=${genderCount.nonBinary}`,
    modalGenderKey
      ? `GÉNERO_MODA (para campo genero del persona): ${genderModalToPersona(modalGenderKey)}`
      : 'GÉNERO_MODA: indeterminado (pocos datos); elige el más coherente con el resto.',
    `Distribución franjas de edad (filtrado):\n${ageTop.map(([k, v]) => `  - ${k}: ${v}`).join('\n')}`,
    modalAgeLabel
      ? `EDAD_FRANJA_MODA: "${modalAgeLabel}"${ageHint != null ? ` → sugerencia entera edad: ${ageHint}` : ''}`
      : '',
    occTop.length ? `Ocupaciones / a qué se dedican (más citadas):\n${occTop.map(([k, v]) => `  - (${v}) ${k}`).join('\n')}` : '',
    extra,
  ].filter(Boolean)

  return lines.join('\n\n')
}

async function buildPotentialSurveyContext(filters: SurveyFilters): Promise<string> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: POTENTIAL_SHEET_ID, range: POTENTIAL_SHEET_RANGE })
  let rows = (res.data.values ?? []).slice(1).filter((r) => r.some(Boolean))

  if (filters.gender && filters.gender !== 'all') {
    rows = rows.filter((row) => potentialGender(row) === filters.gender)
  }
  if (filters.ageRanges?.length) {
    rows = rows.filter((row) => filters.ageRanges!.includes(potentialAge(row)))
  }
  if (filters.painValues?.length) {
    rows = rows.filter((row) => filters.painValues!.includes((row[PAIN_COL] ?? '').trim()))
  }

  const genders = rows.map(potentialGender).filter(Boolean) as ('men' | 'women' | 'nonBinary')[]
  const genderCount = { men: 0, women: 0, nonBinary: 0 }
  genders.forEach((g) => { genderCount[g] += 1 })
  const ages = rows.map(potentialAge).filter((a) => a.trim())
  const ageCount = countMap(ages)
  const ageTop = topCounts(ageCount, 8)
  const modalAgeLabel = ageTop[0]?.[0] ?? ''
  const ageHint = ageModalMidpoint(modalAgeLabel)

  let modalGenderKey: 'men' | 'women' | 'nonBinary' | null = null
  const pairs: [keyof typeof genderCount, 'men' | 'women' | 'nonBinary'][] = [
    ['women', 'women'],
    ['men', 'men'],
    ['nonBinary', 'nonBinary'],
  ]
  let best = -1
  for (const [k, key] of pairs) {
    const c = genderCount[k]
    if (c > best) {
      best = c
      modalGenderKey = key
    }
  }
  if (best === 0) modalGenderKey = null

  const painCounts = countMap(rows.map((r) => (r[PAIN_COL] ?? '').trim() || null))
  const painTop = topCounts(painCounts, 6)

  const closedSummaries: string[] = []
  for (const q of POTENTIAL_QUESTIONS.filter((x) => x.type === 'closed')) {
    const c = countMap(rows.map((r) => (r[q.columnIndex] ?? '').trim() || null))
    const t = topCounts(c, 5)
    if (t.length && t.some(([k]) => k)) {
      closedSummaries.push(
        `${q.shortTitle}: ${t.map(([k, v]) => `${k || '(vacío)'} (${v})`).join('; ')}`
      )
    }
  }

  const sampleOpen = (id: number, max = 4) => {
    const q = POTENTIAL_QUESTIONS.find((x) => x.id === id && x.type === 'open')
    if (!q) return ''
    const seen = new Set<string>()
    const lines: string[] = []
    for (const r of rows) {
      const t = (r[q.columnIndex] ?? '').trim()
      if (t.length < 8 || seen.has(t)) continue
      seen.add(t)
      lines.push(`  - ${t.slice(0, 110)}${t.length > 110 ? '…' : ''}`)
      if (lines.length >= max) break
    }
    return lines.length ? `${q.shortTitle}:\n${lines.join('\n')}` : ''
  }

  const extra = [sampleOpen(8), sampleOpen(11), sampleOpen(13)].filter(Boolean).join('\n\n')

  const lines = [
    `Respuestas en este corte: ${rows.length}`,
    `Distribución género (filtrado): hombres=${genderCount.men}, mujeres=${genderCount.women}, no binario=${genderCount.nonBinary}`,
    modalGenderKey
      ? `GÉNERO_MODA (para campo genero del persona): ${genderModalToPersona(modalGenderKey)}`
      : 'GÉNERO_MODA: indeterminado; elige lo más coherente con datos e insights.',
    `Distribución franjas de edad (filtrado):\n${ageTop.map(([k, v]) => `  - ${k}: ${v}`).join('\n')}`,
    modalAgeLabel
      ? `EDAD_FRANJA_MODA: "${modalAgeLabel}"${ageHint != null ? ` → sugerencia entera edad: ${ageHint}` : ''}`
      : '',
    painTop.length ? `Dolor / patología (Q1, más frecuente):\n${painTop.map(([k, v]) => `  - ${k}: ${v}`).join('\n')}` : '',
    closedSummaries.length ? `Respuestas cerradas (recuentos):\n${closedSummaries.map((s) => `  - ${s}`).join('\n')}` : '',
    extra,
  ].filter(Boolean)

  return lines.join('\n\n')
}

const ERR: Record<string, string> = {
  no_sheet: 'No hay hoja de insights guardados para este segmento.',
  empty: 'Los insights guardados están vacíos. Genera y guarda insights en la página Insights.',
  invalid_json: 'No se pudieron leer los insights guardados.',
  invalid_shape: 'Los insights guardados tienen un formato inválido. Vuelve a generarlos en Insights.',
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const filtersClientes: SurveyFilters = body.filtersClientes ?? body.filters ?? {}
  const filtersPotenciales: SurveyFilters = body.filtersPotenciales ?? body.filters ?? {}

  const [interview, insClientes, insPotenciales, ctxClientes, ctxPotenciales] = await Promise.all([
    fetchCeoInterviewPlaintext(),
    fetchSavedInsights('clientes'),
    fetchSavedInsights('potenciales'),
    buildClientSurveyContext(filtersClientes),
    buildPotentialSurveyContext(filtersPotenciales),
  ])

  if (!insClientes.ok) {
    return NextResponse.json(
      { error: `${ERR[insClientes.code]} (clientes actuales). Ve a Insights → Clientes actuales.` },
      { status: 400 }
    )
  }
  if (!insPotenciales.ok) {
    return NextResponse.json(
      { error: `${ERR[insPotenciales.code]} (clientes potenciales). Ve a Insights → Clientes potenciales.` },
      { status: 400 }
    )
  }

  const textoClientes = insightsToPlainText(insClientes.data)
  const textoPotenciales = insightsToPlainText(insPotenciales.data)

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `Eres un UX researcher experto en user personas para MOA (salud y fitness, Martorell).

Fuentes por persona:
1) INSIGHTS guardados del segmento → motivaciones, necesidades, dolor, tono, tags, frase.
2) DATOS ENCUESTA FILTRADOS del mismo segmento → **edad** y **genero** del schema deben ceñirse a la moda y franjas recuentes indicadas ahí (GÉNERO_MODA, EDAD_FRANJA_MODA / sugerencia entera). Ocupación/educación/ubicación: prioriza hechos de la encuesta cuando existan (p. ej. ocupaciones citadas); si no hay dato, infiere con moderación coherente con insights + entrevista.
3) Entrevista a Patricia → contexto de marca, **cómo se presta el servicio** (presencial vs online) y matices; **no la contradigas** con suposiciones de negocio digital.

"clienteActual" solo mezcla INSIGHTS clientes + ENCUESTA clientes + entrevista. No uses el bloque de potenciales.
"clientePotencial" solo mezcla INSIGHTS potenciales + ENCUESTA potenciales + entrevista.

Los dos perfiles deben distinguirse claramente. Español natural. Nombres locales plausibles.

Campo **canalesBusquedaSolucion** (obligatorio en cada persona): deduce **dónde y cómo** busca ayuda o información para cubrir sus necesidades, apoyándote sobre todo en **patrones de la encuesta** (p. ej. confianza en profesionales de la salud, uso de redes, búsqueda online, recomendaciones cercanas) y en insights. Entre 2 y 10 ítems, cada uno muy corto (máx. ~6 palabras).${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}`,
    prompt: `=== ENTREVISTA — PATRICIA / MOA ===\n${interview}

=== DATOS ENCUESTA FILTRADOS — CLIENTES ACTUALES (demografía y muestras; mismo corte que en /survey) ===
${ctxClientes}

=== INSIGHTS — CLIENTES ACTUALES (narrativa e insights para "clienteActual") ===
${textoClientes}

=== DATOS ENCUESTA FILTRADOS — CLIENTES POTENCIALES ===
${ctxPotenciales}

=== INSIGHTS — CLIENTES POTENCIALES (para "clientePotencial") ===
${textoPotenciales}`,
  })

  return NextResponse.json(object)
}
