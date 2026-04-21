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
        <ResearchJourneyShell>{children}</ResearchJourneyShell>
        <Analytics />
      </body>
    </html>
  )
}
