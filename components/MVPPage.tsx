'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MVPNota, MVPNotaColor, MVPNotaTamano } from '@/lib/mvp-types'
import { newMVPNotaId } from '@/lib/mvp-types'

// ── Helpers de visualización ──────────────────────────────────────────────────

const TAMANO_CLASS: Record<MVPNotaTamano, string> = {
  sm: 'w-[88px] min-h-[68px] text-[9.5px] leading-[1.25] p-1.5',
  md: 'w-[116px] min-h-[88px] text-[10.5px] leading-[1.3] p-2',
  lg: 'w-[148px] min-h-[112px] text-[12px] leading-[1.35] p-2.5 font-semibold',
}

const COLOR_CLASS: Record<MVPNotaColor, string> = {
  amarillo: 'bg-yellow-200 border-yellow-300 shadow-yellow-100',
  naranja: 'bg-orange-200 border-orange-300 shadow-orange-100',
}

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface EditForm {
  id: string | null
  texto: string
  color: MVPNotaColor
  tamano: MVPNotaTamano
}

// ── Componente principal ───────────────────────────────────────────────────────

export function MVPPage() {
  const [notas, setNotas] = useState<MVPNota[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [iaStatus, setIaStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [iaError, setIaError] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditForm | null>(null)

  const matrixRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<{
    id: string
    startPx: { x: number; y: number }
    origPct: { x: number; y: number }
  } | null>(null)

  // ── Carga inicial ────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoadStatus('loading')
    fetch('/api/mvp-saved')
      .then((r) => r.json())
      .then((data) => {
        if (data.saved) {
          setNotas(data.saved.data?.notas ?? [])
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
      const res = await fetch('/api/mvp-saved', {
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
      const res = await fetch('/api/mvp-ia', { method: 'POST' })
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

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    const nota = notas.find((n) => n.id === id)
    if (!nota) return
    draggingRef.current = {
      id,
      startPx: { x: e.clientX, y: e.clientY },
      origPct: { x: nota.x, y: nota.y },
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [notas])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = draggingRef.current
    if (!drag || !matrixRef.current) return
    const rect = matrixRef.current.getBoundingClientRect()
    const dx = ((e.clientX - drag.startPx.x) / rect.width) * 100
    const dy = ((e.clientY - drag.startPx.y) / rect.height) * 100
    const newX = Math.max(0, Math.min(100, drag.origPct.x + dx))
    const newY = Math.max(0, Math.min(100, drag.origPct.y + dy))
    setNotas((prev) =>
      prev.map((n) => (n.id === drag.id ? { ...n, x: newX, y: newY } : n))
    )
  }, [])

  const handlePointerUp = useCallback(() => {
    draggingRef.current = null
  }, [])

  // ── Añadir nota al hacer doble clic en el canvas ──────────────────────────────

  const handleMatrixDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!matrixRef.current) return
    if ((e.target as HTMLElement).closest('[data-nota]')) return
    const rect = matrixRef.current.getBoundingClientRect()
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100))
    const id = newMVPNotaId()
    setNotas((prev) => [
      ...prev,
      { id, texto: 'Nueva funcionalidad', x, y, color: 'amarillo', tamano: 'md', origenHmw: null },
    ])
    setEdit({ id, texto: 'Nueva funcionalidad', color: 'amarillo', tamano: 'md' })
  }, [])

  // ── Edición ───────────────────────────────────────────────────────────────────

  const openEdit = useCallback((nota: MVPNota) => {
    setEdit({ id: nota.id, texto: nota.texto, color: nota.color, tamano: nota.tamano })
  }, [])

  const saveEdit = useCallback(() => {
    if (!edit) return
    if (edit.id === null) {
      setEdit(null)
      return
    }
    setNotas((prev) =>
      prev.map((n) =>
        n.id === edit.id
          ? { ...n, texto: edit.texto.trim() || n.texto, color: edit.color, tamano: edit.tamano }
          : n
      )
    )
    setEdit(null)
  }, [edit])

  const deleteNota = useCallback((id: string) => {
    setNotas((prev) => prev.filter((n) => n.id !== id))
    setEdit(null)
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
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
          disabled={saveStatus === 'saving' || notas.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {saveStatus === 'saving' ? 'Guardando…' : saveStatus === 'saved' ? '✓ Guardado' : 'Guardar en Sheets'}
        </button>

        {savedAt && (
          <span className="text-xs text-gray-400">Último guardado: {savedAt}</span>
        )}

        {saveStatus === 'error' && (
          <span className="text-xs text-red-600">Error al guardar</span>
        )}
      </div>

      {iaError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {iaError}
        </div>
      )}

      {loadStatus === 'loading' && (
        <div className="text-sm text-gray-400 animate-pulse">Cargando datos guardados…</div>
      )}

      {/* Instrucción */}
      <p className="text-xs text-gray-400">
        Doble clic en la matriz para añadir una funcionalidad · Clic en una nota para editarla · Arrastra para reposicionar
      </p>

      {/* Matriz */}
      <div className="relative w-full" style={{ paddingBottom: '0' }}>
        {/* Outer labels — eje Y (usuario) */}
        <div className="flex flex-col items-center mb-1">
          <span className="text-xs font-medium text-gray-600">😍 Mucho valor para el usuario</span>
        </div>

        <div className="flex items-stretch gap-0">
          {/* Label izquierda — eje X */}
          <div className="flex items-center justify-center w-6 shrink-0">
            <span
              className="text-[10px] font-medium text-gray-500 whitespace-nowrap"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
              Poco valor para el negocio
            </span>
          </div>

          {/* Canvas de la matriz */}
          <div
            ref={matrixRef}
            className="relative flex-1 rounded-xl overflow-hidden cursor-crosshair select-none"
            style={{ aspectRatio: '1 / 0.85', border: '1.5px solid #d1d5db' }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleMatrixDoubleClick}
          >
            {/* Fondo por cuadrantes */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
              {/* TL: alto usuario, bajo negocio */}
              <div className="bg-yellow-50/60" />
              {/* TR: alto usuario, alto negocio — área MVP */}
              <div className="bg-orange-50/80" />
              {/* BL: bajo usuario, bajo negocio */}
              <div className="bg-gray-50/60" />
              {/* BR: bajo usuario, alto negocio */}
              <div className="bg-blue-50/40" />
            </div>

            {/* Etiqueta cuadrante MVP */}
            <div className="absolute top-2 right-3 text-[9px] font-semibold text-orange-400 uppercase tracking-wide pointer-events-none">
              MVP
            </div>

            {/* Ejes centrales */}
            {/* Eje vertical */}
            <div
              className="absolute top-0 bottom-0 w-px bg-gray-300 pointer-events-none"
              style={{ left: '50%' }}
            />
            {/* Eje horizontal */}
            <div
              className="absolute left-0 right-0 h-px bg-gray-300 pointer-events-none"
              style={{ top: '50%' }}
            />

            {/* Puntas de flecha */}
            {/* Arriba */}
            <svg
              className="absolute pointer-events-none"
              style={{ left: 'calc(50% - 5px)', top: 0 }}
              width="10" height="10" viewBox="0 0 10 10"
            >
              <polygon points="5,0 0,8 10,8" fill="#9ca3af" />
            </svg>
            {/* Abajo */}
            <svg
              className="absolute pointer-events-none"
              style={{ left: 'calc(50% - 5px)', bottom: 0 }}
              width="10" height="10" viewBox="0 0 10 10"
            >
              <polygon points="5,10 0,2 10,2" fill="#9ca3af" />
            </svg>
            {/* Derecha */}
            <svg
              className="absolute pointer-events-none"
              style={{ right: 0, top: 'calc(50% - 5px)' }}
              width="10" height="10" viewBox="0 0 10 10"
            >
              <polygon points="10,5 2,0 2,10" fill="#9ca3af" />
            </svg>
            {/* Izquierda */}
            <svg
              className="absolute pointer-events-none"
              style={{ left: 0, top: 'calc(50% - 5px)' }}
              width="10" height="10" viewBox="0 0 10 10"
            >
              <polygon points="0,5 8,0 8,10" fill="#9ca3af" />
            </svg>

            {/* Notas sticky */}
            {notas.map((nota) => (
              <StickyNota
                key={nota.id}
                nota={nota}
                onPointerDown={handlePointerDown}
                onEdit={openEdit}
              />
            ))}

            {/* Vacío */}
            {notas.length === 0 && loadStatus === 'loaded' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs text-gray-400 text-center px-4">
                  Usa «Generar con IA» o haz doble clic para añadir funcionalidades
                </span>
              </div>
            )}
          </div>

          {/* Label derecha — eje X */}
          <div className="flex items-center justify-center w-6 shrink-0">
            <span
              className="text-[10px] font-medium text-gray-500 whitespace-nowrap"
              style={{ writingMode: 'vertical-rl' }}
            >
              Mucho valor para el negocio 💰
            </span>
          </div>
        </div>

        {/* Label inferior — eje Y */}
        <div className="flex flex-col items-center mt-1">
          <span className="text-xs font-medium text-gray-600">Poco valor para el usuario</span>
        </div>
      </div>

      {/* Modal de edición */}
      {edit && (
        <EditModal
          edit={edit}
          onChange={setEdit}
          onSave={saveEdit}
          onDelete={() => edit.id && deleteNota(edit.id)}
          onClose={() => setEdit(null)}
        />
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm bg-orange-200 border border-orange-300" />
          Alta prioridad (top-right)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm bg-yellow-200 border border-yellow-300" />
          Media prioridad
        </div>
        <div className="flex items-center gap-4">
          <span>Tamaño = importancia:</span>
          <span className="font-semibold">Grande</span>= crítica ·
          <span className="font-medium">Mediana</span>= importante ·
          <span className="text-gray-400">Pequeña</span>= a explorar
        </div>
      </div>
    </div>
  )
}

// ── Sticky nota ───────────────────────────────────────────────────────────────

function StickyNota({
  nota,
  onPointerDown,
  onEdit,
}: {
  nota: MVPNota
  onPointerDown: (e: React.PointerEvent, id: string) => void
  onEdit: (nota: MVPNota) => void
}) {
  const rotation = useRef(((nota.id.charCodeAt(nota.id.length - 1) % 7) - 3) * 0.8)

  return (
    <div
      data-nota={nota.id}
      style={{
        position: 'absolute',
        left: `${nota.x}%`,
        top: `${nota.y}%`,
        transform: `translate(-50%, -50%) rotate(${rotation.current}deg)`,
        zIndex: 10,
        touchAction: 'none',
      }}
      className={`
        ${TAMANO_CLASS[nota.tamano]}
        ${COLOR_CLASS[nota.color]}
        border rounded-sm shadow-md cursor-grab active:cursor-grabbing
        flex items-center justify-center text-center font-medium text-gray-800
        transition-shadow hover:shadow-lg hover:z-20
      `}
      onPointerDown={(e) => onPointerDown(e, nota.id)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onEdit(nota)
      }}
    >
      {nota.texto}
    </div>
  )
}

// ── Modal de edición ──────────────────────────────────────────────────────────

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Editar funcionalidad</h3>

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
              onChange={(e) => onChange({ ...edit, color: e.target.value as MVPNotaColor })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400"
            >
              <option value="amarillo">🟡 Amarillo</option>
              <option value="naranja">🟠 Naranja (alta prioridad)</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Tamaño</label>
            <select
              value={edit.tamano}
              onChange={(e) => onChange({ ...edit, tamano: e.target.value as MVPNotaTamano })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400"
            >
              <option value="sm">Pequeña</option>
              <option value="md">Mediana</option>
              <option value="lg">Grande (crítica)</option>
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
