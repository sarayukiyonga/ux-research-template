'use client'

import { usePathname } from 'next/navigation'
import { ResearchJourneyBar } from '@/components/ResearchJourneyBar'

export function ResearchJourneyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideBar = pathname === '/login' || pathname?.startsWith('/participa/')

  return (
    <>
      {!hideBar && <ResearchJourneyBar />}
      <main
        id="contenido-principal"
        tabIndex={-1}
        className="outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 focus-visible:ring-offset-2"
      >
        {children}
      </main>
    </>
  )
}
