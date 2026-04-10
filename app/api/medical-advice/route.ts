import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const schema = z.object({
  groups: z.array(
    z.object({
      label: z.string().describe('Nombre corto del tipo de recomendación (máx 4 palabras)'),
      count: z.number(),
      color: z.string().describe('Color hex representativo'),
      examples: z.array(z.string()).describe('2-3 frases literales o resumidas de los participantes'),
      interpretation: z.string().describe('1 frase sobre qué refleja este patrón en el paciente'),
    })
  ).describe('Grupos de recomendaciones ordenados de mayor a menor frecuencia'),
})

export async function POST(req: Request) {
  const { answers } = await req.json()

  const { object } = await generateObject({
    model: 'openai/gpt-5.4',
    schema,
    system: `Eres un médico y psicólogo especializado en salud preventiva y ejercicio terapéutico.
Analiza qué tipo de recomendaciones recibían los pacientes antes de encontrar una entrenadora especializada.
Agrupa por similitud semántica, no literal. Responde en español.`,
    prompt: `Estas son las respuestas de clientes sobre qué les decían los médicos o su entorno antes de conocer a su entrenadora personal:

${answers.map((a: string, i: number) => `${i + 1}. "${a}"`).join('\n')}

Agrupa estas respuestas en categorías por similitud. Ejemplos de posibles grupos:
- "Reposo / No hagas ejercicio" 
- "Pierde peso"
- "Toma medicación"
- "Haz ejercicio suave"
- "Cirugía o intervención"
- "Pesimismo / Sin solución"
- "Nada / Sin consejo claro"

Usa los colores hex: #7c3aed, #2563eb, #dc2626, #d97706, #059669, #0891b2, #9333ea, #be185d

Prioriza que los grupos sean significativos y representativos. Puede haber entre 3 y 7 grupos.`,
  })

  return NextResponse.json(object)
}
