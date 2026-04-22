import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { hmwIaContextToMarkdown, loadHmwIaContextOrFail } from '@/lib/hmw-ia-context'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'
import { CLIENT } from '@/lib/client-config'
import {
  HMW_MARCA_MOTIVO_MAX_LEN,
  HMW_RESPUESTAS_MAX,
  enforceSingleMejor,
  normalizeHmwPayload,
  normalizeRespuestasList,
  syncMarcaMotivosToRespuestas,
  syncMarcasToRespuestas,
  type HMWItem,
  type HMWQuestionsPayload,
  type HMWRespuestaMarca,
} from '@/lib/hmw-payload'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const marcaIaSchema = z.enum(['ninguna', 'mejor', 'no_viable'])

function blockSchemaIa(itemCount: number) {
  return z
    .array(
      z.object({
        respuestas: z.array(z.string().max(2000)).length(HMW_RESPUESTAS_MAX),
        respuestasMarcas: z.array(marcaIaSchema).length(HMW_RESPUESTAS_MAX),
        respuestasMarcaMotivos: z.array(z.string().max(HMW_MARCA_MOTIVO_MAX_LEN)).length(HMW_RESPUESTAS_MAX),
      })
    )
    .length(itemCount)
}

function mapMarcaIa(v: z.infer<typeof marcaIaSchema>): HMWRespuestaMarca | null {
  if (v === 'ninguna') return null
  return v
}

/** Sin texto → sin marca; si no queda ninguna "mejor" pero hay ideas, marca la primera no vacía. */
function refineMarcasForTexts(
  normText: string[],
  mapped: Array<HMWRespuestaMarca | null>
): Array<HMWRespuestaMarca | null> {
  const out = mapped.map((m, j) => (!normText[j]?.trim() ? null : m))
  let fixed = enforceSingleMejor(out)
  if (!fixed.some((m) => m === 'mejor') && normText.some((t) => t.trim())) {
    const fi = normText.findIndex((t) => t.trim())
    if (fi >= 0) {
      const copy = [...fixed]
      copy[fi] = 'mejor'
      fixed = enforceSingleMejor(copy)
    }
  }
  return fixed
}

/** Igual número de preguntas; cada una con exactamente `HMW_RESPUESTAS_MAX` huecos para el prompt y el modelo. */
function padQuestionsToIaSlots(q: HMWQuestionsPayload): HMWQuestionsPayload {
  const padItem = (it: HMWItem): HMWItem => {
    const r = [...it.respuestas]
    while (r.length < HMW_RESPUESTAS_MAX) r.push('')
    if (r.length > HMW_RESPUESTAS_MAX) r.length = HMW_RESPUESTAS_MAX
    const m = [...(it.respuestasMarcas ?? [])]
    while (m.length < r.length) m.push(null)
    m.length = r.length
    const mot = [...(it.respuestasMarcaMotivos ?? [])]
    while (mot.length < r.length) mot.push('')
    mot.length = r.length
    return { ...it, respuestas: r, respuestasMarcas: enforceSingleMejor(m), respuestasMarcaMotivos: mot }
  }
  return {
    clienteActual: q.clienteActual.map(padItem),
    clientePotencial: q.clientePotencial.map(padItem),
  }
}

type AiRespuestasRow = {
  respuestas: string[]
  respuestasMarcas: Array<z.infer<typeof marcaIaSchema>>
  respuestasMarcaMotivos: string[]
}

function mergeRespuestasFromAi(
  target: HMWQuestionsPayload,
  ai: {
    clienteActual?: AiRespuestasRow[]
    clientePotencial?: AiRespuestasRow[]
  },
  onlyBlock?: 'clienteActual' | 'clientePotencial' | null
): HMWQuestionsPayload {
  const mapBlock = (block: 'clienteActual' | 'clientePotencial') =>
    target[block].map((it, i) => {
      const row = ai[block]?.[i]
      const got = [...(row?.respuestas ?? [])]
      while (got.length < HMW_RESPUESTAS_MAX) got.push('')
      got.length = HMW_RESPUESTAS_MAX
      const normText = normalizeRespuestasList(got)
      const rawM = row?.respuestasMarcas ?? []
      const mapped: Array<HMWRespuestaMarca | null> = []
      for (let j = 0; j < normText.length; j++) {
        mapped[j] = mapMarcaIa(rawM[j] ?? 'ninguna')
      }
      const refined = refineMarcasForTexts(normText, mapped)
      const marcas = syncMarcasToRespuestas(normText, refined)
      const rawMot = row?.respuestasMarcaMotivos ?? []
      const motivosFromAi = Array.from({ length: normText.length }, (_, j) => {
        const t = (rawMot[j] ?? '').trim().slice(0, HMW_MARCA_MOTIVO_MAX_LEN)
        return t || null
      })
      const motivos = syncMarcaMotivosToRespuestas(normText.length, refined, motivosFromAi)
      const next: HMWItem = { ...it, respuestas: normText }
      if (marcas) next.respuestasMarcas = marcas
      else delete next.respuestasMarcas
      if (motivos) next.respuestasMarcaMotivos = motivos
      else delete next.respuestasMarcaMotivos
      return next
    })

  if (onlyBlock === 'clienteActual' || onlyBlock === 'clientePotencial') {
    return {
      ...target,
      [onlyBlock]: mapBlock(onlyBlock),
    }
  }
  return {
    clienteActual: mapBlock('clienteActual'),
    clientePotencial: mapBlock('clientePotencial'),
  }
}

