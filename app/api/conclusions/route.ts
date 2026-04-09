import { streamText } from 'ai'
import { QUESTIONS } from '@/lib/questions'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { questionId, answers } = await req.json()

  const question = QUESTIONS.find((q) => q.id === questionId)
  if (!question) {
    return new Response('Pregunta no encontrada', { status: 404 })
  }

  const answersText = answers
    .map((a: string, i: number) => `- Respuesta ${i + 1}: "${a}"`)
    .join('\n')

  const result = streamText({
    model: 'openai/gpt-5.4',
    system: `Eres un analista experto en bienestar, salud y entrenamiento personal. 
Analiza las respuestas de una encuesta a clientes de una entrenadora personal especializada en personas mayores o con limitaciones físicas. 
Sé empático, preciso y orientado a insights accionables para la entrenadora.
Responde siempre en español.`,
    prompt: `Pregunta de la encuesta: "${question.title}"

Respuestas de los ${answers.length} participantes:
${answersText}

Por favor:
1. Resume los patrones y temas comunes en 3-4 puntos clave
2. Destaca las frases o sentimientos más relevantes
3. Da 1-2 recomendaciones concretas para la entrenadora basadas en estas respuestas

Formato: usa párrafos breves y claros, sin numeración excesiva. Máximo 250 palabras.`,
  })

  return result.toTextStreamResponse()
}
