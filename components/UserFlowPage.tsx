'use client'

import { useState, useEffect, useMemo, useId, useRef, useCallback, useLayoutEffect, createContext, useContext, type ReactNode } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import type { FlowPaso, FlowNodo, UserFlowLine } from '@/lib/user-flow-tree'
import type { FlowLineal, FlowDecision } from '@/lib/user-flow-tree'
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

// ─── Iconos SVG (mismos que UserJourneyPage / EmpathyMapPage) ─────────────────

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

function DragHandleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="9"  cy="5"  r="1.5" />
      <circle cx="15" cy="5"  r="1.5" />
      <circle cx="9"  cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9"  cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  )
}

// ─── Validaciones de dependencias ────────────────────────────────────────────

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

// ─── Helpers de mutación del árbol ───────────────────────────────────────────

function renumberPasos(pasos: FlowPaso[]): FlowPaso[] {
  return pasos.map((p, i) => ({ ...p, orden: i + 1 }))
}

function deletePasoAt(nodo: FlowLineal, idx: number): FlowLineal {
  const sorted = [...nodo.pasos].sort((a, b) => a.orden - b.orden)
  const newPasos = renumberPasos(sorted.filter((_, i) => i !== idx))
  // Eliminar el conector que llega al paso borrado (clic[idx-1]) o el siguiente si era el primero
  const clicoIdx = Math.min(idx, nodo.clicsEntrePasos.length - 1)
  const newClics = nodo.clicsEntrePasos.filter((_, i) => i !== clicoIdx)
  return { ...nodo, pasos: newPasos, clicsEntrePasos: newClics }
}

function updatePasoAt(nodo: FlowLineal, idx: number, paso: Omit<FlowPaso, 'orden'>): FlowLineal {
  const sorted = [...nodo.pasos].sort((a, b) => a.orden - b.orden)
  const newPasos = sorted.map((p, i) => (i === idx ? { ...paso, orden: i + 1 } : p))
  return { ...nodo, pasos: newPasos }
}

function insertPasoAfter(
  nodo: FlowLineal,
  afterIdx: number,
  draft: Omit<FlowPaso, 'orden'>
): FlowLineal {
  const sorted = [...nodo.pasos].sort((a, b) => a.orden - b.orden)
  const insertAt = afterIdx + 1
  const rawPasos = [
    ...sorted.slice(0, insertAt),
    { ...draft, orden: 0 },
    ...sorted.slice(insertAt),
  ]
  const newPasos = renumberPasos(rawPasos)
  // clic[i] conecta pasos[i] y pasos[i+1]; insertar nuevo clic en posición max(0, insertAt-1)
  const clicInsertIdx = Math.max(0, insertAt - 1)
  const newClics = [
    ...nodo.clicsEntrePasos.slice(0, clicInsertIdx),
    'Continúa en la web',
    ...nodo.clicsEntrePasos.slice(clicInsertIdx),
  ]
  return { ...nodo, pasos: newPasos, clicsEntrePasos: newClics }
}

function updateClicoAt(nodo: FlowLineal, idx: number, value: string): FlowLineal {
  const newClics = nodo.clicsEntrePasos.map((c, i) => (i === idx ? value : c))
  return { ...nodo, clicsEntrePasos: newClics }
}

function updateDiamond(
  nodo: FlowDecision,
  tituloDiamante: string,
  descripcion: string
): FlowDecision {
  return { ...nodo, tituloDiamante, descripcion }
}

function updateBranchLabel(nodo: FlowDecision, ramaIdx: number, etiqueta: string): FlowDecision {
  return {
    ...nodo,
    ramas: nodo.ramas.map((r, i) => (i === ramaIdx ? { ...r, etiqueta } : r)),
  }
}

function reorderPasos(nodo: FlowLineal, fromIdx: number, toIdx: number): FlowLineal {
  const sorted = [...nodo.pasos].sort((a, b) => a.orden - b.orden)
  const [moved] = sorted.splice(fromIdx, 1)
  sorted.splice(toIdx, 0, moved)
  return { ...nodo, pasos: renumberPasos(sorted) }
}

/**
 * Divide un tramo lineal en afterIdx e inserta una decisión como `despues`.
 * - pasos[0..afterIdx] → quedan en el lineal resultante
 * - pasos[afterIdx+1..n] → pasan como primera rama de la decisión
 */
function splitLinealAtDecision(
  nodo: FlowLineal,
  afterIdx: number,
  decision: FlowDecision
): FlowLineal {
  const sorted = [...nodo.pasos].sort((a, b) => a.orden - b.orden)
  const prePasos = renumberPasos(sorted.slice(0, afterIdx + 1))
  const postPasos = sorted.slice(afterIdx + 1)
  const preClics = nodo.clicsEntrePasos.slice(0, afterIdx)
  const postClics = nodo.clicsEntrePasos.slice(afterIdx + 1)

  const continuation: FlowNodo =
    postPasos.length > 0
      ? { tipo: 'lineal', pasos: renumberPasos(postPasos), clicsEntrePasos: postClics, despues: nodo.despues }
      : nodo.despues ?? makeMinimalLineal('Continúa')

  const decisionFinal: FlowDecision = {
    ...decision,
    ramas: [
      { ...decision.ramas[0], siguiente: continuation },
      decision.ramas[1],
    ],
  }

  return { tipo: 'lineal', pasos: prePasos, clicsEntrePasos: preClics, despues: decisionFinal }
}

function clearRetornoAt(nodo: FlowLineal, idx: number): FlowLineal {
  const sorted = [...nodo.pasos].sort((a, b) => a.orden - b.orden)
  const newPasos = sorted.map((p, i) =>
    i === idx
      ? { ...p, retornoTipo: null, retornoA: null, retornoLabel: null }
      : p
  )
  return { ...nodo, pasos: newPasos }
}

// ─── Contexto de targets de retorno ──────────────────────────────────────────

interface FlowTarget {
  tipo: 'paso' | 'decision'
  titulo: string
}

const FlowTargetsContext = createContext<FlowTarget[]>([])

function collectTargets(nodo: FlowNodo): FlowTarget[] {
  const out: FlowTarget[] = []
  if (nodo.tipo === 'lineal') {
    for (const p of nodo.pasos) out.push({ tipo: 'paso', titulo: p.tituloBolita })
    if (nodo.despues) out.push(...collectTargets(nodo.despues))
  } else {
    out.push({ tipo: 'decision', titulo: nodo.tituloDiamante })
    for (const r of nodo.ramas) out.push(...collectTargets(r.siguiente))
  }
  return out
}

