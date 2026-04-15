import { POVPage } from '@/components/POVPage'
import Link from 'next/link'

export default function POVRoute() {
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
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
            Design Thinking
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Point of View (POV)
            </h1>
            <p className="mt-1 text-gray-500 text-sm">
              MOA · Declaraciones de necesidad e insight extraídas de las encuestas con IA
            </p>
          </div>
        </div>

        {/* Pattern explainer */}
        <div
          className="relative rounded-2xl border border-sky-200 px-6 py-4 mb-8 max-w-xl"
          style={{ backgroundColor: '#dff1fb' }}
        >
          <p className="text-sm text-sky-800 leading-relaxed">
            <span className="text-sky-400 italic">(usuario)</span>
            {' '}
            <span className="font-bold">necesita</span>
            {' '}
            <span className="text-sky-600">(necesidad)</span>
            {' '}
            <span className="font-bold">porque</span>
            {' '}
            <span className="text-sky-500">(insight)</span>
          </p>
          {/* Tail */}
          <div
            className="absolute"
            style={{
              bottom: -10,
              left: 28,
              width: 0,
              height: 0,
              borderLeft: '10px solid transparent',
              borderRight: '10px solid #dff1fb',
              borderTop: '10px solid #dff1fb',
              filter: 'drop-shadow(0 1px 0 #bae3f5)',
            }}
          />
        </div>

        <POVPage />
      </div>
    </main>
  )
}
