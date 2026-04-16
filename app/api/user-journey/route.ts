import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { fetchSavedUserPersonas, personaRecordToPlainText } from '@/lib/fetch-saved-user-personas'
import { fetchSavedPovFromSheets, type POVStatement } from '@/lib/fetch-saved-pov'
import { fetchSavedHmwFromSheets } from '@/lib/fetch-saved-hmw'
import { hmwBlockToPlainTextForJourney } from '@/lib/hmw-payload'
import {
  DEFAULT_USER_JOURNEY_CANAL_ID,
  JOURNEY_BASE_CANAL_ID,
  catalogoContainsId,
  defaultJourneyCanalCatalogo,
  ensureBaseChannelInCatalog,
  getCanalPromptFields,
  type CanalPromptFields,
  type JourneyCanalDef,
} from '@/lib/user-journey-channels'
import type { UserJourneySegmento } from '@/lib/user-journey-persist'
import { fetchCeoInterviewPlaintext } from '@/lib/fetch-ceo-interview-plaintext'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function makeJourneySchemas(canal: CanalPromptFields, journeyBaseMode: boolean, esClienteActual: boolean) {
  const contextoEtapa = journeyBaseMode
    ? esClienteActual
      ? `Qué hace, piensa o siente **la persona ya como clienta de MOA** (entrena con Patri) en esta fase del recorrido global. Puede implicar varios puntos de contacto. Contexto: ${canal.focoExperiencia}. Debe rastrearse al HMW; **no** trates el relato como si aún no conociera a MOA salvo que el HMW lo pida explícitamente.`
      : `Qué hace, piensa o siente el usuario en esta fase hacia MOA/Patri en el **recorrido global** (puede implicar varios puntos de contacto). Contexto: ${canal.focoExperiencia}. Debe poder rastrearse hasta ideas concretas del bloque HMW del prompt.`
    : esClienteActual
      ? `Qué hace, piensa o siente **la clienta ya activa** con MOA/Patri en esta fase en ${canal.descripcionCorta}. Contexto: ${canal.focoExperiencia}. Debe rastrearse al HMW; evita narrar descubrimiento o primera toma de contacto salvo que el HMW lo exija.`
      : `Qué hace, piensa o siente el usuario en esta fase en relación con MOA/Patri y ${canal.descripcionCorta}. Contexto: ${canal.focoExperiencia}. Debe poder rastrearse hasta ideas concretas del bloque HMW del prompt.`

  const etapaSchema = z.object({
    orden: z.number().int().min(1).max(12),
    titulo: z
      .string()
      .max(72)
      .describe(
        esClienteActual
          ? 'Nombre corto de la etapa en el viaje **como clienta** (p. ej. "Consulta horarios de la semana", "Escribe a Patri por WhatsApp tras la sesión").'
          : 'Nombre corto de la etapa en el viaje (p. ej. "Descubre el perfil de MOA en Instagram").'
      ),
    descripcion: z.string().max(420).describe(contextoEtapa),
    puntosDeDolor: z
      .array(z.string().max(140))
      .min(1)
      .max(5)
      .describe(
        'Dolores concretos en este paso (fricción, miedo, confusión…). Deben reflejar tensiones alineadas con el HMW, no inventadas al margen del HMW.'
      ),
    rolWebFrenteAlPov: z
      .string()
      .max(260)
      .describe(
        journeyBaseMode
          ? esClienteActual
            ? `Qué debe hacer MOA/Patri para **acompañar a la clienta ya activa** en esta etapa respecto al POV. Campo JSON "rolWebFrenteAlPov" por compatibilidad. Coherente con el HMW; no actúes como si fuera captación salvo que el HMW lo indique.`
            : `Qué debe hacer MOA para acompañar al usuario en esta etapa respecto al POV (contenido, tono, timing, confianza…). El campo JSON se llama "rolWebFrenteAlPov" por compatibilidad: aquí resume el **rol de MOA** en el recorrido (puede abarcar varios medios). Coherente con el HMW.`
          : esClienteActual
            ? `Qué debe hacer MOA en ${canal.descripcionCorta} para la **persona que ya entrena** en esta etapa respecto al POV. Campo JSON "rolWebFrenteAlPov" por compatibilidad. Coherente con el HMW; no centres el relato en "convencer por primera vez" salvo que el HMW lo pida.`
            : `Qué debe hacer MOA en ${canal.descripcionCorta} en esta etapa respecto al POV (contenido, tono, timing…). El nombre del campo en JSON es "rolWebFrenteAlPov" por compatibilidad; describe el rol del **canal ${canal.label}**. Debe ser coherente con las ideas HMW que esta etapa atiende.`
      ),
  })

  const journeyForPersonaSchema = z.object({
    etiquetaPersona: z
      .string()
      .max(90)
      .describe(
        esClienteActual
          ? 'Arquetipo + segmento; deja claro que **ya es clienta** (ej. "María · Clienta MOA / cliente actual").'
          : 'Referencia al arquetipo + segmento, ej. "Ana · Cliente potencial".'
      ),
    etapas: z
      .array(etapaSchema)
      .min(6)
      .max(9)
      .describe(
        journeyBaseMode
          ? esClienteActual
            ? `Etapas en orden para **clienta que ya entrena con Patri**: continuidad, comunicación, resolución de dudas, sensaciones entre sesiones, uso del canal… hasta un cierre coherente (${canal.cierreExperiencia}). Pueden citarse varios medios si el HMW lo permite. **No** hagas por defecto un embudo de "descubrir MOA → primera clase" salvo que el HMW lo describa así.`
            : `Etapas en orden cronológico: desde la necesidad o el problema hasta **contratar o reafirmar** el servicio con MOA (${canal.cierreExperiencia}). Pueden mencionarse varios medios a lo largo del relato. Cada etapa debe **colgar** del HMW.`
          : esClienteActual
            ? `Etapas en orden en **${canal.label}** para quien **ya es clienta** de MOA: uso recurrente del canal durante el servicio (avisos, reservas, dudas, motivación, seguimiento…). Cierre: ${canal.cierreExperiencia}. Cada etapa del HMW de cliente actual; evita narrar captación salvo que el HMW lo exija.`
            : `Etapas en orden cronológico: desde el problema o la necesidad hasta que el usuario ${canal.cierreExperiencia}. Cada etapa debe **colgar** de retos o ideas del HMW (puedes fusionar varias ideas en una etapa, pero sin ignorar el HMW).`
      ),
    etapaOrdenPovResuelto: z
      .number()
      .int()
      .min(1)
      .describe(
        journeyBaseMode
          ? esClienteActual
            ? 'Orden de la etapa en la que MOA aporta **más valor al POV de la clienta ya activa** en este recorrido, sin contradecir el HMW.'
            : 'Orden de la etapa en la que **MOA** aporta MÁS valor al POV en el recorrido global, **sin contradecir** el HMW (momento clave).'
          : esClienteActual
            ? `Orden de la etapa en la que MOA en **${canal.label}** aporta más al POV **en la vida de clienta**, sin contradecir el HMW.`
            : `Orden de la etapa en la que MOA (${canal.label}) aporta MÁS valor al POV, **sin contradecir** el HMW (momento clave).`
      ),
    sintesis: z
      .string()
      .max(300)
      .describe(
        journeyBaseMode
          ? esClienteActual
            ? 'Una frase de cierre sobre **la experiencia como clienta** y el HMW/POV; no como si fuera solo captación.'
            : `Una frase que cierre el relato: cómo el recorrido end-to-end materializa el HMW y encaja con el POV y la persona.`
          : esClienteActual
            ? `Cierre: cómo el uso de ${canal.descripcionCorta} **como clienta** encaja con HMW y POV.`
            : `Una frase que cierre el relato: cómo el recorrido por ${canal.descripcionCorta} materializa las ideas HMW y encaja con el POV y la persona.`
      ),
  })

  return { journeyForPersonaSchema }
}

