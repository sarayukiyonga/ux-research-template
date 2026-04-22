import { MVPPage } from '@/components/MVPPage'
import { CLIENT } from '@/lib/client-config'
import Link from 'next/link'

export default function MVPRoute() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          ← Volver al dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Design Thinking
          </div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Priorizar los accionables
          </h1>
          <p className="mt-1 text-gray-500 text-sm">
            {CLIENT.name} · Matriz de valor para definir el MVP — Eje X: valor para el negocio · Eje Y: valor para el
            usuario
          </p>
        </div>

        {/* Info */}
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-5 py-4 mb-8 space-y-2 text-sm text-violet-950 leading-relaxed">
          <p>
            El selector <strong>Canal</strong> elige el mismo ámbito que en MoSCoW (todos los canales o un medio
            concreto). La IA lee las notas MoSCoW guardadas de ese ámbito y las coloca en la matriz según los{' '}
            <strong>insights</strong> (clientes actuales y potenciales) y la <strong>entrevista a la CEO</strong>. Cada
            vista se guarda por separado en Sheets.
          </p>
          <p className="text-violet-800/80 text-xs">
            Las funcionalidades en el cuadrante <strong>superior derecho</strong>{' '}
            (naranja) son las candidatas principales al MVP.
            Arrastra las notas para ajustar la priorización manualmente.
          </p>
        </div>

        <MVPPage />

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-400">
          <Link href="/moscow" className="text-violet-600 font-medium hover:underline underline-offset-2">
            ← Must · Should · Could · Won&apos;t
          </Link>
          <div className="flex flex-wrap gap-4">
            <Link href="/card-sorting" className="text-violet-600 font-medium hover:underline underline-offset-2">
              Card sorting →
            </Link>
            <Link href="/mapa-sitio" className="text-violet-600 font-medium hover:underline underline-offset-2">
              Mapa del sitio →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
