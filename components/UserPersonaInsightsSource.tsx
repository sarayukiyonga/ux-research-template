'use client'

import Link from 'next/link'

export function UserPersonaInsightsSource({
  variant,
}: {
  /** compact: una línea; full: lista con enlaces */
  variant: 'compact' | 'full'
}) {
  if (variant === 'compact') {
    return (
      <p className="text-xs text-violet-600">
        Fuente:{' '}
        <Link href="/insights" className="font-semibold underline underline-offset-2">
          Insights clientes
        </Link>
        {' · '}
        <Link href="/insights?tab=potenciales" className="font-semibold underline underline-offset-2">
          Insights potenciales
        </Link>
        . Regenera los insights allí si cambia el mapa de empatía, luego vuelve aquí.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-violet-800">Origen de los perfiles</p>
      <p className="text-xs text-violet-700 leading-relaxed">
        Narrativa (motivaciones, necesidades, dolor…): <strong>insights guardados</strong> por segmento.{' '}
        <strong>Edad, género y ocupación</strong> (y otros recuentos de encuesta) usan el <strong>mismo filtrado</strong>{' '}
        que en <Link href="/survey" className="underline font-medium">/survey</Link> y{' '}
        <Link href="/potential" className="underline font-medium">/potential</Link>.
      </p>
      <ul className="text-xs text-violet-800 space-y-1">
        <li>
          <strong>Cliente actual</strong> →{' '}
          <Link href="/insights" className="underline underline-offset-2 font-medium">
            Insights · Clientes actuales
          </Link>
        </li>
        <li>
          <strong>Cliente potencial</strong> →{' '}
          <Link href="/insights?tab=potenciales" className="underline underline-offset-2 font-medium">
            Insights · Clientes potenciales
          </Link>
        </li>
      </ul>
    </div>
  )
}
