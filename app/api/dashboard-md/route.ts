import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { CLIENT, CLIENT_SHORT_DESC } from '@/lib/client-config'
import { fetchCeoInterviewPlaintext } from '@/lib/fetch-ceo-interview-plaintext'
import { fetchSavedHmwFromSheets } from '@/lib/fetch-saved-hmw'
import { fetchSavedPovFromSheets, povPairToPlainTextForHmw } from '@/lib/fetch-saved-pov'
import { fetchSavedUserPersonas, personasPairToPlainText } from '@/lib/fetch-saved-user-personas'
import { fetchSavedInsights, insightsToPlainText } from '@/lib/fetch-saved-insights'
import { empathyMapToPlainText, fetchSavedEmpathyMap } from '@/lib/fetch-saved-empathy-map'
import { fetchSavedUserJourneyFromSheets, journeySegmentToPlainText } from '@/lib/fetch-saved-user-journey'
import { fetchSitemapPromptBlockFromSheets } from '@/lib/fetch-saved-sitemap-prompt'
import { fetchMVPBundleFromSheets } from '@/lib/fetch-mvp-bundle-sheets'
import { mvpBundleToCombinedPersist, mvpPersistToPlainTextForIa } from '@/lib/mvp-types'
import { MOSCOW_CATEGORIAS, MOSCOW_LABELS, type MoSCoWNota, normalizeMoSCoWStoredJson } from '@/lib/moscow-types'

export const dynamic = 'force-dynamic'

function getAuthReadonly() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

function safeJsonPretty(v: unknown, maxLen = 24000): string {
  try {
    const s = JSON.stringify(v, null, 2)
    if (s.length <= maxLen) return s
    return `${s.slice(0, maxLen)}\n…(truncado)…`
  } catch {
    return '(no se pudo serializar JSON)'
  }
}

function formatMoscow(bundleJson: unknown): string {
  const bundle = normalizeMoSCoWStoredJson(bundleJson)
  const combined = bundle.generic
  const lines: string[] = []
  lines.push('### MoSCoW (Todos los canales)')
  for (const cat of MOSCOW_CATEGORIAS) {
    const label = MOSCOW_LABELS[cat]?.titulo ?? cat
    const notas = combined.notas[cat] ?? []
    lines.push(`\n#### ${label}`)
    if (notas.length === 0) {
      lines.push('(vacío)')
      continue
    }
    lines.push(
      notas
        .map((n: MoSCoWNota, i: number) => {
          const orig = n.origenMVP?.trim() ? ` · origen: ${n.origenMVP.trim()}` : ''
          return `${i + 1}. ${n.texto}${orig}`
        })
        .join('\n')
    )
  }
  return lines.join('\n')
}

async function readSheetRow(range: string): Promise<string[] | null> {
  const sheets = google.sheets({ version: 'v4', auth: getAuthReadonly() })
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: CEO_SHEET_ID, range })
  const row = res.data.values?.[0]
  return row ? (row as string[]) : null
}

