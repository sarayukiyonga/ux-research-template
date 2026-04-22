import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { fetchCeoInterviewPlaintext } from '@/lib/fetch-ceo-interview-plaintext'
import { fetchSavedInsights, insightsToPlainText } from '@/lib/fetch-saved-insights'
import {
  MOSCOW_CATEGORIAS,
  getScopePersist,
  normalizeMoSCoWStoredJson,
  MOSCOW_SCOPE_ALL,
  type MoSCoWCategoria,
  type MoSCoWPersist,
} from '@/lib/moscow-types'
import { fetchSavedUserJourneyFromSheets } from '@/lib/fetch-saved-user-journey'
import { mergeJourneyCatalogosForV3 } from '@/lib/moscow-scope-options'
import { getCanalPromptFields } from '@/lib/user-journey-channels'
import { newMVPNotaId } from '@/lib/mvp-types'
import { CLIENT, CLIENT_LONG_DESC } from '@/lib/client-config'

export const dynamic = 'force-dynamic'

const MOSCOW_SHEET = 'moscow'
const MAX_MOSCOW_NOTAS = 50

/** Must / Should / Could entran en la matriz MVP por IA; Won't queda fuera. */
const MOSCOW_CATEGORIAS_PARA_MVP = MOSCOW_CATEGORIAS.filter((c) => c !== 'wont')

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

const MOSCOW_LABEL_SHORT: Record<MoSCoWCategoria, string> = {
  must: 'Must',
  should: 'Should',
  could: 'Could',
  wont: "Won't",
}

interface MoscowFlatItem {
  orden: number
  categoria: MoSCoWCategoria
  texto: string
  origenMVP: string | null
}

function flattenMoSCoW(persist: MoSCoWPersist): MoscowFlatItem[] {
  const out: MoscowFlatItem[] = []
  let orden = 1
  for (const cat of MOSCOW_CATEGORIAS_PARA_MVP) {
    for (const n of persist.notas[cat]) {
      const t = n.texto?.trim()
      if (!t) continue
      out.push({
        orden: orden++,
        categoria: cat,
        texto: t.slice(0, 80),
        origenMVP: n.origenMVP?.trim() ? n.origenMVP!.trim().slice(0, 120) : null,
      })
    }
  }
  return out
}

