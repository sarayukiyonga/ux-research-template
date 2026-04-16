'use client'

import { useState, useEffect, useId, type ReactNode } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import type { FlowPaso, FlowNodo, UserFlowLine } from '@/lib/user-flow-tree'
import {
  emptyFlowV3,
  getFlowLineForSegmentChannel,
  parseUserFlowPersist,
  syncFlowCatalogFromJourneyV3,
  type UserFlowV3Persist,
} from '@/lib/user-flow-tree'
import {
  parsePersistedJourneyCell,
  parseUserJourneySavedFilters,
  savedJourneyCellHasFlowBundle,
  toJourneyV3,
} from '@/lib/user-journey-persist'
import { newCustomJourneyCanalId, normalizeCanalInCatalog } from '@/lib/user-journey-channels'

export type { FlowPaso, UserFlowLine, UserFlowBundle } from '@/lib/user-flow-tree'

function hasValidPersonasSaved(personas: unknown): boolean {
  if (!personas || typeof personas !== 'object') return false
  const o = personas as Record<string, unknown>
  const ca = o.clienteActual
  const cp = o.clientePotencial
  if (!ca || !cp || typeof ca !== 'object' || typeof cp !== 'object') return false
  const check = (p: Record<string, unknown>) =>
    typeof p.nombre === 'string' && Array.isArray(p.motivaciones) && p.motivaciones.length > 0
  return check(ca as Record<string, unknown>) && check(cp as Record<string, unknown>)
}

function flowV3HasAnyDiagram(f: UserFlowV3Persist): boolean {
  return (
    Object.keys(f.clienteActual.diagramas).length > 0 ||
    Object.keys(f.clientePotencial.diagramas).length > 0
  )
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

const SMARTDRAW_FLOWCHART_URL =
  'https://www.smartdraw.com/flowchart/simbolos-de-diagramas-de-flujo.htm'

/** Paralelogramo: entrada/salida de datos (canal por el que entra el usuario). */
function FlowParallelogram({
  children,
  borderClass,
  bgClass,
}: {
  children: ReactNode
  borderClass: string
  bgClass: string
}) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 w-[7.25rem]">
      <div className={`w-full skew-x-[-12deg] rounded-sm border-2 px-2 py-2.5 shadow-sm ${borderClass} ${bgClass}`}>
        <div className="skew-x-[12deg] text-center text-[10px] font-semibold leading-tight text-gray-900 line-clamp-5">
          {children}
        </div>
      </div>
      <span className="text-[9px] font-medium uppercase tracking-wide text-gray-500">Entrada / salida</span>
    </div>
  )
}