export async function GET() {
  const now = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })

  const [
    ceoInterview,
    hmw,
    pov,
    personas,
    insightsClientes,
    insightsPotenciales,
    empathyClientes,
    empathyPotenciales,
    journey,
    sitemapPromptBlock,
    mvpBundle,
    moscowRow,
    userFlowRow,
    designRow,
  ] = await Promise.all([
    fetchCeoInterviewPlaintext().catch(() => ''),
    fetchSavedHmwFromSheets().catch(() => ({ ok: false as const, code: 'empty' as const })),
    fetchSavedPovFromSheets().catch(() => ({ ok: false as const, code: 'empty' as const })),
    fetchSavedUserPersonas().catch(() => ({ ok: false as const, code: 'empty' as const })),
    fetchSavedInsights('clientes').catch(() => ({ ok: false as const, code: 'empty' as const })),
    fetchSavedInsights('potenciales').catch(() => ({ ok: false as const, code: 'empty' as const })),
    fetchSavedEmpathyMap('clientes').catch(() => ({ ok: false as const, code: 'empty' as const })),
    fetchSavedEmpathyMap('potenciales').catch(() => ({ ok: false as const, code: 'empty' as const })),
    fetchSavedUserJourneyFromSheets().catch(() => ({ ok: false as const, code: 'empty' as const })),
    fetchSitemapPromptBlockFromSheets().catch(() => ''),
    fetchMVPBundleFromSheets().catch(() => null),
    readSheetRow('moscow!A2:B2').catch(() => null),
    readSheetRow('user-flow!A2:C2').catch(() => null),
    readSheetRow('principios!A2:D2').catch(() => null),
  ])

  const md: string[] = []

  md.push(`# Entregable de investigación — ${CLIENT.name}`)
  md.push('')
  md.push(`Generado: ${now}`)
  md.push('')
  md.push('## Cómo usar este documento')
  md.push(
    [
      '- Pégalo en otra IA y pídele: **proponer arquitectura de información, contenido y diseño de la web**.',
      '- Mantén trazabilidad: no inventar features que contradigan CEO/HMW/MVP.',
      '- Si falta algún bloque, la IA debe **preguntar** o proponer hipótesis explícitas.',
    ].join('\n')
  )

  md.push('\n---\n')

  md.push('## 1) Fuente de verdad (CEO)')
  md.push(ceoInterview?.trim() ? ceoInterview.trim() : '(No hay entrevista/encuesta CEO disponible.)')

  md.push('\n---\n')
  md.push('## 2) POV')
  if (pov.ok) md.push(povPairToPlainTextForHmw(pov.data))
  else md.push('(No hay POV guardado.)')

  md.push('\n---\n')
  md.push('## 3) User Persona')
  if (personas.ok) md.push(personasPairToPlainText(personas.data))
  else md.push('(No hay User Persona guardado.)')

  md.push('\n---\n')
  md.push('## 4) HOW MIGHT WE (HMW)')
  if (hmw.ok) md.push(safeJsonPretty(hmw.data))
  else md.push('(No hay HMW guardado.)')

  md.push('\n---\n')
  md.push('## 5) Insights de encuesta')
  md.push('### Clientes')
  if (insightsClientes.ok) md.push(insightsToPlainText(insightsClientes.data))
  else md.push('(Sin insights guardados para clientes.)')
  md.push('\n### Potenciales')
  if (insightsPotenciales.ok) md.push(insightsToPlainText(insightsPotenciales.data))
  else md.push('(Sin insights guardados para potenciales.)')

  md.push('\n---\n')
  md.push('## 6) Mapa de empatía')
  md.push('### Clientes')
  if (empathyClientes.ok) md.push(empathyMapToPlainText(empathyClientes.data))
  else md.push('(Sin mapa de empatía guardado para clientes.)')
  md.push('\n### Potenciales')
  if (empathyPotenciales.ok) md.push(empathyMapToPlainText(empathyPotenciales.data))
  else md.push('(Sin mapa de empatía guardado para potenciales.)')

  md.push('\n---\n')
  md.push('## 7) User Journey Map')
  if (journey.ok) {
    const ca = journeySegmentToPlainText(journey.pair.clienteActual.journey, 'Cliente actual')
    const cp = journeySegmentToPlainText(journey.pair.clientePotencial.journey, 'Cliente potencial')
    md.push(ca)
    md.push('')
    md.push(cp)
  } else {
    md.push('(Sin User Journey guardado.)')
  }

  md.push('\n---\n')
  md.push('## 8) MoSCoW')
  if (moscowRow?.[1]?.trim()) {
    let parsed: unknown
    try {
      parsed = JSON.parse(moscowRow[1] as string)
      md.push(formatMoscow(parsed))
    } catch {
      md.push('(MoSCoW guardado pero JSON inválido.)')
    }
  } else {
    md.push('(Sin MoSCoW guardado.)')
  }

  md.push('\n---\n')
  md.push('## 9) MVP (matriz de valor)')
  if (mvpBundle) {
    const combined = mvpBundleToCombinedPersist(mvpBundle)
    md.push(mvpPersistToPlainTextForIa(combined))
  } else {
    md.push('(Sin MVP guardado.)')
  }

  md.push('\n---\n')
  md.push('## 10) Mapa del sitio')
  md.push(sitemapPromptBlock?.trim() ? sitemapPromptBlock.trim() : '(Sin mapa del sitio guardado.)')

  md.push('\n---\n')
  md.push('## 11) User Flow (diagrama)')
  if (userFlowRow?.[1]?.trim()) {
    try {
      md.push(safeJsonPretty(JSON.parse(userFlowRow[1] as string)))
    } catch {
      md.push('(User Flow guardado pero JSON inválido.)')
    }
  } else {
    md.push('(Sin User Flow guardado.)')
  }

  md.push('\n---\n')
  md.push('## 12) Principios de diseño')
  if (designRow?.[2]?.trim()) {
    md.push(`Guardado el: ${designRow[0] ?? ''}`)
    md.push('')
    md.push('### Respuestas del formulario (texto)')
    md.push(designRow[1] ? String(designRow[1]) : '(vacío)')
    md.push('')
    md.push('### Principios (JSON)')
    try {
      md.push(safeJsonPretty(JSON.parse(designRow[2] as string)))
    } catch {
      md.push('(Principios guardados pero JSON inválido.)')
    }
  } else {
    md.push('(Sin principios de diseño guardados.)')
  }

  md.push('\n---\n')
  md.push('## 13) Brief para IA de diseño (web)')
  md.push(
    [
      `**Cliente:** ${CLIENT_SHORT_DESC}`,
      `**Concepto de marca:** ${CLIENT.brandConcept}`,
      `**Servicio:** ${CLIENT.serviceDescription}`,
      '',
      '### Objetivo',
      `Diseña la **nueva web** de ${CLIENT.name}: arquitectura de información, contenidos clave, componentes/patrones UI y tono visual coherente con la investigación anterior.`,
      '',
      '### Jerarquía de fuentes (no inventar por encima)',
      '1. **Encuesta CEO** (sección 1) — modelo de negocio, límites, promesas reales.',
      '2. **HMW + MVP + MoSCoW** — qué entra en el producto mínimo y con qué prioridad.',
      '3. **User Journey + User Flow + Mapa del sitio** — recorrido, páginas y flujos.',
      '4. **POV, Personas, Insights, Empatía** — tono, dolores y motivaciones.',
      '5. **Principios de diseño** (sección 12) — identidad y comunicación.',
      '',
      '### Restricciones de realismo',
      `- El servicio principal es **${CLIENT.serviceModel}** en ${CLIENT.location}; la web **acompaña** el negocio, no lo sustituye salvo que la CEO lo indique.`,
      '- No propongas funcionalidades que contradigan CEO, HMW o MVP.',
      '- Si falta información en algún bloque, **pregunta** o marca la hipótesis explícitamente.',
      '',
      '### Entregables esperados de la IA de diseño',
      '- Sitemap / IA validado (páginas, jerarquía, CTAs).',
      '- Wireframes o descripción pantalla a pantalla de las rutas prioritarias (MVP).',
      '- Guía de tono y contenido (microcopy, mensajes clave por segmento: cliente actual vs potencial).',
      '- Recomendación de componentes UI reutilizables y criterios de accesibilidad básicos.',
      '- Lista de contenidos a redactar (con prioridad Must/Should del MoSCoW).',
    ].join('\n')
  )

  const body = md.join('\n\n').replace(/\n{3,}/g, '\n\n')
  return new NextResponse(body, {
    status: 200,
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