function listQuestionsForPrompt(blockLabel: string, items: HMWItem[]): string {
  if (items.length === 0) return `(No hay preguntas en el bloque «${blockLabel}».)`
  return items
    .map((it, i) => {
      return `${i + 1}. ${it.pregunta}\n   → En "respuestas" debes devolver **exactamente ${HMW_RESPUESTAS_MAX}** cadenas: ideas **distintas** de diseño digital / web / UX / comunicación / confianza / onboarding. Rellena las que tengan sentido; si sobran ranuras, pon "" al final. **Ordena** esas cadenas (índice 0 = máxima prioridad) según las reglas de ordenación globales indicadas abajo.\n   → En "respuestasMarcas" la **misma longitud**: por cada posición, \`mejor\` (solo una por pregunta: la de mayor impacto+viabilidad), \`no_viable\` si esa idea es claramente inviable para ${CLIENT.ownerFirstName}, o \`ninguna\` en el resto. Las posiciones con texto "" deben llevar \`ninguna\`.\n   → En "respuestasMarcaMotivos" la **misma longitud**: en cada índice, cadena vacía "" si la marca es \`ninguna\`; si es \`mejor\`, 2–4 frases en español explicando impacto + viabilidad; si es \`no_viable\`, 1–3 frases explicando por qué se descarta.`
    })
    .join('\n\n')
}

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON no válido.' }, { status: 400 })
  }

  const rawBody = body as Record<string, unknown>
  const rawQuestions = rawBody?.questions
  const questions = normalizeHmwPayload(rawQuestions)
  if (!questions) {
    return NextResponse.json({ error: 'Falta "questions" con el HMW actual o el formato no es válido.' }, { status: 400 })
  }

  const segmento =
    rawBody.segmento === 'clienteActual' || rawBody.segmento === 'clientePotencial' ? rawBody.segmento : null

  const loaded = await loadHmwIaContextOrFail()
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.message }, { status: 400 })
  }

  const contextMd = hmwIaContextToMarkdown(loaded.ctx)

  const questionsForIa = padQuestionsToIaSlots(questions)

  const schema =
    segmento === 'clienteActual'
      ? z.object({ clienteActual: blockSchemaIa(questionsForIa.clienteActual.length) })
      : segmento === 'clientePotencial'
        ? z.object({ clientePotencial: blockSchemaIa(questionsForIa.clientePotencial.length) })
        : z.object({
            clienteActual: blockSchemaIa(questionsForIa.clienteActual.length),
            clientePotencial: blockSchemaIa(questionsForIa.clientePotencial.length),
          })

  const bloqueActual = `## Bloque CLIENTE ACTUAL — preguntas HMW (rellena solo "respuestas" por índice)
${listQuestionsForPrompt('cliente actual', questionsForIa.clienteActual)}`

  const bloquePotencial = `## Bloque CLIENTE POTENCIAL — preguntas HMW
${listQuestionsForPrompt('cliente potencial', questionsForIa.clientePotencial)}`

  const tareasBloque =
    segmento === 'clienteActual'
      ? `Solo rellena el bloque **CLIENTE ACTUAL**. Devuelve JSON con un único array "clienteActual" con la **misma longitud** que las preguntas de ese bloque.`
      : segmento === 'clientePotencial'
        ? `Solo rellena el bloque **CLIENTE POTENCIAL**. Devuelve JSON con un único array "clientePotencial" con la **misma longitud** que las preguntas de ese bloque.`
        : `Devuelve JSON con dos arrays (clienteActual, clientePotencial) con la **misma longitud** que las listas de arriba.`

  const userPrompt = `Eres en ${CLIENT.name} (${CLIENT.ownerFirstName}, ${CLIENT.sector} en ${CLIENT.location}). Tienes que rellenar las **respuestas / notas de diseño** de cada pregunta HMW ya definida, sin cambiar el enunciado de las preguntas.

${contextMd}

---

${segmento === 'clientePotencial' ? '' : `${bloqueActual}\n\n---\n\n`}
${segmento === 'clienteActual' ? '' : `${bloquePotencial}\n\n---\n\n`}
Instrucciones finales:
- ${tareasBloque} Para **cada** pregunta del bloque a rellenar: **"respuestas"**, **"respuestasMarcas"** y **"respuestasMarcaMotivos"** (los tres con **exactamente ${HMW_RESPUESTAS_MAX}** elementos).
- En **respuestasMarcas**: usa **exactamente una** vez \`mejor\` por pregunta (la respuesta que recomiendas priorizar), salvo que todas las cadenas de respuesta sean vacías (entonces todas \`ninguna\`). Marca como \`no_viable\` cada idea que ${CLIENT.ownerFirstName} deba descartar por coste/tiempo/riesgo; el resto \`ninguna\`. Una misma posición no puede ser \`mejor\` y \`no_viable\` a la vez (elige una).
- En **respuestasMarcaMotivos**: coherente con cada marca; solo texto útil donde haya \`mejor\` o \`no_viable\`; "" en el resto. En los motivos **no afirmes** que ${CLIENT.ownerFirstName} ya tiene web, app o plataforma si eso **no** aparece de forma explícita en el contexto de arriba.
- Para **todas** las preguntas aplica el mismo criterio: genera **hasta ${HMW_RESPUESTAS_MAX} ideas distintas** cuando el contexto lo permita; no te quedes en una sola si puedes aportar más ángulos útiles (p. ej. UX, contenido, confianza, accesibilidad, captación).
- Cada texto: ideas concretas de producto digital / web / UX / comunicación / confianza / onboarding; tono profesional en español; sin repetir literalmente el POV entero; alinea con mapa de empatía y user persona del **mismo** segmento (actual vs potencial).
- Usa "" solo en ranuras finales que no puedas rellenar con una idea útil (evita duplicar o rellenar ruido).

### Ordenación obligatoria del array "respuestas" (de la posición 0 a la ${HMW_RESPUESTAS_MAX - 1})
Tras redactar las ideas, **reordénalas** antes de devolver el JSON. La posición **0** es la de **máxima prioridad** para ${CLIENT.ownerFirstName}. Criterio en **cascada** (primero el 1, luego el 2):
1. **Impacto para la persona usuaria** (la cliente tipo del bloque: p. ej. Marta en clientes actuales, o el arquetipo de potencial en el otro bloque, según persona/mapa/POV): ¿la solución **le resuelve de verdad** el problema, necesidad o frustración que describe el contexto? Las ideas con **más impacto real para ella** van **antes**.
2. **Factibilidad técnica y de negocio para ${CLIENT.ownerFirstName} / ${CLIENT.name}**: entre ideas de impacto parecido, coloca **antes** las que ${CLIENT.ownerFirstName} pueda **implementar con menos riesgo** (tiempo disponible, coste, complejidad técnica, carga operativa, sostenibilidad del negocio). Penaliza propuestas que la dejen “arruinada” o con un coste de tiempo desproporcionado.

Las cadenas vacías "" solo al final del array, nunca intercaladas entre ideas con texto.`

  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema,
      system:
        `Eres un diseñador de producto digital senior en ${CLIENT.name} (${CLIENT.ownerFirstName}, ${CLIENT.location}). Respondes solo con el JSON pedido; español neutro o de España. En cada pregunta: "respuestas" ordenadas por prioridad (impacto usuaria, luego viabilidad ${CLIENT.ownerFirstName}); "respuestasMarcas" con exactamente una "mejor" y "no_viable" en ideas inviables; "respuestasMarcaMotivos" con explicaciones breves solo donde corresponda. No inventes canales digitales ni "plataforma existente" que no figuren en el contexto del prompt.` +
        MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO,
      prompt: userPrompt,
    })

    const merged = mergeRespuestasFromAi(questions, object, segmento)
    return NextResponse.json({ questions: merged })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ error: `No se pudieron generar las respuestas con IA: ${msg}` }, { status: 500 })
  }
}
