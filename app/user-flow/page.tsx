import { UserFlowPage } from '@/components/UserFlowPage'
import { PdfDownloadButton } from '@/components/PdfDownloadButton'
import Link from 'next/link'

export default function UserFlowRoute() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="relative mx-auto max-w-5xl px-4 py-10">
        <div className="absolute right-2 top-10 z-20 sm:right-4">
          <PdfDownloadButton fileName="moa-user-flow.pdf" />
        </div>

        <div id="moa-pdf-root">
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
                traducidos a pantallas y clics · MOA · Cliente actual y potencial
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 px-5 py-4 mb-8 space-y-2 text-sm text-cyan-950 leading-relaxed">
            <p>
              El flujo se construye a partir del <strong>User Journey Map</strong> guardado: las <strong>etapas en orden</strong>,
              los <strong>dolores</strong> y el rol de la <strong>web frente al POV</strong> se traducen a rectángulos (pantallas)
              y flechas (clics). Puede haber <strong>ramas</strong> (rombo) donde el journey sugiera bifurcación. El{' '}
              <strong>objetivo de conversión</strong> del diagrama debe alinearse con la etapa en que el journey indica que el
              POV se resuelve en la web.
            </p>
            <p className="text-xs text-cyan-900/85">
              Hace falta el <strong>User Journey Map guardado</strong> (obligatorio), más <strong>User Persona</strong> y{' '}
              <strong>POV</strong>. La IA no inventa un recorrido distinto al del journey. Referencia de símbolos:{' '}
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
              <Link href="/user-journey" className="font-semibold text-cyan-800 underline underline-offset-2">
                User Journey Map (base) →
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
    </main>
  )
}
