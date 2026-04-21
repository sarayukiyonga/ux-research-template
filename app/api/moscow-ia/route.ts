import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { loadHmwIaContextOrFail, hmwIaContextToMarkdown } from '@/lib/hmw-ia-context'
import { newMoSCoWId } from '@/lib/moscow-types'
import type { MVPNota } from '@/lib/mvp-types'

export const dynamic = 'force-dynamic'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function loadMVPNotas(): Promise<MVPNota[]> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: 'mvp!A2:B2',
    })
    const row = res.data.values?.[0]
    if (!row || !row[1]) return []
    const parsed = JSON.parse(row[1])
    return Array.isArray(parsed?.notas) ? parsed.notas : []
  } catch {
    return []
  }
}

// ── Esquema de respuesta ──────────────────────────────────────────────────────

const notaSchema = z.object({
  texto: z.string().max(65),
  color: z.enum(['amarillo', 'naranja', 'blanco']),
  tamano: z.enum(['sm', 'md', 'lg']),
  origenMVP: z.string().max(100).nullable(),
})

const responseSchema = z.object({
  must: z.array(notaSchema),
  should: z.array(notaSchema),
  could: z.array(notaSchema),
  wont: z.array(notaSchema),
})

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const [ctx, mvpNotas] = await Promise.all([
      loadHmwIaContextOrFail(),
      loadMVPNotas(),
    ])

    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.message }, { status: 400 })
    }

    const contextoBase = hmwIaContextToMarkdown(ctx.ctx)

    const notasTexto =
      mvpNotas.length > 0
        ? mvpNotas
            .map((n) => {
              const prioUsuario = Math.round(100 - n.y)
              const prioNegocio = Math.round(n.x)
              return `- "${n.texto}" (valor usuario: ${prioUsuario}/100, valor negocio: ${prioNegocio}/100)`
            })
            .join('\n')
        : '(No hay notas guardadas en la matriz MVP. Genera funcionalidades basandote en el contexto.)'

    const prompt = `Eres un experto en diseño de producto y priorización de MVP con el metodo MoSCoW.

${contextoBase}

=== Funcionalidades de la matriz MVP (con puntuacion de valor) ===
${notasTexto}

=== TU TAREA ===
Clasifica TODAS las funcionalidades anteriores en las 4 categorias MoSCoW para la nueva web/app de MOA.
Si no habia funcionalidades en la matriz, genera entre 8 y 15 funcionalidades nuevas para MOA y clasificalas.

Criterios de clasificacion:
- MUST: Critico para el MVP. Sin esto el producto no tiene sentido. (valor usuario >65 Y valor negocio >60, o absolutamente imprescindible por otro motivo)
- SHOULD: Muy importante pero puede esperar a la version 2 si el tiempo no da. (valor alto en al menos uno de los dos ejes)
- COULD: Deseable pero opcional. Se hara si hay tiempo y recursos en v1.
- WONT: Descartado para esta version. Demasiado complejo, muy bajo valor, o fuera del alcance del MVP.

Para cada nota define:
1. "texto": nombre de la funcionalidad (maximo 55 caracteres)
2. "color":
   - "naranja" para Must con alta prioridad critica
   - "amarillo" para Should y Could normales
   - "blanco" para Won't (descartadas)
3. "tamano":
   - "lg" = absolutamente critica (MUST principal)
   - "md" = importante
   - "sm" = menor importancia o descartada
4. "origenMVP": texto de la funcionalidad original de la que proviene (o null si es nueva)

Distribuye de forma realista. Tipicamente: 4-7 Must, 3-6 Should, 3-5 Could, 2-4 Won't.
Usa el contexto de MOA (osteopatia, servicios presenciales, Patri/CEO) para justificar las decisiones.`

    const result = await generateObject({
      model: openai('gpt-4o'),
      schema: responseSchema,
      prompt,
    })

    const obj = result.object

    return NextResponse.json({
      notas: {
        must: obj.must.map((n) => ({ ...n, id: newMoSCoWId() })),
        should: obj.should.map((n) => ({ ...n, id: newMoSCoWId() })),
        could: obj.could.map((n) => ({ ...n, id: newMoSCoWId() })),
        wont: obj.wont.map((n) => ({ ...n, id: newMoSCoWId() })),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error generando MoSCoW'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
