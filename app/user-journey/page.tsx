import { UserJourneyPage } from '@/components/UserJourneyPage'
import { PdfDownloadButton } from '@/components/PdfDownloadButton'
import Link from 'next/link'

export default function UserJourneyRoute() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative mx-auto max-w-5xl px-4 py-10">
        <div className="absolute right-2 top-10 z-20 sm:right-4">
          <PdfDownloadButton fileName="moa-user-journey.pdf" />
        </div>

        <div id="moa-pdf-root">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-6"
          >
            ← Volver al dashboard
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium text-teal-800 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
              Design Thinking
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">User Journey Map</h1>
              <p className="mt-1 text-gray-500 text-sm">
                Mapa de recorrido del usuario · MOA · Dos viajes (actual y potencial) desde el problema hasta salir de la
                web
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-teal-200 bg-teal-50/50 px-5 py-4 mb-8 space-y-3 text-sm text-teal-950 leading-relaxed">
            <p>
              Cada recorrido enlaza el <strong>User Persona</strong> con su <strong>POV</strong>: defines{' '}
              <strong>etapas</strong> en orden (de tener la necesidad a cerrar la visita en la web), los{' '}
              <strong>puntos de dolor</strong> en cada paso, y se marca el momento en que la <strong>web de MOA</strong>{' '}
              aporta más al POV.
            </p>
            <p className="text-xs text-teal-900/85">
              Objetivo: ver en qué pantalla o fase concreta tu web está resolviendo la declaración que redactaste en POV.
            </p>
            <p className="text-xs flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/user-persona" className="font-semibold text-teal-800 underline underline-offset-2">
                User Persona →
              </Link>
              <Link href="/pov" className="font-semibold text-teal-800 underline underline-offset-2">
                POV →
              </Link>
              <Link href="/hmw" className="font-semibold text-teal-800 underline underline-offset-2">
                HMW →
              </Link>
            </p>
          </div>

          <UserJourneyPage />

          <p className="mt-10 text-center text-xs text-gray-400">
            Siguiente paso:{' '}
            <Link href="/moscow" className="text-teal-700 font-medium hover:underline underline-offset-2">
              MoSCoW →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
