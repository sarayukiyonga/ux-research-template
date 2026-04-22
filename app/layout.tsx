import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ResearchJourneyShell } from '@/components/ResearchJourneyShell'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Encuesta Patri — Resultados',
  description: 'Dashboard de resultados de la encuesta de satisfacción',
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
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-violet-800 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-violet-900"
        >
          Saltar al contenido principal
        </a>
        <ResearchJourneyShell>{children}</ResearchJourneyShell>
        <Analytics />
      </body>
    </html>
  )
}
