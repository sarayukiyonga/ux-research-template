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
import { fetchSavedUserJourneyIdeasFromSheets } from '@/lib/fetch-saved-user-journey-ideas'
import {
  parseUserJourneySavedFilters,
  resolveCanalForSegment,
  resolveFlowJourneyPairFromRequest,
  resolveOneSegmentJourneyFromRequest,
} from '@/lib/user-journey-persist'
import {
  createEmptyIdeasPersist,
  getIdeasForSegmentChannel,
  ideasToFlowPromptBlock,
} from '@/lib/user-journey-ideas-persist'
import { userFlowLineSchema, normalizeUserFlowLine } from '@/lib/user-flow-tree'
import { getCanalPromptFields } from '@/lib/user-journey-channels'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function povLine(label: string, s: POVStatement): string {
  return `${label}: ${s.usuario} necesita ${s.necesidad} porque ${s.insight}.`
}

const ERR_PERSONA = 'Faltan user personas guardados. Ve a /user-persona.'
const ERR_POV = 'Faltan POV guardados. Ve a /pov.'
const ERR_JOURNEY =
  'Falta el User Journey Map guardado. Ve a /user-journey, genera mapas para los canales elegidos por segmento, y guarda en Sheets antes de crear el User Flow.'
const ERR_IDEAS =
  'Faltan ideas de funcionalidades y contenido guardadas para este canal y segmento. En /user-journey, sección «Funcionalidades y contenido por canal», elige el mismo canal, genera o añade al menos una idea, y guarda en Sheets.'

function buildSystemBase(canalLabel: string): string {
  return `Eres un diseñador UX/UI para MOA (Patri, entrenamiento y salud en Martorell).

## Canal
**${canalLabel}**.

## Fuente principal (obligatoria)
Las **ideas de funcionalidades y contenidos** del bloque dedicado en /user-journey son la **base del diagrama**: cada rectángulo (proceso), el óvalo de entrada/salida y los textos de transición deben **materializar o preparar** esas ideas en un orden de uso real. Si una idea es de **contenido**, el paso debe reflejar qué ve o lee la persona; si es **funcionalidad**, qué hace el sistema o la interfaz en **${canalLabel}**.

## Contexto de apoyo (coherencia; no sustituye las ideas)
El **User Journey Map** (etapas, dolores, rol MOA↔POV), la **User Persona** y el **POV** alinean tono y bifurcaciones. No contradigas el journey; si una idea choca con un dolor del mapa, **adapta el paso** para reducir esa fricción manteniendo la intención de la idea.

## Trazado en **árbol vertical**
El JSON **raiz** representa un **árbol que se lee de arriba abajo** (diagrama de flujo clásico):
- Los tramos **lineales** son una **columna** de pasos en secuencia (el primer paso tras la entrada es lo primero que ocurre; luego el siguiente, etc.).
- Las **decisiones** (rombos) aparecen donde las ideas o dolores sugieren **bifurcación**; cada rama continúa **hacia abajo** con más pasos u otra decisión.
- **deDondeEntra** y **clicsEntrePasos** deben sonar a acciones concretas en **${canalLabel}**.
- **objetivoConversion**: alineado con la etapa del journey donde el **POV** cobra fuerza (\`etapaOrdenPovResuelto\`) **y** con las ideas asociadas a esa etapa.

## Formato JSON — campo **raiz** (árbol)

1) **Tramos lineales** \`{ "tipo": "lineal", "pasos": [...], "clicsEntrePasos": [...], "despues": ... }\`
   - \`pasos\`: orden creciente = **orden temporal de arriba abajo** en el diagrama.
   - \`clicsEntrePasos\`: exactamente **pasos.length - 1** textos (transición entre pasos consecutivos del tramo).
   - \`despues\`: **null** o el siguiente **nodo** (lineal o decisión).

2) **Decisiones** \`{ "tipo": "decision", "tituloDiamante": "...", "descripcion": "...", "ramas": [...] }\`
   - **tituloDiamante**: pregunta breve para el rombo.
   - **ramas**: **2 o 3** \`{ "etiqueta": "...", "siguiente": <FlowNodo> }\`; cada \`siguiente\` continúa el flujo **vertical** por debajo de esa rama.

### Campo opcional de retroceso en un paso (`retornoTipo` / `retornoA` / `retornoLabel`)

Úsalo **solo** cuando la persona deba **volver a repetir un paso ANTERIOR** (por ejemplo, "Si no encuentra hueco libre, vuelve a consultar horarios"). Reglas estrictas:
- `retornoA` debe ser el `tituloBolita` de un paso con **orden menor** al paso actual (nunca el siguiente ni el mismo).
- Nunca uses retornoA para avanzar: si la persona "continúa" o "va al siguiente paso", eso es un `clicEntrePasos`, no un retorno.
- Usa retornoA con moderación: máximo 1–2 veces en todo el flujo, solo cuando el journey muestre una **reincidencia** real.
- Si no hay retroceso real en el journey, deja `retornoTipo: null`, `retornoA: null`, `retornoLabel: null` en todos los pasos.

Reglas:
- Responde en español.
- Incluye **al menos una decisión** en el árbol.
- Como máximo **2 decisiones** en cadena por rama.
${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}`
}

