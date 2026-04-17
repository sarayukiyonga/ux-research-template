'use client'

import { useState, useEffect, useMemo, useId, type ReactNode } from 'react'
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
import {
  getIdeasForSegmentChannel,
  normalizeUserJourneyIdeasPersist,
  type UserJourneyIdeasPersist,
} from '@/lib/user-journey-ideas-persist'

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

/** Paralelogramo: entrada/salida de datos (canal / contexto), estilo pastel neutro. */
function FlowParallelogram({ children }: { children: ReactNode }) {
  const plain =
    typeof children === 'string' || typeof children === 'number' ? String(children) : undefined
  return (
    <div className="flex w-full max-w-2xl shrink-0 flex-col items-center gap-1" title={plain}>
      <div className="w-fit -skew-x-10 rounded-lg border border-slate-300/90 bg-slate-100/90 px-4 py-2.5 shadow-sm">
        <div className="skew-x-10 text-center text-[11px] font-medium leading-snug text-gray-800 line-clamp-6">
          {children}
        </div>
      </div>
      <span className="text-[12px] font-medium text-gray-500">Entrada-salida de datos</span>
    </div>
  )
}

function FlowchartProcessBox({
  title,
  tipo,
  fullTooltip,
  pathVariant = 'default',
}: {
  title: string
  tipo: FlowPaso['tipo']
  /** Título + descripción para tooltip al truncar. */
  fullTooltip?: string
  /** Rama secundaria (p. ej. «No»): rectángulos estilo pastel rosa como en diagramas de excepción. */
  pathVariant?: 'default' | 'alternate'
}) {
  const tip = (fullTooltip?.trim() || title).slice(0, 2000)
  const pastelTeal =
    pathVariant === 'alternate'
      ? 'border border-rose-300 bg-rose-50 text-gray-800'
      : 'border border-teal-300/90 bg-teal-50/95 text-gray-800'
  const pastelTealConv =
    pathVariant === 'alternate'
      ? 'border border-rose-400 bg-rose-100/70 text-gray-800'
      : 'border border-teal-400/90 bg-teal-100/80 text-gray-800'

  if (tipo === 'entrada' || tipo === 'salida') {
    return (
      <div
        title={tip}
        className={`flex min-h-14 min-w-44 max-w-2xl shrink-0 items-center justify-center rounded-full border px-4 py-2.5 text-center text-[11px] font-semibold leading-snug shadow-sm ${
          tipo === 'entrada'
            ? 'border-amber-300/95 bg-amber-50 text-gray-800'
            : 'border-amber-400/90 bg-amber-100/80 text-gray-800'
        }`}
      >
        <span className="line-clamp-3">{title}</span>
      </div>
    )
  }

  if (tipo === 'conversion') {
    return (
      <div title={tip} className={`flex min-h-14 min-w-44 max-w-2xl items-center justify-center rounded-lg px-4 py-2.5 text-center text-[11px] font-semibold leading-snug shadow-sm ${pastelTealConv}`}>
        <span className="line-clamp-3">{title}</span>
      </div>
    )
  }

  return (
    <div
      title={tip}
      className={`flex min-h-14 min-w-44 max-w-2xl shrink-0 items-center justify-center rounded-lg px-4 py-2.5 text-center text-[11px] font-medium leading-snug shadow-sm ${pastelTeal}`}
    >
      <span className="line-clamp-3">{title}</span>
    </div>
  )
}

/**
 * Conector entre nodos: tramo vertical simple, o en **L** saliendo del rombo (baja, gira hacia el carril de la rama, baja).
 */
