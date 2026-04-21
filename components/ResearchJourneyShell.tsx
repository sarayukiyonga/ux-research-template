'use client'

import { usePathname } from 'next/navigation'
import { ResearchJourneyBar } from '@/components/ResearchJourneyBar'

export function ResearchJourneyShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideBar = pathname === '/login'

  return (
    <>
      {!hideBar && <ResearchJourneyBar />}
      {children}
    </>
  )
}
