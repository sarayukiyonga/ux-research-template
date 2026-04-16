import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { empathyMapToPlainText, fetchSavedEmpathyMap } from '@/lib/fetch-saved-empathy-map'
import { sanitizeInsightsPayload } from '@/lib/insights-sanitize'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Segment = 'clientes' | 'potenciales'

const bloqueSchema = z.object({
  titulo: z.string().max(110).describe('Título corto del tema de insights'),
  items: z
    .array(z.string().max(900))
    .min(3)
    .max(6)
    .describe('3-6 hallazgos concretos y accionables; cada ítem una frase o párrafo breve COMPLETO (sin truncar a mitad).'),
})

const schema = z.object({
  resumen: z
    .string()
    .max(2800)
    .describe('Párrafo ejecutivo que sintetiza lo más importante; texto completo, sin cortar a mitad de frase.'),
  bloques: z
    .array(bloqueSchema)
    .min(5)
    .max(8)
    .describe('5-8 bloques temáticos con insights accionables'),
})

const ERROR_MESSAGES: Record<string, string> = {
  no_sheet:
    'No hay mapa de empatía guardado para este segmento. Genera y guarda el mapa en la página Mapa de empatía primero.',
  empty: 'El mapa de empatía guardado está vacío. Vuelve a generar y guardar el mapa de empatía.',
  invalid_json: 'No se pudo leer el mapa de empatía guardado (JSON inválido).',
  invalid_shape: 'El mapa de empatía guardado tiene un formato inesperado. Regenera el mapa en la página correspondiente.',
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const segment = body.segment as Segment | undefined

  if (segment !== 'clientes' && segment !== 'potenciales') {
    return NextResponse.json({ error: 'segment requerido: clientes | potenciales' }, { status: 400 })
  }

  const empathy = await fetchSavedEmpathyMap(segment)
  if (!empathy.ok) {
    return NextResponse.json(
      { error: ERROR_MESSAGES[empathy.code] ?? 'No se pudo cargar el mapa de empatía.' },
      { status: 400 }
    )
  }

  const mapaTexto = empathyMapToPlainText(empathy.data)
  const contexto =
    segment === 'clientes'
      ? 'CLIENTES ACTUALES de MOA (ya entrenan con Patricia Dorado en Martorell). El mapa ya refleja el subconjunto filtrado que guardaste.'
      : 'CLIENTES POTENCIALES de MOA (aún no son clientes). El mapa ya refleja el subconjunto filtrado que guardaste.'

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema,
    system: `Eres un analista de investigación cualitativa especializado en salud, fitness y experiencia de cliente.
Tu única fuente de verdad es el MAPA DE EMPATÍA GUARDADO de ${contexto}
No inventes datos que no estén implícitos en esas notas.

Tu tarea es extraer INSIGHTS accionables para Patricia (entrenadora) y su marca MOA:
- Patrones, tensiones, oportunidades y riesgos que emergen del mapa.
- Lenguaje cercano al del mapa cuando aporte valor.
- Cada ítem debe ser específico (no genéricos como "mejorar la comunicación" sin contexto).
- Si el mapa es muy escaso, dilo en el resumen y reduce la ambición de los bloques.

Estructura de salida:
- "resumen": síntesis ejecutiva.
- "bloques": temas con título + lista de insights (cada uno una idea completa en una frase).

PROHIBIDO en cualquier texto visible: llaves {}, corchetes [], comillas JSON sueltas, fragmentos como "}, {" o "'], [", bloques markdown con backticks, o pegamento de arrays. Solo español natural. No truncar frases: si un ítem es largo, que siga siendo una idea completa.${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}`,
    prompt: `=== MAPA DE EMPATÍA (${segment === 'clientes' ? 'clientes actuales' : 'clientes potenciales'}) ===\n\n${mapaTexto}`,
  })

  const cleaned = sanitizeInsightsPayload(object)
  return NextResponse.json({ segment, ...cleaned })
}
