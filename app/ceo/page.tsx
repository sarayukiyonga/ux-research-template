import { CeoDashboard } from '@/components/CeoDashboard'
import Link from 'next/link'

export default function CeoPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Nav */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          ← Volver a la encuesta de clientes
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Entrevista CEO
          </div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Entrevista a Patricia Dorado
          </h1>
          <p className="mt-1 text-gray-500 text-sm">
            Fundadora de MOA · Análisis estratégico de marca y negocio
          </p>
        </div>

        <CeoDashboard />
      </div>
    </main>
  )
}
