import { MoSCoWPage } from '@/components/MoSCoWPage'
import Link from 'next/link'

export default function MoSCoWRoute() {
  return (
    <main className="min-h-screen bg-gray-50">
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
            Must · Should · Could · Won&apos;t
          </h1>
          <p className="mt-1 text-gray-500 text-sm">
            MoSCoW a partir del User Journey guardado y la entrevista a la CEO
          </p>
        </div>

        {/* Info */}
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-5 py-4 mb-8 space-y-2 text-sm text-violet-950 leading-relaxed">
          <p>
            La IA propone y clasifica funcionalidades a partir de los{' '}
            <Link href="/user-journey" className="font-semibold underline underline-offset-2 text-violet-700">
              mapas de User Journey
            </Link>{' '}
            y las{' '}
            <strong>ideas [FUNC] y [CONT]</strong> guardadas por canal. Usa el selector <strong>Canal</strong> para un
            tablero MoSCoW por medio o <strong>Todos los canales</strong> en conjunto; cada ámbito se guarda por
            separado en Sheets. Complemento:{' '}
            <Link href="/ceo" className="font-semibold underline underline-offset-2 text-violet-700">
              entrevista a la CEO
            </Link>
            .
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div className="rounded-lg bg-orange-100 border border-orange-200 px-3 py-2">
              <span className="font-bold text-orange-700">Must</span>
              <p className="text-orange-800/80 mt-0.5">Imprescindible para el MVP</p>
            </div>
            <div className="rounded-lg bg-yellow-100 border border-yellow-200 px-3 py-2">
              <span className="font-bold text-yellow-700">Should</span>
              <p className="text-yellow-800/80 mt-0.5">Muy importante, puede esperar v2</p>
            </div>
            <div className="rounded-lg bg-gray-100 border border-gray-200 px-3 py-2">
              <span className="font-bold text-gray-600">Could</span>
              <p className="text-gray-600/80 mt-0.5">Deseable si hay tiempo</p>
            </div>
            <div className="rounded-lg bg-slate-100 border border-slate-200 px-3 py-2">
              <span className="font-bold text-slate-500">Won&apos;t</span>
              <p className="text-slate-500/80 mt-0.5">Descartado por ahora</p>
            </div>
          </div>
        </div>

        <MoSCoWPage />

        <div className="mt-10 flex items-center justify-between text-xs text-gray-400">
          <Link href="/user-journey" className="text-violet-600 font-medium hover:underline underline-offset-2">
            ← User Journey Map
          </Link>
          <Link href="/mvp" className="text-violet-600 font-medium hover:underline underline-offset-2">
            Matriz MVP →
          </Link>
        </div>
      </div>
    </main>
  )
}
