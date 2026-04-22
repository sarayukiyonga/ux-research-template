import { CardSortingAdminPage } from '@/components/CardSortingAdminPage'
import Link from 'next/link'

export default function CardSortingRoute() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link
          href="/"
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-gray-600 mb-6"
        >
          ← Volver al dashboard
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Ideación + priorización
          </div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Card sorting — configuración</h1>
          <p className="mt-1 text-gray-500 text-sm">
            Define las tarjetas (páginas o secciones) y las categorías por defecto. Los participantes usan una página
            pública sin iniciar sesión.
          </p>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-5 py-4 mb-8 text-sm text-violet-950 leading-relaxed">
          <p>
            Elige el <strong>canal</strong> (mismo criterio que en la matriz MVP) y{' '}
            <strong>genera las tarjetas desde el MVP</strong> de ese ámbito, o añádelas sin borrar las que ya tengas.
            Guarda los cambios para que la{' '}
            <Link
              href="/participa/card-sorting"
              className="cursor-pointer font-semibold underline underline-offset-2 text-violet-800 transition-colors hover:text-violet-950"
            >
              sesión pública
            </Link>{' '}
            muestre la lista actualizada.
          </p>
        </div>

        <CardSortingAdminPage />

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-400">
          <Link
            href="/mvp"
            className="cursor-pointer text-violet-600 font-medium underline-offset-2 transition-colors hover:text-violet-800 hover:underline"
          >
            ← Matriz MVP
          </Link>
          <Link
            href="/mapa-sitio"
            className="cursor-pointer text-violet-600 font-medium underline-offset-2 transition-colors hover:text-violet-800 hover:underline"
          >
            Mapa del sitio →
          </Link>
        </div>
      </div>
    </div>
  )
}
