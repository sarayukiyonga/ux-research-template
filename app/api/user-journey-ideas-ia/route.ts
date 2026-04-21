import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'
import { fetchCeoInterviewPlaintext } from '@/lib/fetch-ceo-interview-plaintext'
import { CLIENT } from '@/lib/client-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const etapaIn = z.object({
  orden: z.number(),
  titulo: z.string(),
  descripcion: z.string(),
  puntosDeDolor: z.array(z.string()),
  rolWebFrenteAlPov: z.string(),
})

const journeyIn = z.object({
  etiquetaPersona: z.string(),
  etapas: z.array(etapaIn).min(3).max(12),
  etapaOrdenPovResuelto: z.number().int().min(1),
  sintesis: z.string().optional(),
})

function journeyToPromptBlock(j: z.infer<typeof journeyIn>, canalLabel: string): string {
  const lines = j.etapas
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((e) => {
      const clave = e.orden === j.etapaOrdenPovResuelto ? ' [MOMENTO CLAVE POV]' : ''
      return (
        `#### Etapa orden=${e.orden}${clave}: ${e.titulo}\n` +
        `${e.descripcion}\n` +
        `Dolores: ${e.puntosDeDolor.join(' · ')}\n` +
        `Rol MOA frente al POV en ${canalLabel}: ${e.rolWebFrenteAlPov}`
      )
    })
  return [`Persona: ${j.etiquetaPersona}`, `Canal: ${canalLabel}`, '', ...lines].join('\n\n')
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON no válido.' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>
  const parsed = journeyIn.safeParse(raw?.journey)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Falta "journey" con etapas válidas (mín. 3).' }, { status: 400 })
  }

  const j = parsed.data
  const canalEtiqueta =
    typeof raw.canalEtiqueta === 'string' && raw.canalEtiqueta.trim().length > 0
      ? raw.canalEtiqueta.trim().slice(0, 120)
      : 'el canal elegido'

  const ordenes = j.etapas.map((e) => e.orden)
  const bloque = journeyToPromptBlock(j, canalEtiqueta)
  const ceoInterview = await fetchCeoInterviewPlaintext()

  const ideaSchema = z.object({
    etapaOrden: z
      .number()
      .int()
      .describe(`Debe ser exactamente uno de estos valores de orden de etapa: ${ordenes.join(', ')}.`),
    tipo: z
      .enum(['funcionalidad', 'contenido'])
      .describe(
        'funcionalidad = capacidad del producto/servicio digital o físico (pantalla, flujo, automatización, CTA, recordatorio…). contenido = mensajes, piezas de copy, temas de publicación, guion de email, story, vídeo breve, FAQ…'
      ),
    texto: z
      .string()
      .min(8)
      .max(360)
      .describe(
        'Idea concreta y accionable en español, alineada con los dolores y el rol MOA↔POV de esa etapa en el canal indicado.'
      ),
  })

  const maxIdeas = Math.min(32, Math.max(8, j.etapas.length * 3))

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        ideas: z
          .array(ideaSchema)
          .min(Math.min(6, j.etapas.length))
          .max(maxIdeas)
          .describe(
            'Lista de ideas: reparte al menos una idea por etapa del journey; puedes poner varias por etapa si cubren dolores distintos. Prioriza cubrir necesidades en cada fase del mapa.'
          ),
      }),
      system:
        'Eres estratega de producto y contenidos para MOA (Patri, salud y fitness, Martorell). ' +
        'Generas ideas realistas para el canal de comunicación indicado (no inventes funciones imposibles para ese medio). ' +
        'Al inicio del mensaje de usuario viene la **encuesta / entrevista a la ' +
        CLIENT.ownerRole +
        '**: úsala como **fuente de verdad** para modelo de servicio, límites, tono y viabilidad; **no contradigas** lo explícito ni propongas ofertas o canales que la encuesta descarte. ' +
        'Las etapas del mapa definen **dónde** aplicar cada idea. ' +
        'Responde solo con el JSON del esquema. Español.' +
        MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO,
      prompt: `=== ENCUESTA / ENTREVISTA A LA ${CLIENT.ownerRole.toUpperCase()} (${CLIENT.ownerFirstName}) — modelo de servicio ===
${ceoInterview}

A partir del User Journey Map siguiente, genera ideas de **funcionalidades** (qué debe poder hacer el sistema, la web, la app, el flujo en WhatsApp, etc.) y de **contenidos** (textos, piezas, ritmo de comunicación) para el canal **${canalEtiqueta}**.

Reglas:
- Cada idea debe asociarse a **etapaOrden** existente en el mapa (usa solo estos órdenes: ${ordenes.join(', ')}).
- En cada etapa, piensa qué necesita la persona según descripción, dolores y rol MOA↔POV; propón ideas que **reduzcan fricción** o **refuercen confianza** hacia el POV.
- Las ideas deben ser **coherentes** con la encuesta CEO de arriba (promesas, formato presencial/digital, recursos).
- Alterna razonablemente funcionalidad y contenido según encaje (no hace falta 50/50 estricto).
- Sé específico a MOA/Patri; evita ideas genéricas de manual de marketing.

--- MAPA ---

${bloque}
`,
    })

    const ideas = object.ideas.filter((i) => ordenes.includes(i.etapaOrden))
    if (ideas.length < 4) {
      return NextResponse.json({ error: 'La IA devolvió pocas ideas válidas. Reintenta.' }, { status: 500 })
    }
    return NextResponse.json({ ideas })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: `No se pudo generar: ${msg}` }, { status: 500 })
  }
}
