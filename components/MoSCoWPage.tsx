'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MOSCOW_CATEGORIAS,
  MOSCOW_LABELS,
  MoSCoWCategoria,
  MoSCoWColor,
  MoSCoWNota,
  MoSCoWNotas,
  MoSCoWTamano,
  createEmptyNotas,
  newMoSCoWId,
} from '@/lib/moscow-types'

// ── Estilos visuales de las notas ─────────────────────────────────────────────

const COLOR_CLASSES: Record<MoSCoWColor, string> = {
  naranja: 'bg-orange-200 border-orange-300 shadow-orange-100',
  amarillo: 'bg-yellow-200 border-yellow-300 shadow-yellow-100',
  blanco: 'bg-white border-gray-200 shadow-gray-100 text-gray-500',
}

const SIZE_CLASSES: Record<MoSCoWTamano, string> = {
  sm: 'min-w-[76px] max-w-[100px] min-h-[60px] text-[9px] leading-[1.25] p-1.5',
  md: 'min-w-[100px] max-w-[130px] min-h-[74px] text-[10px] leading-[1.3] p-2',
  lg: 'min-w-[120px] max-w-[160px] min-h-[90px] text-[11.5px] leading-[1.35] p-2.5 font-semibold',
}

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface DragState {
  notaId: string
  fromCat: MoSCoWCategoria
}

interface EditForm {
  notaId: string
  cat: MoSCoWCategoria
  texto: string
  color: MoSCoWColor
  tamano: MoSCoWTamano
}

// ── Componente principal ───────────────────────────────────────────────────────