// ─── Formularios inline de edición ───────────────────────────────────────────

const TIPO_LABELS: Record<FlowPaso['tipo'], string> = {
  entrada: 'Entrada / inicio (cápsula ámbar)',
  navegacion: 'Navegación / proceso (rectángulo teal)',
  conversion: 'Conversión (rectángulo teal oscuro)',
  salida: 'Salida / fin (cápsula ámbar)',
}

function PasoEditForm({
  initial,
  onSave,
  onCancel,
  isNew = false,
}: {
  initial: Omit<FlowPaso, 'orden'>
  onSave: (p: Omit<FlowPaso, 'orden'>) => void
  onCancel: () => void
  isNew?: boolean
}) {
  const targets = useContext(FlowTargetsContext)
  const [titulo, setTitulo] = useState(initial.tituloBolita)
  const [desc, setDesc] = useState(initial.descripcion)
  const [tipo, setTipo] = useState<FlowPaso['tipo']>(initial.tipo)
  const [retornoTipo, setRetornoTipo] = useState<'paso' | 'decision' | ''>(initial.retornoTipo ?? '')
  const [retornoA, setRetornoA] = useState(initial.retornoA ?? '')
  const [retornoLabel, setRetornoLabel] = useState(initial.retornoLabel ?? '')
  const canSave = titulo.trim().length > 0

  const commit = () => {
    if (!canSave) return
    const retorno =
      retornoTipo && retornoA
        ? { retornoTipo: retornoTipo as 'paso' | 'decision', retornoA, retornoLabel: retornoLabel.trim() }
        : { retornoTipo: null, retornoA: null, retornoLabel: null }
    onSave({ tituloBolita: titulo.trim(), descripcion: desc.trim(), tipo, ...retorno })
  }

  const filteredTargets = targets.filter((t) => t.tipo === retornoTipo)

  return (
    <div className="w-full max-w-2xl rounded-xl border border-teal-200 bg-white px-4 py-3 shadow-sm space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">
        {isNew ? 'Nuevo paso' : 'Editar paso'}
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-500">Título (máx. 36 car.)</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value.slice(0, 36))}
          maxLength={36}
          autoFocus
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
          placeholder="Nombre del paso"
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') onCancel()
          }}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-500">Descripción (máx. 200 car.)</span>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value.slice(0, 200))}
          maxLength={200}
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none"
          placeholder="Descripción breve del paso"
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-500">Tipo</span>
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as FlowPaso['tipo'])}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
        >
          {(Object.entries(TIPO_LABELS) as [FlowPaso['tipo'], string][]).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {/* Sección de retorno — sólo visible cuando hay targets en el árbol */}
      {targets.length > 0 && !isNew && (
        <div className="border-t border-gray-100 pt-3 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
            Flecha de retorno (opcional)
          </p>
          <div className="flex gap-2">
            <label className="flex-1 space-y-1">
              <span className="text-[11px] font-medium text-gray-500">Tipo de destino</span>
              <select
                value={retornoTipo}
                onChange={(e) => {
                  setRetornoTipo(e.target.value as 'paso' | 'decision' | '')
                  setRetornoA('')
                }}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                <option value="">Sin retorno</option>
                <option value="paso">Paso anterior</option>
                <option value="decision">Toma de decisión</option>
              </select>
            </label>
            {retornoTipo && (
              <label className="flex-1 space-y-1">
                <span className="text-[11px] font-medium text-gray-500">Elemento destino</span>
                <select
                  value={retornoA}
                  onChange={(e) => setRetornoA(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="">Seleccionar...</option>
                  {filteredTargets.map((t) => (
                    <option key={t.titulo} value={t.titulo}>
                      {t.titulo}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {retornoTipo && retornoA && (
            <label className="block space-y-1">
              <span className="text-[11px] font-medium text-gray-500">
                Etiqueta de la flecha (ej. "Si falla", "Reintentar")
              </span>
              <input
                value={retornoLabel}
                onChange={(e) => setRetornoLabel(e.target.value.slice(0, 80))}
                maxLength={80}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                placeholder="Reintentar, Si falla..."
              />
            </label>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={commit}
          className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
        >
          {isNew ? 'Añadir' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

function DiamondEditForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: { tituloDiamante: string; descripcion: string }
  onSave: (tituloDiamante: string, descripcion: string) => void
  onCancel: () => void
}) {
  const [titulo, setTitulo] = useState(initial.tituloDiamante)
  const [desc, setDesc] = useState(initial.descripcion)
  const canSave = titulo.trim().length > 0

  return (
    <div className="w-full max-w-md rounded-xl border border-orange-200 bg-white px-4 py-3 shadow-sm space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">
        Editar decisión
      </p>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-500">Texto del rombo (máx. 36 car.)</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value.slice(0, 36))}
          maxLength={36}
          autoFocus
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="Pregunta o condición"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSave) onSave(titulo.trim(), desc.trim())
            if (e.key === 'Escape') onCancel()
          }}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-500">Descripción (máx. 240 car.)</span>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value.slice(0, 240))}
          maxLength={240}
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
        />
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={() => onSave(titulo.trim(), desc.trim())}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
        >
          Guardar
        </button>
      </div>
    </div>
  )
}

/** Crea un FlowLineal mínimo con un paso de navegación para usar como rama de una nueva decisión. */
function makeMinimalLineal(label: string): FlowLineal {
  return {
    tipo: 'lineal',
    pasos: [{ orden: 1, tituloBolita: label || 'Paso', descripcion: '', tipo: 'navegacion', retornoTipo: null, retornoA: null, retornoLabel: null }],
    clicsEntrePasos: [],
    despues: null,
  }
}

/** Formulario para crear un nuevo nodo de decisión con 2 ramas iniciales. */
function NewDecisionForm({
  onSave,
  onCancel,
}: {
  onSave: (nodo: FlowDecision) => void
  onCancel: () => void
}) {
  const [titulo, setTitulo] = useState('')
  const [desc, setDesc] = useState('')
  const [rama1, setRama1] = useState('Sí')
  const [rama2, setRama2] = useState('No')

  const commit = () => {
    const decision: FlowDecision = {
      tipo: 'decision',
      tituloDiamante: titulo.trim() || '¿Condición?',
      descripcion: desc.trim(),
      ramas: [
        { etiqueta: rama1.trim() || 'Sí', siguiente: makeMinimalLineal(rama1.trim() || 'Rama 1') },
        { etiqueta: rama2.trim() || 'No', siguiente: makeMinimalLineal(rama2.trim() || 'Rama 2') },
      ],
    }
    onSave(decision)
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-orange-200 bg-white px-4 py-3 shadow-sm space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-orange-700">Nueva decisión</p>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-500">Texto del rombo (máx. 36 car.)</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value.slice(0, 36))}
          maxLength={36}
          autoFocus
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          placeholder="¿Condición?"
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-[11px] font-medium text-gray-500">Descripción (máx. 240 car.)</span>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value.slice(0, 240))}
          maxLength={240}
          rows={2}
          className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-gray-500">Etiqueta rama 1</span>
          <input
            value={rama1}
            onChange={(e) => setRama1(e.target.value.slice(0, 80))}
            maxLength={80}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            placeholder="Sí"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-gray-500">Etiqueta rama 2</span>
          <input
            value={rama2}
            onChange={(e) => setRama2(e.target.value.slice(0, 80))}
            maxLength={80}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            placeholder="No"
          />
        </label>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={commit}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
        >
          Añadir decisión
        </button>
      </div>
    </div>
  )
}

/** Input inline que edita la etiqueta de un conector o rama al pulsar sobre el texto. */
function InlineLabelEditor({
  value,
  onSave,
  maxLength = 100,
  className = '',
}: {
  value: string
  onSave: (v: string) => void
  maxLength?: number
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(value)
      setTimeout(() => { ref.current?.select() }, 0)
    }
  }, [editing, value])

  if (!editing) {
    return (
      <span
        className={`cursor-pointer rounded px-1 hover:bg-gray-100 transition-colors ${className}`}
        title="Clic para editar etiqueta"
        onClick={() => setEditing(true)}
      >
        {value || <span className="italic text-gray-400">—</span>}
      </span>
    )
  }

  return (
    <input
      ref={ref}
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
      maxLength={maxLength}
      onBlur={() => { onSave(draft.trim() || value); setEditing(false) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { onSave(draft.trim() || value); setEditing(false) }
        if (e.key === 'Escape') setEditing(false)
      }}
      className={`rounded border border-gray-300 px-1.5 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 ${className}`}
    />
  )
}

// ─── Componentes de presentación ─────────────────────────────────────────────

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
  fullTooltip?: string
  pathVariant?: 'default' | 'alternate'
}) {
  const tip = (fullTooltip?.trim() || title).slice(0, 2000)
  // Navegación/proceso → azul (distinguible de conversión que es verde/teal)
  const pastelBlue =
    pathVariant === 'alternate'
      ? 'border border-rose-300 bg-rose-50 text-gray-800'
      : 'border border-blue-300/90 bg-blue-50/95 text-gray-800'
  // Conversión → teal/verde
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
      <div
        title={tip}
        className={`flex min-h-14 min-w-44 max-w-2xl items-center justify-center rounded-lg px-4 py-2.5 text-center text-[11px] font-semibold leading-snug shadow-sm ${pastelTealConv}`}
      >
        <span className="line-clamp-3">{title}</span>
      </div>
    )
  }

  return (
    <div
      title={tip}
      className={`flex min-h-14 min-w-44 max-w-2xl shrink-0 items-center justify-center rounded-lg px-4 py-2.5 text-center text-[11px] font-medium leading-snug shadow-sm ${pastelBlue}`}
    >
      <span className="line-clamp-3">{title}</span>
    </div>
  )
}

