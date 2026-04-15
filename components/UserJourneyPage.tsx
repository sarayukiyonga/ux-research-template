'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

export interface JourneyEtapa {
  orden: number
  titulo: string
  descripcion: string
  puntosDeDolor: string[]
  rolWebFrenteAlPov: string
}

export interface JourneyForPersona {
  etiquetaPersona: string
  etapas: JourneyEtapa[]
  etapaOrdenPovResuelto: number
  sintesis: string
}

export interface UserJourneyBundle {
  clienteActual: JourneyForPersona
  clientePotencial: JourneyForPersona
}

function isEtapa(x: unknown): x is JourneyEtapa {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.orden === 'number' &&
    typeof o.titulo === 'string' &&
    typeof o.descripcion === 'string' &&
    Array.isArray(o.puntosDeDolor) &&
    typeof o.rolWebFrenteAlPov === 'string'
  )
}

function isJourneyForPersona(x: unknown): x is JourneyForPersona {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (typeof o.etiquetaPersona !== 'string' || typeof o.sintesis !== 'string') return false
  if (typeof o.etapaOrdenPovResuelto !== 'number') return false
  if (!Array.isArray(o.etapas) || o.etapas.length < 4) return false
  return o.etapas.every(isEtapa)
}

function normalizeBundle(raw: unknown): UserJourneyBundle | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!isJourneyForPersona(o.clienteActual) || !isJourneyForPersona(o.clientePotencial)) return null
  return {
    clienteActual: o.clienteActual,
    clientePotencial: o.clientePotencial,
  }
}

function hasValidPersonasSaved(personas: unknown): boolean {
  if (!personas || typeof personas !== 'object') return false
  const o = personas as Record<string, unknown>
  const ca = o.clienteActual
  const cp = o.clientePotencial
  if (!ca || !cp || typeof ca !== 'object' || typeof cp !== 'object') return false
  const check = (p: Record<string, unknown>) =>
    typeof p.nombre === 'string' &&
    Array.isArray(p.motivaciones) &&
    p.motivaciones.length > 0
  return check(ca as Record<string, unknown>) && check(cp as Record<string, unknown>)
}

function hasValidPovSaved(statements: unknown): boolean {
  if (!statements || typeof statements !== 'object') return false
  const o = statements as Record<string, unknown>
  const st = (x: unknown) => {
    if (!x || typeof x !== 'object') return false
    const s = x as Record<string, unknown>
    return (
      typeof s.usuario === 'string' &&
      typeof s.necesidad === 'string' &&
      typeof s.insight === 'string'
    )
  }
  return st(o.clienteActual) && st(o.clientePotencial)
}