function buildSystemBase(canal: CanalPromptFields, journeyBaseMode: boolean, esClienteActual: boolean): string {
  const mapaDesc = journeyBaseMode
    ? esClienteActual
      ? `un **User Journey Map base** para **cliente actual**: la persona **ya entrena con Patri / ya es clienta de MOA**. Describe el recorrido end-to-end **en la vida de clienta** (continuidad, motivación, comunicación, resolución de dudas, sensaciones entre sesiones, otros canales de apoyo…) usando **HMW**, **POV** y **User Persona**. No sustituyas esto por un embudo de captación salvo que el HMW lo describa explícitamente.`
      : `un **User Journey Map base**: recorrido **end-to-end** sin centrarse en un solo canal de comunicación. Describe cómo la persona pasa de tener una necesidad a **encontrar a MOA y contratar o reafirmar** el servicio, usando **HMW**, **POV** y **User Persona**. Puedes mencionar varios medios (web, salud, boca a boca, redes…) si encajan con los datos; no fuerces todo el relato por un único medio.`
    : esClienteActual
      ? `un **User Journey Map** en **${canal.label}** (${canal.focoExperiencia}) para **quien ya es clienta** de MOA: cómo vive ese medio **durante el servicio** (antes/durante/después de sesiones, avisos, reservas, dudas, vínculo con Patri…) hasta **${canal.cierreExperiencia}**. No narres por defecto el descubrimiento de MOA o la primera toma de contacto salvo que el HMW de cliente actual lo plantee así.`
      : `un **User Journey Map** para **${canal.label}** (${canal.focoExperiencia}), desde el problema o la necesidad hasta **${canal.cierreExperiencia}**.`

  const requisitoRol = journeyBaseMode
    ? '- Cada etapa: título, descripción, **puntos de dolor** y **rolWebFrenteAlPov** (rol de **MOA** frente al POV en esa fase del recorrido; el nombre del campo es heredado del formato).'
    : `- Cada etapa: título, descripción, **puntos de dolor** y **rolWebFrenteAlPov** (rol de MOA en ${canal.descripcionCorta} frente al POV en esa etapa).`

  return `Eres un UX strategist para MOA (Patri, entrenamiento y salud en Martorell).

## Jerarquía de fuentes (obligatoria)
1. **HOW MIGHT WE (HMW)** — Es la **fuente principal**: las preguntas e ideas del prompt definen **qué retos** cubre el journey y cómo se traducen en **etapas**, **dolores** y el ritmo del relato. Respeta el **orden** de las ideas y las marcas **[mejor]** / **[no viable]** (nunca presentes como solución viable algo marcado como no viable).
2. **POV** — **Complementa** el HMW: acota **dónde** MOA debe aportar más valor al insight de necesidad (etapa \`etapaOrdenPovResuelto\`). No sustituyas retos que solo aparecen en el HMW.
3. **User Persona** — **Complementa** con contexto humano (motivaciones, miedos, contexto vital). No inventes etapas o dolores que contradigan el HMW.

Construyes ${mapaDesc}

${
  esClienteActual
    ? `## ⚠️ Cliente actual (obligatorio)
- La protagonista del mapa **ya entrena con Patri** (clienta activa de MOA).
- Las etapas son el viaje en el **tiempo de cliente**, no un relato genérico de "aún no conoce el gimnasio" salvo que el HMW lo pida.
- Los **puntos de dolor** pueden ser miedos al ejercicio, cansancio, compararse, organizar la semana, comunicación con la entrenadora, etc., **en contexto de ya estar apuntada**.
`
    : `## Cliente potencial
- Describe el camino de quien **aún no** es clienta y acerca el relato a **descubrir / valorar / dar el paso** con MOA según HMW y POV.
`
}

Requisitos:
${requisitoRol}
- **Una** etapa debe marcar con claridad el **momento clave** en que MOA más contribuye al POV, **alineado con el HMW**.
- Español de España, tono profesional y empático.
${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}`
}