async function generateOneFlow(opts: {
  ideasBlock: string
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

Segmento: **${opts.segmentLabel}**. Las ideas listadas son la prioridad; el journey y persona/POV son apoyo.`,
    prompt: `=== IDEAS DE FUNCIONALIDADES Y CONTENIDO (PRIORIDAD 1 — canal ${opts.canalEtiqueta}) ===
${opts.ideasBlock}

=== USER JOURNEY MAP — contexto de etapas, dolores y POV ===
${opts.journeyBlock}

=== USER PERSONA ===
${opts.personaBlock}

=== POV ===
${opts.povBlock}

===
Devuelve el objeto "flow" con **raiz** como árbol vertical fiel a las ideas; usa el journey para no contradecir etapas y dolores.`,
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

    const ideasSaved = await fetchSavedUserJourneyIdeasFromSheets()
    const ideasPersist = ideasSaved.ok ? ideasSaved.data : createEmptyIdeasPersist()

    const { v3, pair: defaultPair, journeyFiltersRaw } = journeySaved

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
      const ideaItems = getIdeasForSegmentChannel(ideasPersist, 'clienteActual', one.canalId)
      if (ideaItems.length === 0) {
        return NextResponse.json(
          { error: `${ERR_IDEAS} (Cliente actual, canal «${canalMeta.label}».)` },
          { status: 400 }
        )
      }
      const ideasBlock = ideasToFlowPromptBlock(ideaItems, one.journey, canalMeta.label)
      const journeyActual = journeySegmentToFlowGrounding(one.journey, 'USER JOURNEY — CLIENTE ACTUAL', {
        canalEtiqueta: canalMeta.label,
      })
      const textoPersonaActual = personaRecordToPlainText(
        'USER PERSONA — CLIENTE ACTUAL',
        personas.data.clienteActual
      )
      const povActual = povLine('POV — CLIENTE ACTUAL', pov.data.clienteActual)
      const flow = await generateOneFlow({
        ideasBlock,
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
      const ideaItems = getIdeasForSegmentChannel(ideasPersist, 'clientePotencial', one.canalId)
      if (ideaItems.length === 0) {
        return NextResponse.json(
          { error: `${ERR_IDEAS} (Cliente potencial, canal «${canalMeta.label}».)` },
          { status: 400 }
        )
      }
      const ideasBlock = ideasToFlowPromptBlock(ideaItems, one.journey, canalMeta.label)
      const journeyPotencial = journeySegmentToFlowGrounding(one.journey, 'USER JOURNEY — CLIENTE POTENCIAL', {
        canalEtiqueta: canalMeta.label,
      })
      const textoPersonaPotencial = personaRecordToPlainText(
        'USER PERSONA — CLIENTE POTENCIAL',
        personas.data.clientePotencial
      )
      const povPotencial = povLine('POV — CLIENTE POTENCIAL', pov.data.clientePotencial)
      const flow = await generateOneFlow({
        ideasBlock,
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

    const canalMetaA = getCanalPromptFields(pair.clienteActual.canalId, v3.clienteActual.catalogo)
    const canalMetaP = getCanalPromptFields(pair.clientePotencial.canalId, v3.clientePotencial.catalogo)
    const ideasA = getIdeasForSegmentChannel(ideasPersist, 'clienteActual', pair.clienteActual.canalId)
    const ideasP = getIdeasForSegmentChannel(ideasPersist, 'clientePotencial', pair.clientePotencial.canalId)
    if (ideasA.length === 0) {
      return NextResponse.json(
        { error: `${ERR_IDEAS} (Cliente actual, canal «${canalMetaA.label}».)` },
        { status: 400 }
      )
    }
    if (ideasP.length === 0) {
      return NextResponse.json(
        { error: `${ERR_IDEAS} (Cliente potencial, canal «${canalMetaP.label}».)` },
        { status: 400 }
      )
    }
    const ideasBlockA = ideasToFlowPromptBlock(ideasA, pair.clienteActual.journey, canalMetaA.label)
    const ideasBlockP = ideasToFlowPromptBlock(ideasP, pair.clientePotencial.journey, canalMetaP.label)

    const runActual = async () => {
      const journeyActual = journeySegmentToFlowGrounding(
        pair.clienteActual.journey,
        'USER JOURNEY — CLIENTE ACTUAL',
        { canalEtiqueta: canalMetaA.label }
      )
      const textoPersonaActual = personaRecordToPlainText(
        'USER PERSONA — CLIENTE ACTUAL',
        personas.data.clienteActual
      )
      const povActual = povLine('POV — CLIENTE ACTUAL', pov.data.clienteActual)
      return generateOneFlow({
        ideasBlock: ideasBlockA,
        journeyBlock: journeyActual,
        personaBlock: textoPersonaActual,
        povBlock: povActual,
        segmentLabel: 'cliente actual',
        canalEtiqueta: canalMetaA.label,
      })
    }

    const runPotencial = async () => {
      const journeyPotencial = journeySegmentToFlowGrounding(
        pair.clientePotencial.journey,
        'USER JOURNEY — CLIENTE POTENCIAL',
        { canalEtiqueta: canalMetaP.label }
      )
      const textoPersonaPotencial = personaRecordToPlainText(
        'USER PERSONA — CLIENTE POTENCIAL',
        personas.data.clientePotencial
      )
      const povPotencial = povLine('POV — CLIENTE POTENCIAL', pov.data.clientePotencial)
      return generateOneFlow({
        ideasBlock: ideasBlockP,
        journeyBlock: journeyPotencial,
        personaBlock: textoPersonaPotencial,
        povBlock: povPotencial,
        segmentLabel: 'cliente potencial',
        canalEtiqueta: canalMetaP.label,
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
