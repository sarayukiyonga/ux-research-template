import { CeoDashboard } from '@/components/CeoDashboard'
import { PdfDownloadButton } from '@/components/PdfDownloadButton'
import { CLIENT } from '@/lib/client-config'
import Link from 'next/link'

export default function CeoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative mx-auto max-w-3xl px-4 py-10">
        <div className="absolute right-2 top-10 z-20 sm:right-4">
          <PdfDownloadButton fileName="moa-entrevista-ceo.pdf" />
        </div>

        <div id="moa-pdf-root">
          {/* Nav */}
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
              Entrevista CEO
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                  Entrevista a {CLIENT.ownerFullName}
                </h1>
                <p className="mt-1 text-gray-500 text-sm">
                  Análisis estratégico de la empresa y del mercado
                </p>
              </div>
              <Link
                href="/design"
                className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-white border border-violet-200 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors shadow-sm"
              >
                <span>🎨</span>
                Principios →
              </Link>
            </div>
          </div>

          <CeoDashboard
            ownerFullName={CLIENT.ownerFullName}
            ownerRole={CLIENT.ownerRole}
            businessName={CLIENT.name}
          />
        </div>
      </div>
    </div>
  )
}
