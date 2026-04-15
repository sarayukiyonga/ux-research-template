'use client'

import Link from 'next/link'
import { describeSegmentFiltersInline, type SurveySegmentKey } from '@/lib/segment-survey-filters'
import { useLiveSegmentFilters } from '@/hooks/useLiveSegmentFilters'

const SURVEY_HREF: Record<SurveySegmentKey, string> = {
  clientes: '/survey',
  potenciales: '/potential',
}

const LABEL: Record<SurveySegmentKey, string> = {
  clientes: 'Encuesta de clientes actuales',
  potenciales: 'Encuesta a clientes potenciales',
}

type Accent = 'violet' | 'rose' | 'orange' | 'sky' | 'amber' | 'emerald'

const styles: Record<Accent, { box: string; title: string; link: string }> = {
  violet: {
    box: 'border-violet-100 bg-violet-50',
    title: 'text-violet-800',
    link: 'text-violet-700 hover:text-violet-900',
  },
  rose: {
    box: 'border-rose-100 bg-rose-50',
    title: 'text-rose-800',
    link: 'text-rose-700 hover:text-rose-900',
  },
  orange: {
    box: 'border-orange-100 bg-orange-50',
    title: 'text-orange-900',
    link: 'text-orange-800 hover:text-orange-950',
  },
  sky: {
    box: 'border-sky-100 bg-sky-50',
    title: 'text-sky-900',
    link: 'text-sky-800 hover:text-sky-950',
  },
  amber: {
    box: 'border-amber-100 bg-amber-50',
    title: 'text-amber-900',
    link: 'text-amber-800 hover:text-amber-950',
  },
  emerald: {
    box: 'border-emerald-100 bg-emerald-50',
    title: 'text-emerald-900',
    link: 'text-emerald-800 hover:text-emerald-950',
  },
}

/** Muestra los filtros activos definidos en la página de encuesta del segmento. */
export function SegmentFiltersReadBanner({
  segment,
  accent = 'violet',
}: {
  segment: SurveySegmentKey
  accent?: Accent
}) {
  const f = useLiveSegmentFilters(segment)
  const s = styles[accent]
  const href = SURVEY_HREF[segment]

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-1.5 ${s.box}`}>
      <p className={`text-xs font-semibold ${s.title}`}>Filtros de encuesta (solo lectura)</p>
      <p className="text-xs text-gray-600 leading-relaxed">
        <span className="font-medium text-gray-700">{LABEL[segment]}:</span>{' '}
        {describeSegmentFiltersInline(f)}
      </p>
      <p className="text-xs text-gray-500">
        Los filtros se eligen en la{' '}
        <Link href={href} className={`font-semibold underline underline-offset-2 ${s.link}`}>
          página de esa encuesta
        </Link>
        . Tras cambiarlos, regenera aquí para aplicar el nuevo corte.
      </p>
    </div>
  )
}

/** Variante con dos segmentos (POV, User Persona, principios de diseño). */
export function DualSegmentFiltersReadBanner({ accent = 'violet' }: { accent?: Accent }) {
  const fc = useLiveSegmentFilters('clientes')
  const fp = useLiveSegmentFilters('potenciales')
  const s = styles[accent]

  return (
    <div className={`rounded-xl border px-4 py-3 space-y-2 ${s.box}`}>
      <p className={`text-xs font-semibold ${s.title}`}>Filtros de encuesta (solo lectura)</p>
      <ul className="text-xs text-gray-600 space-y-1.5">
        <li>
          <span className="font-medium text-gray-700">Clientes actuales:</span>{' '}
          {describeSegmentFiltersInline(fc)}{' '}
          <Link href={SURVEY_HREF.clientes} className={`underline underline-offset-2 ${s.link}`}>
            /survey
          </Link>
        </li>
        <li>
          <span className="font-medium text-gray-700">Clientes potenciales:</span>{' '}
          {describeSegmentFiltersInline(fp)}{' '}
          <Link href={SURVEY_HREF.potenciales} className={`underline underline-offset-2 ${s.link}`}>
            /potential
          </Link>
        </li>
      </ul>
      <p className="text-xs text-gray-500">
        Cambia los filtros en cada encuesta y pulsa regenerar en esta página para actualizar el análisis.
      </p>
    </div>
  )
}
