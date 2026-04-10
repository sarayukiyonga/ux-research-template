import { DesignPrinciplesPage } from '@/components/DesignPrinciplesPage'
import Link from 'next/link'

export default function DesignPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Nav */}
        <Link
          href="/ceo"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          ← Volver a la entrevista CEO
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Identidad de marca
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                Principios de diseño
              </h1>
              <p className="mt-1 text-gray-500 text-sm">
                MOA · Válidos para web, app, espacio físico y materiales de marca
              </p>
            </div>
          </div>
        </div>

        <DesignPrinciplesPage />
      </div>
    </main>
  )
}
