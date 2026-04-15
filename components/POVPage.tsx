'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { POVPersonaSource } from '@/components/POVPersonaSource'

// ── POV statement types ────────────────────────────────────────────────────────

interface POVStatement {
  usuario: string
  necesidad: string
  insight: string
}

interface POVPair {
  clienteActual: POVStatement
  clientePotencial: POVStatement
}

function normalizeSavedStatements(raw: unknown): POVPair | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (
    o.clienteActual &&
    o.clientePotencial &&
    typeof o.clienteActual === 'object' &&
    typeof o.clientePotencial === 'object'
  ) {
    return raw as POVPair
  }
  if (Array.isArray(raw) && raw.length >= 2) {
    return { clienteActual: raw[0] as POVStatement, clientePotencial: raw[1] as POVStatement }
  }
  return null
}

/** La UI concatena "[usuario] necesita …"; limpia colas típicas de la IA que chocan con esa plantilla. */
function sanitizePovUsuario(usuario: string): string {
  let s = usuario.trim()
  const stripEnd = (re: RegExp) => {
    const next = s.replace(re, '').trim()
    if (next !== s) s = next
  }
  stripEnd(/\s*,\s*que\s+busca\s+un\s+ambiente\s+a\s*$/i)
  stripEnd(/\s+que\s+busca\s+un\s+ambiente\s+a\s*$/i)
  stripEnd(/\s*,\s*que\s+busca\s+un\s+ambiente\s*$/i)
  stripEnd(/\s+que\s+busca\s+un\s+ambiente\s*$/i)
  stripEnd(/\s*,\s*que\s+ya\s*$/i)
  stripEnd(/\s+que\s+ya\s*$/i)
  // Si quedó "Patri en M" por límite de caracteres en el JSON guardado, completar Martorell (MOA)
  if (/Patri\s+en\s+M\s*$/i.test(s)) {
    s = s.replace(/Patri\s+en\s+M\s*$/i, 'Patri en Martorell').trim()
  }
  return s.trim()
}

function hasValidPersonasPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  const ca = o.clienteActual
  const cp = o.clientePotencial
  if (!ca || !cp || typeof ca !== 'object' || typeof cp !== 'object') return false
  const check = (p: Record<string, unknown>) =>
    typeof p.nombre === 'string' &&
    Array.isArray(p.motivaciones) &&
    p.motivaciones.length > 0 &&
    Array.isArray(p.necesidades) &&
    p.necesidades.length > 0
  return check(ca as Record<string, unknown>) && check(cp as Record<string, unknown>)
}

// ── POV Bubble ─────────────────────────────────────────────────────────────────

function formatInsightForPov(insight: string): { text: string; showClosingDot: boolean } {
  let t = insight.trim().replace(/\.{2,}\s*$/, '.')
  if (!t) return { text: t, showClosingDot: true }
  const showClosingDot = !/[.!?…]\s*$/.test(t)
  return { text: t, showClosingDot }
}

function POVBubble({
  statement,
  sectionLabel,
  tailLeft,
}: {
  statement: POVStatement
  sectionLabel: string
  tailLeft: boolean
}) {
  const { text: insightText, showClosingDot } = formatInsightForPov(statement.insight)
  return (
    <div className="flex flex-col" style={{ alignItems: tailLeft ? 'flex-start' : 'flex-end' }}>
      <div
        className="relative rounded-2xl border border-sky-200 px-6 py-5 max-w-2xl w-full"
        style={{ backgroundColor: '#dff1fb' }}
      >
        <span
          className="absolute -top-3 left-5 inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-white shadow-sm"
          style={{ backgroundColor: '#3b9fd4' }}
        >
          {sectionLabel}
        </span>

        <p className="text-sm leading-relaxed text-sky-900">
          <span className="text-sky-500 font-normal italic">{sanitizePovUsuario(statement.usuario)}</span>
          {' '}
          <span className="font-bold text-sky-800">necesita</span>
          {' '}
          <span className="text-sky-700">{statement.necesidad}</span>
          {' '}
          <span className="font-bold text-sky-800">porque</span>
          {' '}
          <span className="text-sky-600">{insightText}</span>
          {showClosingDot ? <span className="text-sky-400">.</span> : null}
        </p>
      </div>

      <div
        style={{
          width: 0,
          height: 0,
          marginLeft: tailLeft ? 28 : 'auto',
          marginRight: tailLeft ? 'auto' : 28,
          borderLeft: tailLeft ? '10px solid transparent' : '10px solid #dff1fb',
          borderRight: tailLeft ? '10px solid #dff1fb' : '10px solid transparent',
          borderTop: '10px solid #dff1fb',
          filter: 'drop-shadow(0 1px 0 #bae3f5)',
        }}
      />
    </div>
  )
}

