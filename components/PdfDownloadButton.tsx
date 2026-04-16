'use client'

import { useState } from 'react'
import { exportElementToPdf } from '@/lib/moa-pdf-export'

type Props = {
  fileName: string
  selector?: string
  label?: string
  className?: string
}

export function PdfDownloadButton({
  fileName,
  selector = '#moa-pdf-root',
  label = 'Descargar PDF',
  className,
}: Props) {
  const [busy, setBusy] = useState(false)

  return (
    <button
      type="button"
      data-html2canvas-ignore="true"
      disabled={busy}
      onClick={async () => {
        const el = document.querySelector(selector) as HTMLElement | null
        if (!el) {
          window.alert('No se encontró el área exportable de la página.')
          return
        }
        setBusy(true)
        try {
          await exportElementToPdf(el, fileName)
        } catch (e) {
          console.error(e)
          window.alert('No se pudo generar el PDF. Prueba de nuevo o usa otra página.')
        } finally {
          setBusy(false)
        }
      }}
      className={
        className ??
        'inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60'
      }
    >
      {busy ? 'Generando PDF…' : label}
    </button>
  )
}
