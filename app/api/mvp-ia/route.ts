import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { loadHmwIaContextOrFail, hmwIaContextToMarkdown } from '@/lib/hmw-ia-context'
import type { HMWQuestionsPayload, HMWItem } from '@/lib/hmw-payload'
import { newMVPNotaId } from '@/lib/mvp-types'

export const dynamic = 'force-dynamic'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function loadHMWMejor(): Promise<{ pregunta: string; respuesta: string; segmento: string }[]> {
  const sheets = google.sheets({ version: 'v4', auth: getAuth() })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: CEO_SHEET_ID,
    range: 'hmw!A2:C2',
  })
  const row = res.data.values?.[0]
  if (!row || !row[1]) return []

  const payload: HMWQuestionsPayload = JSON.parse(row[1])
  const result: { pregunta: string; respuesta: string; segmento: string }[] = []

  function extractMejor(items: HMWItem[], segmento: string) {
    for (const item of items) {
      if (!item.respuestasMarcas) continue
      item.respuestasMarcas.forEach((marca, i) => {
        if (marca === 'mejor' && item.respuestas[i]?.trim()) {
          result.push({
            pregunta: item.pregunta,
            respuesta: item.respuestas[i].trim(),
            segmento,
          })
        }
      })
    }
  }

  extractMejor(payload.clienteActual ?? [], 'cliente actual')
  extractMejor(payload.clientePotencial ?? [], 'cliente potencial')
  return result
}

async function loadCEOInsights(): Promise<string> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: 'informe_ceo!A2:B2',
    })
    return res.data.values?.[0]?.[1] ?? ''
  } catch {
    return ''
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────

const notaSchema = z.object({
  texto: z.string().max(60),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  color: z.enum(['amarillo', 'naranja']),
  tamano: z.enum(['sm', 'md', 'lg']),
  origenHmw: z.string().max(120).nullable(),
})

const responseSchema = z.object({
  notas: z.array(notaSchema).min(8).max(25),
})

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const [ctx, hmwMejor, ceoInsights] = await Promise.all([
      loadHmwIaContextOrFail(),
      loadHMWMejor(),
      loadCEOInsights(),
    ])

    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.message }, { status: 400 })
    }

    const contextoBase = hmwIaContextToMarkdown(ctx.ctx)

    const hmwMejorText =
      hmwMejor.length > 0
        ? hmwMejor
            .map((h) => `- [${h.segmento}] "${h.pregunta}" → ${h.respuesta}`)
            .join('\n')
        : '(No hay respuestas HMW marcadas como "mejor" todavia.)'

    const ceoText = ceoInsights.trim()
      ? `=== Insights de la entrevista a la CEO (Patri) ===\n${ceoInsights.slice(0, 3000)}`
      : '(No hay informe CEO guardado todavia.)'

    const prompt = `Eres un experto en diseño de producto y priorización de MVP para startups y negocios de servicios.

${contextoBase}

${ceoText}

=== Respuestas HMW marcadas como "mejor" (ideas clave del equipo) ===
${hmwMejorText}

=== TU TAREA ===
Genera entre 10 y 20 funcionalidades/características concretas para el MVP de la nueva web/app de MOA (centro de osteopatia y movimiento de Patri).

Para CADA funcionalidad define:
1. "texto": nombre corto y claro (maximo 55 caracteres). Ejemplos: "Reserva online de sesiones", "Pago de cuota mensual", "Calendario de clases grupales".
2. "x": posicion horizontal 0-100.
   - 0 = Poco valor para el NEGOCIO (no genera ingresos ni ahorra costes a Patri / MOA)
   - 100 = Mucho valor para el NEGOCIO (genera ingresos directos, fideliza, ahorra tiempo de administracion)
3. "y": posicion vertical 0-100.
   - 0 = Mucho valor para el USUARIO/CLIENTA (resuelve un dolor claro, mejora su experiencia)
   - 100 = Poco valor para el USUARIO/CLIENTA (es mas administrativa o tecnica, el usuario apenas la nota)
4. "color":
   - "naranja" si la funcionalidad esta en el cuadrante top-right (x>50 AND y<50): alta prioridad MVP
   - "amarillo" para el resto
5. "tamano": importancia relativa dentro de su cuadrante.
   - "lg" = critica (sin esto el MVP no tiene sentido)
   - "md" = importante pero no bloqueante
   - "sm" = interesante a largo plazo
6. "origenHmw": si la funcionalidad viene de una pregunta HMW, pon el texto de esa pregunta (maximo 100 chars). Si no, pon null.

Usa solo informacion real del contexto (encuestas, CEO, HMW). No inventes datos demograficos ni funciones sin base.
Posiciona las funcionalidades de forma realista y variada en la matriz; no las pongas todas en el mismo cuadrante.`

    const result = await generateObject({
      model: openai('gpt-4o'),
      schema: responseSchema,
      prompt,
    })

    const notas = result.object.notas.map((n) => ({
      ...n,
      id: newMVPNotaId(),
    }))

    return NextResponse.json({ notas })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error generando MVP'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