async function loadMoSCoWForMvpScope(scope: string): Promise<MoSCoWPersist | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: `${MOSCOW_SHEET}!A2:B2`,
    })
    const row = res.data.values?.[0]
    if (!row?.[1]?.trim()) return null
    const bundle = normalizeMoSCoWStoredJson(JSON.parse(row[1]))
    const p = getScopePersist(bundle, scope)
    const n = MOSCOW_CATEGORIAS.reduce((s, c) => s + p.notas[c].length, 0)
    return n > 0 ? p : null
  } catch {
    return null
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

function buildResponseSchema(count: number) {
  return z.object({
    notas: z.array(notaSchema).min(count).max(count),
  })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    let mvpScope: string = MOSCOW_SCOPE_ALL
    try {
      const raw = (await req.json().catch(() => null)) as { scope?: unknown } | null
      if (raw && typeof raw.scope === 'string' && raw.scope.trim()) {
        const s = raw.scope.trim().slice(0, 48)
        if (s !== MOSCOW_SCOPE_ALL) mvpScope = s
      }
    } catch {
      /* cuerpo vacío */
    }

    const [persist, insClientes, insPotenciales, ceoPlain, journeyRes] = await Promise.all([
      loadMoSCoWForMvpScope(mvpScope),
      fetchSavedInsights('clientes'),
      fetchSavedInsights('potenciales'),
      fetchCeoInterviewPlaintext(),
      mvpScope === MOSCOW_SCOPE_ALL
        ? Promise.resolve({ ok: false as const })
        : fetchSavedUserJourneyFromSheets(),
    ])

    if (!persist) {
      return NextResponse.json(
        {
          error:
            mvpScope === MOSCOW_SCOPE_ALL
              ? 'No hay MoSCoW en «Todos los canales» con notas. Guarda el tablero combinado en /moscow o elige un canal con MoSCoW.'
              : `No hay notas MoSCoW guardadas para el canal seleccionado. Genera y guarda MoSCoW para ese canal en /moscow.`,
        },
        { status: 400 }
      )
    }

    const mergedCatalog = journeyRes.ok ? mergeJourneyCatalogosForV3(journeyRes.v3) : []
    const ambitoLine =
      mvpScope === MOSCOW_SCOPE_ALL
        ? 'Ámbito: **Todos los canales** — el listado MoSCoW corresponde al tablero combinado guardado en Sheets.'
        : `Ámbito: **solo el canal «${getCanalPromptFields(mvpScope, mergedCatalog).label}»** — posiciona solo en función de esas notas MoSCoW; no mezcles prioridades de otros medios.`

    const flat = flattenMoSCoW(persist)
    if (flat.length === 0) {
      const totalConTexto = MOSCOW_CATEGORIAS.reduce(
        (s, c) => s + persist.notas[c].filter((n) => n.texto?.trim()).length,
        0
      )
      const msg =
        totalConTexto > 0
          ? 'Solo hay notas en Won\'t o el resto de columnas está vacío: la fila Won\'t no se usa para crear el MVP con IA. Añade al menos una nota con texto en Must, Should o Could en MoSCoW y vuelve a guardar.'
          : 'El MoSCoW guardado no tiene notas con texto. Añade al menos una nota en la página MoSCoW y vuelve a guardar.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (flat.length > MAX_MOSCOW_NOTAS) {
      return NextResponse.json(
        {
          error: `Hay demasiadas notas en MoSCoW (${flat.length}). Reduce a ${MAX_MOSCOW_NOTAS} o menos para generar la matriz con IA.`,
        },
        { status: 400 }
      )
    }

    const listaMoscow = flat
      .map((item) => {
        const lab = MOSCOW_LABEL_SHORT[item.categoria]
        const orig = item.origenMVP ? ` · trazo HMW/MVP: "${item.origenMVP}"` : ''
        return `${item.orden}. [MoSCoW · ${lab}] "${item.texto}"${orig}`
      })
      .join('\n')

    const bloqueClientes = insClientes.ok
      ? `=== Insights IA — encuesta a CLIENTES ACTUALES ===\n${insightsToPlainText(insClientes.data).slice(0, 8000)}`
      : '(No hay insights guardados para la encuesta a clientes actuales.)'

    const bloquePotenciales = insPotenciales.ok
      ? `=== Insights IA — encuesta a CLIENTES POTENCIALES ===\n${insightsToPlainText(insPotenciales.data).slice(0, 8000)}`
      : '(No hay insights guardados para la encuesta a clientes potenciales.)'

    const ceoText =
      ceoPlain.trim() && !ceoPlain.startsWith('(Sin datos')
        ? `=== Entrevista a la ${CLIENT.ownerRole} (${CLIENT.ownerFirstName}) — respuestas por tema ===\n${ceoPlain.slice(0, 12000)}`
        : `(No hay respuestas de entrevista CEO en la hoja principal; posiciona según MoSCoW y los insights de encuesta si existen.)`

    const n = flat.length
    const responseSchema = buildResponseSchema(n)

    const prompt = `Eres experto en priorización de MVP para ${CLIENT_LONG_DESC}.

${ambitoLine}

=== FUNCIONALIDADES Ya definidas en MoSCoW — solo Must, Should y Could (Won't no entra en el MVP) ===
${listaMoscow}

${bloqueClientes}

${bloquePotenciales}

${ceoText}

=== TU TAREA ===
Debes devolver EXACTAMENTE ${n} entradas en "notas", en el MISMO ORDEN que el listado numerado de arriba (la entrada 1 del JSON corresponde a la línea 1, etc.).

Para cada entrada i:
1. "texto": el nombre corto de la funcionalidad tal como en MoSCoW (máximo 55 caracteres). Puedes acortar ligeramente si hace falta para caber; no cambies el significado ni inventes otra funcionalidad distinta.
2. "x": 0–100 = valor para el NEGOCIO de ${CLIENT.name} (${CLIENT.ownerFirstName}).
   - 0 = poco valor de negocio (no ingresos, poco ahorro operativo, poco impacto en retención).
   - 100 = mucho valor de negocio (ingresos, eficiencia, fidelización clara).
3. "y": 0–100 = valor para el USUARIO/cliente final.
   - 0 = mucho valor percibido (resuelve un dolor o necesidad fuerte).
   - 100 = poco valor percibido para quien usa el producto.
4. "color": "naranja" si x>50 e y<50 (cuadrante MVP de alta prioridad); en caso contrario "amarillo".
5. "tamano": "lg" si es crítica en ese cuadrante, "md" si es importante, "sm" si es secundaria (relativo al resto del listado).
6. "origenHmw": cadena corta con la categoría MoSCoW de origen, por ejemplo "MoSCoW · Must". Si en la línea había trazo HMW/MVP, añade " — " y un fragmento breve (máx. ~80 caracteres en total).

Cómo posicionar: usa sobre todo los insights de las dos encuestas y la entrevista CEO para situar x e y. La etiqueta MoSCoW (Must/Should/Could) orienta prioridad global pero NO sustituye la evidencia de encuestas y CEO (por ejemplo, algo en "Could" puede tener alto valor de usuario si las encuestas lo muestran).

No inventes datos demográficos ni funciones que no estén en el listado MoSCoW. Reparte las posiciones de forma realista; no apiles todas en el mismo punto.`

    const result = await generateObject({
      model: openai('gpt-4o'),
      schema: responseSchema,
      prompt,
    })

    const notas = result.object.notas.map((row, idx) => {
      const src = flat[idx]
      const fallbackTexto = src ? src.texto.slice(0, 60) : row.texto
      return {
        ...row,
        texto: row.texto?.trim() ? row.texto.trim().slice(0, 60) : fallbackTexto,
        id: newMVPNotaId(),
      }
    })

    return NextResponse.json({ notas })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error generando MVP'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
