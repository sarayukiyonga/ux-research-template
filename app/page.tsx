import Link from 'next/link'

const sections = [
  {
    href: '/survey',
    emoji: '📊',
    tag: 'Tiempo real',
    tagPulse: true,
    title: 'Encuesta de clientes',
    description:
      'Respuestas abiertas de los clientes de Patri, agrupadas por pregunta con análisis de IA y User Persona generada automáticamente.',
    color: 'violet',
  },
  {
    href: '/potential',
    emoji: '🔍',
    tag: 'Tiempo real',
    tagPulse: true,
    title: 'Encuesta a clientes potenciales',
    description:
      'Perfil del público objetivo de MOA: barreras, motivaciones, conocimiento del mercado y oportunidades de captación.',
    color: 'orange',
  },
  {
    href: '/ceo',
    emoji: '🎙️',
    tag: 'Entrevista',
    tagPulse: false,
    title: 'Entrevista a la CEO',
    description:
      'Respuestas de Patricia Dorado sobre marca, negocio, web y competencia, con informe estratégico generado por IA.',
    color: 'blue',
  },
  {
    href: '/design',
    emoji: '🎨',
    tag: 'Identidad de marca',
    tagPulse: false,
    title: 'Principios de diseño',
    description:
      'Principios de diseño de MOA generados a partir de la entrevista, las respuestas de los clientes y las decisiones de Patricia.',
    color: 'emerald',
  },
]

const colorMap: Record<string, { tag: string; border: string; icon: string; arrow: string }> = {
  violet: {
    tag: 'bg-violet-100 text-violet-700',
    border: 'hover:border-violet-300',
    icon: 'bg-violet-100',
    arrow: 'text-violet-400 group-hover:text-violet-600',
  },
  orange: {
    tag: 'bg-orange-100 text-orange-700',
    border: 'hover:border-orange-300',
    icon: 'bg-orange-100',
    arrow: 'text-orange-400 group-hover:text-orange-600',
  },
  blue: {
    tag: 'bg-blue-100 text-blue-700',
    border: 'hover:border-blue-300',
    icon: 'bg-blue-100',
    arrow: 'text-blue-400 group-hover:text-blue-600',
  },
  emerald: {
    tag: 'bg-emerald-100 text-emerald-700',
    border: 'hover:border-emerald-300',
    icon: 'bg-emerald-100',
    arrow: 'text-emerald-400 group-hover:text-emerald-600',
  },
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 py-14 flex-1">

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-violet-100 text-3xl mb-4">
            ✦
          </div>
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl tracking-tight">
            MOA | Patricia Dorado Trainer
          </h1>
          <p className="mt-2 text-gray-500 text-sm">
            Panel de análisis · Marca y estrategia
          </p>
        </div>

        {/* Section cards */}
        <div className="space-y-3">
          {sections.map((s) => {
            const c = colorMap[s.color]
            return (
              <Link
                key={s.href}
                href={s.href}
                className={`group flex items-start gap-4 rounded-2xl border-2 border-gray-100 bg-white px-5 py-5 transition-all hover:shadow-md ${c.border}`}
              >
                {/* Icon */}
                <div className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center text-2xl ${c.icon}`}>
                  {s.emoji}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c.tag}`}>
                      {s.tagPulse && (
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      )}
                      {s.tag}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 text-base leading-snug">
                    {s.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    {s.description}
                  </p>
                </div>

                {/* Arrow */}
                <span className={`shrink-0 text-xl mt-1 transition-all group-hover:translate-x-0.5 ${c.arrow}`}>
                  →
                </span>
              </Link>
            )
          })}
        </div>

      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-xs text-gray-300">MOA · Martorell</p>
      </div>
    </main>
  )
}
