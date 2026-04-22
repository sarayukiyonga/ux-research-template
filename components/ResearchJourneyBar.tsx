'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  RESEARCH_JOURNEY_STEPS,
  researchJourneyStepIndex,
  researchPhaseForPathname,
} from '@/lib/research-journey-steps'
import { cn } from '@/lib/utils'

export function ResearchJourneyBar() {
  const pathname = usePathname()
  const current = researchJourneyStepIndex(pathname)
  const phase = researchPhaseForPathname(pathname)

  const homeBlurb =
    'Panel principal · Elige un paso del recorrido para ver datos, guardar en Sheets y generar análisis con IA.'
  const bottomText =
    current >= 0 ? RESEARCH_JOURNEY_STEPS[current].long : homeBlurb

  const total = RESEARCH_JOURNEY_STEPS.length

  return (
    <div className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-2 sm:px-3 py-2">
        <p
          id="research-journey-bar-label"
          className="mb-1 text-center text-[9px] font-semibold uppercase tracking-wide text-gray-400"
        >
          Recorrido de investigación UX
        </p>

        <nav
          className="overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-labelledby="research-journey-bar-label"
        >
          <div className="flex min-w-max items-start justify-center gap-0 px-0">
            {RESEARCH_JOURNEY_STEPS.map((step, i) => {
              const isCurrent = i === current
              const isPast = current >= 0 && i < current
              const num = i + 1
              const stepLabel = `Paso ${num} de ${total}: ${step.title}`

              return (
                <div key={step.href} className="flex shrink-0 items-start">
                  <Link
                    href={step.href}
                    aria-label={stepLabel}
                    aria-current={isCurrent ? 'page' : undefined}
                    className="group flex w-8 flex-col items-center gap-0.5 sm:w-9"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold transition-colors sm:h-7 sm:w-7 sm:border-2 sm:text-[10px]',
                        isCurrent &&
                          'border-violet-600 bg-violet-600 text-white shadow-sm ring-1 ring-violet-200 sm:shadow-md sm:ring-2',
                        !isCurrent &&
                          isPast &&
                          'border-emerald-400 bg-emerald-50 text-emerald-800 group-hover:border-emerald-500',
                        !isCurrent &&
                          !isPast &&
                          'border-gray-200 bg-white text-gray-500 group-hover:border-violet-300 group-hover:text-violet-700'
                      )}
                    >
                      {num}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'max-w-[2rem] truncate text-center text-[7px] font-medium leading-tight text-gray-400 sm:max-w-none sm:text-[8px]',
                        isCurrent && 'text-violet-700',
                        isPast && 'text-emerald-700'
                      )}
                      title={step.short}
                    >
                      {step.short}
                    </span>
                  </Link>
                  {i < RESEARCH_JOURNEY_STEPS.length - 1 && (
                    <div
                      className={cn(
                        'mt-[11px] h-px w-1 shrink-0 self-start sm:mt-[13px] sm:w-1.5',
                        current >= 0 && i < current ? 'bg-emerald-300' : 'bg-gray-200'
                      )}
                      aria-hidden
                    />
                  )}
                </div>
              )
            })}
          </div>
        </nav>

        <p
          className={cn(
            'mt-1.5 border-t border-gray-100 pt-1.5 text-center text-[10px] leading-snug text-gray-600 sm:text-[11px]',
            current >= 0 && 'text-gray-800'
          )}
        >
          {current >= 0 && (
            <>
              <span className="mr-1.5 inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                Paso {current + 1} de {RESEARCH_JOURNEY_STEPS.length}
              </span>
              {phase && (
                <span className="mr-1.5 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                  Fase {phase.number}: {phase.title}
                </span>
              )}
            </>
          )}
          {bottomText}
        </p>
      </div>
    </div>
  )
}
