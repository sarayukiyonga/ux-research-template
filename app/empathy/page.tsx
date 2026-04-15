import { EmpathyMapPage } from '@/components/EmpathyMapPage'
import Link from 'next/link'

export default function EmpathyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Nav */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          ← Volver al dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Conocimiento del cliente
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Mapa de empatía
            </h1>
            <p className="mt-1 text-gray-500 text-sm">
              MOA · Generado a partir de encuestas de clientes actuales y potenciales
            </p>
          </div>
        </div>

        <EmpathyMapPage />
      </div>
    </main>
  )
}
