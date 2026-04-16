import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { fetchSavedUserPersonas, personaRecordToPlainText } from '@/lib/fetch-saved-user-personas'
import { fetchSavedPovFromSheets, type POVStatement } from '@/lib/fetch-saved-pov'
import {
  fetchSavedUserJourneyFromSheets,
  journeySegmentToFlowGrounding,
} from '@/lib/fetch-saved-user-journey'
import {
  parseUserJourneySavedFilters,
  resolveCanalForSegment,
  resolveFlowJourneyPairFromRequest,
  resolveOneSegmentJourneyFromRequest,
} from '@/lib/user-journey-persist'
import { userFlowLineSchema, normalizeUserFlowLine } from '@/lib/user-flow-tree'
import { getCanalPromptFields } from '@/lib/user-journey-channels'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function povLine(label: string, s: POVStatement): string {
  return `${label}: ${s.usuario} necesita ${s.necesidad} porque ${s.insight}.`
}

const ERR_PERSONA = 'Faltan user personas guardados. Ve a /user-persona.'
const ERR_POV = 'Faltan POV guardados. Ve a /pov.'
const ERR_JOURNEY =
  'Falta el User Journey Map guardado. Ve a /user-journey, genera mapas para los canales elegidos por segmento, y guarda en Sheets antes de crear el User Flow.'

function buildSystemBase(canalLabel: string): string {
  return `Eres un diseñador UX/UI para MOA (Patri, entrenamiento y salud en Martorell).

## Canal del recorrido
Este User Flow se basa en el **User Journey Map** guardado para el canal **${canalLabel}** (el mismo que corresponde a ese segmento en /user-journey). El diagrama debe ser coherente con ese canal.

## Fuente principal del diagrama
El **User Flow** (diagrama con ramas) debe estar **basado en el User Journey Map** que recibes: mismas **etapas en orden**, mismos **momentos de dolor** y el rol de **MOA frente al POV** en cada etapa para **${canalLabel}**. Persona y POV dan contexto, pero **no inventes un recorrido distinto** al del journey.

- **deDondeEntra**: coherente con la **primera etapa** del journey.
- **objetivoConversion**: alineado con la etapa donde el journey marca que el **POV se resuelve** (\`etapaOrdenPovResuelto\`).
- **Rombo (decisiones)**: solo donde el journey o los dolores sugieren **bifurcación**; las ramas deben seguir siendo plausibles respecto a las etapas siguientes del journey.

## Formato JSON — campo **raiz** (árbol)

1) **Tramos lineales** \`{ "tipo": "lineal", "pasos": [...], "clicsEntrePasos": [...], "despues": ... }\`
   - \`pasos\`: pasos en orden; cada paso: orden, tituloBolita (muy corto), descripcion, tipo (entrada | navegacion | conversion | salida).
   - \`clicsEntrePasos\`: exactamente **pasos.length - 1** textos (acción o CTA entre pasos consecutivos del mismo tramo).
   - \`despues\`: **null** o el siguiente **nodo** (lineal o decisión).

2) **Decisiones** \`{ "tipo": "decision", "tituloDiamante": "...", "descripcion": "...", "ramas": [...] }\`
   - **tituloDiamante**: pregunta breve para el rombo.
   - **ramas**: **2 o 3** \`{ "etiqueta": "...", "siguiente": <FlowNodo> }\`.

Reglas:
- Responde en español.
- Incluye **al menos una decisión** en el árbol.
- Como máximo **2 decisiones** en cadena por rama.
- Los **orden** de los pasos del diagrama deben poder seguir la **secuencia de orden de etapas** del journey (puedes agrupar dos etapas en un solo rectángulo si es un mismo paso, pero indícalo en la descripción).`
}

async function generateOneFlow(opts: {
  journeyBlock: string
  personaBlock: string
  povBlock: string
  segmentLabel: string
  canalEtiqueta: string
}) {
  const systemBase = buildSystemBase(opts.canalEtiqueta)
  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({ flow: userFlowLineSchema }),
    system: `${systemBase}

Segmento: **${opts.segmentLabel}**. El journey es la verdad del recorrido en **${opts.canalEtiqueta}**; el diagrama es su traducción a pasos y transiciones.`,
    prompt: `=== USER JOURNEY MAP — canal ${opts.canalEtiqueta} (OBLIGATORIO — base del flujo) ===\n${opts.journeyBlock}\n\n=== USER PERSONA ===\n${opts.personaBlock}\n\n=== POV ===\n${opts.povBlock}\n\n===\nDevuelve el flujo en "flow" con **raiz**, fiel al journey anterior.`,
  })
  return normalizeUserFlowLine(object.flow)
}

