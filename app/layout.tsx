import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ResearchJourneyShell } from '@/components/ResearchJourneyShell'
import { CLIENT } from '@/lib/client-config'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

/** Título y descripción derivados de `CLIENT_*` (.env) para forks de la plantilla. */
export function generateMetadata(): Metadata {
  const name = CLIENT.name
  const defaultTitle = `${name} — Investigación UX`
  const description = [
    `Recorrido UX con IA para ${name}: ${CLIENT.serviceShort}.`,
    `Sector ${CLIENT.sector} · ${CLIENT.location}. Encuestas, mapas de empatía, journey, MVP y Sheets.`,
  ]
    .join(' ')
    .slice(0, 160)

  return {
    title: {
      default: defaultTitle,
      template: `%s · ${name}`,
    },
    description,
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={geist.className}>
        <a
          href="#contenido-principal"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-100 focus:rounded-md focus:bg-violet-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-violet-900"
        >
          Saltar al contenido principal
        </a>
        <ResearchJourneyShell>{children}</ResearchJourneyShell>
        <Analytics />
      </body>
    </html>
  )
}