function povToLine(label: string, s: POVStatement): string {
  return `${label}: ${s.usuario} necesita ${s.necesidad} porque ${s.insight}.`
}

const ERR_PERSONA = {
  no_sheet: 'No hay hoja de user persona.',
  empty: 'No hay user personas guardados.',
  invalid_json: 'JSON de user persona inválido.',
  invalid_shape: 'User persona incompleto (cliente actual / cliente potencial).',
} as const

const ERR_POV = {
  no_sheet: 'No hay hoja de POV.',
  empty: 'No hay POV guardados.',
  invalid_json: 'JSON de POV inválido.',
  invalid_shape: 'POV incompleto.',
} as const

const ERR_HMW = {
  no_sheet: 'No hay hoja HMW.',
  empty: 'No hay HMW guardado.',
  invalid_json: 'JSON de HMW inválido.',
  invalid_shape: 'HMW incompleto.',
} as const

function parseCatalogo(body: unknown): JourneyCanalDef[] {
  if (!body || typeof body !== 'object') return defaultJourneyCanalCatalogo()
  const raw = (body as Record<string, unknown>).catalogo
  if (!Array.isArray(raw) || raw.length === 0) return defaultJourneyCanalCatalogo()
  const out: JourneyCanalDef[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.label !== 'string') continue
    const id = o.id.trim().slice(0, 48)
    const label = o.label.trim().slice(0, 80)
    if (!id || !label) continue
    out.push({ id, label, esPreset: Boolean(o.esPreset) })
  }
  const list = out.length ? out : defaultJourneyCanalCatalogo()
  return ensureBaseChannelInCatalog(list)
}

