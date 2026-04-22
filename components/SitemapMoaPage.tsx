'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SitemapNodo, SitemapPrioridad, SitemapTipo } from '@/lib/sitemap-moa-types'
import { newSitemapId } from '@/lib/sitemap-moa-types'

// ── Estilos visuales por prioridad ────────────────────────────────────────────

const PRIO_COLORS: Record<string, { box: string; badge: string }> = {
  must:   { box: 'bg-orange-100 border-orange-300 text-orange-900', badge: 'bg-orange-500 text-white' },
  should: { box: 'bg-yellow-100 border-yellow-300 text-yellow-900', badge: 'bg-yellow-400 text-white' },
  could:  { box: 'bg-gray-100  border-gray-300   text-gray-700',    badge: 'bg-gray-400 text-white'   },
  none:   { box: 'bg-white     border-gray-200   text-gray-600',    badge: 'bg-gray-300 text-gray-700' },
}

const WIDGET_STYLE = { box: 'bg-violet-50 border-violet-300 text-violet-900', badge: 'bg-violet-500 text-white' }

const TIPO_ICON: Record<SitemapTipo, string> = {
  inicio:  '🏠',
  seccion: '📂',
  pagina:  '📄',
  modal:   '🪟',
  accion:  '⚡',
  widget:  '⭐',
}

function prioKey(p: SitemapPrioridad) { return p ?? 'none' }
function nodeColors(nodo: SitemapNodo) {
  return nodo.tipo === 'widget' ? WIDGET_STYLE : PRIO_COLORS[prioKey(nodo.prioridad)]
}

// ── Tipos internos ─────────────────────────────────────────────────────────────

interface EditForm {
  id: string
  titulo: string
  tipo: SitemapTipo
  prioridad: SitemapPrioridad
  descripcion: string
}

// ── Componente principal ───────────────────────────────────────────────────────