/**
 * Conector entre nodos. Acepta callbacks opcionales para editar etiqueta e insertar paso.
 */
function FlowDownArrow({
  label,
  fromDiamond,
  branchIndex = 0,
  branchCount = 1,
  onEditLabel,
  onAdd,
}: {
  label: string
  fromDiamond?: boolean
  branchIndex?: number
  branchCount?: number
  /** Si se pasa, la etiqueta se convierte en editable al hacer clic. */
  onEditLabel?: (newLabel: string) => void
  /** Si se pasa, aparece un botón "+" para insertar paso antes del conector. */
  onAdd?: () => void
}) {
  const markerId = useId().replace(/:/g, '')
  const [editingLabel, setEditingLabel] = useState(false)
  const [draftLabel, setDraftLabel] = useState(label)
  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingLabel) {
      setDraftLabel(label)
      setTimeout(() => { labelRef.current?.select() }, 0)
    }
  }, [editingLabel, label])

  const tip = label ? label.slice(0, 2000) : undefined

  const commitLabel = () => {
    onEditLabel?.(draftLabel.trim() || label)
    setEditingLabel(false)
  }

  const labelBlock = editingLabel ? (
    <input
      ref={labelRef}
      value={draftLabel}
      autoFocus
      onChange={(e) => setDraftLabel(e.target.value.slice(0, 100))}
      maxLength={100}
      onBlur={commitLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitLabel()
        if (e.key === 'Escape') setEditingLabel(false)
      }}
      className="w-full max-w-2xl rounded border border-gray-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
    />
  ) : label != null && label !== '' ? (
    <p
      className={`w-full max-w-2xl px-1 text-center text-[12px] font-medium leading-snug text-gray-500 line-clamp-3 ${onEditLabel ? 'cursor-pointer hover:text-teal-600' : ''}`}
      title={onEditLabel ? 'Clic para editar etiqueta' : tip}
      onClick={onEditLabel ? () => setEditingLabel(true) : undefined}
    >
      {label}
    </p>
  ) : (
    <p className="text-[9px] text-gray-400">—</p>
  )

  const useElbow = Boolean(fromDiamond && branchCount >= 2)
  const y0 = 6
  const yElbow = 18
  const yArrow = 74

  let elbowPathD: string | null = null
  let straightPathD: string

  if (!useElbow) {
    straightPathD = `M 100 ${y0} L 100 ${yArrow}`
  } else if (branchCount === 2) {
    const xEntry = branchIndex === 0 ? 200 : 0
    elbowPathD = `M ${xEntry} ${y0} L ${xEntry} ${yElbow} L 100 ${yElbow}`
    straightPathD = `M 100 ${yElbow} L 100 ${yArrow}`
  } else {
    const last = branchCount - 1
    if (branchIndex === 0) {
      elbowPathD = `M 200 ${y0} L 200 ${yElbow} L 100 ${yElbow}`
      straightPathD = `M 100 ${yElbow} L 100 ${yArrow}`
    } else if (branchIndex === last) {
      elbowPathD = `M 0 ${y0} L 0 ${yElbow} L 100 ${yElbow}`
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
      title={onEditLabel ? undefined : tip}
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
      {onAdd && !editingLabel && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-0.5 inline-flex items-center gap-0.5 rounded-full border border-teal-200 bg-white px-2.5 py-0.5 text-[10px] text-teal-500 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-700 transition-colors"
          title="Insertar paso aquí"
        >
          + insertar paso
        </button>
      )}
    </div>
  )
}