export async function POST(req: Request) {
  let canalId: string = DEFAULT_USER_JOURNEY_CANAL_ID
  let segmento: UserJourneySegmento = 'clienteActual'
  let catalogo: JourneyCanalDef[] = defaultJourneyCanalCatalogo()

  try {
    const body = (await req.json()) as Record<string, unknown>
    if (typeof body.canalId === 'string' && body.canalId.trim()) canalId = body.canalId.trim().slice(0, 48)
    if (body.segmento === 'clientePotencial' || body.segmento === 'clienteActual') {
      segmento = body.segmento
    }
    catalogo = parseCatalogo(body)
  } catch {
    /* cuerpo vacío */
  }

  if (!catalogoContainsId(catalogo, canalId)) {
    return NextResponse.json(
      { error: 'El canal seleccionado no está en el catálogo enviado. Recarga la página o vuelve a añadir el canal.' },
      { status: 400 }
    )
  }

  const canal = getCanalPromptFields(canalId, catalogo)
  const journeyBaseMode = canalId === JOURNEY_BASE_CANAL_ID
  const esClienteActual = segmento === 'clienteActual'
  const { journeyForPersonaSchema } = makeJourneySchemas(canal, journeyBaseMode, esClienteActual)

  const hmwSaved = await fetchSavedHmwFromSheets()
  if (!hmwSaved.ok) {
    return NextResponse.json(
      {
        error: `${ERR_HMW[hmwSaved.code]} El User Journey se basa principalmente en el HMW: ve a /hmw y guarda.`,
      },
      { status: 400 }
    )
  }

  const hmwBlock =
    segmento === 'clienteActual'
      ? hmwBlockToPlainTextForJourney(hmwSaved.data.clienteActual, 'Cliente actual').trim()
      : hmwBlockToPlainTextForJourney(hmwSaved.data.clientePotencial, 'Cliente potencial').trim()

  if (!hmwBlock) {
    return NextResponse.json(
      {
        error:
          'El User Journey se basa principalmente en el HMW: completa **ideas con texto** en este segmento en /hmw, guarda, y vuelve a intentar.',
      },
      { status: 400 }
    )
  }

  const personas = await fetchSavedUserPersonas()
  if (!personas.ok) {
    return NextResponse.json(
      { error: `${ERR_PERSONA[personas.code]} Genera y guarda en /user-persona.` },
      { status: 400 }
    )
  }

  const pov = await fetchSavedPovFromSheets()
  if (!pov.ok) {
    return NextResponse.json(
      { error: `${ERR_POV[pov.code]} Genera y guarda en /pov.` },
      { status: 400 }
    )
  }

  const ceoInterview = await fetchCeoInterviewPlaintext()

  const systemBase = buildSystemBase(canal, journeyBaseMode, esClienteActual)

  const personaBlock =
    segmento === 'clienteActual'
      ? personaRecordToPlainText('USER PERSONA — CLIENTE ACTUAL (complemento)', personas.data.clienteActual)
      : personaRecordToPlainText('USER PERSONA — CLIENTE POTENCIAL (complemento)', personas.data.clientePotencial)

  const personaCanales = (() => {
    const p =
      segmento === 'clienteActual' ? personas.data.clienteActual : personas.data.clientePotencial
    const raw = (p as Record<string, unknown>).canalesBusquedaSolucion
    if (!Array.isArray(raw)) return [] as string[]
    return raw
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((s) => s.trim().slice(0, 80))
      .slice(0, 12)
  })()
  const personaCanalesBlock =
    personaCanales.length > 0
      ? `\n\n**Medios que la persona usa para buscar soluciones** (definidos en User Persona, a partir de encuesta + insights):\n${personaCanales.map((c) => `- ${c}`).join('\n')}${
          esClienteActual
            ? '\n\n*(Si es cliente actual: esos medios pueden servir **entre sesiones** para informarse o tranquilizarse; el mapa sigue siendo de **persona ya clienta**.)*'
            : ''
        }`
      : ''

  const povBlock =
    segmento === 'clienteActual'
      ? povToLine('POV — CLIENTE ACTUAL (complemento)', pov.data.clienteActual)
      : povToLine('POV — CLIENTE POTENCIAL (complemento)', pov.data.clientePotencial)

  const segNombre = segmento === 'clienteActual' ? 'CLIENTE ACTUAL' : 'CLIENTE POTENCIAL'
  const hmwTitulo =
    segmento === 'clienteActual'
      ? 'HOW MIGHT WE — fuente principal (cliente actual)'
      : 'HOW MIGHT WE — fuente principal (cliente potencial)'

  const modoIntro = journeyBaseMode
    ? esClienteActual
      ? `Modo: **recorrido base · cliente actual**. La persona **ya entrena con Patri**. El mapa es el viaje end-to-end **como clienta** según **HMW**, **POV** y **persona** (no un embudo de captación por defecto).`
      : `Modo: **recorrido base** (sin un único canal de comunicación). El mapa describe el camino end-to-end hacia MOA según **HMW**, **POV** y **persona**; los mapas por canal concreto se generan aparte.`
    : esClienteActual
      ? `Canal: **${canal.label}** · **Cliente actual**. Mapa del uso de este medio **siendo ya clienta** de MOA; coherente con los hábitos de la persona si aparecen abajo.`
      : `Canal de trabajo: **${canal.label}**. Las etapas deben describir la experiencia en **este** medio; coherente con los hábitos de búsqueda de la persona si aparecen abajo.`

  const prompt = `=== ENTREVISTA — PATRICIA / MOA (modelo de servicio; ceñir el relato a lo que encaje aquí) ===
${ceoInterview}

${modoIntro}

${
  esClienteActual
    ? `**Recordatorio:** segmento **CLIENTE ACTUAL** — asume **relación activa** con MOA/Patri; no reescribas el recorrido como si fuera solo captación salvo que el HMW lo exija.\n\n`
    : ''
}=== ${hmwTitulo} ===
${hmwBlock}

=== POV — complemento ===
${povBlock}

=== USER PERSONA — complemento ===
${personaBlock}${personaCanalesBlock}

===
Devuelve el mapa en "journey".`

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({ journey: journeyForPersonaSchema }),
    system: `${systemBase}

Segmento: **${segNombre}**. Sigue la jerarquía **HMW → POV → User Persona**. ${
      journeyBaseMode
        ? esClienteActual
          ? 'Mapa base para **clienta activa**: end-to-end en la vida de cliente; no fuerces un solo canal ni un embudo de captación por defecto.'
          : 'Este es el **mapa base** (end-to-end); no fuerces un solo canal en todas las etapas.'
        : esClienteActual
          ? `Cliente **actual**: el viaje en **${canal.label}** es **como clienta**; cada etapa debe justificarse con el HMW de este segmento.`
          : `El viaje transcurre en **${canal.label}**; cada etapa debe poder justificarse frente al bloque HMW de este segmento.`
    }`,
    prompt,
  })

  return NextResponse.json({
    canalId,
    segmento,
    journey: object.journey,
  })
}