export function SitemapMoaPage() {
  const [root, setRoot] = useState<SitemapNodo | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>('loading')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [iaStatus, setIaStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [iaError, setIaError] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditForm | null>(null)

  // ── Carga ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/sitemap-moa-saved')
      .then((r) => r.json())
      .then((d) => {
        if (d.saved) { setRoot(deduplicateInicio(d.saved.data?.root ?? null)); setSavedAt(d.saved.savedAt) }
        setLoadStatus('loaded')
      })
      .catch(() => setLoadStatus('error'))
  }, [])

  // ── Guardar ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!root) return
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/sitemap-moa-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { version: 1, root } }),
      })
      const j = await res.json()
      if (j.ok) { setSavedAt(j.savedAt); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2500) }
      else setSaveStatus('error')
    } catch { setSaveStatus('error') }
  }, [root])

  // ── Generar con IA ───────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    setIaError(null); setIaStatus('loading')
    try {
      const res = await fetch('/api/sitemap-moa-ia', { method: 'POST' })
      const j = await res.json()
      if (j.root) { setRoot(deduplicateInicio(j.root)); setIaStatus('idle') }
      else { setIaError(j.error ?? 'Error desconocido'); setIaStatus('error') }
    } catch (e) { setIaError(e instanceof Error ? e.message : 'Error'); setIaStatus('error') }
  }, [])

  // ── Mutaciones del árbol ──────────────────────────────────────────────────────

  const updateNode = useCallback((id: string, patch: Partial<SitemapNodo>) => {
    setRoot((prev) => prev ? applyPatch(prev, id, patch) : prev)
  }, [])

  const addChild = useCallback((parentId: string) => {
    const n: SitemapNodo = { id: newSitemapId(), titulo: 'Nueva página', tipo: 'pagina', prioridad: null, descripcion: null, hijos: [] }
    setRoot((prev) => prev ? addChildNode(prev, parentId, n) : prev)
    setEdit({ id: n.id, titulo: n.titulo, tipo: 'pagina', prioridad: null, descripcion: '' })
  }, [])

  const deleteNode = useCallback((id: string) => {
    setRoot((prev) => prev ? deleteNodeById(prev, id) : prev)
    setEdit(null)
  }, [])

  const openEdit = useCallback((nodo: SitemapNodo) => {
    setEdit({ id: nodo.id, titulo: nodo.titulo, tipo: nodo.tipo, prioridad: nodo.prioridad, descripcion: nodo.descripcion ?? '' })
  }, [])

  const saveEdit = useCallback(() => {
    if (!edit) return
    updateNode(edit.id, {
      titulo: edit.titulo.trim() || 'Sin título',
      tipo: edit.tipo,
      prioridad: edit.prioridad,
      descripcion: edit.descripcion.trim() || null,
    })
    setEdit(null)
  }, [edit, updateNode])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={iaStatus === 'loading'}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-60 transition-colors"
        >
          {iaStatus === 'loading' ? (
            <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>Generando…</>
          ) : '✦ Generar con IA'}
        </button>
        <button
          onClick={handleSave}
          disabled={saveStatus === 'saving' || !root}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {saveStatus === 'saving' ? 'Guardando…' : saveStatus === 'saved' ? '✓ Guardado' : 'Guardar en Sheets'}
        </button>
        {savedAt && <span className="text-xs text-gray-400">Último guardado: {savedAt}</span>}
        {saveStatus === 'error' && <span className="text-xs text-red-600">Error al guardar</span>}
      </div>

      {iaError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{iaError}</div>
      )}
      {loadStatus === 'loading' && <p className="text-sm text-gray-400 animate-pulse">Cargando datos guardados…</p>}

      <p className="text-xs text-gray-400">
        «Generar con IA» usa solo la matriz MVP del canal <strong>Página web</strong> en Sheets (y MoSCoW/POV si existen)
        · Doble clic para editar · + para añadir hijos · × para eliminar
      </p>

      {/* Árbol vertical */}
      <div className="pb-4">
        {root ? (
          <TreeNode
            nodo={root}
            depth={0}
            onEdit={openEdit}
            onAddChild={addChild}
            onDelete={deleteNode}
          />
        ) : loadStatus === 'loaded' ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-3xl mb-3">🗺️</span>
            <p className="text-sm">
              En /mvp elige <strong>Página web</strong>, guarda la matriz MVP y usa «Generar con IA» para crear el mapa
            </p>
          </div>
        ) : null}
      </div>

      {/* Modal edición */}
      {edit && (
        <EditModal
          edit={edit}
          onChange={setEdit}
          onSave={saveEdit}
          onDelete={() => { if (edit.id !== root?.id) deleteNode(edit.id) }}
          onClose={() => setEdit(null)}
          isRoot={edit.id === root?.id}
        />
      )}

      {/* Leyenda */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
        {(['must','should','could','none'] as const).map((k) => (
          <div key={k} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm border ${PRIO_COLORS[k].box}`} />
            {k === 'none' ? 'Sin prioridad' : k.charAt(0).toUpperCase() + k.slice(1)}
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded-sm border ${WIDGET_STYLE.box}`} />
          ⭐ Widget portada
        </div>
        <span className="text-gray-200 hidden sm:inline">|</span>
        {Object.entries(TIPO_ICON).map(([tipo, icon]) => (
          <span key={tipo}>{icon} {tipo}</span>
        ))}
      </div>
    </div>
  )
}

// ── Nodo del árbol (layout vertical indentado) ────────────────────────────────

function TreeNode({
  nodo, depth, isLeft = false, onEdit, onAddChild, onDelete,
}: {
  nodo: SitemapNodo
  depth: number
  isLeft?: boolean
  onEdit: (n: SitemapNodo) => void
  onAddChild: (id: string) => void
  onDelete: (id: string) => void
}) {
  const colors = nodeColors(nodo)
  const hasChildren = nodo.hijos.length > 0
  const canHaveChildren = depth < 2
  const isWidget = nodo.tipo === 'widget'

  const cardClass =
    depth === 0
      ? `text-sm font-bold px-4 py-2.5 rounded-xl border-2 shadow-sm w-fit ${colors.box}`
      : depth === 1
      ? `text-[11.5px] font-semibold px-3 py-2 rounded-lg border shadow-sm ${colors.box} ${isWidget ? 'border-dashed' : ''}`
      : `text-[10.5px] px-2.5 py-1.5 rounded-md border ${colors.box} ${isWidget ? 'border-dashed' : ''}`

  // En depth=0 separamos widgets (portada) de secciones (menú)
  const widgetHijos  = depth === 0 ? nodo.hijos.filter((h) => h.tipo === 'widget') : []
  const seccionHijos = depth === 0 ? nodo.hijos.filter((h) => h.tipo !== 'widget') : nodo.hijos

  return (
    <div className={depth === 0 ? 'select-none inline-flex flex-col items-center' : 'select-none'}>
      {/* Fila del nodo — flex-row-reverse cuando es columna izquierda */}
      <div className={`flex items-start gap-0 group w-fit ${isLeft ? 'flex-row-reverse' : ''}`}>
        {/* Conector horizontal (solo niveles > 0) */}
        {depth > 0 && (
          <div className="flex items-center shrink-0 self-stretch">
            <div className="w-5 h-px bg-gray-300 mt-[18px]" />
          </div>
        )}

        {/* Tarjeta */}
        <div className={`relative w-fit ${depth === 0 ? '' : 'my-0.5'}`}>
          <div
            onDoubleClick={() => onEdit(nodo)}
            className={`cursor-pointer hover:shadow-md transition-shadow ${cardClass}`}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="shrink-0">{TIPO_ICON[nodo.tipo]}</span>
              <span className="truncate flex-1 min-w-0">{nodo.titulo}</span>
              {nodo.prioridad && (
                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${colors.badge}`}>
                  {nodo.prioridad}
                </span>
              )}
            </div>
            {nodo.descripcion && depth <= 1 && (
              <p className="text-[9.5px] font-normal opacity-60 mt-0.5 truncate">{nodo.descripcion}</p>
            )}
          </div>

          {/* Botones acción en hover */}
          <div className={`absolute top-1 ${isLeft ? 'left-1' : 'right-1'} hidden group-hover:flex gap-1 z-10`}>
            {canHaveChildren && !isLeft && (
              <button
                onClick={() => onAddChild(nodo.id)}
                className="h-5 w-5 rounded-full bg-violet-500 text-white text-xs flex items-center justify-center hover:bg-violet-600 shadow leading-none"
                title="Añadir hijo"
              >+</button>
            )}
            {depth > 0 && (
              <button
                onClick={() => onDelete(nodo.id)}
                className="h-5 w-5 rounded-full bg-red-400 text-white text-xs flex items-center justify-center hover:bg-red-500 shadow leading-none"
                title="Eliminar"
              >×</button>
            )}
          </div>
        </div>
      </div>

      {/* Hijos — en depth=0: dos columnas; en depth>0: árbol normal */}
      {depth === 0 && (widgetHijos.length > 0 || seccionHijos.length > 0) && (
        <>
        <div className="flex items-start">
          {/* Columna izquierda: widgets de portada (conector a la derecha) */}
          {widgetHijos.length > 0 && (
            <div className="border-r border-gray-200 flex flex-col items-end pt-3">
              {widgetHijos.map((hijo) => (
                <TreeNode
                  key={hijo.id}
                  nodo={hijo}
                  depth={1}
                  isLeft={true}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
          {/* Columna derecha: secciones de menú (conector a la izquierda) */}
          {seccionHijos.length > 0 && (
            <div className="border-l border-gray-200 pt-3" style={{ marginLeft: '1.25rem' }}>
              {seccionHijos.map((hijo) => (
                <TreeNode
                  key={hijo.id}
                  nodo={hijo}
                  depth={1}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
        </>
      )}

      {/* Hijos normales (depth > 0) */}
      {depth > 0 && hasChildren && (
        <div className="border-l border-gray-200 pl-0" style={{ marginLeft: '2.5rem' }}>
          {nodo.hijos.map((hijo) => (
            <TreeNode
              key={hijo.id}
              nodo={hijo}
              depth={depth + 1}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Modal edición ─────────────────────────────────────────────────────────────

function EditModal({
  edit, onChange, onSave, onDelete, onClose, isRoot,
}: {
  edit: EditForm
  onChange: (e: EditForm) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  isRoot: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Editar nodo</h3>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Título</label>
          <input
            autoFocus maxLength={60} value={edit.titulo}
            onChange={(e) => onChange({ ...edit, titulo: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Descripción (opcional)</label>
          <input
            maxLength={120} value={edit.descripcion}
            onChange={(e) => onChange({ ...edit, descripcion: e.target.value })}
            placeholder="¿Qué hace esta página?"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
            <select
              value={edit.tipo}
              onChange={(e) => onChange({ ...edit, tipo: e.target.value as SitemapTipo })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400"
            >
              <option value="inicio">🏠 Inicio</option>
              <option value="seccion">📂 Sección</option>
              <option value="pagina">📄 Página</option>
              <option value="modal">🪟 Modal</option>
              <option value="accion">⚡ Acción</option>
              <option value="widget">⭐ Widget portada</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Prioridad</label>
            <select
              value={edit.prioridad ?? ''}
              onChange={(e) => onChange({ ...edit, prioridad: (e.target.value || null) as SitemapPrioridad })}
              className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:border-violet-400"
            >
              <option value="">— Sin prioridad</option>
              <option value="must">Must</option>
              <option value="should">Should</option>
              <option value="could">Could</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={onSave}
            className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >Guardar</button>
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >Cancelar</button>
          {!isRoot && (
            <button onClick={onDelete}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
              title="Eliminar nodo"
            >🗑</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Normalización del nodo raíz ────────────────────────────────────────────────
// • Elimina secciones "Inicio"/"Bienvenida" duplicadas
// • Aplana antigua sección "Portada — Elementos destacados" extrayendo sus widgets

function deduplicateInicio(root: SitemapNodo | null): SitemapNodo | null {
  if (!root || root.tipo !== 'inicio') return root

  const widgets: SitemapNodo[] = []
  const secciones: SitemapNodo[] = []

  for (const hijo of root.hijos) {
    if (hijo.tipo !== 'seccion') { secciones.push(hijo); continue }
    // Sección duplicada de inicio/bienvenida → descartar
    if (/^(inicio|bienvenida|home)$/i.test(hijo.titulo.trim())) continue
    // Antigua sección portada/elementos destacados → aplanar sus widgets al root
    if (/portada|destacados/i.test(hijo.titulo)) { widgets.push(...hijo.hijos); continue }
    secciones.push(hijo)
  }

  return { ...root, hijos: [...widgets, ...secciones] }
}

// ── Mutaciones del árbol (inmutables) ─────────────────────────────────────────

function applyPatch(node: SitemapNodo, id: string, patch: Partial<SitemapNodo>): SitemapNodo {
  if (node.id === id) return { ...node, ...patch }
  return { ...node, hijos: node.hijos.map((h) => applyPatch(h, id, patch)) }
}

function addChildNode(node: SitemapNodo, parentId: string, newChild: SitemapNodo): SitemapNodo {
  if (node.id === parentId) return { ...node, hijos: [...node.hijos, newChild] }
  return { ...node, hijos: node.hijos.map((h) => addChildNode(h, parentId, newChild)) }
}

function deleteNodeById(node: SitemapNodo, id: string): SitemapNodo {
  return { ...node, hijos: node.hijos.filter((h) => h.id !== id).map((h) => deleteNodeById(h, id)) }
}