function FlowDownArrow({
  label,
  fromDiamond,
  branchIndex = 0,
  branchCount = 1,
}: {
  label: string
  /** Si true, dibuja codo en L hacia el interior del diagrama (solo entre ramas del rombo). */
  fromDiamond?: boolean
  branchIndex?: number
  branchCount?: number
}) {
  const markerId = useId().replace(/:/g, '')
  const tip = label ? label.slice(0, 2000) : undefined

  const labelBlock =
    label != null && label !== '' ? (
      <p className="w-full max-w-2xl px-1 text-center text-[12px] font-medium leading-snug text-gray-500 line-clamp-3">
        {label}
      </p>
    ) : (
      <p className="text-[9px] text-gray-400">—</p>
    )

  const useElbow = Boolean(fromDiamond && branchCount >= 2)
  const y0 = 6
  const yElbow = 18
  const yArrow = 74

  // Tramo horizontal: de borde a borde (xEntry → xFar), sin flecha.
  // Tramo vertical: del centro (x=50) en yElbow hasta yArrow, con flecha.
  let elbowPathD: string | null = null
  let straightPathD: string

  if (!useElbow) {
    straightPathD = `M 100 ${y0} L 100 ${yArrow}`
  } else if (branchCount === 2) {
    const xEntry = branchIndex === 0 ? 200 : 0
    elbowPathD    = `M ${xEntry} ${y0} L ${xEntry} ${yElbow} L 100 ${yElbow}`
    straightPathD = `M 100 ${yElbow} L 100 ${yArrow}`
  } else {
    const last = branchCount - 1
    if (branchIndex === 0) {
      elbowPathD    = `M 200 ${y0} L 200 ${yElbow} L 100 ${yElbow}`
      straightPathD = `M 100 ${yElbow} L 100 ${yArrow}`
    } else if (branchIndex === last) {
      elbowPathD    = `M 0 ${y0} L 0 ${yElbow} L 100 ${yElbow}`
      straightPathD = `M 100 ${yElbow} L 100 ${yArrow}`
    } else {
      straightPathD = `M 100 ${y0} L 100 ${yArrow}`
    }
  }

  const sharedStroke = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.35,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  return (
    <div
      className="flex w-full max-w-2xl shrink-0 flex-col items-center gap-0.5 py-1 text-gray-400"
      title={tip}
    >
      <svg
        viewBox="0 0 200 82"
        className="h-21 w-full text-gray-400"
        preserveAspectRatio="xMidYMin meet"
        aria-hidden
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="7"
            markerHeight="7"
            refX="3.5"
            refY="3.5"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L7,3.5 L0,7 Z" fill="currentColor" />
          </marker>
        </defs>
        {elbowPathD && <path d={elbowPathD} {...sharedStroke} />}
        <path d={straightPathD} {...sharedStroke} markerEnd={`url(#${markerId})`} />
      </svg>
      {labelBlock}
    </div>
  )
}