export async function POST(req: Request) {
  try {
    let soloSegmento: 'clienteActual' | 'clientePotencial' | null = null
    let canalPorSegmentoReq: Partial<Record<'clienteActual' | 'clientePotencial', string>> | undefined
    try {
      const body = (await req.json()) as {
        segmento?: unknown
        canalPorSegmento?: unknown
      }
      if (body?.segmento === 'clienteActual' || body?.segmento === 'clientePotencial') {
        soloSegmento = body.segmento
      }
      const cps = body?.canalPorSegmento
      if (cps && typeof cps === 'object') {
        const o = cps as Record<string, unknown>
        canalPorSegmentoReq = {}
        if (typeof o.clienteActual === 'string' && o.clienteActual.trim()) {
          canalPorSegmentoReq.clienteActual = o.clienteActual.trim()
        }
        if (typeof o.clientePotencial === 'string' && o.clientePotencial.trim()) {
          canalPorSegmentoReq.clientePotencial = o.clientePotencial.trim()
        }
        if (!canalPorSegmentoReq.clienteActual && !canalPorSegmentoReq.clientePotencial) {
          canalPorSegmentoReq = undefined
        }
      }
    } catch {
      /* sin cuerpo: generar ambos */
    }

    const personas = await fetchSavedUserPersonas()
    if (!personas.ok) {
      return NextResponse.json({ error: ERR_PERSONA }, { status: 400 })
    }

    const pov = await fetchSavedPovFromSheets()
    if (!pov.ok) {
      return NextResponse.json({ error: ERR_POV }, { status: 400 })
    }

    const journeySaved = await fetchSavedUserJourneyFromSheets()
    if (!journeySaved.ok) {
      if (journeySaved.code === 'no_journey_for_channel') {
        return NextResponse.json(
          {
            error: `${ERR_JOURNEY} ${journeySaved.detalle ?? ''}`.trim(),
          },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: ERR_JOURNEY }, { status: 400 })
    }

    const { v3, pair: defaultPair, journeyFiltersRaw } = journeySaved

    let pair = resolveFlowJourneyPairFromRequest(v3, journeyFiltersRaw, canalPorSegmentoReq)
    if (!pair && canalPorSegmentoReq) {
      const f = parseUserJourneySavedFilters(journeyFiltersRaw)
      const ca =
        typeof canalPorSegmentoReq.clienteActual === 'string' && canalPorSegmentoReq.clienteActual.trim()
          ? canalPorSegmentoReq.clienteActual.trim()
          : resolveCanalForSegment(f, v3, 'clienteActual')
      const cp =
        typeof canalPorSegmentoReq.clientePotencial === 'string' && canalPorSegmentoReq.clientePotencial.trim()
          ? canalPorSegmentoReq.clientePotencial.trim()
          : resolveCanalForSegment(f, v3, 'clientePotencial')
      const ja = Boolean(v3.clienteActual.mapas[ca])
      const jp = Boolean(v3.clientePotencial.mapas[cp])
      let detalle = ''
      if (!ja && !jp) {
        detalle = `No hay mapa de journey en cliente actual (canal «${ca}») ni en potencial (canal «${cp}»).`
      } else if (!ja) {
        detalle = `No hay mapa de journey para cliente actual en el canal «${ca}».`
      } else {
        detalle = `No hay mapa de journey para cliente potencial en el canal «${cp}».`
      }
      return NextResponse.json({ error: `${ERR_JOURNEY} ${detalle}`.trim() }, { status: 400 })
    }
    if (!pair) pair = defaultPair
    if (!pair) {
      return NextResponse.json({ error: ERR_JOURNEY }, { status: 400 })
    }

    const runActual = async () => {
      const canalMeta = getCanalPromptFields(pair.clienteActual.canalId, v3.clienteActual.catalogo)
      const journeyActual = journeySegmentToFlowGrounding(
        pair.clienteActual.journey,
        'USER JOURNEY — CLIENTE ACTUAL',
        { canalEtiqueta: canalMeta.label }
      )
      const textoPersonaActual = personaRecordToPlainText(
        'USER PERSONA — CLIENTE ACTUAL',
        personas.data.clienteActual
      )
      const povActual = povLine('POV — CLIENTE ACTUAL', pov.data.clienteActual)
      return generateOneFlow({
        journeyBlock: journeyActual,
        personaBlock: textoPersonaActual,
        povBlock: povActual,
        segmentLabel: 'cliente actual',
        canalEtiqueta: canalMeta.label,
      })
    }

    const runPotencial = async () => {
      const canalMeta = getCanalPromptFields(pair.clientePotencial.canalId, v3.clientePotencial.catalogo)
      const journeyPotencial = journeySegmentToFlowGrounding(
        pair.clientePotencial.journey,
        'USER JOURNEY — CLIENTE POTENCIAL',
        { canalEtiqueta: canalMeta.label }
      )
      const textoPersonaPotencial = personaRecordToPlainText(
        'USER PERSONA — CLIENTE POTENCIAL',
        personas.data.clientePotencial
      )
      const povPotencial = povLine('POV — CLIENTE POTENCIAL', pov.data.clientePotencial)
      return generateOneFlow({
        journeyBlock: journeyPotencial,
        personaBlock: textoPersonaPotencial,
        povBlock: povPotencial,
        segmentLabel: 'cliente potencial',
        canalEtiqueta: canalMeta.label,
      })
    }

    if (soloSegmento === 'clienteActual') {
      const one = resolveOneSegmentJourneyFromRequest(
        v3,
        journeyFiltersRaw,
        'clienteActual',
        canalPorSegmentoReq?.clienteActual
      )
      if (!one) {
        const f = parseUserJourneySavedFilters(journeyFiltersRaw)
        const ca =
          typeof canalPorSegmentoReq?.clienteActual === 'string' && canalPorSegmentoReq.clienteActual.trim()
            ? canalPorSegmentoReq.clienteActual.trim()
            : resolveCanalForSegment(f, v3, 'clienteActual')
        return NextResponse.json(
          {
            error: `${ERR_JOURNEY} No hay mapa de journey para cliente actual en el canal «${ca}».`.trim(),
          },
          { status: 400 }
        )
      }
      const canalMeta = getCanalPromptFields(one.canalId, v3.clienteActual.catalogo)
      const journeyActual = journeySegmentToFlowGrounding(one.journey, 'USER JOURNEY — CLIENTE ACTUAL', {
        canalEtiqueta: canalMeta.label,
      })
      const textoPersonaActual = personaRecordToPlainText(
        'USER PERSONA — CLIENTE ACTUAL',
        personas.data.clienteActual
      )
      const povActual = povLine('POV — CLIENTE ACTUAL', pov.data.clienteActual)
      const flow = await generateOneFlow({
        journeyBlock: journeyActual,
        personaBlock: textoPersonaActual,
        povBlock: povActual,
        segmentLabel: 'cliente actual',
        canalEtiqueta: canalMeta.label,
      })
      return NextResponse.json({
        version: 3 as const,
        segmento: 'clienteActual' as const,
        canalId: one.canalId,
        flow,
      })
    }
    if (soloSegmento === 'clientePotencial') {
      const one = resolveOneSegmentJourneyFromRequest(
        v3,
        journeyFiltersRaw,
        'clientePotencial',
        canalPorSegmentoReq?.clientePotencial
      )
      if (!one) {
        const f = parseUserJourneySavedFilters(journeyFiltersRaw)
        const cp =
          typeof canalPorSegmentoReq?.clientePotencial === 'string' && canalPorSegmentoReq.clientePotencial.trim()
            ? canalPorSegmentoReq.clientePotencial.trim()
            : resolveCanalForSegment(f, v3, 'clientePotencial')
        return NextResponse.json(
          {
            error: `${ERR_JOURNEY} No hay mapa de journey para cliente potencial en el canal «${cp}».`.trim(),
          },
          { status: 400 }
        )
      }
      const canalMeta = getCanalPromptFields(one.canalId, v3.clientePotencial.catalogo)
      const journeyPotencial = journeySegmentToFlowGrounding(one.journey, 'USER JOURNEY — CLIENTE POTENCIAL', {
        canalEtiqueta: canalMeta.label,
      })
      const textoPersonaPotencial = personaRecordToPlainText(
        'USER PERSONA — CLIENTE POTENCIAL',
        personas.data.clientePotencial
      )
      const povPotencial = povLine('POV — CLIENTE POTENCIAL', pov.data.clientePotencial)
      const flow = await generateOneFlow({
        journeyBlock: journeyPotencial,
        personaBlock: textoPersonaPotencial,
        povBlock: povPotencial,
        segmentLabel: 'cliente potencial',
        canalEtiqueta: canalMeta.label,
      })
      return NextResponse.json({
        version: 3 as const,
        segmento: 'clientePotencial' as const,
        canalId: one.canalId,
        flow,
      })
    }

    const [fa, fp] = await Promise.all([runActual(), runPotencial()])
    return NextResponse.json({
      version: 3 as const,
      clienteActual: fa,
      clientePotencial: fp,
      canalPorSegmento: {
        clienteActual: pair.clienteActual.canalId,
        clientePotencial: pair.clientePotencial.canalId,
      },
    })
  } catch (e) {
    console.error('[api/user-flow]', e)
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json(
      {
        error:
          'No se pudo generar el User Flow. ' +
          (msg.includes('API key') || msg.includes('401')
            ? 'Revisa OPENAI_API_KEY en el entorno.'
            : msg),
      },
      { status: 500 }
    )
  }
}
