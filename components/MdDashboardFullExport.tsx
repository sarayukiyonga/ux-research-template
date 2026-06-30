'use client'

import { useMemo, useState } from 'react'
import { CLIENT_PDF_BASENAME } from '@/lib/client-config'

function downloadTextFile(filename: string, content: string, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function MdDashboardFullExport() {
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'copied' | 'downloaded' | 'error'>('idle')

  const filename = useMemo(() => `${CLIENT_PDF_BASENAME}-entregable-ia.md`, [])

  const run = async (mode: 'copy' | 'download') => {
    setBusy(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/dashboard-md', { redirect: 'manual' })
      if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
        window.alert('Necesitas iniciar sesión para generar el entregable.')
        window.location.href = '/login'
        return
      }
      if (!res.ok) throw new Error('No se pudo generar el markdown.')
      const ct = res.headers.get('content-type') ?? ''
      const text = await res.text()
      if (!ct.includes('text/markdown') && text.trim().startsWith('<!DOCTYPE html')) {
        throw new Error('Respuesta inesperada (HTML) en lugar de Markdown.')
      }
      if (!text.trim()) throw new Error('El markdown está vacío.')

      if (mode === 'copy') {
        try {
          await navigator.clipboard.writeText(text)
          setStatus('copied')
        } catch {
          downloadTextFile(filename, text)
          setStatus('downloaded')
        }
      } else {
        downloadTextFile(filename, text)
        setStatus('downloaded')
      }

      window.setTimeout(() => setStatus((s) => (s === 'idle' ? s : 'idle')), 2400)
    } catch (e) {
      console.error(e)
      setStatus('error')
      window.alert('No se pudo generar el entregable en Markdown. Revisa que tengas acceso a Sheets y vuelve a intentarlo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto mt-3 flex flex-col items-center gap-2" data-html2canvas-ignore="true">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('copy')}
          className="rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? 'Generando…' : 'Copiar entregable (MD)'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('download')}
          className="rounded-xl border-2 border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 shadow-sm hover:bg-violet-100 disabled:opacity-60"
        >
          {busy ? 'Generando…' : 'Descargar entregable (MD)'}
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {status === 'copied'
          ? 'Copiado al portapapeles.'
          : status === 'downloaded'
            ? 'Descargado.'
            : status === 'error'
              ? 'Error al generar.'
              : 'Úsalo para pasar todo el proceso a otra IA y diseñar la web.'}
      </p>
    </div>
  )
}

