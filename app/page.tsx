import Link from 'next/link'
import { DashboardLogoutBar } from '@/components/DashboardLogoutBar'
import { PdfDashboardFullExport } from '@/components/PdfDashboardFullExport'
import { CLIENT, CLIENT_PDF_BASENAME } from '@/lib/client-config'
import { RESEARCH_PHASES, type DashboardColor } from '@/lib/research-journey-steps'

const colorMap: Record<
  DashboardColor,
  { tag: string; border: string; icon: string; arrow: string }
> = {
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
  rose: {
    tag: 'bg-rose-100 text-rose-700',
    border: 'hover:border-rose-300',
    icon: 'bg-rose-100',
    arrow: 'text-rose-400 group-hover:text-rose-600',
  },
  sky: {
    tag: 'bg-sky-100 text-sky-700',
    border: 'hover:border-sky-300',
    icon: 'bg-sky-100',
    arrow: 'text-sky-400 group-hover:text-sky-600',
  },
  amber: {
    tag: 'bg-amber-100 text-amber-800',
    border: 'hover:border-amber-300',
    icon: 'bg-amber-100',
    arrow: 'text-amber-400 group-hover:text-amber-600',
  },
  indigo: {
    tag: 'bg-indigo-100 text-indigo-800',
    border: 'hover:border-indigo-300',
    icon: 'bg-indigo-100',
    arrow: 'text-indigo-400 group-hover:text-indigo-600',
  },
  teal: {
    tag: 'bg-teal-100 text-teal-800',
    border: 'hover:border-teal-300',
    icon: 'bg-teal-100',
    arrow: 'text-teal-400 group-hover:text-teal-600',
  },
  cyan: {
    tag: 'bg-cyan-100 text-cyan-900',
    border: 'hover:border-cyan-300',
    icon: 'bg-cyan-100',
    arrow: 'text-cyan-400 group-hover:text-cyan-600',
  },
}

export default function DashboardPage() {
  const dashboardTitle = `${CLIENT.name} | ${CLIENT.ownerFullName}`
  const footerBrand = `${CLIENT.name} · ${CLIENT.location}`

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:py-14">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-3xl">
            ✦
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {dashboardTitle}
          </h1>
          <p className="mt-2 text-sm text-gray-500">Panel de análisis · Marca y estrategia</p>
          <PdfDashboardFullExport fileName={`${CLIENT_PDF_BASENAME}-panel-completo.pdf`} />
        </div>

        {/* Fases agrupadas en cards */}
        <div className="space-y-8">
          {RESEARCH_PHASES.map((phase) => (
            <section
              key={phase.id}
              className="rounded-2xl border-2 border-gray-200/90 bg-white p-5 shadow-sm sm:p-6"
            >
              <header className="mb-4 border-b border-gray-100 pb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">
                  Fase {phase.number} de 7
                </p>
                <h2 className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">{phase.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{phase.subtitle}</p>
              </header>

              <div className="space-y-2.5">
                {phase.steps.map((s) => {
                  const c = colorMap[s.color]
                  return (
                    <Link
                      key={s.href}
                      href={s.href}
                      className={`group flex items-start gap-3 rounded-xl border-2 border-gray-100 bg-gray-50/50 px-4 py-4 transition-all hover:bg-white hover:shadow-md sm:gap-4 sm:px-5 ${c.border}`}
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl sm:h-11 sm:w-11 sm:text-2xl ${c.icon}`}
                      >
                        {s.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.tag}`}
                        >
                          {s.tagPulse && (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                          )}
                          {s.tag}
                        </span>
                        <p className="text-base font-semibold leading-snug text-gray-900">{s.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-gray-500">{s.description}</p>
                      </div>
                      <span
                        className={`mt-1 shrink-0 text-xl transition-all group-hover:translate-x-0.5 ${c.arrow}`}
                      >
                        →
                      </span>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <DashboardLogoutBar footerBrand={footerBrand} />
    </div>
  )
}
