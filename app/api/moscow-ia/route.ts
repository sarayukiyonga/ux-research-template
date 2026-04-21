import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { newMoSCoWId } from '@/lib/moscow-types'
import { CLIENT } from '@/lib/client-config'
import { fetchSavedUserJourneyFromSheets, journeySegmentToMoSCoWBlock } from '@/lib/fetch-saved-user-journey'
import { fetchSavedUserJourneyIdeasFromSheets } from '@/lib/fetch-saved-user-journey-ideas'
import {
  createEmptyIdeasPersist,
  getIdeasForSegmentChannel,
  ideasToMoSCoWPromptBlock,
  type UserJourneyIdeasPersist,
} from '@/lib/user-journey-ideas-persist'
import { getCanalPromptFields } from '@/lib/user-journey-channels'
import type { UserJourneyV3Persist } from '@/lib/user-journey-persist'
import { fetchCeoInterviewPlaintext } from '@/lib/fetch-ceo-interview-plaintext'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'
import {
  hasIdeasForAllScope,
  journeyCanalReadyForMoscowIa,
  mergeJourneyCatalogosForV3,
} from '@/lib/moscow-scope-options'
import { MOSCOW_SCOPE_ALL } from '@/lib/moscow-types'

export const dynamic = 'force-dynamic'

const CEO_PROMPT_MAX = 12000

const notaSchema = z.object({
  texto: z.string().max(65),
  color: z.enum(['amarillo', 'naranja', 'blanco']),
  tamano: z.enum(['sm', 'md', 'lg']),
  /** Idea FUNC/CONT, etapa del journey o fragmento CEO (campo persistido como origenMVP). */
  origenMVP: z.string().max(100).nullable(),
})

const responseSchema = z.object({
  must: z.array(notaSchema),
  should: z.array(notaSchema),
  could: z.array(notaSchema),
  wont: z.array(notaSchema),
})

/** Si `canalFilter` es null, incluye todos los canales; si es id, solo ese canal (ambos segmentos). */
function buildJourneyAndIdeasBlock(
  v3: UserJourneyV3Persist,
  ideas: UserJourneyIdeasPersist,
  canalFilter: string | null
): string | null {
  const mergedCatalog = mergeJourneyCatalogosForV3(v3)
  const parts: string[] = []
  let anyMap = false
  for (const seg of ['clienteActual', 'clientePotencial'] as const) {
    const st = v3[seg]
    const segHuman = seg === 'clienteActual' ? 'Cliente actual' : 'Cliente potencial'
    for (const canal of st.catalogo) {
      if (canalFilter !== null && canal.id !== canalFilter) continue
      const j = st.mapas[canal.id]
      if (!j?.etapas?.length) continue
      anyMap = true
      const meta = getCanalPromptFields(canal.id, mergedCatalog)
      parts.push(journeySegmentToMoSCoWBlock(j, `USER JOURNEY — ${segHuman}`, meta.label))
      const ideaChunk = ideasToMoSCoWPromptBlock(
        getIdeasForSegmentChannel(ideas, seg, canal.id),
        j,
        meta.label,
        segHuman
      )
      if (ideaChunk.trim()) parts.push(ideaChunk)
    }
  }
  if (!anyMap) return null
  return parts.join('\n\n---\n\n')
}

