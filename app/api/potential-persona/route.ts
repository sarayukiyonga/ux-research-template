import { streamText } from 'ai'
import { POTENTIAL_QUESTIONS } from '@/lib/potential-questions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  const { byQuestion, demographic } = await req.json()

  const totalResponses =
    (demographic?.men?.length ?? 0) +
    (demographic?.women?.length ?? 0) +
    (demographic?.nonBinary?.length ?? 0)

  const answersText = POTENTIAL_QUESTIONS.map((q) => {
    const block = byQuestion.find((b: { questionId: number }) => b.questionId === q.id)
    const answers: string[] = block?.answers ?? []
    if (answers.length === 0) return null
    return `**${q.title}**\n${answers.map((a: string) => `- "${a}"`).join('\n')}`
  })
    .filter(Boolean)
    .join('\n\n')

  const result = streamText({
    model: 'openai/gpt-5.4',
    system: `Eres un investigador UX especializado en salud y bienestar. 
Analizas encuestas a clientes potenciales para crear perfiles de buyer persona útiles para diseño web y estrategia de captación.
Responde siempre en español. Sé concreto y basa todo en las respuestas reales.`,
    prompt: `Analiza estas ${totalResponses} respuestas de una encuesta a clientes potenciales de MOA (centro de entrenamiento y salud en Martorell) y genera un Perfil de Cliente Potencial con este formato exacto:

## 🎯 Perfil del cliente potencial

**Nombre ficticio:** [nombre representativo]
**Edad y género:** [rango predominante basado en los datos]

### Lo que le preocupa
[2-3 bullets sobre sus dolores físicos, limitaciones o necesidades de salud reales]

### Su relación actual con el ejercicio
[Cómo se relaciona hoy con el ejercicio: si va o no a un centro, qué hace, qué le frena]

### Qué piensa del concepto MOA
[Cómo percibe el "Entrenamiento Personal de Salud": qué le atrae, qué le genera dudas o barreras]

### Lo que busca y no encuentra
[Qué echa de menos en la oferta actual, qué valoraría en un profesional]

### Por qué MOA encaja con él/ella
[Por qué el modelo combinado de MOA (ejercicio + quiromasaje + fisio) le resultaría atractivo]

---

RESPUESTAS DE LA ENCUESTA (${totalResponses} participantes):

${answersText}`,
  })

  return result.toTextStreamResponse()
}
