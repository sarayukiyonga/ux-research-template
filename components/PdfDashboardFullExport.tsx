'use client'

import { useState } from 'react'
import { exportRoutesToCombinedPdf } from '@/lib/moa-pdf-export'
import { MOA_FULL_PDF_ROUTES } from '@/lib/moa-pdf-routes'

export function PdfDashboardFullExport({ fileName }: { fileName: string }) {
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      data-html2canvas-ignore="true"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        try {
          await exportRoutesToCombinedPdf(MOA_FULL_PDF_ROUTES, fileName)
        } catch (e) {
          console.error(e)
          window.alert(
            'No se pudo generar el informe completo. Asegúrate de tener sesión iniciada y vuelve a intentarlo.'
          )
        } finally {
          setBusy(false)
        }
      }}
      className="mx-auto mt-6 flex items-center justify-center rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 shadow-sm hover:bg-violet-100 disabled:opacity-60"
    >
      {busy ? 'Generando informe (puede tardar varios minutos)…' : 'Descargar informe completo (PDF)'}
    </button>
  )
}
