import { UserFlowPage } from '@/components/UserFlowPage'
import { PdfDownloadButton } from '@/components/PdfDownloadButton'
import { CLIENT, CLIENT_PDF_BASENAME, PDF_CAPTURE_ROOT_ID } from '@/lib/client-config'
import Link from 'next/link'

export default function UserFlowRoute() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative mx-auto max-w-5xl px-4 py-10">
        <div className="absolute right-2 top-10 z-20 sm:right-4">
          <PdfDownloadButton fileName={`${CLIENT_PDF_BASENAME}-user-flow.pdf`} />
        </div>

        <div id={PDF_CAPTURE_ROOT_ID}>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-6"
          >
            ← Volver al dashboard
          </Link>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-100 px-3 py-1 text-xs font-medium text-cyan-900 mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
              Design Thinking
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">User Flow (flujo de usuario)</h1>
              <p className="mt-1 text-gray-500 text-sm">
                Diagrama de flujo basado en el <strong>User Journey Map</strong> guardado: etapas, dolores y web↔POV
                traducidos a pantallas y clics · {CLIENT.name} · Cliente actual y potencial
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 px-5 py-4 mb-8 space-y-2 text-sm text-cyan-950 leading-relaxed">
            <p>
              El flujo combina las <strong>funcionalidades Must del MoSCoW</strong> con el{' '}
              <strong>User Journey Map</strong>: las etapas, dolores y el rol de la web frente al POV
              se traducen en pantallas (rectángulos) y clics (flechas). Las decisiones (rombos) aparecen
              donde las funcionalidades Must o los dolores del journey sugieren bifurcación.
            </p>
            <p className="text-xs text-cyan-900/85">
              Requiere: <strong>MoSCoW guardado</strong> (Must) + <strong>User Journey Map</strong> +{' '}
              <strong>User Persona</strong> + <strong>POV</strong>. Si no hay MoSCoW guardado, el flujo
              se basa solo en el journey. Referencia de símbolos:{' '}
              <a
                href="https://www.smartdraw.com/flowchart/simbolos-de-diagramas-de-flujo.htm"
                className="font-semibold underline underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                SmartDraw — símbolos de diagramas de flujo
              </a>
              .
            </p>
            <p className="text-xs flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <Link href="/mapa-sitio" className="font-semibold text-cyan-800 underline underline-offset-2">
                ← Mapa del Sitio
              </Link>
              <Link href="/user-journey" className="font-semibold text-cyan-800 underline underline-offset-2">
                User Journey Map →
              </Link>
              <Link href="/user-persona" className="font-semibold text-cyan-800 underline underline-offset-2">
                User Persona →
              </Link>
              <Link href="/pov" className="font-semibold text-cyan-800 underline underline-offset-2">
                POV →
              </Link>
            </p>
          </div>

          <UserFlowPage />
        </div>
      </div>
    </div>
  )
}