// ── Main page component ────────────────────────────────────────────────────────

export function POVPage() {
  const [statements, setStatements] = useState<POVPair | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [personasOk, setPersonasOk] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/pov-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/user-persona-saved').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([povSaved, personaSaved]) => {
        if (povSaved?.saved) {
          const pair = normalizeSavedStatements(povSaved.saved.statements)
          setStatements(pair)
          setSavedAt(povSaved.saved.savedAt)
        }
        setPersonasOk(hasValidPersonasPayload(personaSaved?.saved?.personas))
      })
      .finally(() => setLoadingSaved(false))
  }, [])

  const saveStatements = async (data: POVPair) => {
    setSaving(true)
    try {
      const r = await fetch('/api/pov-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statements: data, filters: { fuente: 'user-persona' } }),
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
      const res = await fetch('/api/pov', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'No se pudieron generar los POV.')
        return
      }
      const pair: POVPair = { clienteActual: d.clienteActual, clientePotencial: d.clientePotencial }
      setStatements(pair)
      await saveStatements(pair)
    } catch {
      setGenError('No se pudieron generar los POV. Inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  if (loadingSaved) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  if (generating) {
    return (
      <div className="space-y-5 py-4">
        <div className="text-center space-y-2 py-4">
          <div className="inline-block h-6 w-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Leyendo user personas y construyendo los POV…</p>
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
          onClick={generate}
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors self-start sm:self-auto"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!statements) {
    return (
      <div className="space-y-5">
        <POVPersonaSource variant="full" />
        {!personasOk && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-medium">Faltan user personas guardados</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Genera y guarda los <strong>dos</strong> perfiles en la página User Persona; los POV se derivan solo de
              ahí.
            </p>
            <Link
              href="/user-persona"
              className="inline-block text-xs font-semibold text-amber-900 underline underline-offset-2"
            >
              Ir a User Persona →
            </Link>
          </div>
        )}
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center space-y-4">
          <div className="text-5xl">💬</div>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">Genera los POV de MOA</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Dos declaraciones <span className="italic">[Usuario] necesita [Necesidad] porque [Insight]</span>, una por
              cada <strong>user persona</strong> guardado (cliente actual y cliente potencial).
            </p>
          </div>
          <button
            onClick={generate}
            disabled={!personasOk}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors shadow-sm disabled:opacity-45 disabled:pointer-events-none"
          >
            ✦ Generar los 2 POV
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <POVPersonaSource variant="full" />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {saving ? (
            <>
              <span className="inline-block h-3 w-3 border border-gray-300 border-t-sky-400 rounded-full animate-spin" />
              Guardando…
            </>
          ) : savedAt ? (
            <>
              <span className="text-green-500">✓</span>
              Guardado el {savedAt}
            </>
          ) : null}
        </span>
        <button
          onClick={generate}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          ↺ Regenerar
        </button>
      </div>

      <div className="space-y-4">
        <POVBubble statement={statements.clienteActual} sectionLabel="Clientes actuales" tailLeft />
        <POVBubble statement={statements.clientePotencial} sectionLabel="Clientes potenciales" tailLeft={false} />
      </div>
    </div>
  )
}
