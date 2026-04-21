import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { fetchSavedUserPersonas, personaRecordToPlainText } from '@/lib/fetch-saved-user-personas'
import { MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO } from '@/lib/moa-ai-contexto-servicio'
import { CLIENT } from '@/lib/client-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const necesidadField = z
  .string()
  .max(100)
  .describe('Necesidad en infinitivo o frase verbal concreta, coherente con motivaciones/necesidades del persona')

const insightField = z
  .string()
  .max(150)
  .describe('Hallazgo profundo (dolor, contexto, emoción) alineado con el persona y su frase')

/** El front concatena: "[usuario] necesita [necesidad] porque [insight]." — usuario = solo sujeto, sin subordinadas finales. */
const USUARIO_MAX = 120

const statementSchemaActual = z.object({
  usuario: z
    .string()
    .max(USUARIO_MAX)
    .describe(
      'SOLO el sujeto del enunciado (arquetipo: nombre o rol + edad y un matiz breve). La app une después la palabra "necesita". ' +
        'PROHIBIDO terminar en subordinadas: no uses al final "que", "que ya", "quien", "a la que", comas + "ya", etc. ' +
        'Ejemplo válido: "Marta, 48 años, administrativa, clienta de Patri en Martorell". ' +
        'Ejemplo inválido: "Una clienta que ya" (sobra antes de "necesita").'
    ),
  necesidad: necesidadField,
  insight: insightField,
})

const statementSchemaPotencial = z.object({
  usuario: z
    .string()
    .max(USUARIO_MAX)
    .describe(
      'SOLO el sujeto del enunciado (arquetipo + edad y un matiz breve). La app une después "necesita". ' +
        'PROHIBIDO terminar en "que busca", "que busca un", "que busca un ambiente", "que busca un ambiente a", etc. ' +
        'Lo de buscar ambiente / local / centro va en necesidad o insight, no en usuario. ' +
        'Ejemplo válido: "Carlos, 61 años, jubilado en Martorell".'
    ),
  necesidad: necesidadField,
  insight: insightField,
})

const ERR: Record<string, string> = {
  no_sheet: 'No hay hoja de user persona guardada.',
  empty: 'No hay user personas guardados. Genera y guarda los perfiles en la página User Persona.',
  invalid_json: 'No se pudieron leer los user personas guardados.',
  invalid_shape: 'Los user personas guardados no tienen el formato esperado (clienteActual / clientePotencial).',
}

const SYSTEM_CLIENTE_ACTUAL = `Eres un UX researcher experto en Design Thinking (Point of View) para ${CLIENT.name} (${CLIENT.ownerFirstName} como ${CLIENT.ownerRole}, ${CLIENT.sector} en ${CLIENT.location}).

Contexto que NO debes confundir: el documento describe al **CLIENTE ACTUAL** — persona que **ya** entrena con Patri o ya forma parte de su comunidad de clientas. No es un prospecto que está valorando si ir al gimnasio.

Genera UNA declaración POV con tres campos: usuario, necesidad, insight.

Formato mental: [Usuario] necesita [Necesidad] porque [Insight].

CRÍTICO — Los tres campos se concatenan en una sola frase en la interfaz. El campo **usuario** es únicamente el **sujeto** (sustantivo / arquetipo); **nunca** lleve al final "que…", "que ya…", ni verbo: eso rompe la lectura delante de la palabra fija **"necesita"**.

Reglas solo para CLIENTE ACTUAL:
- usuario: arquetipo concreto (edad, ocupación, ciudad); la idea de "ya es clienta" se infiere del segmento, **no** la escribas como "que ya" al final del usuario.
- necesidad: infinitivos o frases verbales de **continuidad, adherencia, sentirse acompañada, no perder progreso, gestionar su salud con guía conocida, encajar el servicio en su vida**. Evita redacciones de descubrimiento ("conocer ${CLIENT.name}", "decidir si ${CLIENT.ownerFirstName} encaja", "probar un centro nuevo") — eso sería cliente potencial.
- insight: emoción o contexto que encaje con **quien ya confía en ${CLIENT.ownerFirstName}** (miedo a retroceder, cansancio con otros modelos, valor del grupo, vergüenza o limitación física que ${CLIENT.ownerFirstName} ya conoce, etc.), tomado del persona.

Solo usa el bloque de texto que te damos. Español natural y conciso.`

const SYSTEM_CLIENTE_POTENCIAL = `Eres un UX researcher experto en Design Thinking (Point of View) para ${CLIENT.name} (${CLIENT.ownerFirstName}, ${CLIENT.location}).

Contexto: el documento describe al **CLIENTE POTENCIAL** — persona que **aún no** es clienta de Patri; podría valorar MOA frente a otras opciones o tiene dudas/barreras previas.

Genera UNA declaración POV: usuario, necesidad, insight.

Formato mental: [Usuario] necesita [Necesidad] porque [Insight].

CRÍTICO — Igual que arriba: **usuario** solo sujeto, sin cola "que busca…" / "que busca un ambiente…" antes de la palabra fija **"necesita"** (quedaría "… ambiente a necesita", incorrecto).

Reglas para CLIENTE POTENCIAL:
- usuario: arquetipo concreto del persona (no genérico); si habla de "buscar ambiente" o "valorar un centro", va en **necesidad** o **insight**, no en usuario.
- necesidad: infinitivos alineados con **decidir con confianza, entender la propuesta, superar dudas o barreras antes de dar el paso, encontrar un modelo que encaje con su salud**.
- insight: dolor o motivación del persona en clave de **antes de ser cliente** (búsqueda, comparación, miedo, información).

Solo usa el bloque de texto que te damos. Español natural. Debe quedar claramente distinto de un POV de "ya clienta".`

export async function POST() {
  const personas = await fetchSavedUserPersonas()

  if (!personas.ok) {
    return NextResponse.json(
      {
        error: `${ERR[personas.code]} Ve a /user-persona y guarda los dos perfiles antes de generar POV.`,
      },
      { status: 400 }
    )
  }

  const textoActual = personaRecordToPlainText(
    `USER PERSONA — CLIENTE ACTUAL (ya clientes de ${CLIENT.ownerFirstName} / ${CLIENT.name})`,
    personas.data.clienteActual
  )
  const textoPotencial = personaRecordToPlainText(
    `USER PERSONA — CLIENTE POTENCIAL (aún no clientes; podrían valorar ${CLIENT.name})`,
    personas.data.clientePotencial
  )

  const { object: clienteActual } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({ statement: statementSchemaActual }),
    system: `${SYSTEM_CLIENTE_ACTUAL}${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}`,
    prompt: `=== ÚNICA FUENTE (cliente actual) ===\n\n${textoActual}\n\n===\nGenera el POV en el campo "statement".`,
  })

  const { object: clientePotencial } = await generateObject({
    model: openai('gpt-4o-mini'),
    schema: z.object({ statement: statementSchemaPotencial }),
    system: `${SYSTEM_CLIENTE_POTENCIAL}${MOA_AI_CONTEXTO_SERVICIO_PRESENCIAL_Y_CEO}`,
    prompt: `=== ÚNICA FUENTE (cliente potencial) ===\n\n${textoPotencial}\n\n===\nGenera el POV en el campo "statement".`,
  })

  return NextResponse.json({
    clienteActual: clienteActual.statement,
    clientePotencial: clientePotencial.statement,
  })
}