function JourneyMapSection({
  journey,
  segmentLabel,
  accent,
}: {
  journey: JourneyForPersona
  segmentLabel: string
  accent: 'teal' | 'orange'
}) {
  const ring = accent === 'teal' ? 'ring-teal-400 shadow-teal-100' : 'ring-orange-400 shadow-orange-100'
  const badge = accent === 'teal' ? 'bg-teal-600' : 'bg-orange-600'
  const pain = accent === 'teal' ? 'text-rose-700 bg-rose-50 border-rose-100' : 'text-rose-800 bg-rose-50 border-rose-100'
  const webBox = accent === 'teal' ? 'border-teal-200 bg-teal-50/80 text-teal-900' : 'border-orange-200 bg-orange-50/80 text-orange-950'
  const claveBadge =
    accent === 'teal' ? 'text-teal-800 bg-teal-100' : 'text-orange-900 bg-orange-100'

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{segmentLabel}</h2>
          <p className="text-sm text-gray-500">{journey.etiquetaPersona}</p>
        </div>
      </div>

      <p className="text-sm text-gray-700 leading-relaxed rounded-xl border border-gray-200 bg-white px-4 py-3">
        <span className="font-semibold text-gray-800">Síntesis: </span>
        {journey.sintesis}
      </p>

      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-3 pt-1 snap-x snap-mandatory scroll-smooth">
          {journey.etapas.map((e) => {
            const clave = e.orden === journey.etapaOrdenPovResuelto
            return (
              <div
                key={e.orden}
                className={`snap-start shrink-0 w-[min(100%,20rem)] rounded-2xl border-2 bg-white p-4 space-y-3 transition-shadow ${
                  clave ? `ring-2 ${ring} shadow-md` : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${badge}`}
                  >
                    {e.orden}
                  </span>
                  {clave && (
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${claveBadge}`}>
                      POV ↔ web
                    </span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">{e.titulo}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{e.descripcion}</p>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600 mb-1.5">Puntos de dolor</p>
                  <ul className="space-y-1">
                    {e.puntosDeDolor.map((d, i) => (
                      <li
                        key={i}
                        className={`text-xs rounded-lg border px-2.5 py-1.5 leading-snug ${pain}`}
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${webBox}`}>
                  <p className="font-semibold text-[10px] uppercase tracking-wide opacity-80 mb-1">Web MOA y el POV</p>
                  <p>{e.rolWebFrenteAlPov}</p>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-1 hidden sm:block">
          Desplaza horizontalmente para ver todas las etapas →
        </p>
      </div>
    </section>
  )
}

export function UserJourneyPage() {
  const [bundle, setBundle] = useState<UserJourneyBundle | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [depsOk, setDepsOk] = useState({ persona: false, pov: false })

  useEffect(() => {
    Promise.all([
      fetch('/api/user-journey-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/user-persona-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/pov-saved').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([jSaved, personaSaved, povSaved]) => {
        if (jSaved?.saved?.journey) {
          const n = normalizeBundle(jSaved.saved.journey)
          if (n) {
            setBundle(n)
            setSavedAt(jSaved.saved.savedAt ?? '')
          }
        }
        setDepsOk({
          persona: hasValidPersonasSaved(personaSaved?.saved?.personas),
          pov: hasValidPovSaved(povSaved?.saved?.statements),
        })
      })
      .finally(() => setLoadingSaved(false))
  }, [])

  const saveBundle = async (data: UserJourneyBundle) => {
    setSaving(true)
    try {
      const r = await fetch('/api/user-journey-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journey: data, filters: { fuente: 'user-persona+pov' } }),
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
      const res = await fetch('/api/user-journey', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'No se pudo generar el User Journey Map.')
        return
      }
      const n = normalizeBundle(d)
      if (!n) {
        setGenError('La respuesta de la IA no tenía el formato esperado.')
        return
      }
      setBundle(n)
      await saveBundle(n)
    } catch {
      setGenError('No se pudo generar el mapa. Inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  const prereqOk = depsOk.persona && depsOk.pov

  if (loadingSaved) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (generating) {
    return (
      <div className="space-y-5 py-4">
        <div className="text-center space-y-2 py-4">
          <div className="inline-block h-6 w-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Construyendo los dos mapas de recorrido (web + POV)…</p>
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
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
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!bundle) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 space-y-2">
          <p>
            El mapa une cada <strong>User Persona</strong> con su <strong>POV</strong> y el recorrido en la{' '}
            <strong>web de MOA</strong>: etapas, dolores por paso y el momento en que la web aporta más al POV.
          </p>
          <p className="text-xs text-gray-500">
            Requiere los perfiles en{' '}
            <Link href="/user-persona" className="font-semibold text-teal-700 underline underline-offset-2">
              User Persona
            </Link>{' '}
            y los POV en{' '}
            <Link href="/pov" className="font-semibold text-teal-700 underline underline-offset-2">
              POV
            </Link>
            .
          </p>
        </div>

        {(!depsOk.persona || !depsOk.pov) && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-medium">Faltan datos guardados</p>
            <ul className="text-xs list-disc pl-4 space-y-1">
              {!depsOk.persona && <li>User Persona (cliente actual y potencial) guardados.</li>}
              {!depsOk.pov && <li>Los dos POV guardados.</li>}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center space-y-4">
          <div className="text-5xl">🛤️</div>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">User Journey Map</p>
            <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
              Dos recorridos (cliente actual y potencial): desde el problema hasta salir de la web, con puntos de dolor
              y el paso donde la interfaz mejor resuelve el POV.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!prereqOk}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-45 disabled:pointer-events-none"
          >
            ✦ Generar y guardar mapas
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 flex flex-wrap items-center justify-between gap-2">
        <p>
          Fuente:{' '}
          <Link href="/user-persona" className="font-semibold text-teal-700 underline underline-offset-2">
            User Persona
          </Link>{' '}
          +{' '}
          <Link href="/pov" className="font-semibold text-teal-700 underline underline-offset-2">
            POV
          </Link>
          . Regenera si cambias persona o POV.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {saving ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 border border-gray-300 border-t-teal-500 rounded-full animate-spin" />
                Guardando…
              </span>
            ) : savedAt ? (
              <span className="text-green-600">✓ Sheets · {savedAt}</span>
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
      </div>

      <JourneyMapSection journey={bundle.clienteActual} segmentLabel="Cliente actual" accent="teal" />
      <JourneyMapSection journey={bundle.clientePotencial} segmentLabel="Cliente potencial" accent="orange" />
    </div>
  )
}
