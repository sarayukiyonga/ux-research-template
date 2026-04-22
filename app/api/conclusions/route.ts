import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { CLIENT_AI_SERVICE_CONTEXT } from '@/lib/client-ai-service-context'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { questionId, answers, questionTitle, questions } = await req.json()

  let title: string | undefined =
    typeof questionTitle === 'string' && questionTitle.trim() ? questionTitle.trim() : undefined
  if (!title && Array.isArray(questions) && typeof questionId === 'number') {
    const m = questions.find((q: { questionId?: number }) => q?.questionId === questionId)
    title = typeof m?.title === 'string' ? m.title : undefined
  }
  if (!title) {
    return new Response(
      'Indica questionTitle o un array questions con los encabezados del Sheet y questionId.',
      { status: 400 }
    )
  }

  const answersText = answers
    .map((a: string, i: number) => `- Respuesta ${i + 1}: "${a}"`)
    .join('\n')

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: `Eres un analista experto en bienestar, salud y entrenamiento personal. 
Analiza las respuestas de una encuesta a clientes de una entrenadora personal especializada en personas mayores o con limitaciones físicas. 
Sé empático, preciso y orientado a insights accionables para la entrenadora.
Responde siempre en español.${CLIENT_AI_SERVICE_CONTEXT}`,
    prompt: `Pregunta de la encuesta: "${title}"

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
