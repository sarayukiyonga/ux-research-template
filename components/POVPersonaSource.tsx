'use client'

import Link from 'next/link'

export function POVPersonaSource({ variant }: { variant: 'full' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <p className="text-xs text-sky-700">
        Fuente:{' '}
        <Link href="/user-persona" className="font-semibold underline underline-offset-2">
          User Persona guardados
        </Link>
        . Actualiza los perfiles allí y regenera los POV aquí.
      </p>
    )
  }

  return (
    <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 space-y-2">
      <p className="text-xs font-semibold text-sky-900">Origen de los POV</p>
      <p className="text-xs text-sky-800 leading-relaxed">
        Cada declaración se genera <strong>solo</strong> a partir del <strong>user persona guardado</strong> de su
        segmento (cliente actual vs cliente potencial). Primero deben existir los dos perfiles en{' '}
        <Link href="/user-persona" className="font-semibold underline underline-offset-2">
          User Persona
        </Link>
        .
      </p>
    </div>
  )
}
