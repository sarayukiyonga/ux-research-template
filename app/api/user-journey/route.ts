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
import { CLIENT_AI_SERVICE_CONTEXT } from '@/lib/client-ai-service-context'
import { CLIENT } from '@/lib/client-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function makeJourneySchemas(canal: CanalPromptFields, journeyBaseMode: boolean, esClienteActual: boolean) {
  const contextoEtapa = journeyBaseMode
    ? esClienteActual
      ? `Qué hace, piensa o siente **la persona ya como clienta de ${CLIENT.name}** (relación con ${CLIENT.ownerFirstName}) en esta fase del recorrido global. Puede implicar varios puntos de contacto. Contexto: ${canal.focoExperiencia}. Debe rastrearse al HMW; **no** trates el relato como si aún no conociera a ${CLIENT.name} salvo que el HMW lo pida explícitamente.`
      : `Qué hace, piensa o siente el usuario en esta fase hacia ${CLIENT.name} / ${CLIENT.ownerFirstName} en el **recorrido global** (puede implicar varios puntos de contacto). Contexto: ${canal.focoExperiencia}. Debe poder rastrearse hasta ideas concretas del bloque HMW del prompt.`
    : esClienteActual
      ? `Qué hace, piensa o siente **la clienta ya activa** con ${CLIENT.name} / ${CLIENT.ownerFirstName} en esta fase en ${canal.descripcionCorta}. Contexto: ${canal.focoExperiencia}. Debe rastrearse al HMW; evita narrar descubrimiento o primera toma de contacto salvo que el HMW lo exija.`
      : `Qué hace, piensa o siente el usuario en esta fase en relación con ${CLIENT.name} / ${CLIENT.ownerFirstName} y ${canal.descripcionCorta}. Contexto: ${canal.focoExperiencia}. Debe poder rastrearse hasta ideas concretas del bloque HMW del prompt.`

  const etapaSchema = z.object({
    orden: z.number().int().min(1).max(12),
    titulo: z
      .string()
      .max(72)
      .describe(
        esClienteActual
          ? `Nombre corto de la etapa en el viaje **como clienta** (p. ej. "Consulta horarios de la semana", "Escribe a ${CLIENT.ownerFirstName} por WhatsApp tras la sesión").`
          : `Nombre corto de la etapa en el viaje (p. ej. "Descubre el perfil de ${CLIENT.name} en Instagram").`
      ),
    descripcion: z.string().max(420).describe(contextoEtapa),
    puntosDeDolor: z
      .array(z.string().max(140))
      .min(1)
      .max(5)
      .describe(
        'Dolores concretos en este paso (fricción, miedo, confusión…). Deben reflejar tensiones alineadas con el HMW, no inventadas al margen del HMW.'
      ),
    canalesDeMarketing: z
      .string()
      .max(260)
      .describe(
        journeyBaseMode
          ? 'Canales de marketing y contacto relevantes en esta etapa del recorrido (boca a boca, Instagram, web, WhatsApp, email…). Enumera los principales separados por " / ".'
          : `Canales de marketing y contacto relevantes en esta etapa para ${canal.descripcionCorta} (boca a boca, Instagram, web, WhatsApp, email…). Enumera los principales separados por " / ".`
      ),
    rolWebFrenteAlPov: z
      .string()
      .max(260)
      .describe(
        journeyBaseMode
          ? esClienteActual
            ? `Oportunidad/rol de ${CLIENT.name} (y ${CLIENT.ownerFirstName}) para **acompañar a la clienta ya activa** en esta etapa respecto al POV: qué debe aportar, decir o facilitar (contenido, tono, timing, confianza…). Campo JSON "rolWebFrenteAlPov" por compatibilidad (no implica "web"). Coherente con el HMW; no lo enfoques como captación salvo que el HMW lo indique.`
            : `Oportunidad/rol de ${CLIENT.name} en esta etapa respecto al POV: qué debe aportar, decir o facilitar (contenido, tono, timing, confianza…). El campo JSON se llama "rolWebFrenteAlPov" por compatibilidad (no implica "web"): aquí resume el **rol de ${CLIENT.name}** en el recorrido global (puede abarcar varios medios). Coherente con el HMW.`
          : esClienteActual
            ? `Oportunidad/rol del canal **${canal.label}** para la **persona que ya entrena** en esta etapa respecto al POV: qué debe aportar ese medio (contenido, tono, timing, confianza…). Campo JSON "rolWebFrenteAlPov" por compatibilidad. Coherente con el HMW; no centres el relato en "convencer por primera vez" salvo que el HMW lo pida.`
            : `Oportunidad/rol del canal **${canal.label}** en esta etapa respecto al POV: qué debe aportar ese medio (contenido, tono, timing, confianza…). El nombre del campo en JSON es "rolWebFrenteAlPov" por compatibilidad; describe el rol del **canal ${canal.label}**. Debe ser coherente con las ideas HMW que esta etapa atiende.`
      ),
  })

  const journeyForPersonaSchema = z.object({
    etiquetaPersona: z
      .string()
      .max(90)
      .describe(
        esClienteActual
          ? `Arquetipo + segmento; deja claro que **ya es clienta** (ej. "María · Clienta ${CLIENT.name} / cliente actual").`
          : 'Referencia al arquetipo + segmento, ej. "Ana · Cliente potencial".'
      ),
    etapas: z
      .array(etapaSchema)
      .min(6)
      .max(9)
      .describe(
        journeyBaseMode
          ? esClienteActual
            ? `Etapas en orden para **clienta que ya entrena con ${CLIENT.ownerFirstName}**: continuidad, comunicación, resolución de dudas, sensaciones entre sesiones, uso del canal… hasta un cierre coherente (${canal.cierreExperiencia}). Pueden citarse varios medios si el HMW lo permite. **No** hagas por defecto un embudo de "descubrir ${CLIENT.name} → primera clase" salvo que el HMW lo describa así.`
            : `Etapas en orden cronológico: desde la necesidad o el problema hasta **contratar o reafirmar** el servicio con ${CLIENT.name} (${canal.cierreExperiencia}). Pueden mencionarse varios medios a lo largo del relato. Cada etapa debe **colgar** del HMW.`
          : esClienteActual
            ? `Etapas en orden en **${canal.label}** para quien **ya es clienta** de ${CLIENT.name}: uso recurrente del canal durante el servicio (avisos, reservas, dudas, motivación, seguimiento…). Cierre: ${canal.cierreExperiencia}. Cada etapa del HMW de cliente actual; evita narrar captación salvo que el HMW lo exija.`
            : `Etapas en orden cronológico: desde el problema o la necesidad hasta que el usuario ${canal.cierreExperiencia}. Cada etapa debe **colgar** de retos o ideas del HMW (puedes fusionar varias ideas en una etapa, pero sin ignorar el HMW).`
      ),
    etapaOrdenPovResuelto: z
      .number()
      .int()
      .min(1)
      .describe(
        journeyBaseMode
          ? esClienteActual
            ? `Orden de la etapa en la que ${CLIENT.name} aporta **más valor al POV de la clienta ya activa** en este recorrido, sin contradecir el HMW.`
            : `Orden de la etapa en la que **${CLIENT.name}** aporta MÁS valor al POV en el recorrido global, **sin contradecir** el HMW (momento clave).`
          : esClienteActual
            ? `Orden de la etapa en la que ${CLIENT.name} en **${canal.label}** aporta más al POV **en la vida de clienta**, sin contradecir el HMW.`
            : `Orden de la etapa en la que ${CLIENT.name} (${canal.label}) aporta MÁS valor al POV, **sin contradecir** el HMW (momento clave).`
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
      ? `un **User Journey Map base** para **cliente actual**: la persona **ya entrena con ${CLIENT.ownerFirstName} / ya es clienta de ${CLIENT.name}**. Describe el recorrido end-to-end **en la vida de clienta** (continuidad, motivación, comunicación, resolución de dudas, sensaciones entre sesiones, otros canales de apoyo…) usando **HMW**, la **encuesta CEO** del prompt, **POV** y **User Persona**. No sustituyas esto por un embudo de captación salvo que el HMW lo describa explícitamente.`
      : `un **User Journey Map base**: recorrido **end-to-end** sin centrarse en un solo canal de comunicación. Describe cómo la persona pasa de tener una necesidad a **encontrar a ${CLIENT.name} y contratar o reafirmar** el servicio, usando **HMW**, la **encuesta CEO** del prompt, **POV** y **User Persona**. Puedes mencionar varios medios (web, salud, boca a boca, redes…) si encajan con los datos; no fuerces todo el relato por un único medio.`
    : esClienteActual
      ? `un **User Journey Map** en **${canal.label}** (${canal.focoExperiencia}) para **quien ya es clienta** de ${CLIENT.name}: cómo vive ese medio **durante el servicio** (antes/durante/después de sesiones, avisos, reservas, dudas, vínculo con ${CLIENT.ownerFirstName}…) hasta **${canal.cierreExperiencia}**. Ancla límites y realismo del servicio a la **encuesta CEO** del prompt. No narres por defecto el descubrimiento de ${CLIENT.name} o la primera toma de contacto salvo que el HMW de cliente actual lo plantee así.`
      : `un **User Journey Map** para **${canal.label}** (${canal.focoExperiencia}), desde el problema o la necesidad hasta **${canal.cierreExperiencia}**. Ancla límites y realismo del servicio a la **encuesta CEO** del prompt.`

  const requisitoRol = journeyBaseMode
    ? `- Cada etapa: título, descripción, **puntos de dolor** y **rolWebFrenteAlPov** (oportunidad/rol de **${CLIENT.name}** frente al POV en esa fase del recorrido global; el nombre del campo es heredado del formato y no implica "web").`
    : `- Cada etapa: título, descripción, **puntos de dolor** y **rolWebFrenteAlPov** (oportunidad/rol del canal **${canal.label}** frente al POV en esa etapa; el nombre del campo es heredado del formato).`

  return `Eres un UX strategist para ${CLIENT.name} (${CLIENT.ownerFirstName}, ${CLIENT.sector} en ${CLIENT.location}).

## Jerarquía de fuentes (obligatoria)
1. **HOW MIGHT WE (HMW)** — Es la **fuente principal** del relato: las preguntas e ideas del prompt definen **qué retos** cubre el journey y cómo se traducen en **etapas**, **dolores** y el ritmo del relato. Respeta el **orden** de las ideas y las marcas **[mejor]** / **[no viable]** (nunca presentes como solución viable algo marcado como no viable).
2. **Encuesta / entrevista a la ${CLIENT.ownerRole} (${CLIENT.ownerFirstName})** — El bloque **ENTREVISTA** al inicio del mensaje de usuario resume la **encuesta guiada** en Sheets. Es **fuente de verdad** para modelo de negocio, operación presencial vs digital, prioridades, tono y límites. Úsala para dar **realismo** a etapas, canales y dolores; **no contradigas** lo que afirme de forma explícita.
3. **POV** — **Complementa** el HMW: acota **dónde** ${CLIENT.name} debe aportar más valor al insight de necesidad (etapa \`etapaOrdenPovResuelto\`). No sustituyas retos que solo aparecen en el HMW; mantén **coherencia** con la encuesta CEO si hay tensión, priorizando CEO en datos de negocio y HMW/POV en la experiencia de usuario.
4. **User Persona** — **Complementa** con contexto humano (motivaciones, miedos, contexto vital). No inventes etapas o dolores que contradigan el HMW.

Construyes ${mapaDesc}

${
  esClienteActual
    ? `## ⚠️ Cliente actual (obligatorio)
- La protagonista del mapa **ya entrena con ${CLIENT.ownerFirstName}** (clienta activa de ${CLIENT.name}).
- Las etapas son el viaje en el **tiempo de cliente**, no un relato genérico de "aún no conoce el gimnasio" salvo que el HMW lo pida.
- Los **puntos de dolor** pueden ser miedos al ejercicio, cansancio, compararse, organizar la semana, comunicación con la entrenadora, etc., **en contexto de ya estar apuntada**.
`
    : `## Cliente potencial
- Describe el camino de quien **aún no** es clienta y acerca el relato a **descubrir / valorar / dar el paso** con ${CLIENT.name} según HMW y POV.
`
}

Requisitos:
${requisitoRol}
- **Una** etapa debe marcar con claridad el **momento clave** en que ${CLIENT.name} más contribuye al POV, **alineado con el HMW** y coherente con la **encuesta CEO** cuando trate de promesas o límites del servicio.
- Español de España, tono profesional y empático.
${CLIENT_AI_SERVICE_CONTEXT}`
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
      ? `Modo: **todos los canales · cliente actual**. La persona **ya entrena con ${CLIENT.ownerFirstName}**. El mapa es el viaje end-to-end **como clienta** según **HMW**, la **encuesta CEO** (arriba), **POV** y **persona** (no un embudo de captación por defecto).`
      : `Modo: **todos los canales** (sin un único medio de comunicación). El mapa describe el camino end-to-end hacia ${CLIENT.name} según **HMW**, la **encuesta CEO** (arriba), **POV** y **persona**; los mapas por canal concreto se generan aparte.`
    : esClienteActual
      ? `Canal: **${canal.label}** · **Cliente actual**. Mapa del uso de este medio **siendo ya clienta** de ${CLIENT.name}; coherente con la **encuesta CEO** (arriba) y los hábitos de la persona si aparecen abajo.`
      : `Canal de trabajo: **${canal.label}**. Las etapas deben describir la experiencia en **este** medio; coherente con la **encuesta CEO** (arriba) y los hábitos de búsqueda de la persona si aparecen abajo.`

  const prompt = `=== ENCUESTA / ENTREVISTA A LA ${CLIENT.ownerRole.toUpperCase()} (${CLIENT.ownerFirstName}) — modelo de servicio y negocio ===
${ceoInterview}

${modoIntro}

${
  esClienteActual
    ? `**Recordatorio:** segmento **CLIENTE ACTUAL** — asume **relación activa** con ${CLIENT.name} / ${CLIENT.ownerFirstName}; no reescribas el recorrido como si fuera solo captación salvo que el HMW lo exija.\n\n`
    : ''
}=== ${hmwTitulo} ===
${hmwBlock}

=== POV — complemento ===
${povBlock}

=== USER PERSONA — complemento ===
${personaBlock}${personaCanalesBlock}

===
Ceñe etapas, dolores y rol de ${CLIENT.name} a la **encuesta CEO** cuando defina límites, formato del servicio o prioridades; no inventes ofertas que contradigan ese bloque.
Devuelve el mapa en "journey".`

  const { object } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({ journey: journeyForPersonaSchema }),
    system: `${systemBase}

Segmento: **${segNombre}**. Sigue la jerarquía **HMW → encuesta CEO → POV → User Persona**. ${
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
