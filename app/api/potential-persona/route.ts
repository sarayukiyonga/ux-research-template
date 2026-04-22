import { streamText, generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { NextResponse } from 'next/server'
import type { SurveyQuestionFromSheet } from '@/lib/survey-sheet-headers'
import { CLIENT_AI_SERVICE_CONTEXT } from '@/lib/client-ai-service-context'
import { CLIENT } from '@/lib/client-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const SYSTEM = `Eres un investigador UX especializado en salud y bienestar. 
Analizas encuestas a clientes potenciales para crear perfiles de buyer persona útiles para diseño web y estrategia de captación.
Responde siempre en español. Sé concreto y basa todo en las respuestas reales.${CLIENT_AI_SERVICE_CONTEXT}`

function buildPotentialPersonaPrompt(
  byQuestion: { questionId: number; answers: string[] }[],
  demographic: { men: string[]; women: string[]; nonBinary: string[] },
  questions: SurveyQuestionFromSheet[]
) {
  const totalResponses =
    (demographic?.men?.length ?? 0) +
    (demographic?.women?.length ?? 0) +
    (demographic?.nonBinary?.length ?? 0)

  const answersText = questions
    .map((q) => {
      const block = byQuestion.find((b: { questionId: number }) => b.questionId === q.questionId)
      const answers: string[] = block?.answers ?? []
      if (answers.length === 0) return null
      return `**${q.title}**\n${answers.map((a: string) => `- "${a}"`).join('\n')}`
    })
    .filter(Boolean)
    .join('\n\n')

  const prompt = `Analiza estas ${totalResponses} respuestas de una encuesta a clientes potenciales de ${CLIENT.name} (${CLIENT.serviceShort} en ${CLIENT.location}) y genera un Perfil de Cliente Potencial con este formato exacto:

## 🎯 Perfil del cliente potencial

**Nombre ficticio:** [nombre representativo]
**Edad y género:** [rango predominante basado en los datos]

### Lo que le preocupa
[2-3 bullets sobre sus dolores físicos, limitaciones o necesidades de salud reales]

### Su relación actual con el ejercicio
[Cómo se relaciona hoy con el ejercicio: si va o no a un centro, qué hace, qué le frena]

### Qué piensa del concepto ${CLIENT.name}
[Cómo percibe el posicionamiento de ${CLIENT.name}: qué le atrae, qué le genera dudas o barreras]

### Lo que busca y no encuentra
[Qué echa de menos en la oferta actual, qué valoraría en un profesional]

### Por qué ${CLIENT.name} encaja con él/ella
[Por qué el modelo combinado (${CLIENT.serviceCombo}) le resultaría atractivo]

---

RESPUESTAS DE LA ENCUESTA (${totalResponses} participantes):

${answersText}`

  return prompt
}

export async function POST(req: Request) {
  const { byQuestion, demographic, questions, stream = true } = await req.json()

  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json(
      {
        error:
          'Falta "questions" (metadatos de la fila de encabezados del Sheet). Recarga la encuesta en /potential.',
      },
      { status: 400 }
    )
  }

  const prompt = buildPotentialPersonaPrompt(
    byQuestion,
    demographic,
    questions as SurveyQuestionFromSheet[]
  )

  if (!stream) {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: SYSTEM,
      prompt,
    })
    return NextResponse.json({ text })
  }

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: SYSTEM,
    prompt,
  })

  return result.toTextStreamResponse()
}
