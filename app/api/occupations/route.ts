import { generateObject } from 'ai'
import { z } from 'zod'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const OccupationCategory = z.enum([
  'Sedentaria',
  'De pie prolongado',
  'Trabajo físico intenso',
  'Mixta',
  'Jubilada/o',
])

const schema = z.object({
  categorized: z.array(
    z.object({
      profession: z.string().describe('Profesión tal como la describió el participante'),
      category: OccupationCategory,
      physicalRisks: z.array(z.string()).describe('2-3 riesgos físicos concretos de esta profesión'),
    })
  ),
  summary: z.object({
    sedentaria: z.object({
      count: z.number(),
      mainRisks: z.array(z.string()).describe('Los 3 riesgos físicos más comunes de este grupo'),
    }),
    dePieProlongado: z.object({
      count: z.number(),
      mainRisks: z.array(z.string()),
    }),
    trabajoFisicoIntenso: z.object({
      count: z.number(),
      mainRisks: z.array(z.string()),
    }),
    mixta: z.object({
      count: z.number(),
      mainRisks: z.array(z.string()),
    }),
    jubilada: z.object({
      count: z.number(),
      mainRisks: z.array(z.string()),
    }),
  }),
})

export async function POST(req: Request) {
  const { answers } = await req.json()

  const { object } = await generateObject({
    model: 'openai/gpt-5.4',
    schema,
    system: `Eres un fisioterapeuta y experto en salud laboral. 
Categoriza profesiones según el tipo de carga física que implican y los problemas musculoesqueléticos que pueden generar.
Responde siempre en español.`,
    prompt: `Clasifica estas profesiones de clientes de una entrenadora personal especializada en personas con limitaciones físicas:

${answers.map((a: string, i: number) => `${i + 1}. "${a}"`).join('\n')}

Categorías posibles:
- **Sedentaria**: trabajo de oficina, informática, conducción prolongada, trabajo administrativo
- **De pie prolongado**: comercio, hostelería, peluquería, dependienta, cajera, enfermería en planta
- **Trabajo físico intenso**: construcción, limpieza, carga y descarga, fisioterapia activa, agricultura
- **Mixta**: combinación de sedentaria y activa según el día (ej: docente, comercial)
- **Jubilada/o**: retirada del mercado laboral

Para cada categoría en el summary, indica los riesgos físicos más comunes (ej: "Dolor lumbar crónico", "Varices y edema en piernas", "Contracturas cervicales").`,
  })

  return NextResponse.json(object)
}