function FlowDiamond({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  const romboTip = [titulo.trim(), descripcion.trim()].filter(Boolean).join('\n\n').slice(0, 2000)
  return (
    <div
      className="flex w-full max-w-md shrink-0 flex-col items-center gap-1.5 cursor-default"
      title={romboTip}
      data-flowref-decision={titulo}
    >
      <div className="relative flex h-20 w-20 items-center justify-center sm:h-21 sm:w-21">
        <div
          className="absolute inset-[6px] rotate-45 rounded-md border border-orange-300/95 bg-orange-100/85 shadow-sm"
          aria-hidden
        />
        <span className="relative z-10 max-w-18 text-center text-[10px] font-semibold leading-tight text-gray-800 line-clamp-3">
          {titulo}
        </span>
      </div>
      <p
        className="max-w-xs text-center text-[12px] leading-snug text-gray-500 line-clamp-3"
        title={descripcion}
      >
        {descripcion}
      </p>
    </div>
  )
}

// ─── Tramo lineal editable ────────────────────────────────────────────────────

/**
 * Renderiza y edita un tramo lineal de pasos.
 * Cuando se pasa `onReplace`, activa controles de editar / borrar / insertar.
 */
function TreeLinealSteps({
  nodo,
  pathVariant = 'default',
  onReplace,
  onAddDecisionBefore,
}: {
  nodo: FlowLineal
  pathVariant?: 'default' | 'alternate'
  onReplace?: (n: FlowLineal) => void
  /** Llamado cuando el usuario quiere insertar una decisión ANTES de todos los pasos. */
  onAddDecisionBefore?: (d: FlowDecision) => void
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [addingAfterIdx, setAddingAfterIdx] = useState<number | null>(null)
  const [addingDecisionAfterIdx, setAddingDecisionAfterIdx] = useState<number | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  const canEdit = Boolean(onReplace)
  const ordenados = [...nodo.pasos].sort((a, b) => a.orden - b.orden)

  const commitEdit = (i: number, draft: Omit<FlowPaso, 'orden'>) => {
    onReplace?.(updatePasoAt(nodo, i, draft))
    setEditingIdx(null)
  }

  const commitDelete = (i: number) => {
    onReplace?.(deletePasoAt(nodo, i))
  }

  const commitAdd = (afterIdx: number, draft: Omit<FlowPaso, 'orden'>) => {
    onReplace?.(insertPasoAfter(nodo, afterIdx, draft))
    setAddingAfterIdx(null)
  }

  const commitClic = (i: number, value: string) => {
    onReplace?.(updateClicoAt(nodo, i, value))
  }

  const commitDeleteRetorno = (i: number) => {
    onReplace?.(clearRetornoAt(nodo, i))
  }

  const commitAddDecision = (afterIdx: number, decision: FlowDecision) => {
    if (afterIdx === -1) {
      onAddDecisionBefore?.(decision)
    } else {
      onReplace?.(splitLinealAtDecision(nodo, afterIdx, decision))
    }
    setAddingDecisionAfterIdx(null)
  }

  const openDecisionForm = (afterIdx: number) => {
    setAddingDecisionAfterIdx(afterIdx)
    setAddingAfterIdx(null)  // cierra cualquier form de paso abierto
  }

  const handleDragStart = (e: React.DragEvent, i: number) => {
    setDraggingIdx(i)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(i))
  }

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverIdx !== i) setDragOverIdx(i)
  }

  const handleDrop = (e: React.DragEvent, toIdx: number) => {
    e.preventDefault()
    if (draggingIdx !== null && draggingIdx !== toIdx) {
      onReplace?.(reorderPasos(nodo, draggingIdx, toIdx))
    }
    setDraggingIdx(null)
    setDragOverIdx(null)
  }

  const handleDragEnd = () => {
    setDraggingIdx(null)
    setDragOverIdx(null)
  }

  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-1">
      {/* Botones insertar / añadir decisión ANTES del primer paso */}
      {canEdit && (
        <div className="mb-0.5 flex flex-wrap items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => { setAddingAfterIdx(-1); setAddingDecisionAfterIdx(null) }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-teal-300 px-3 py-0.5 text-[10px] text-teal-600 hover:bg-teal-50 transition-colors"
          >
            + insertar paso al inicio
          </button>
          {onAddDecisionBefore && (
            <button
              type="button"
              onClick={() => openDecisionForm(-1)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-orange-300 px-3 py-0.5 text-[10px] text-orange-500 hover:bg-orange-50 transition-colors"
            >
              + añadir decisión al inicio
            </button>
          )}
        </div>
      )}
      {addingAfterIdx === -1 && (
        <div className="w-full py-1">
          <PasoEditForm
            initial={{ tituloBolita: '', descripcion: '', tipo: 'navegacion', retornoTipo: null, retornoA: null, retornoLabel: null }}
            onSave={(p) => commitAdd(-1, p)}
            onCancel={() => setAddingAfterIdx(null)}
            isNew
          />
        </div>
      )}
      {addingDecisionAfterIdx === -1 && (
        <div className="w-full py-1">
          <NewDecisionForm
            onSave={(d) => commitAddDecision(-1, d)}
            onCancel={() => setAddingDecisionAfterIdx(null)}
          />
        </div>
      )}

      {ordenados.map((p, i) => (
        <div key={`${p.orden}-${i}`} className="flex w-full flex-col items-center">
          {/* Conector entre pasos */}
          {i > 0 && (
            <FlowDownArrow
              label={nodo.clicsEntrePasos[i - 1] ?? '—'}
              onEditLabel={canEdit ? (v) => commitClic(i - 1, v) : undefined}
              onAdd={canEdit ? () => { setAddingAfterIdx(i - 1); setAddingDecisionAfterIdx(null) } : undefined}
            />
          )}
          {/* Botón añadir decisión entre pasos (se muestra debajo del conector) */}
          {canEdit && i > 0 && addingDecisionAfterIdx !== i - 1 && addingAfterIdx !== i - 1 && (
            <button
              type="button"
              onClick={() => openDecisionForm(i - 1)}
              className="mb-0.5 inline-flex items-center gap-1 rounded-full border border-dashed border-orange-300 px-3 py-0.5 text-[10px] text-orange-500 hover:bg-orange-50 transition-colors"
            >
              + añadir decisión aquí
            </button>
          )}

          {/* Formulario insertar paso entre pasos */}
          {addingAfterIdx === i - 1 && i > 0 && (
            <div className="w-full py-1">
              <PasoEditForm
                initial={{ tituloBolita: '', descripcion: '', tipo: 'navegacion', retornoTipo: null, retornoA: null, retornoLabel: null }}
                onSave={(p) => commitAdd(i - 1, p)}
                onCancel={() => setAddingAfterIdx(null)}
                isNew
              />
            </div>
          )}
          {/* Formulario insertar decisión entre pasos */}
          {addingDecisionAfterIdx === i - 1 && i > 0 && (
            <div className="w-full py-1">
              <NewDecisionForm
                onSave={(d) => commitAddDecision(i - 1, d)}
                onCancel={() => setAddingDecisionAfterIdx(null)}
              />
            </div>
          )}

          {/* Paso: formulario de edición o visualización */}
          {editingIdx === i ? (
            <div className="w-full py-1">
              <PasoEditForm
                initial={{
                  tituloBolita: p.tituloBolita,
                  descripcion: p.descripcion,
                  tipo: p.tipo,
                  retornoTipo: p.retornoTipo,
                  retornoA: p.retornoA,
                  retornoLabel: p.retornoLabel,
                }}
                onSave={(draft) => commitEdit(i, draft)}
                onCancel={() => setEditingIdx(null)}
              />
            </div>
          ) : (
            <div
              className={`relative flex w-full max-w-2xl flex-col items-center gap-1 rounded-xl transition-all ${
                draggingIdx === i ? 'opacity-40' : ''
              } ${dragOverIdx === i && draggingIdx !== i ? 'ring-2 ring-teal-400 ring-offset-1' : ''}`}
              data-pdf-avoid-break
              data-flowref-paso={p.tituloBolita}
              data-retorno-a={p.retornoA ?? ''}
              data-retorno-tipo={p.retornoTipo ?? ''}
              data-retorno-label={p.retornoLabel ?? ''}
              draggable={canEdit}
              onDragStart={canEdit ? (e) => handleDragStart(e, i) : undefined}
              onDragOver={canEdit ? (e) => handleDragOver(e, i) : undefined}
              onDrop={canEdit ? (e) => handleDrop(e, i) : undefined}
              onDragEnd={canEdit ? handleDragEnd : undefined}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Handle de arrastre */}
              {canEdit && (
                <div
                  className="absolute -left-6 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing transition-opacity"
                  style={{ opacity: hoveredIdx === i ? 0.6 : 0 }}
                >
                  <DragHandleIcon className="h-4 w-4 text-gray-400" />
                </div>
              )}

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

              {/* Badge de retorno configurado */}
              {p.retornoA && p.retornoTipo && (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] text-amber-800">
                  <span aria-hidden>↩</span>
                  {p.retornoLabel && (
                    <span className="font-semibold">{p.retornoLabel}</span>
                  )}
                  <span className="text-amber-600">
                    → {p.retornoTipo === 'decision' ? '◇ ' : ''}{p.retornoA}
                  </span>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingIdx(i)}
                        className="ml-0.5 rounded p-0.5 text-amber-700 hover:bg-amber-100 transition-colors"
                        title="Editar retorno"
                        aria-label="Editar retorno"
                      >
                        <PencilIcon className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => commitDeleteRetorno(i)}
                        className="rounded p-0.5 text-amber-700 hover:bg-amber-100 transition-colors"
                        title="Eliminar retorno"
                        aria-label="Eliminar retorno"
                      >
                        <XIcon className="h-2.5 w-2.5" />
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Botones editar / borrar paso */}
              {canEdit && (
                <div
                  className="flex gap-1 transition-opacity"
                  style={{ opacity: hoveredIdx === i ? 1 : 0, pointerEvents: hoveredIdx === i ? 'auto' : 'none' }}
                >
                  <button
                    type="button"
                    onClick={() => setEditingIdx(i)}
                    className="rounded-lg p-1.5 text-teal-700 hover:bg-teal-50 ring-1 ring-transparent hover:ring-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-300 transition-colors"
                    title="Editar paso"
                    aria-label="Editar paso"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  {ordenados.length > 1 && (
                    <button
                      type="button"
                      onClick={() => commitDelete(i)}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 ring-1 ring-transparent hover:ring-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors"
                      title="Eliminar paso"
                      aria-label="Eliminar paso"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Formulario insertar al final */}
      {addingAfterIdx === ordenados.length - 1 && (
        <div className="w-full py-1">
          <PasoEditForm
            initial={{ tituloBolita: '', descripcion: '', tipo: 'navegacion', retornoTipo: null, retornoA: null, retornoLabel: null }}
            onSave={(p) => commitAdd(ordenados.length - 1, p)}
            onCancel={() => setAddingAfterIdx(null)}
            isNew
          />
        </div>
      )}

      {canEdit && addingAfterIdx !== ordenados.length - 1 && (
        <button
          type="button"
          onClick={() => setAddingAfterIdx(ordenados.length - 1)}
          className="mt-1 inline-flex items-center gap-1 rounded-full border border-dashed border-teal-300 px-3 py-0.5 text-[10px] text-teal-600 hover:bg-teal-50 transition-colors"
        >
          + insertar paso al final
        </button>
      )}
    </div>
  )
}

// ─── Nodo recursivo editable ──────────────────────────────────────────────────

function branchPathVariant(
  _ramas: { etiqueta: string }[],
  idx: number,
  _parentVariant: 'default' | 'alternate'
): 'default' | 'alternate' {
  // La primera rama (índice 0 = Sí / afirmativa) es siempre teal.
  // Las ramas siguientes (No, otras) son siempre rose/alternate.
  return idx === 0 ? 'default' : 'alternate'
}

function RenderFlowNodo({
  nodo,
  pathVariant = 'default',
  onReplace,
}: {
  nodo: FlowNodo
  pathVariant?: 'default' | 'alternate'
  /** Si se pasa, habilita todos los controles de edición. */
  onReplace?: (n: FlowNodo) => void
}) {
  const [editingDiamond, setEditingDiamond] = useState(false)
  const [editingBranchIdx, setEditingBranchIdx] = useState<number | null>(null)
  const [confirmingDeleteDecision, setConfirmingDeleteDecision] = useState(false)
  const [addingDecision, setAddingDecision] = useState(false)

  if (nodo.tipo === 'lineal') {
    return (
      <div className="flex w-full flex-col items-center gap-2">
        <TreeLinealSteps
          nodo={nodo}
          pathVariant={pathVariant}
          onReplace={
            onReplace
              ? (newLineal: FlowLineal) => onReplace(newLineal)
              : undefined
          }
          onAddDecisionBefore={
            onReplace
              ? (decision: FlowDecision) =>
                  onReplace({
                    ...decision,
                    ramas: [
                      { ...decision.ramas[0], siguiente: nodo },
                      decision.ramas[1],
                    ],
                  })
              : undefined
          }
        />
        {nodo.despues != null && (
          <div className="mt-3 flex w-full flex-col items-center pt-2">
            <FlowDownArrow label="Continúa el flujo" />
            <RenderFlowNodo
              nodo={nodo.despues}
              pathVariant={pathVariant}
              onReplace={
                onReplace
                  ? (newDespues) => onReplace({ ...nodo, despues: newDespues })
                  : undefined
              }
            />
          </div>
        )}
        {/* Añadir decisión al final del tramo (solo cuando no hay despues) */}
        {onReplace && nodo.despues === null && (
          <div className="mt-2 flex w-full flex-col items-center">
            {addingDecision ? (
              <NewDecisionForm
                onSave={(decision) => {
                  onReplace({ ...nodo, despues: decision })
                  setAddingDecision(false)
                }}
                onCancel={() => setAddingDecision(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingDecision(true)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-orange-300 px-3 py-0.5 text-[10px] text-orange-500 hover:bg-orange-50 transition-colors"
              >
                + añadir nodo de decisión
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  // Nodo de decisión (rombo)
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4">
      {editingDiamond ? (
        <div className="w-full max-w-md">
          <DiamondEditForm
            initial={{ tituloDiamante: nodo.tituloDiamante, descripcion: nodo.descripcion }}
            onSave={(t, d) => {
              onReplace?.(updateDiamond(nodo, t, d))
              setEditingDiamond(false)
            }}
            onCancel={() => setEditingDiamond(false)}
          />
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-1.5" data-pdf-avoid-break>
          <FlowDiamond titulo={nodo.tituloDiamante} descripcion={nodo.descripcion} />
          {onReplace && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => { setEditingDiamond(true); setConfirmingDeleteDecision(false) }}
                className="rounded-lg p-1.5 text-orange-700 hover:bg-orange-50 ring-1 ring-transparent hover:ring-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300 transition-colors"
                title="Editar decisión"
                aria-label="Editar decisión"
              >
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
              {!confirmingDeleteDecision ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDeleteDecision(true)}
                  className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 ring-1 ring-transparent hover:ring-red-200 focus:outline-none focus:ring-2 focus:ring-red-300 transition-colors"
                  title="Borrar decisión"
                  aria-label="Borrar decisión"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px]">
                  <span className="text-red-700">Se conserva la 1.ª rama.</span>
                  <button
                    type="button"
                    onClick={() => { onReplace(nodo.ramas[0].siguiente); setConfirmingDeleteDecision(false) }}
                    className="font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteDecision(false)}
                    className="text-gray-500 underline underline-offset-2 hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex w-full flex-col items-stretch justify-center gap-8 pt-1 lg:flex-row lg:items-start">
        {nodo.ramas.map((rama, idx) => {
          const childVariant = branchPathVariant(nodo.ramas, idx, pathVariant)
          return (
            <div
              key={`${rama.etiqueta}-${idx}`}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 lg:max-w-none"
            >
              {editingBranchIdx === idx ? (
                <div className="flex w-full items-center gap-2 py-1">
                  <InlineLabelEditor
                    value={rama.etiqueta}
                    maxLength={80}
                    onSave={(v) => {
                      onReplace?.(updateBranchLabel(nodo, idx, v))
                      setEditingBranchIdx(null)
                    }}
                    className="flex-1 text-center"
                  />
                </div>
              ) : (
                <FlowDownArrow
                  label={rama.etiqueta}
                  fromDiamond
                  branchIndex={idx}
                  branchCount={nodo.ramas.length}
                  onEditLabel={
                    onReplace ? (v) => onReplace?.(updateBranchLabel(nodo, idx, v)) : undefined
                  }
                />
              )}
              <RenderFlowNodo
                nodo={rama.siguiente}
                pathVariant={childVariant}
                onReplace={
                  onReplace
                    ? (newNodo) =>
                        onReplace({
                          ...nodo,
                          ramas: nodo.ramas.map((r, i) =>
                            i === idx ? { ...r, siguiente: newNodo } : r
                          ),
                        })
                    : undefined
                }
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Leyenda ─────────────────────────────────────────────────────────────────

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
          <span className="inline-block h-5 w-10 shrink-0 rounded-md border border-blue-300 bg-blue-50" />
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
        Lectura <strong>de arriba abajo</strong>. Pasa el cursor sobre cualquier{' '}
        <strong>paso</strong> para ver los botones de edición (✏) y borrado (✕). Haz clic en las{' '}
        <strong>etiquetas de flecha</strong> para editarlas. Los botones{' '}
        <strong>+ insertar paso</strong> aparecen al pasar el cursor por las flechas. Convención de
        símbolos (
        <a
          href={SMARTDRAW_FLOWCHART_URL}
          className="text-teal-700 underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          referencia SmartDraw
        </a>
        ).
      </p>
    </div>
  )
}

// ─── Sección del diagrama ─────────────────────────────────────────────────────

interface RetornoArrow {
  fromX: number
  fromY: number
  toX: number
  toY: number
  label: string
  idx: number
}

function UserFlowchartSection({
  flow,
  segmentLabel,
  canalSubtitle,
  accent: _accent,
  onUpdateFlow,
}: {
  flow: UserFlowLine
  segmentLabel: string
  canalSubtitle?: string
  accent: 'cyan' | 'orange'
  onUpdateFlow?: (newFlow: UserFlowLine) => void
}) {
  const { raiz } = flow
  const innerRef = useRef<HTMLDivElement>(null)
  const [arrows, setArrows] = useState<RetornoArrow[]>([])
  const [editingDeDonde, setEditingDeDonde] = useState(false)
  const [draftDeDonde, setDraftDeDonde] = useState(flow.deDondeEntra)
  const [hoveredDeDonde, setHoveredDeDonde] = useState(false)
  const canEdit = Boolean(onUpdateFlow)

  const commitDeDonde = () => {
    onUpdateFlow?.({ ...flow, deDondeEntra: draftDeDonde.trim() })
    setEditingDeDonde(false)
  }

  const deleteDeDonde = () => {
    onUpdateFlow?.({ ...flow, deDondeEntra: '' })
    setDraftDeDonde('')
    setEditingDeDonde(false)
  }

  const allTargets = useMemo(() => collectTargets(raiz), [raiz])

  const recalcArrows = useCallback(() => {
    const container = innerRef.current
    if (!container) return
    const cr = container.getBoundingClientRect()
    const newArrows: RetornoArrow[] = []
    const sourceEls = container.querySelectorAll<HTMLElement>('[data-retorno-a]')
    let idx = 0
    sourceEls.forEach((el) => {
      const retornoA = el.getAttribute('data-retorno-a')
      const retornoTipo = el.getAttribute('data-retorno-tipo') as 'paso' | 'decision' | ''
      const retornoLabel = el.getAttribute('data-retorno-label') ?? ''
      if (!retornoA || !retornoTipo) return
      const attr = retornoTipo === 'paso' ? 'data-flowref-paso' : 'data-flowref-decision'
      // escape para el selector CSS
      const escaped = retornoA.replace(/["\\]/g, '\\$&')
      const targetEl = container.querySelector<HTMLElement>(`[${attr}="${escaped}"]`)
      if (!targetEl) return
      const sr = el.getBoundingClientRect()
      const tr = targetEl.getBoundingClientRect()
      newArrows.push({
        fromX: sr.right - cr.left,
        fromY: sr.top + sr.height / 2 - cr.top,
        toX: tr.right - cr.left,
        toY: tr.top + tr.height / 2 - cr.top,
        label: retornoLabel,
        idx: idx++,
      })
    })
    setArrows(newArrows)
  }, [])

  useLayoutEffect(() => {
    recalcArrows()
  }, [flow, recalcArrows])

  const svgMarkerId = useId().replace(/:/g, '')

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          {segmentLabel}
          {canalSubtitle ? (
            <span className="block text-sm font-normal text-gray-500 mt-0.5">
              Canal: {canalSubtitle}
            </span>
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
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800/75 mb-0.5">
          Objetivo de conversión
        </p>
        <p className="leading-snug">{flow.objetivoConversion}</p>
      </div>

      <FlowchartLegend />

      <div className="overflow-x-auto pb-2 pt-1">
        <FlowTargetsContext.Provider value={allTargets}>
          <div
            ref={innerRef}
            className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-1 py-2 sm:px-2"
          >
            {/* Paralelograma de origen — editable/borrable */}
            {editingDeDonde ? (
              <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">
                  Origen del flujo
                </p>
                <textarea
                  autoFocus
                  value={draftDeDonde}
                  onChange={(e) => setDraftDeDonde(e.target.value.slice(0, 260))}
                  maxLength={260}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
                  placeholder="¿De dónde llega el usuario? (ej. Google Ads, email, directo…)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitDeDonde() }
                    if (e.key === 'Escape') setEditingDeDonde(false)
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingDeDonde(false)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={commitDeDonde}
                    className="rounded-lg bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : flow.deDondeEntra ? (
              <div
                className="relative flex w-full max-w-2xl flex-col items-center gap-1"
                onMouseEnter={() => setHoveredDeDonde(true)}
                onMouseLeave={() => setHoveredDeDonde(false)}
              >
                <FlowParallelogram>{flow.deDondeEntra}</FlowParallelogram>
                {canEdit && (
                  <div
                    className="flex gap-1 transition-opacity"
                    style={{ opacity: hoveredDeDonde ? 1 : 0, pointerEvents: hoveredDeDonde ? 'auto' : 'none' }}
                  >
                    <button
                      type="button"
                      onClick={() => { setDraftDeDonde(flow.deDondeEntra); setEditingDeDonde(true) }}
                      className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-50 ring-1 ring-transparent hover:ring-slate-200 transition-colors"
                      title="Editar origen"
                      aria-label="Editar origen"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={deleteDeDonde}
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 ring-1 ring-transparent hover:ring-red-200 transition-colors"
                      title="Eliminar origen"
                      aria-label="Eliminar origen"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : canEdit ? (
              <button
                type="button"
                onClick={() => { setDraftDeDonde(''); setEditingDeDonde(true) }}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50 transition-colors"
              >
                + añadir origen del flujo
              </button>
            ) : null}

            {flow.deDondeEntra && (
              <FlowDownArrow label="Llega a la primera pantalla del flujo (carga / enlace)" />
            )}

            <RenderFlowNodo
              nodo={raiz}
              onReplace={
                onUpdateFlow
                  ? (newRaiz) => onUpdateFlow({ ...flow, raiz: newRaiz })
                  : undefined
              }
            />

            {/* SVG overlay para las flechas de retorno */}
            {arrows.length > 0 && (
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  overflow: 'visible',
                  pointerEvents: 'none',
                }}
                aria-hidden
              >
                <defs>
                  <marker
                    id={`${svgMarkerId}-ret`}
                    markerWidth="7"
                    markerHeight="7"
                    refX="6"
                    refY="3.5"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L7,3.5 L0,7 Z" fill="#d97706" />
                  </marker>
                </defs>
                {arrows.map((a) => {
                  const offset = 32 + a.idx * 14
                  const x1 = a.fromX
                  const y1 = a.fromY
                  const x2 = a.fromX + offset
                  const x3 = a.toX + offset
                  const y2 = a.toY
                  const x4 = a.toX
                  const pathD = `M ${x1} ${y1} L ${x2} ${y1} L ${x3} ${y2} L ${x4} ${y2}`
                  const midY = (y1 + y2) / 2
                  return (
                    <g key={a.idx}>
                      <path
                        d={pathD}
                        stroke="#d97706"
                        strokeWidth="1.5"
                        strokeDasharray="5,3"
                        fill="none"
                        markerEnd={`url(#${svgMarkerId}-ret)`}
                      />
                      {a.label && (
                        <text
                          x={x2 - 6}
                          y={midY - 4}
                          fontSize="10"
                          fill="#92400e"
                          fontFamily="inherit"
                          fontWeight="500"
                          textAnchor="end"
                        >
                          {a.label}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
        </FlowTargetsContext.Provider>
      </div>
      <p className="text-[11px] text-gray-400 sm:hidden">
        Desplaza si hace falta para ver ramas anchas del diagrama →
      </p>
    </section>
  )
}

// ─── Panel de segmento / canal ────────────────────────────────────────────────

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
          Un diagrama por <strong>tipo de cliente</strong> y <strong>canal</strong>. Los canales se
          sincronizan con el User Journey; puedes añadir más solo en este segmento.
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
          <span className="text-[11px] font-medium text-gray-500">
            Canal adicional (solo este segmento)
          </span>
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

// ─── Página principal ─────────────────────────────────────────────────────────

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
        if (
          filt.segmentoActivo === 'clienteActual' ||
          filt.segmentoActivo === 'clientePotencial'
        ) {
          setSegmento(filt.segmentoActivo)
        }
        setFlow(next)
        if (typeof fSaved?.saved?.savedAt === 'string') setSavedAt(fSaved.saved.savedAt)
        setDepsOk({
          persona: hasValidPersonasSaved(personaSaved?.saved?.personas),
          pov: hasValidPovSaved(povSaved?.saved?.statements),
          journey: savedJourneyCellHasFlowBundle(
            journeySaved?.saved?.journey,
            journeySaved?.saved?.filters
          ),
        })
        const rawIdeas = ideasSaved?.saved?.ideas
        setIdeasPersist(
          rawIdeas
            ? normalizeUserJourneyIdeasPersist(rawIdeas)
            : normalizeUserJourneyIdeasPersist(null)
        )
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

  /** Actualiza el diagrama activo y guarda automáticamente. */
  const handleUpdateActiveLine = async (newLine: UserFlowLine) => {
    if (!flow) return
    const activeCanalId = flow[segmento].canalActivoId
    const next: UserFlowV3Persist = {
      ...flow,
      [segmento]: {
        ...flow[segmento],
        diagramas: { ...flow[segmento].diagramas, [activeCanalId]: newLine },
      },
    }
    setFlow(next)
    await saveFlow(next)
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
      const ca =
        typeof cps?.clienteActual === 'string'
          ? cps.clienteActual
          : flow.clienteActual.canalActivoId
      const cp =
        typeof cps?.clientePotencial === 'string'
          ? cps.clientePotencial
          : flow.clientePotencial.canalActivoId
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
      if (
        d.version !== 3 ||
        d.segmento !== segmento ||
        !d.flow ||
        typeof d.canalId !== 'string'
      ) {
        setGenError('Respuesta incompleta del servidor.')
        return
      }
      const next = mergeGeneratedFlow(
        flow,
        segmento,
        d.canalId as string,
        d.flow as UserFlowLine
      )
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
    return getIdeasForSegmentChannel(
      ideasPersist,
      'clienteActual',
      flow.clienteActual.canalActivoId
    ).length
  }, [flow, ideasPersist])
  const ideaCountPotencial = useMemo(() => {
    if (!flow || !ideasPersist) return 0
    return getIdeasForSegmentChannel(
      ideasPersist,
      'clientePotencial',
      flow.clientePotencial.canalActivoId
    ).length
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
          El <strong>User Flow</strong> se muestra como diagrama <strong>vertical</strong> con
          estilo <strong>pastel</strong> (cápsulas amarillas inicio/fin, rectángulos teal, rombo
          melocotón, paralelogramo gris para datos; la segunda rama de una decisión binaria va en
          tono rosa). Se genera a partir de las{' '}
          <strong>ideas de funcionalidades y contenido</strong> guardadas en{' '}
          <Link
            href="/user-journey"
            className="font-semibold text-cyan-800 underline underline-offset-2"
          >
            User Journey
          </Link>{' '}
          para el mismo <strong>segmento</strong> y <strong>canal</strong>. El mapa de journey, la
          persona y el POV afinan el resultado.
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

      {(!depsOk.persona ||
        !depsOk.pov ||
        !depsOk.journey ||
        ideaCountActual === 0 ||
        ideaCountPotencial === 0) && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
          <p className="font-medium">Faltan datos guardados</p>
          <ul className="text-xs list-disc pl-4 space-y-1">
            {!depsOk.journey && (
              <li>
                <Link
                  href="/user-journey"
                  className="font-semibold underline underline-offset-2"
                >
                  User Journey Map
                </Link>{' '}
                guardado con mapas para los canales activos por segmento.
              </li>
            )}
            {depsOk.journey && ideaCountActual === 0 && (
              <li>
                <strong>Ideas</strong> en User Journey (cliente actual, canal activo aquí): al
                menos una en «Funcionalidades y contenido por canal».
              </li>
            )}
            {depsOk.journey && ideaCountPotencial === 0 && (
              <li>
                <strong>Ideas</strong> en User Journey (cliente potencial, canal activo aquí): al
                menos una en la misma sección.
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
          <Link
            href="/user-journey"
            className="font-semibold text-cyan-800 underline underline-offset-2"
          >
            ideas funcionalidad/contenido
          </Link>
          {' · apoyo: mapa '}
          <Link
            href="/user-journey"
            className="font-semibold text-cyan-800 underline underline-offset-2"
          >
            Journey
          </Link>
          {' · '}
          <Link
            href="/user-persona"
            className="font-semibold text-cyan-700 underline underline-offset-2"
          >
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
              Genera diagramas para los canales activos de cada segmento (o solo el segmento y
              canal seleccionados). Cada canal puede tener su propio diagrama guardado en Sheets.
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
            . Genera el mapa en User Journey, añade <strong>ideas</strong> de
            funcionalidad/contenido para ese canal, y pulsa generar aquí.
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
          onUpdateFlow={(newLine) => void handleUpdateActiveLine(newLine)}
        />
      ) : null}
    </div>
  )
}
