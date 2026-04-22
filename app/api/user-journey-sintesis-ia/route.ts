import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'
import { CLIENT } from '@/lib/client-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

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

function journeyToPlainText(j: z.infer<typeof journeyIn>): string {
  const lines = j.etapas
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map(
      (e) =>
        `### Etapa ${e.orden}: ${e.titulo}${e.orden === j.etapaOrdenPovResuelto ? ' **[momento clave POV↔web]**' : ''}\n` +
        `${e.descripcion}\n` +
        `Dolores: ${e.puntosDeDolor.join(' · ')}\n` +
        `Web y POV: ${e.rolWebFrenteAlPov}`
    )
  return [`Persona: ${j.etiquetaPersona}`, '', ...lines].join('\n\n')
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
      : 'el canal de contacto elegido'

  const bloque = journeyToPlainText(j)
  const prev = j.sintesis?.trim() ? `\nSíntesis actual (puedes mejorarla, no copiarla literal si no aporta): "${j.sintesis.trim()}"` : ''

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        sintesis: z
          .string()
          .max(300)
          .describe(
            `Una sola frase o dos cortas en español: enlaza el viaje en ${canalEtiqueta} con el valor para la persona y el POV.`
          ),
      }),
      system:
        `Eres UX strategist para ${CLIENT.name} (${CLIENT.ownerFirstName}, ${CLIENT.sector} en ${CLIENT.location}). Respondes solo JSON. Español natural, tono profesional.` +
        MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO,
      prompt: `A partir del siguiente User Journey (etapas, dolores, rol frente al POV en ${canalEtiqueta}), escribe una **síntesis** breve (máximo ~280 caracteres) que cierre el relato: qué busca la persona, cómo ${CLIENT.name} la acompaña en ese canal y en qué sentido el momento clave resuelve o acerca al POV.

${bloque}
${prev}

Devuelve solo el campo sintesis.`,
    })

    const sintesis = object.sintesis.trim().slice(0, 300)
    if (!sintesis) {
      return NextResponse.json({ error: 'La IA devolvió una síntesis vacía.' }, { status: 500 })
    }
    return NextResponse.json({ sintesis })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: `No se pudo generar la síntesis: ${msg}` }, { status: 500 })
  }
}