export async function POST(req: Request) {
  try {
    let iaScope: string = MOSCOW_SCOPE_ALL
    try {
      const raw = (await req.json().catch(() => null)) as { scope?: unknown } | null
      if (raw && typeof raw.scope === 'string' && raw.scope.trim()) {
        const s = raw.scope.trim().slice(0, 48)
        if (s !== MOSCOW_SCOPE_ALL) iaScope = s
      }
    } catch {
      /* cuerpo vacío → todos los canales */
    }

    const canalFilter = iaScope === MOSCOW_SCOPE_ALL ? null : iaScope

    const [journeyRes, ideasRes, ceoRaw] = await Promise.all([
      fetchSavedUserJourneyFromSheets(),
      fetchSavedUserJourneyIdeasFromSheets(),
      fetchCeoInterviewPlaintext(),
    ])

    if (!journeyRes.ok) {
      const extra = journeyRes.code === 'no_journey_for_channel' && journeyRes.detalle ? ` ${journeyRes.detalle}` : ''
      return NextResponse.json(
        {
          error: `No se pudo cargar el User Journey guardado.${extra} Ve a /user-journey, genera y guarda mapas por canal, y vuelve a intentar.`,
        },
        { status: 400 }
      )
    }

    const ideasPersist = ideasRes.ok ? ideasRes.data : createEmptyIdeasPersist()

    if (canalFilter === null) {
      if (!hasIdeasForAllScope(ideasPersist)) {
        return NextResponse.json(
          {
            error:
              'No hay ideas de funcionalidades ni contenidos guardadas. En /user-journey, sección «Funcionalidades y contenido por canal», añade ideas por canal y guarda en Sheets antes de generar MoSCoW.',
          },
          { status: 400 }
        )
      }
    } else if (!journeyCanalReadyForMoscowIa(journeyRes.v3, ideasPersist, canalFilter)) {
      return NextResponse.json(
        {
          error: `No hay mapa con etapas e ideas FUNC/CONT guardadas para el canal seleccionado («${canalFilter}»). Completa ese canal en /user-journey y guarda.`,
        },
        { status: 400 }
      )
    }

    const bloqueJourney = buildJourneyAndIdeasBlock(journeyRes.v3, ideasPersist, canalFilter)
    if (!bloqueJourney?.trim()) {
      return NextResponse.json(
        {
          error:
            canalFilter === null
              ? 'No hay mapas de User Journey con etapas guardados. Genera y guarda al menos un mapa por segmento y canal en /user-journey.'
              : 'No hay mapas con etapas para ese canal. Revisa el User Journey guardado.',
        },
        { status: 400 }
      )
    }

    const ceoPlain = ceoRaw.trim()
    const ceoBlock =
      ceoPlain && !ceoPlain.startsWith('(Sin datos')
        ? `=== ENCUESTA / ENTREVISTA A LA ${CLIENT.ownerRole.toUpperCase()} (${CLIENT.ownerFirstName}) — respuestas por tema ===\n${ceoRaw.slice(0, CEO_PROMPT_MAX)}`
        : `=== ENCUESTA / ENTREVISTA A LA ${CLIENT.ownerRole.toUpperCase()} (${CLIENT.ownerFirstName}) ===\n(No hay respuestas en la hoja principal de la encuesta; prioriza solo con las ideas y etapas del User Journey.)`

    const mergedCatalog = mergeJourneyCatalogosForV3(journeyRes.v3)
    const ambitoLine =
      canalFilter === null
        ? 'Ámbito: **todos los canales** del journey (cliente actual y potencial). Usa **todas** las etapas e ideas [FUNC]/[CONT] del bloque siguiente.'
        : `Ámbito: **solo el canal «${getCanalPromptFields(canalFilter, mergedCatalog).label}»** (${canalFilter}). Ignora otros canales: prioriza etapas e ideas [FUNC]/[CONT] de ese medio únicamente.`

    const prompt = `Eres un experto en diseño de producto y priorización con el método MoSCoW.

=== REGLA ABSOLUTA (origen de las funcionalidades) ===
- Tu base principal son: (1) los **User Journey Map** y las **ideas [FUNC]/[CONT]** del bloque siguiente, y (2) la **encuesta / entrevista a la ${CLIENT.ownerRole}** más abajo.
- **No** uses la matriz MVP, el HMW como fuente principal ni documentos que no estén en este prompt.
- Cada nota MoSCoW debe **colgar** de una o varias ideas o etapas del journey; la encuesta CEO sirve para **priorizar** (Must vs Should vs Could vs Won't), **coherencia de negocio** (recursos, modelo presencial, visión) y **no contradecir** lo que la ${CLIENT.ownerRole} afirma de forma explícita.
- ${ambitoLine}

${ceoBlock}

=== USER JOURNEY — MAPAS E IDEAS (fuente principal) ===
${bloqueJourney}

=== TU TAREA ===
Genera entre **8 y 18** funcionalidades concretas para la nueva web/app de ${CLIENT.name}, clasificadas en las 4 categorías MoSCoW.

Criterios de clasificación (journey + ideas + encuesta CEO):
- **MUST**: Imprescindible para un primer lanzamiento coherente con ideas/etapas críticas y con lo que la encuesta CEO marca como núcleo o bloqueante.
- **SHOULD**: Muy importante; puede ir a v2 si hace falta.
- **COULD**: Deseable si hay tiempo.
- **WON'T**: Fuera de alcance en esta versión (según CEO o bajo valor relativo frente al resto).

Para cada nota:
1. "texto": nombre breve (máximo 55 caracteres).
2. "color": "naranja" (Must críticas), "amarillo" (Should/Could), "blanco" (Won't).
3. "tamano": "lg" | "md" | "sm".
4. "origenMVP": texto corto (máx. 100) que cite la **idea FUNC/CONT** o el **título de etapa** del journey de la que procede; si fusionas varias, sepáralas con "; ". **null** solo si la nota se apoya **exclusivamente** en un fragmento claro de la **encuesta a la ${CLIENT.ownerRole}** (y entonces el "texto" debe reflejar ese fragmento).

Distribución realista típica: 4–7 Must, 3–6 Should, 3–5 Could, 2–4 Won't.
Contexto: ${CLIENT.name} (${CLIENT.serviceShort}, ${CLIENT.ownerFirstName}).${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}`

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
