import { CardSortingParticipantPage } from '@/components/CardSortingParticipantPage'
import { CLIENT } from '@/lib/client-config'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Card sorting',
  description: `Ejercicio abierto de card sorting — ${CLIENT.name}`,
}

export default function ParticipaCardSortingRoute() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Participación</p>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Card sorting</h1>
          <p className="mt-1 text-sm text-gray-600">
            {CLIENT.name} — arrastra cada tarjeta a la categoría que mejor encaje. Si no encaja ninguna, añade una
            columna nueva.
          </p>
        </header>

        <CardSortingParticipantPage />
      </div>
    </div>
  )
}
