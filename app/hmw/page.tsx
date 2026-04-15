import { HMWPage } from '@/components/HMWPage'
import Link from 'next/link'

export default function HMWRoute() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          ← Volver al dashboard
        </Link>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Design Thinking
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">How Might We (HMW)</h1>
            <p className="mt-1 text-gray-500 text-sm">
              MOA · Retos de diseño a partir de los dos POV guardados (cliente actual y potencial)
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 px-5 py-4 mb-8 space-y-3 text-sm text-indigo-950 leading-relaxed">
          <p>
            Cada <strong>Point of View</strong> se traduce en varias preguntas que empiezan por{' '}
            <span className="font-semibold">«¿Cómo podríamos…?»</span>: sirven para idear sin cerrarte en una solución
            demasiado pronto.
          </p>
          <p className="text-indigo-800/90 text-xs">
            Ejemplo: si el POV habla de confianza tras malas experiencias, una HMW podría ser: «¿Cómo podríamos
            mostrar las reseñas de otras clientas de forma que no se duden de su veracidad?».
          </p>
          <p className="text-xs">
            <Link href="/pov" className="font-semibold text-indigo-700 underline underline-offset-2">
              Ver o editar POV →
            </Link>
          </p>
        </div>

        <HMWPage />

        <p className="mt-10 text-center text-xs text-gray-400">
          Siguiente paso:{' '}
          <Link href="/user-journey" className="text-indigo-600 font-medium hover:underline underline-offset-2">
            User Journey Map →
          </Link>
        </p>
      </div>
    </main>
  )
}