export function MoSCoWPage() {
  const [notas, setNotas] = useState<MoSCoWNotas>(createEmptyNotas())
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [iaStatus, setIaStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [iaError, setIaError] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<MoSCoWCategoria | null>(null)
  const [edit, setEdit] = useState<EditForm | null>(null)

  const dragRef = useRef<DragState | null>(null)
  const laneRefs = useRef<Partial<Record<MoSCoWCategoria, HTMLDivElement | null>>>({})

  // ── Carga inicial ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoadStatus('loading')
    fetch('/api/moscow-saved')
      .then((r) => r.json())
      .then((data) => {
        if (data.saved) {
          setNotas(data.saved.data?.notas ?? createEmptyNotas())
          setSavedAt(data.saved.savedAt)
        }
        setLoadStatus('loaded')
      })
      .catch(() => setLoadStatus('error'))
  }, [])

  // ── Guardar ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const totalNotas = MOSCOW_CATEGORIAS.reduce((sum, c) => sum + notas[c].length, 0)
      if (totalNotas === 0) { setSaveStatus('idle'); return }
      const res = await fetch('/api/moscow-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { version: 1, notas } }),
      })
      const json = await res.json()
      if (json.ok) {
        setSavedAt(json.savedAt)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    }
  }, [notas])

  // ── Generar con IA ───────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setIaError(null)
    setIaStatus('loading')
    try {
      const res = await fetch('/api/moscow-ia', { method: 'POST' })
      const json = await res.json()
      if (json.notas) {
        setNotas(json.notas)
        setIaStatus('idle')
      } else {
        setIaError(json.error ?? 'Error desconocido')
        setIaStatus('error')
      }
    } catch (e) {
      setIaError(e instanceof Error ? e.message : 'Error de red')
      setIaStatus('error')
    }
  }, [])

  // ── Drag & Drop entre lanes ───────────────────────────────────────────────────

  const detectLane = useCallback((clientX: number, clientY: number): MoSCoWCategoria | null => {
    for (const cat of MOSCOW_CATEGORIAS) {
      const el = laneRefs.current[cat]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return cat
      }
    }
    return null
  }, [])

  const handleNotaPointerDown = useCallback(
    (e: React.PointerEvent, notaId: string, cat: MoSCoWCategoria) => {
      e.preventDefault()
      e.stopPropagation()
      dragRef.current = { notaId, fromCat: cat }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    []
  )

  const handleGlobalPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return
      const lane = detectLane(e.clientX, e.clientY)
      setDropTarget(lane)
    },
    [detectLane]
  )

  const handleGlobalPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag) return
      dragRef.current = null
      const targetCat = detectLane(e.clientX, e.clientY)
      setDropTarget(null)
      if (!targetCat || targetCat === drag.fromCat) return

      setNotas((prev) => {
        const nota = prev[drag.fromCat].find((n) => n.id === drag.notaId)
        if (!nota) return prev
        return {
          ...prev,
          [drag.fromCat]: prev[drag.fromCat].filter((n) => n.id !== drag.notaId),
          [targetCat]: [...prev[targetCat], nota],
        }
      })
    },
    [detectLane]
  )

  // ── Añadir nota ──────────────────────────────────────────────────────────────

  const addNota = useCallback((cat: MoSCoWCategoria) => {
    const id = newMoSCoWId()
    const defaultColor: MoSCoWColor = cat === 'must' ? 'naranja' : cat === 'wont' ? 'blanco' : 'amarillo'
    const nota: MoSCoWNota = { id, texto: 'Nueva funcionalidad', color: defaultColor, tamano: 'md', origenMVP: null }
    setNotas((prev) => ({ ...prev, [cat]: [...prev[cat], nota] }))
    setEdit({ notaId: id, cat, texto: nota.texto, color: defaultColor, tamano: 'md' })
  }, [])

  // ── Edición ───────────────────────────────────────────────────────────────────

  const openEdit = useCallback((nota: MoSCoWNota, cat: MoSCoWCategoria) => {
    setEdit({ notaId: nota.id, cat, texto: nota.texto, color: nota.color, tamano: nota.tamano })
  }, [])

  const saveEdit = useCallback(() => {
    if (!edit) return
    setNotas((prev) => ({
      ...prev,
      [edit.cat]: prev[edit.cat].map((n) =>
        n.id === edit.notaId
          ? { ...n, texto: edit.texto.trim() || n.texto, color: edit.color, tamano: edit.tamano }
          : n
      ),
    }))
    setEdit(null)
  }, [edit])

  const deleteNota = useCallback((notaId: string, cat: MoSCoWCategoria) => {
    setNotas((prev) => ({ ...prev, [cat]: prev[cat].filter((n) => n.id !== notaId) }))
    setEdit(null)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  const totalNotas = MOSCOW_CATEGORIAS.reduce((s, c) => s + notas[c].length, 0)

  return (
    <div
      className="space-y-5"
      onPointerMove={handleGlobalPointerMove}
      onPointerUp={handleGlobalPointerUp}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={iaStatus === 'loading'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-60 transition-colors"
        >
          {iaStatus === 'loading' ? (
            <>
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generando…
            </>
          ) : (
            <>✦ Generar con IA</>
          )}
        </button>

        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving' || totalNotas === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {saveStatus === 'saving' ? 'Guardando…' : saveStatus === 'saved' ? '✓ Guardado' : 'Guardar en Sheets'}
        </button>

        {savedAt && <span className="text-xs text-gray-400">Último guardado: {savedAt}</span>}
        {saveStatus === 'error' && <span className="text-xs text-red-600">Error al guardar</span>}
      </div>

      {iaError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {iaError}
        </div>
      )}

      {loadStatus === 'loading' && (
        <p className="text-sm text-gray-400 animate-pulse">Cargando datos guardados…</p>
      )}

      <p className="text-xs text-gray-400">
        Arrastra las notas entre filas para moverlas · Doble clic para editar · &quot;+&quot; para añadir
      </p>

      {/* Swim lanes */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        {MOSCOW_CATEGORIAS.map((cat, idx) => {
          const meta = MOSCOW_LABELS[cat]
          const isDropTarget = dropTarget === cat
          const isLast = idx === MOSCOW_CATEGORIAS.length - 1

          return (
            <div
              key={cat}
              ref={(el) => { laneRefs.current[cat] = el }}
              className={`
                flex gap-0 transition-colors
                ${meta.bg}
                ${isDropTarget ? 'ring-inset ring-2 ring-violet-400 brightness-95' : ''}
                ${!isLast ? `border-b ${meta.border}` : ''}
              `}
              style={{ minHeight: '110px' }}
            >
              {/* Label izquierda */}
              <div
                className={`shrink-0 w-36 sm:w-44 flex flex-col justify-center gap-1 px-4 py-4 border-r ${meta.border}`}
              >
                <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.badge}`}>
                  {meta.titulo}
                </span>
                <p className="text-[10px] text-gray-500 leading-snug mt-0.5">
                  {meta.descripcion}
                </p>
              </div>

              {/* Área de notas */}
              <div className="flex-1 flex flex-wrap content-start items-start gap-2 p-3 min-h-[110px]">
                {notas[cat].map((nota) => (
                  <StickyNota
                    key={nota.id}
                    nota={nota}
                    cat={cat}
                    onPointerDown={handleNotaPointerDown}
                    onDoubleClick={() => openEdit(nota, cat)}
                  />
                ))}

                {/* Botón añadir */}
                <button
                  onClick={() => addNota(cat)}
                  className="self-start mt-0.5 h-7 w-7 rounded-md border border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center text-base leading-none transition-colors shrink-0"
                  title={`Añadir nota en ${meta.titulo}`}
                >
                  +
                </button>

                {/* Placeholder cuando está vacío */}
                {notas[cat].length === 0 && loadStatus === 'loaded' && (
                  <span className="text-[10px] text-gray-300 self-center ml-1 pointer-events-none">
                    Arrastra notas aquí o pulsa +
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal edición */}
      {edit && (
        <EditModal
          edit={edit}
          onChange={setEdit}
          onSave={saveEdit}
          onDelete={() => deleteNota(edit.notaId, edit.cat)}
          onClose={() => setEdit(null)}
        />
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm bg-orange-200 border border-orange-300" />
          Must · alta prioridad
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm bg-yellow-200 border border-yellow-300" />
          Should / Could
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm bg-white border border-gray-300" />
          Won&apos;t · descartado
        </div>
      </div>
    </div>
  )
}

// ── Sticky nota ───────────────────────────────────────────────────────────────

function StickyNota({
  nota,
  cat,
  onPointerDown,
  onDoubleClick,
}: {
  nota: MoSCoWNota
  cat: MoSCoWCategoria
  onPointerDown: (e: React.PointerEvent, id: string, cat: MoSCoWCategoria) => void
  onDoubleClick: () => void
}) {
  const rotation = useRef(((nota.id.charCodeAt(nota.id.length - 1) % 7) - 3) * 0.8)

  return (
    <div
      style={{ transform: `rotate(${rotation.current}deg)`, touchAction: 'none' }}
      className={`
        ${COLOR_CLASSES[nota.color]}
        ${SIZE_CLASSES[nota.tamano]}
        border rounded-sm shadow-md
        cursor-grab active:cursor-grabbing
        flex items-center justify-center text-center
        font-medium text-gray-800
        hover:shadow-lg hover:z-10 transition-shadow
        select-none shrink-0
      `}
      onPointerDown={(e) => onPointerDown(e, nota.id, cat)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick() }}
    >
      {nota.texto}
    </div>
  )
}

// ── Modal edición ─────────────────────────────────────────────────────────────

function EditModal({
  edit,
  onChange,
  onSave,
  onDelete,
  onClose,
}: {
  edit: EditForm
  onChange: (e: EditForm) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const meta = MOSCOW_LABELS[edit.cat]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${meta.badge}`}>{meta.titulo}</span>
          <h3 className="text-base font-semibold text-gray-900">Editar funcionalidad</h3>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Texto</label>
          <textarea
            autoFocus
            rows={3}
            maxLength={80}
            value={edit.texto}
            onChange={(e) => onChange({ ...edit, texto: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none resize-none"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
            <select
              value={edit.color}
              onChange={(e) => onChange({ ...edit, color: e.target.value as MoSCoWColor })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400"
            >
              <option value="naranja">🟠 Naranja</option>
              <option value="amarillo">🟡 Amarillo</option>
              <option value="blanco">⬜ Blanco</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Tamaño</label>
            <select
              value={edit.tamano}
              onChange={(e) => onChange({ ...edit, tamano: e.target.value as MoSCoWTamano })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400"
            >
              <option value="sm">Pequeña</option>
              <option value="md">Mediana</option>
              <option value="lg">Grande</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onSave}
            className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            Guardar
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar nota"
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  )
}