function FlowDiamond({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  const romboTip = [titulo.trim(), descripcion.trim()].filter(Boolean).join('\n\n').slice(0, 2000)
  return (
    <div className="flex w-full max-w-md shrink-0 flex-col items-center gap-1.5 cursor-default" title={romboTip}>
      <div className="relative flex h-20 w-20 items-center justify-center sm:h-21 sm:w-21">
        <div
          className="absolute inset-[6px] rotate-45 rounded-md border border-orange-300/95 bg-orange-100/85 shadow-sm"
          aria-hidden
        />
        <span className="relative z-10 max-w-18 text-center text-[10px] font-semibold leading-tight text-gray-800 line-clamp-3">
          {titulo}
        </span>
      </div>
      <p className="max-w-xs text-center text-[12px] leading-snug text-gray-500 line-clamp-3" title={descripcion}>
        {descripcion}
      </p>
    </div>
  )
}

/** Tramo lineal en columna (árbol vertical de arriba abajo). */
function TreeLinealSteps({
  pasos,
  clics,
  pathVariant = 'default',
}: {
  pasos: FlowPaso[]
  clics: string[]
  pathVariant?: 'default' | 'alternate'
}) {
  const ordenados = [...pasos].sort((a, b) => a.orden - b.orden)
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-1">
      {ordenados.map((p, i) => (
        <div key={`${p.orden}-${i}`} className="flex w-full flex-col items-center">
          {i > 0 && <FlowDownArrow label={clics[i - 1] ?? '—'} />}
          <div className="flex w-full max-w-2xl shrink-0 flex-col items-center gap-1">
            <FlowchartProcessBox
              title={p.tituloBolita}
              tipo={p.tipo}
              pathVariant={pathVariant}
              fullTooltip={`${p.tituloBolita}\n\n${p.descripcion}`}
            />
            <p
              className="w-full max-w-2xl text-center text-[12px] leading-snug text-gray-500 line-clamp-4"
              title={p.descripcion}
            >
              {p.descripcion}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function branchPathVariant(
  ramas: { etiqueta: string }[],
  idx: number,
  parentVariant: 'default' | 'alternate'
): 'default' | 'alternate' {
  if (parentVariant === 'alternate') return 'alternate'
  if (ramas.length === 2 && idx === 1) return 'alternate'
  return 'default'
}

function RenderFlowNodo({
  nodo,
  pathVariant = 'default',
}: {
  nodo: FlowNodo
  pathVariant?: 'default' | 'alternate'
}) {
  if (nodo.tipo === 'lineal') {
    return (
      <div className="flex w-full flex-col items-center gap-2">
        <TreeLinealSteps pasos={nodo.pasos} clics={nodo.clicsEntrePasos} pathVariant={pathVariant} />
        {nodo.despues != null && (
          <div className="mt-3 flex w-full flex-col items-center pt-2">
            <FlowDownArrow label="Continúa el flujo" />
            <RenderFlowNodo nodo={nodo.despues} pathVariant={pathVariant} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4">
      <FlowDiamond titulo={nodo.tituloDiamante} descripcion={nodo.descripcion} />
      <div className="flex w-full flex-col items-stretch justify-center gap-8 pt-1 lg:flex-row lg:items-start">
        {nodo.ramas.map((rama, idx) => {
          const childVariant = branchPathVariant(nodo.ramas, idx, pathVariant)
          return (
            <div key={`${rama.etiqueta}-${idx}`} className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 lg:max-w-none">
              <FlowDownArrow
                label={rama.etiqueta}
                fromDiamond
                branchIndex={idx}
                branchCount={nodo.ramas.length}
              />
              <RenderFlowNodo nodo={rama.siguiente} pathVariant={childVariant} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FlowchartLegend() {
  return (
    <div className="rounded-xl border border-gray-200/90 bg-gray-50/90 px-3 py-2.5 text-[14px] text-gray-600">
      <p className="mb-2 font-semibold text-gray-700">Leyenda (estilo pastel, vertical)</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-5 w-9 shrink-0 rounded-full border border-amber-300 bg-amber-50" />
          Inicio / fin (cápsula)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-5 w-10 shrink-0 rounded-md border border-teal-300 bg-teal-50" />
          Proceso (rectángulo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="relative inline-block h-4 w-4 shrink-0 rotate-45 border border-orange-300 bg-orange-100/90"
            aria-hidden
          />
          Decisión (rombo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-5 w-10 shrink-0 -skew-x-10 rounded-md border border-slate-300 bg-slate-100"
            aria-hidden
          />
          Entrada-salida de datos (paralelogramo)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-5 w-10 shrink-0 rounded-md border border-teal-400 bg-teal-100/80" />
          Conversión
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-5 w-10 shrink-0 rounded-md border border-rose-300 bg-rose-50" />
          Rama alternativa (2.ª opción)
        </span>
      </div>
      <p className="mt-2 text-[12px] text-gray-500">
        Lectura <strong>de arriba abajo</strong>. Textos largos se resumen en la caja; el <strong>texto completo</strong>{' '}
        aparece al pasar el cursor. Convención de símbolos (
        <a href={SMARTDRAW_FLOWCHART_URL} className="text-teal-700 underline underline-offset-2" target="_blank" rel="noreferrer">
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
  accent: _accent,
}: {
  flow: UserFlowLine
  segmentLabel: string
  canalSubtitle?: string
  accent: 'cyan' | 'orange'
}) {
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
        <p className="text-sm text-gray-500" title={flow.arquetipo}>
          {flow.arquetipo}
        </p>
      </div>

      <div
        className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-sm text-gray-800"
        title={flow.objetivoConversion}
      >
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/75 mb-0.5">Objetivo de conversión</p>
        <p className="leading-snug">{flow.objetivoConversion}</p>
      </div>

      <FlowchartLegend />

      <div className="overflow-x-auto pb-2 pt-1">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-1 py-2 sm:px-2">
          <FlowParallelogram>{flow.deDondeEntra}</FlowParallelogram>

          <FlowDownArrow label="Llega a la primera pantalla del flujo (carga / enlace)" />

          <RenderFlowNodo nodo={raiz} />
        </div>
      </div>
      <p className="text-[11px] text-gray-400 sm:hidden">Desplaza si hace falta para ver ramas anchas del diagrama →</p>
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
        <label className="flex-1 min-w-48 space-y-1">
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
  const [ideasPersist, setIdeasPersist] = useState<UserJourneyIdeasPersist | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/user-flow-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/user-persona-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/pov-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/user-journey-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/user-journey-ideas-saved').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([fSaved, personaSaved, povSaved, journeySaved, ideasSaved]) => {
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
        const rawIdeas = ideasSaved?.saved?.ideas
        setIdeasPersist(rawIdeas ? normalizeUserJourneyIdeasPersist(rawIdeas) : normalizeUserJourneyIdeasPersist(null))
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

  const prereqBase = depsOk.persona && depsOk.pov && depsOk.journey
  const ideaCountActual = useMemo(() => {
    if (!flow || !ideasPersist) return 0
    return getIdeasForSegmentChannel(ideasPersist, 'clienteActual', flow.clienteActual.canalActivoId).length
  }, [flow, ideasPersist])
  const ideaCountPotencial = useMemo(() => {
    if (!flow || !ideasPersist) return 0
    return getIdeasForSegmentChannel(ideasPersist, 'clientePotencial', flow.clientePotencial.canalActivoId).length
  }, [flow, ideasPersist])
  const prereqOne =
    prereqBase && (segmento === 'clienteActual' ? ideaCountActual > 0 : ideaCountPotencial > 0)
  const prereqBoth = prereqBase && ideaCountActual > 0 && ideaCountPotencial > 0

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
          El <strong>User Flow</strong> se muestra como diagrama <strong>vertical</strong> con estilo <strong>pastel</strong>{' '}
          (cápsulas amarillas inicio/fin, rectángulos teal, rombo melocotón, paralelogramo gris para datos; la segunda
          rama de una decisión binaria va en tono rosa). Se genera a partir de las{' '}
          <strong>ideas de funcionalidades y contenido</strong> guardadas en{' '}
          <Link href="/user-journey" className="font-semibold text-cyan-800 underline underline-offset-2">
            User Journey
          </Link>{' '}
          para el mismo <strong>segmento</strong> y <strong>canal</strong>. El mapa de journey, la persona y el POV
          afinan el resultado.
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

      {(!depsOk.persona || !depsOk.pov || !depsOk.journey || ideaCountActual === 0 || ideaCountPotencial === 0) && (
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
            {depsOk.journey && ideaCountActual === 0 && (
              <li>
                <strong>Ideas</strong> en User Journey (cliente actual, canal activo aquí): al menos una en «
                Funcionalidades y contenido por canal».
              </li>
            )}
            {depsOk.journey && ideaCountPotencial === 0 && (
              <li>
                <strong>Ideas</strong> en User Journey (cliente potencial, canal activo aquí): al menos una en la misma
                sección.
              </li>
            )}
            {!depsOk.persona && <li>User Persona (ambos segmentos).</li>}
            {!depsOk.pov && <li>POV guardados.</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
        <p>
          Prioridad:{' '}
          <Link href="/user-journey" className="font-semibold text-cyan-800 underline underline-offset-2">
            ideas funcionalidad/contenido
          </Link>
          {' · apoyo: mapa '}
          <Link href="/user-journey" className="font-semibold text-cyan-800 underline underline-offset-2">
            Journey
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
            disabled={!prereqOne || generating}
            onClick={() => void generateOne()}
            className="text-xs px-3 py-1.5 rounded-full border border-cyan-200 text-cyan-800 bg-cyan-50/80 hover:bg-cyan-100 transition-colors disabled:opacity-45"
          >
            Generar solo este segmento · canal
          </button>
          <button
            type="button"
            disabled={!prereqBoth || generating}
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

      {!flowV3HasAnyDiagram(flow) && prereqBoth ? (
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
            disabled={!prereqBoth || generating}
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
            . Genera el mapa en User Journey, añade <strong>ideas</strong> de funcionalidad/contenido para ese canal, y
            pulsa generar aquí.
          </p>
          <button
            type="button"
            disabled={!prereqOne || generating}
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