function FlowchartProcessBox({
  title,
  tipo,
  accent,
}: {
  title: string
  tipo: FlowPaso['tipo']
  accent: 'cyan' | 'orange'
}) {
  const accentBorder = accent === 'cyan' ? 'border-cyan-600' : 'border-orange-600'
  const accentBg = accent === 'cyan' ? 'bg-cyan-50' : 'bg-orange-50'

  if (tipo === 'entrada' || tipo === 'salida') {
    return (
      <div
        className={`flex min-h-[3.25rem] min-w-[5.5rem] max-w-[6.75rem] shrink-0 items-center justify-center rounded-full border-2 px-2 py-2 text-center text-[10px] font-bold leading-tight shadow-sm ${
          tipo === 'entrada'
            ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
            : 'border-slate-500 bg-slate-50 text-slate-800'
        }`}
      >
        {title}
      </div>
    )
  }

  if (tipo === 'conversion') {
    return (
      <div className="rounded-md p-[3px] bg-amber-400/90 shadow-sm">
        <div
          className={`flex min-h-[3.25rem] min-w-[5.5rem] max-w-[6.75rem] items-center justify-center rounded-[4px] border-2 border-amber-800 bg-amber-50 px-2 py-2 text-center text-[10px] font-bold leading-tight text-amber-950`}
        >
          {title}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex min-h-[3.25rem] min-w-[5.5rem] max-w-[6.75rem] shrink-0 items-center justify-center rounded-md border-2 px-2 py-2 text-center text-[10px] font-semibold leading-tight shadow-sm ${accentBorder} ${accentBg} text-gray-900`}
    >
      {title}
    </div>
  )
}

function FlowArrowConnector({
  label,
  strokeClass,
}: {
  label: string
  strokeClass: string
}) {
  const uid = useId().replace(/:/g, '')
  const markerId = `arrow-${uid}`

  return (
    <div className="flex w-[5.25rem] shrink-0 flex-col items-center justify-start gap-1 pt-2">
      <svg width="84" height="22" viewBox="0 0 84 22" className={strokeClass} aria-hidden>
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,3 L0,6 Z" fill="currentColor" />
          </marker>
        </defs>
        <line x1="2" y1="11" x2="76" y2="11" stroke="currentColor" strokeWidth="2" markerEnd={`url(#${markerId})`} />
      </svg>
      <p className="max-w-[5rem] text-center text-[9px] font-medium leading-tight text-gray-600">{label || '—'}</p>
    </div>
  )
}

function FlowDownArrow({ label, strokeClass }: { label: string; strokeClass: string }) {
  const uid = useId().replace(/:/g, '')
  const markerId = `darrow-${uid}`

  return (
    <div className="flex flex-col items-center gap-1 py-1 shrink-0">
      <svg width="22" height="52" viewBox="0 0 22 52" className={strokeClass} aria-hidden>
        <defs>
          <marker id={markerId} markerWidth="6" markerHeight="8" refX="3" refY="7" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L3,8 L6,0 Z" fill="currentColor" />
          </marker>
        </defs>
        <line x1="11" y1="4" x2="11" y2="44" stroke="currentColor" strokeWidth="2" markerEnd={`url(#${markerId})`} />
      </svg>
      <p className="max-w-[7rem] text-center text-[9px] font-semibold leading-tight text-gray-700">{label || '—'}</p>
    </div>
  )
}

function FlowDiamond({
  titulo,
  descripcion,
  accent,
}: {
  titulo: string
  descripcion: string
  accent: 'cyan' | 'orange'
}) {
  const border = accent === 'cyan' ? 'border-indigo-600 bg-indigo-50' : 'border-purple-700 bg-purple-50'
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 w-[5.5rem]">
      <div className="relative flex h-[4.25rem] w-[4.25rem] items-center justify-center">
        <div className={`absolute inset-[5px] rotate-45 rounded-sm border-2 shadow-sm ${border}`} aria-hidden />
        <span className="relative z-10 max-w-[3.25rem] text-center text-[9px] font-bold leading-tight text-gray-900">
          {titulo}
        </span>
      </div>
      <p className="text-[8px] text-center text-gray-500 leading-snug line-clamp-3 max-w-[6rem]" title={descripcion}>
        {descripcion}
      </p>
      <span className="text-[9px] font-medium uppercase tracking-wide text-gray-500">Decisión</span>
    </div>
  )
}

function HorizontalLinealSteps({
  pasos,
  clics,
  accent,
  stroke,
}: {
  pasos: FlowPaso[]
  clics: string[]
  accent: 'cyan' | 'orange'
  stroke: string
}) {
  const ordenados = [...pasos].sort((a, b) => a.orden - b.orden)
  return (
    <>
      {ordenados.map((p, i) => (
        <div key={`${p.orden}-${i}`} className="flex items-start">
          <div className="flex w-[6.75rem] shrink-0 flex-col items-center gap-1.5">
            <FlowchartProcessBox title={p.tituloBolita} tipo={p.tipo} accent={accent} />
            <p className="text-[9px] text-center text-gray-500 leading-snug px-0.5 line-clamp-3" title={p.descripcion}>
              {p.descripcion}
            </p>
          </div>
          {i < ordenados.length - 1 && <FlowArrowConnector label={clics[i] ?? '—'} strokeClass={stroke} />}
        </div>
      ))}
    </>
  )
}

function RenderFlowNodo({
  nodo,
  accent,
  stroke,
}: {
  nodo: FlowNodo
  accent: 'cyan' | 'orange'
  stroke: string
}) {
  if (nodo.tipo === 'lineal') {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex flex-row flex-wrap items-start">
          <HorizontalLinealSteps pasos={nodo.pasos} clics={nodo.clicsEntrePasos} accent={accent} stroke={stroke} />
        </div>
        {nodo.despues != null && (
          <div className="flex w-full flex-col items-center border-t border-dashed border-gray-200 pt-3 mt-1">
            <FlowDownArrow label="Continúa el flujo" strokeClass={stroke} />
            <RenderFlowNodo nodo={nodo.despues} accent={accent} stroke={stroke} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-4xl">
      <FlowDiamond titulo={nodo.tituloDiamante} descripcion={nodo.descripcion} accent={accent} />
      <div className="flex w-full flex-row flex-wrap items-start justify-center gap-y-6 gap-x-4 sm:gap-x-8">
        {nodo.ramas.map((rama, idx) => (
          <div
            key={`${rama.etiqueta}-${idx}`}
            className="flex min-w-[9rem] max-w-[14rem] flex-1 flex-col items-center rounded-xl border border-gray-100 bg-white/80 px-2 py-3 shadow-sm"
          >
            <FlowDownArrow label={rama.etiqueta} strokeClass={stroke} />
            <RenderFlowNodo nodo={rama.siguiente} accent={accent} stroke={stroke} />
          </div>
        ))}
      </div>
    </div>
  )
}

function FlowchartLegend({ accent }: { accent: 'cyan' | 'orange' }) {
  const proc = accent === 'cyan' ? 'border-cyan-600 bg-cyan-50' : 'border-orange-600 bg-orange-50'
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2.5 text-[10px] text-gray-600">
      <p className="font-semibold text-gray-700 mb-2">Leyenda (diagrama de flujo)</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-5 w-9 rounded-full border-2 border-emerald-600 bg-emerald-50 shrink-0" />
          Inicio / fin (óvalo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-5 w-10 rounded-sm border-2 shrink-0 ${proc}`} />
          Proceso (rectángulo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="relative inline-block h-4 w-4 shrink-0 rotate-45 border-2 border-indigo-600 bg-indigo-50"
            aria-hidden
          />
          Decisión (rombo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-5 w-10 -skew-x-12 border-2 border-violet-400 bg-violet-50 shrink-0 rounded-sm"
            aria-hidden
          />
          Entrada-salida datos (paralelogramo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-5 items-center rounded p-px bg-amber-400">
            <span className="inline-block h-full w-9 rounded-[2px] border-2 border-amber-900 bg-amber-50" />
          </span>
          Conversión (proceso destacado)
        </span>
      </div>
      <p className="mt-2 text-[9px] text-gray-500">
        Convención según símbolos habituales de diagramas de flujo (
        <a href={SMARTDRAW_FLOWCHART_URL} className="underline underline-offset-2 text-cyan-700" target="_blank" rel="noreferrer">
          referencia SmartDraw
        </a>
        ).
      </p>
    </div>
  )
}

function UserFlowchartSection({
  flow,
  segmentLabel,
  canalSubtitle,
  accent,
}: {
  flow: UserFlowLine
  segmentLabel: string
  canalSubtitle?: string
  accent: 'cyan' | 'orange'
}) {
  const stroke = accent === 'cyan' ? 'text-cyan-700' : 'text-orange-700'
  const paraBorder = accent === 'cyan' ? 'border-violet-500' : 'border-violet-600'
  const paraBg = 'bg-violet-50/90'
  const { raiz } = flow

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          {segmentLabel}
          {canalSubtitle ? (
            <span className="block text-sm font-normal text-gray-500 mt-0.5">Canal: {canalSubtitle}</span>
          ) : null}
        </h2>
        <p className="text-sm text-gray-500">{flow.arquetipo}</p>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-sm text-amber-950">
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/80 mb-0.5">Objetivo de conversión</p>
        <p className="leading-snug">{flow.objetivoConversion}</p>
      </div>

      <FlowchartLegend accent={accent} />

      <div className="overflow-x-auto pb-2 pt-1">
        <div className="inline-flex min-w-min flex-col gap-5 px-1 pt-1">
          <div className="flex flex-row flex-wrap items-start gap-0">
            <FlowParallelogram borderClass={paraBorder} bgClass={paraBg}>
              {flow.deDondeEntra}
            </FlowParallelogram>

            <FlowArrowConnector
              label="Llega a la primera pantalla del flujo (carga / enlace)"
              strokeClass={stroke}
            />

            {raiz.tipo === 'lineal' ? (
              <div className="flex flex-row flex-wrap items-start">
                <HorizontalLinealSteps
                  pasos={raiz.pasos}
                  clics={raiz.clicsEntrePasos}
                  accent={accent}
                  stroke={stroke}
                />
              </div>
            ) : null}
          </div>

          {raiz.tipo === 'decision' && (
            <div className="w-full min-w-[min(100%,42rem)]">
              <RenderFlowNodo nodo={raiz} accent={accent} stroke={stroke} />
            </div>
          )}

          {raiz.tipo === 'lineal' && raiz.despues != null && (
            <div className="flex w-full min-w-[min(100%,48rem)] flex-col items-center border-t border-gray-200 pt-4">
              <FlowDownArrow label="Continúa el flujo" strokeClass={stroke} />
              <RenderFlowNodo nodo={raiz.despues} accent={accent} stroke={stroke} />
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-400 sm:hidden">Desplaza horizontalmente para ver ramas y el diagrama →</p>
    </section>
  )
}

function SegmentFlowPanel({
  flow,
  segmento,
  nuevoCanalLabel,
  onNuevoCanalLabel,
  onSelectSegment,
  onSelectCanal,
  onAddCanal,
  disabled,
}: {
  flow: UserFlowV3Persist
  segmento: 'clienteActual' | 'clientePotencial'
  nuevoCanalLabel: string
  onNuevoCanalLabel: (s: string) => void
  onSelectSegment: (s: 'clienteActual' | 'clientePotencial') => void
  onSelectCanal: (id: string) => void
  onAddCanal: () => void
  disabled?: boolean
}) {
  const seg = flow[segmento]
  const tabOn =
    segmento === 'clienteActual'
      ? 'border-cyan-600 bg-cyan-50 text-cyan-900'
      : 'border-orange-500 bg-orange-50 text-orange-950'
  const tabOff = 'border-gray-200 text-gray-600 hover:bg-gray-50'
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Segmento y canal del diagrama</h2>
        <p className="text-xs text-gray-500 mt-1">
          Un diagrama por <strong>tipo de cliente</strong> y <strong>canal</strong>. Los canales se sincronizan con el
          User Journey; puedes añadir más solo en este segmento.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist">
        <button
          type="button"
          role="tab"
          disabled={disabled}
          onClick={() => onSelectSegment('clienteActual')}
          className={`text-xs font-semibold rounded-full px-3 py-1.5 border ${
            segmento === 'clienteActual' ? tabOn : tabOff
          }`}
        >
          Cliente actual
        </button>
        <button
          type="button"
          role="tab"
          disabled={disabled}
          onClick={() => onSelectSegment('clientePotencial')}
          className={`text-xs font-semibold rounded-full px-3 py-1.5 border ${
            segmento === 'clientePotencial' ? tabOn : tabOff
          }`}
        >
          Cliente potencial
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {seg.catalogo.map((c) => {
          const tiene = Boolean(seg.diagramas[c.id])
          const active = seg.canalActivoId === c.id
          return (
            <button
              key={c.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectCanal(c.id)}
              className={`text-xs font-medium rounded-full px-3 py-1.5 border ${
                active ? tabOn : tabOff
              } ${disabled ? 'opacity-45' : ''}`}
            >
              {c.label}
              {tiene ? ' · diagrama' : ''}
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-2 items-end border-t border-gray-100 pt-3">
        <label className="flex-1 min-w-[12rem] space-y-1">
          <span className="text-[11px] font-medium text-gray-500">Canal adicional (solo este segmento)</span>
          <input
            type="text"
            value={nuevoCanalLabel}
            onChange={(e) => onNuevoCanalLabel(e.target.value)}
            maxLength={80}
            disabled={disabled}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            placeholder="Nombre del canal"
          />
        </label>
        <button
          type="button"
          disabled={disabled || !nuevoCanalLabel.trim()}
          onClick={() => onAddCanal()}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Añadir
        </button>
      </div>
    </section>
  )
}

export function UserFlowPage() {
  const [flow, setFlow] = useState<UserFlowV3Persist | null>(null)
  const [segmento, setSegmento] = useState<'clienteActual' | 'clientePotencial'>('clienteActual')
  const [nuevoCanalLabel, setNuevoCanalLabel] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [depsOk, setDepsOk] = useState({ persona: false, pov: false, journey: false })

  useEffect(() => {
    Promise.all([
      fetch('/api/user-flow-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/user-persona-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/pov-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/user-journey-saved').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([fSaved, personaSaved, povSaved, journeySaved]) => {
        let next = parseUserFlowPersist(fSaved?.saved?.flows) ?? emptyFlowV3()
        const jCell = parsePersistedJourneyCell(journeySaved?.saved?.journey)
        const v3j = jCell ? toJourneyV3(jCell) : null
        if (v3j) next = syncFlowCatalogFromJourneyV3(next, v3j)
        const filt = parseUserJourneySavedFilters(journeySaved?.saved?.filters)
        next = {
          ...next,
          clienteActual: {
            ...next.clienteActual,
            canalActivoId: normalizeCanalInCatalog(
              filt.canalPorSegmento?.clienteActual ?? next.clienteActual.canalActivoId,
              next.clienteActual.catalogo
            ),
          },
          clientePotencial: {
            ...next.clientePotencial,
            canalActivoId: normalizeCanalInCatalog(
              filt.canalPorSegmento?.clientePotencial ?? next.clientePotencial.canalActivoId,
              next.clientePotencial.catalogo
            ),
          },
        }
        if (filt.segmentoActivo === 'clienteActual' || filt.segmentoActivo === 'clientePotencial') {
          setSegmento(filt.segmentoActivo)
        }
        setFlow(next)
        if (typeof fSaved?.saved?.savedAt === 'string') setSavedAt(fSaved.saved.savedAt)
        setDepsOk({
          persona: hasValidPersonasSaved(personaSaved?.saved?.personas),
          pov: hasValidPovSaved(povSaved?.saved?.statements),
          journey: savedJourneyCellHasFlowBundle(journeySaved?.saved?.journey, journeySaved?.saved?.filters),
        })
      })
      .finally(() => setLoadingSaved(false))
  }, [])

  const buildFilters = (f: UserFlowV3Persist, seg: typeof segmento) => ({
    fuente: 'persona+pov+journey',
    segmentoActivo: seg,
    canalPorSegmento: {
      clienteActual: f.clienteActual.canalActivoId,
      clientePotencial: f.clientePotencial.canalActivoId,
    },
  })

  const saveFlow = async (data: UserFlowV3Persist, seg: typeof segmento = segmento) => {
    setSaving(true)
    try {
      const r = await fetch('/api/user-flow-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flows: data, filters: buildFilters(data, seg) }),
      })
      const d = await r.json()
      if (d.savedAt) setSavedAt(d.savedAt)
    } catch {}
    setSaving(false)
  }

  const handleSelectSegment = async (s: typeof segmento) => {
    setSegmento(s)
    if (flow) await saveFlow(flow, s)
  }

  const handleSelectCanal = async (id: string) => {
    if (!flow) return
    const seg = flow[segmento]
    const nid = normalizeCanalInCatalog(id, seg.catalogo)
    const next: UserFlowV3Persist = { ...flow, [segmento]: { ...seg, canalActivoId: nid } }
    setFlow(next)
    await saveFlow(next)
  }

  const handleAddCanal = async () => {
    if (!flow) return
    const label = nuevoCanalLabel.trim()
    if (!label) return
    const id = newCustomJourneyCanalId()
    const seg = flow[segmento]
    const next: UserFlowV3Persist = {
      ...flow,
      [segmento]: {
        ...seg,
        catalogo: [...seg.catalogo, { id, label, esPreset: false }],
        canalActivoId: id,
        diagramas: { ...seg.diagramas },
      },
    }
    setNuevoCanalLabel('')
    setFlow(next)
    await saveFlow(next)
  }

  const mergeGeneratedFlow = (
    prev: UserFlowV3Persist,
    seg: typeof segmento,
    canalId: string,
    line: UserFlowLine
  ): UserFlowV3Persist => ({
    ...prev,
    [seg]: {
      ...prev[seg],
      diagramas: { ...prev[seg].diagramas, [canalId]: line },
    },
  })

  const generate = async () => {
    if (!flow) return
    setGenerating(true)
    setGenError(null)
    try {
      const canalPorSegmento = {
        clienteActual: flow.clienteActual.canalActivoId,
        clientePotencial: flow.clientePotencial.canalActivoId,
      }
      const res = await fetch('/api/user-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canalPorSegmento }),
      })
      const text = await res.text()
      let d: Record<string, unknown>
      try {
        d = JSON.parse(text) as Record<string, unknown>
      } catch {
        setGenError(
          res.ok
            ? 'Respuesta del servidor no es JSON válido.'
            : `Error ${res.status}: ${text.slice(0, 280)}${text.length > 280 ? '…' : ''}`
        )
        return
      }
      if (!res.ok) {
        const err = d.error
        setGenError(typeof err === 'string' ? err : `Error ${res.status} al generar el User Flow.`)
        return
      }
      if (d.version !== 3 || !d.clienteActual || !d.clientePotencial) {
        setGenError('La respuesta no tiene el formato v3 esperado.')
        return
      }
      const cps = d.canalPorSegmento as { clienteActual?: string; clientePotencial?: string }
      const ca = typeof cps?.clienteActual === 'string' ? cps.clienteActual : flow.clienteActual.canalActivoId
      const cp = typeof cps?.clientePotencial === 'string' ? cps.clientePotencial : flow.clientePotencial.canalActivoId
      let next = flow
      next = mergeGeneratedFlow(next, 'clienteActual', ca, d.clienteActual as UserFlowLine)
      next = mergeGeneratedFlow(next, 'clientePotencial', cp, d.clientePotencial as UserFlowLine)
      setFlow(next)
      await saveFlow(next)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error de red o desconocido.'
      setGenError(`No se pudo generar el flujo: ${msg}`)
    } finally {
      setGenerating(false)
    }
  }

  const generateOne = async () => {
    if (!flow) return
    setGenerating(true)
    setGenError(null)
    try {
      const canalPorSegmento = {
        clienteActual: flow.clienteActual.canalActivoId,
        clientePotencial: flow.clientePotencial.canalActivoId,
      }
      const res = await fetch('/api/user-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmento, canalPorSegmento }),
      })
      const text = await res.text()
      let d: Record<string, unknown>
      try {
        d = JSON.parse(text) as Record<string, unknown>
      } catch {
        setGenError(res.ok ? 'Respuesta no JSON.' : `Error ${res.status}`)
        return
      }
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'Error al generar.')
        return
      }
      if (d.version !== 3 || d.segmento !== segmento || !d.flow || typeof d.canalId !== 'string') {
        setGenError('Respuesta incompleta del servidor.')
        return
      }
      const next = mergeGeneratedFlow(flow, segmento, d.canalId as string, d.flow as UserFlowLine)
      setFlow(next)
      await saveFlow(next)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Error de red')
    } finally {
      setGenerating(false)
    }
  }

  const prereqOk = depsOk.persona && depsOk.pov && depsOk.journey

  if (loadingSaved) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!flow) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        No se pudo cargar el estado del User Flow. Recarga la página.
      </div>
    )
  }

  const accent = segmento === 'clienteActual' ? 'cyan' : 'orange'
  const segmentLabel = segmento === 'clienteActual' ? 'Cliente actual' : 'Cliente potencial'
  const activeCanalId = flow[segmento].canalActivoId
  const activeLine = getFlowLineForSegmentChannel(flow, segmento, activeCanalId)
  const canalLabel = flow[segmento].catalogo.find((c) => c.id === activeCanalId)?.label

  return (
    <div className="space-y-12">
      {genError ? (
        <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-red-600">{genError}</p>
          <button
            type="button"
            onClick={() => {
              setGenError(null)
              void generate()
            }}
            className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
          >
            Reintentar (ambos segmentos)
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 space-y-2">
        <p>
          El <strong>User Flow</strong> es un diagrama con ramas (óvalos, rectángulos, rombos, paralelogramos) derivado
          del <strong>User Journey</strong> por <strong>segmento</strong> y <strong>canal</strong>. Puedes tener un
          diagrama distinto para cada combinación; la IA usa el journey guardado del canal activo en cada segmento.
        </p>
        <p className="text-xs text-gray-500">
          Símbolos habituales:{' '}
          <a
            href={SMARTDRAW_FLOWCHART_URL}
            className="font-semibold text-cyan-700 underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            SmartDraw
          </a>
          .
        </p>
      </div>

      {(!depsOk.persona || !depsOk.pov || !depsOk.journey) && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
          <p className="font-medium">Faltan datos guardados</p>
          <ul className="text-xs list-disc pl-4 space-y-1">
            {!depsOk.journey && (
              <li>
                <Link href="/user-journey" className="font-semibold underline underline-offset-2">
                  User Journey Map
                </Link>{' '}
                guardado con mapas para los canales activos por segmento.
              </li>
            )}
            {!depsOk.persona && <li>User Persona (ambos segmentos).</li>}
            {!depsOk.pov && <li>POV guardados.</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        <p>
          Base:{' '}
          <Link href="/user-journey" className="font-semibold text-cyan-800 underline underline-offset-2">
            User Journey Map
          </Link>
          {' · '}
          <Link href="/user-persona" className="font-semibold text-cyan-700 underline underline-offset-2">
            Persona
          </Link>
          {' + '}
          <Link href="/pov" className="font-semibold text-cyan-700 underline underline-offset-2">
            POV
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-400">
            {generating ? (
              <span className="inline-flex items-center gap-1 text-cyan-700">
                <span className="inline-block h-3 w-3 border border-cyan-200 border-t-cyan-600 rounded-full animate-spin" />
                Generando…
              </span>
            ) : saving ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 border border-gray-300 border-t-cyan-500 rounded-full animate-spin" />
                Guardando…
              </span>
            ) : savedAt ? (
              <span className="text-green-600">✓ Sheets · {savedAt}</span>
            ) : null}
          </span>
          <button
            type="button"
            disabled={!prereqOk || generating}
            onClick={() => void generateOne()}
            className="text-xs px-3 py-1.5 rounded-full border border-cyan-200 text-cyan-800 bg-cyan-50/80 hover:bg-cyan-100 transition-colors disabled:opacity-45"
          >
            Generar solo este segmento · canal
          </button>
          <button
            type="button"
            disabled={!prereqOk || generating}
            onClick={() => void generate()}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-45"
          >
            ↺ Regenerar ambos segmentos
          </button>
        </div>
      </div>

      <SegmentFlowPanel
        flow={flow}
        segmento={segmento}
        nuevoCanalLabel={nuevoCanalLabel}
        onNuevoCanalLabel={setNuevoCanalLabel}
        onSelectSegment={(s) => void handleSelectSegment(s)}
        onSelectCanal={(id) => void handleSelectCanal(id)}
        onAddCanal={() => void handleAddCanal()}
        disabled={generating || saving}
      />

      {!flowV3HasAnyDiagram(flow) && prereqOk ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center space-y-4">
          <div className="text-5xl">🔀</div>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">User Flow (diagrama de flujo)</p>
            <p className="text-sm text-gray-500 max-w-lg mx-auto leading-relaxed">
              Genera diagramas para los canales activos de cada segmento (o solo el segmento y canal seleccionados).
              Cada canal puede tener su propio diagrama guardado en Sheets.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!prereqOk || generating}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 transition-colors shadow-sm disabled:opacity-45 disabled:pointer-events-none"
          >
            ✦ Generar y guardar (ambos segmentos)
          </button>
        </div>
      ) : null}

      {!activeLine && flowV3HasAnyDiagram(flow) ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-8 text-center text-sm text-gray-600 space-y-3">
          <p>
            No hay diagrama guardado para <strong>{segmentLabel}</strong>
            {canalLabel ? (
              <>
                {' '}
                en el canal <strong>{canalLabel}</strong>
              </>
            ) : null}
            . Genera el journey para ese canal en User Journey y pulsa generar aquí.
          </p>
          <button
            type="button"
            disabled={!prereqOk || generating}
            onClick={() => void generateOne()}
            className="text-xs px-4 py-2 rounded-full bg-white border border-gray-300 font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-45"
          >
            Generar diagrama para este segmento y canal
          </button>
        </div>
      ) : null}
      {activeLine ? (
        <UserFlowchartSection
          flow={activeLine}
          segmentLabel={segmentLabel}
          canalSubtitle={canalLabel}
          accent={accent}
        />
      ) : null}
    </div>
  )
}
