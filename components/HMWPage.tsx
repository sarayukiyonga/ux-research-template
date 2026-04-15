'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

export interface HMWQuestions {
  clienteActual: string[]
  clientePotencial: string[]
}

function normalizeQuestions(raw: unknown): HMWQuestions | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const a = o.clienteActual
  const b = o.clientePotencial
  if (!Array.isArray(a) || !Array.isArray(b)) return null
  const strList = (arr: unknown[]) =>
    arr.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim())
  const ca = strList(a)
  const cp = strList(b)
  if (ca.length === 0 && cp.length === 0) return null
  return { clienteActual: ca, clientePotencial: cp }
}

function hasPovShape(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false
  const o = d as Record<string, unknown>
  const ca = o.clienteActual
  const cp = o.clientePotencial
  if (!ca || !cp || typeof ca !== 'object' || typeof cp !== 'object') return false
  const st = (x: Record<string, unknown>) =>
    typeof x.usuario === 'string' &&
    typeof x.necesidad === 'string' &&
    typeof x.insight === 'string'
  return st(ca as Record<string, unknown>) && st(cp as Record<string, unknown>)
}

function HMWListBlock({
  title,
  accent,
  items,
}: {
  title: string
  accent: 'indigo' | 'violet'
  items: string[]
}) {
  const border = accent === 'indigo' ? 'border-indigo-200 bg-indigo-50/60' : 'border-violet-200 bg-violet-50/60'
  const bullet = accent === 'indigo' ? 'text-indigo-500' : 'text-violet-500'
  const text = accent === 'indigo' ? 'text-indigo-950' : 'text-violet-950'

  return (
    <div className={`rounded-2xl border-2 ${border} p-5 space-y-3`}>
      <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Sin preguntas en este bloque.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((q, i) => (
            <li key={i} className={`flex gap-3 text-sm leading-relaxed ${text}`}>
              <span className={`shrink-0 font-bold ${bullet}`}>{i + 1}.</span>
              <span>{q}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function HMWPage() {
  const [questions, setQuestions] = useState<HMWQuestions | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [povOk, setPovOk] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/hmw-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/pov-saved').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([hmwSaved, povSaved]) => {
        if (hmwSaved?.saved?.questions) {
          const n = normalizeQuestions(hmwSaved.saved.questions)
          if (n) {
            setQuestions(n)
            setSavedAt(hmwSaved.saved.savedAt ?? '')
          }
        }
        if (povSaved?.saved?.statements && hasPovShape(povSaved.saved.statements)) {
          setPovOk(true)
        }
      })
      .finally(() => setLoadingSaved(false))
  }, [])

  const saveQuestions = async (data: HMWQuestions) => {
    setSaving(true)
    try {
      const r = await fetch('/api/hmw-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: data, filters: { fuente: 'pov' } }),
      })
      const d = await r.json()
      if (d.savedAt) setSavedAt(d.savedAt)
    } catch {}
    setSaving(false)
  }

  const generate = async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/hmw', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'No se pudieron generar las preguntas HMW.')
        return
      }
      const n = normalizeQuestions(d)
      if (!n) {
        setGenError('La respuesta de la IA no tenía el formato esperado.')
        return
      }
      setQuestions(n)
      await saveQuestions(n)
    } catch {
      setGenError('No se pudieron generar las preguntas HMW. Inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  if (loadingSaved) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  if (generating) {
    return (
      <div className="space-y-5 py-4">
        <div className="text-center space-y-2 py-4">
          <div className="inline-block h-6 w-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Leyendo POV guardados y formulando retos How Might We…</p>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  if (genError) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-red-600">{genError}</p>
        <button
          type="button"
          onClick={() => void generate()}
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors self-start sm:self-auto"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!questions) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          <p>
            Las HMW se generan a partir de los{' '}
            <Link href="/pov" className="font-semibold text-indigo-600 underline underline-offset-2">
              dos POV guardados
            </Link>{' '}
            (cliente actual y potencial). Si cambias los POV, vuelve aquí y regenera para alinear los retos.
          </p>
        </div>
        {!povOk && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-medium">Faltan POV guardados</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Genera y guarda las dos declaraciones en la página Point of View (POV).
            </p>
            <Link
              href="/pov"
              className="inline-block text-xs font-semibold text-amber-900 underline underline-offset-2"
            >
              Ir a POV →
            </Link>
          </div>
        )}
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center space-y-4">
          <div className="text-5xl">❓</div>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">How Might We (HMW)</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
              Convierte cada POV en varias preguntas del tipo{' '}
              <span className="italic text-gray-700">«¿Cómo podríamos…?»</span> para abrir el abanico de soluciones de
              diseño (web, producto, comunicación).
            </p>
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!povOk}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-45 disabled:pointer-events-none"
          >
            ✦ Generar preguntas HMW
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        <p>
          Fuente:{' '}
          <Link href="/pov" className="font-semibold text-indigo-600 underline underline-offset-2">
            POV guardados
          </Link>
          . Regenera si actualizas los POV en esa página.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {saving ? (
            <>
              <span className="inline-block h-3 w-3 border border-gray-300 border-t-indigo-400 rounded-full animate-spin" />
              Guardando…
            </>
          ) : savedAt ? (
            <>
              <span className="text-green-500">✓</span>
              Guardado en Sheets · {savedAt}
            </>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => void generate()}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          ↺ Regenerar
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <HMWListBlock title="Clientes actuales" accent="indigo" items={questions.clienteActual} />
        <HMWListBlock title="Clientes potenciales" accent="violet" items={questions.clientePotencial} />
      </div>
    </div>
  )
}
