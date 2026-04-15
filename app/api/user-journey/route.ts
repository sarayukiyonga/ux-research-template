import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { fetchSavedUserPersonas, personaRecordToPlainText } from '@/lib/fetch-saved-user-personas'
import { fetchSavedPovFromSheets, type POVStatement } from '@/lib/fetch-saved-pov'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const etapaSchema = z.object({
  orden: z.number().int().min(1).max(12),
  titulo: z
    .string()
    .max(72)
    .describe('Nombre corto de la etapa en el viaje (p. ej. "Busca información en Google")'),
  descripcion: z
    .string()
    .max(420)
    .describe(
      'Qué hace, piensa o siente el usuario en esta fase en relación con MOA/Patri y la web (navegación, dudas, contexto).'
    ),
  puntosDeDolor: z
    .array(z.string().max(140))
    .min(1)
    .max(5)
    .describe('Dolores concretos en este paso (fricción, miedo, confusión, carga cognitiva…).'),
  rolWebFrenteAlPov: z
    .string()
    .max(260)
    .describe(
      'Qué debe hacer la web de MOA en esta etapa respecto al POV: pantalla, mensaje, prueba social, CTA, formulario… Si el POV casi no se atiende aquí, dilo ("poco relevante aquí: el usuario solo…").'
    ),
})

const journeyForPersonaSchema = z.object({
  etiquetaPersona: z
    .string()
    .max(90)
    .describe('Referencia al arquetipo + segmento, ej. "María · Cliente actual"'),
  etapas: z
    .array(etapaSchema)
    .min(6)
    .max(9)
    .describe(
      'Etapas en orden cronológico: desde que tiene el problema o la necesidad hasta cerrar o abandonar la sesión en la web (salida). Incluye descubrimiento, consideración, decisión, uso post-conversión si aplica.'
    ),
  etapaOrdenPovResuelto: z
    .number()
    .int()
    .min(1)
    .describe(
      'El valor de "orden" de la etapa en la que la web de MOA aporta MÁS valor al POV (momento clave). Debe existir una etapa con ese orden.'
    ),
  sintesis: z
    .string()
    .max(300)
    .describe('Una frase que enlaza el viaje con el POV y el objetivo de la web.'),
})

function povToLine(label: string, s: POVStatement): string {
  return `${label}: ${s.usuario} necesita ${s.necesidad} porque ${s.insight}.`
}

const ERR_PERSONA = {
  no_sheet: 'No hay hoja de user persona.',
  empty: 'No hay user personas guardados.',
  invalid_json: 'JSON de user persona inválido.',
  invalid_shape: 'User persona incompleto (clienteActual / clientePotencial).',
} as const

const ERR_POV = {
  no_sheet: 'No hay hoja de POV.',
  empty: 'No hay POV guardados.',
  invalid_json: 'JSON de POV inválido.',
  invalid_shape: 'POV incompleto.',
} as const

export async function POST() {
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

  const systemBase = `Eres un UX strategist para MOA (Patri, entrenamiento y salud en Martorell).

Debes construir un **User Journey Map** centrado en la **experiencia con la web** de moa.cat (o el sitio principal de MOA): etapas ordenadas desde que la persona tiene el problema/necesidad hasta que **sale de la web** (cierra, abandona o completa la visita).

Requisitos:
- Cada etapa tiene título, descripción del momento, **puntos de dolor específicos** y un campo **rolWebFrenteAlPov**: en qué medida esta pantalla/flujo de la web **responde al POV** dado (o prepara la resolución).
- Indica con claridad en **una** etapa el **momento exacto** en que la web más contribuye a resolver el POV (coherente con necesidad + insight del POV).
- Etapas realistas para una web de centro de entrenamiento / reservas / confianza (no inventes productos que no existan; puedes nombrar genéricamente: inicio, servicios, quién es Patri, testimonios, contacto/reserva).
- Español de España, tono profesional y empático.`

  const textoPersonaActual = personaRecordToPlainText(
    'USER PERSONA — CLIENTE ACTUAL',
    personas.data.clienteActual
  )
  const povActual = povToLine('POV — CLIENTE ACTUAL', pov.data.clienteActual)

  const { object: clienteActual } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({ journey: journeyForPersonaSchema }),
    system: `${systemBase}

Contexto: **CLIENTE ACTUAL** (ya conoce o entrena con Patri). El viaje en web puede incluir renovar confianza, consultar horarios, leer novedades, contactar… No copies el POV literal en cada etapa; úsalo como brújula.`,
    prompt: `=== USER PERSONA (solo cliente actual) ===\n${textoPersonaActual}\n\n=== POV (solo cliente actual) ===\n${povActual}\n\n===\nDevuelve el mapa en "journey".`,
  })

  const textoPersonaPotencial = personaRecordToPlainText(
    'USER PERSONA — CLIENTE POTENCIAL',
    personas.data.clientePotencial
  )
  const povPotencial = povToLine('POV — CLIENTE POTENCIAL', pov.data.clientePotencial)

  const { object: clientePotencial } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({ journey: journeyForPersonaSchema }),
    system: `${systemBase}

Contexto: **CLIENTE POTENCIAL** (aún no es clienta; compara, duda, busca encaje). El viaje suele ir de descubrimiento a decisión de contacto/prueba. El POV guía dónde la web debe generar confianza.`,
    prompt: `=== USER PERSONA (solo cliente potencial) ===\n${textoPersonaPotencial}\n\n=== POV (solo cliente potencial) ===\n${povPotencial}\n\n===\nDevuelve el mapa en "journey".`,
  })

  return NextResponse.json({
    clienteActual: clienteActual.journey,
    clientePotencial: clientePotencial.journey,
  })
}
