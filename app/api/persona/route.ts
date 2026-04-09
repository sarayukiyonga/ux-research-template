import { streamText } from 'ai'
import { QUESTIONS } from '@/lib/questions'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { byQuestion, demographic } = await req.json()

  const totalRespondents =
    (demographic.men?.length ?? 0) +
    (demographic.women?.length ?? 0) +
    (demographic.nonBinary?.length ?? 0)

  const demographicSummary = [
    demographic.men?.length ? `Hombres (${demographic.men.length}): ${demographic.men.join(', ')}` : '',
    demographic.women?.length ? `Mujeres (${demographic.women.length}): ${demographic.women.join(', ')}` : '',
    demographic.nonBinary?.length ? `No binario (${demographic.nonBinary.length}): ${demographic.nonBinary.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const questionsBlock = QUESTIONS.map((q) => {
    const entry = byQuestion.find((b: { questionId: number; answers: string[] }) => b.questionId === q.id)
    const answers = entry?.answers ?? []
    if (answers.length === 0) return ''
    return `**${q.title}**\n${answers.map((a: string) => `- "${a}"`).join('\n')}`
  })
    .filter(Boolean)
    .join('\n\n')

  const result = streamText({
    model: 'openai/gpt-5.4',
    system: `Eres un investigador UX y estratega de marca especializado en salud, bienestar y entrenamiento personal. 
Tu tarea es crear User Personas a partir de respuestas reales de encuestas.
Responde siempre en español. Sé empático, humano y orientado a insights accionables para la entrenadora Patri.`,
    prompt: `A continuación tienes las respuestas reales de ${totalRespondents} clientes de Patri, entrenadora personal especializada en personas con limitaciones físicas o de salud.

**DATOS DEMOGRÁFICOS:**
${demographicSummary}

**RESPUESTAS POR PREGUNTA:**
${questionsBlock}

---

Crea un User Persona compuesto que represente al cliente típico de Patri. Usa este formato exacto:

## 👤 Nombre ficticio, edad representativa

**"Frase que resumiría su actitud o motivación principal"**

---

### Quién es
2-3 frases describiendo su perfil: situación de salud, vida cotidiana, contexto personal.

### Antes de Patri
Qué le frenaba, qué le decían los médicos, qué actividades le costaban. 2-3 frases.

### Por qué eligió a Patri
Qué le dio confianza. Qué vio en ella que no encontraba en otros. 2 frases.

### Cómo se siente entrenando
Sensación física y mental tras las sesiones. El valor que le da al grupo. 2-3 frases.

### Su relación con el dinero que invierte
Cómo percibe el precio. ¿Inversión o gasto? 1-2 frases.

### Su momento "esto funciona"
El instante concreto en que sintió el cambio real. 1-2 frases.

### Sus roces con el sistema actual
Qué le cuesta o le da pereza del modelo actual. 1-2 frases.

### Oportunidades para Patri
3 bullets concisos con acciones concretas que Patri podría tomar basándose en este perfil.`,
  })

  return result.toTextStreamResponse()
}
