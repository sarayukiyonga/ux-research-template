'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { AutoTextarea } from '@/components/ui/auto-textarea'
import { SegmentFiltersReadBanner } from '@/components/SegmentFiltersReadBanner'
import { readSegmentSurveyFilters, segmentFiltersToApi } from '@/lib/segment-survey-filters'

export type EmpathySegment = 'clientes' | 'potenciales'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmpathyMapData {
  piensaSiente: string[]
  ve: string[]
  oye: string[]
  dice: string[]
  hace: string[]
  dolorFrustraciones: string[]
  necesidadesDeseos: string[]
}

function useIsNarrowScreen() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const apply = () => setNarrow(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return narrow
}

// ── Sticky note ────────────────────────────────────────────────────────────────

// Note dimensions
const NOTE = 62   // compact square size (px)
const GUTTER = 4  // gap between notes (px)
const GW = NOTE * 2 + GUTTER  // group width for 2-column layout = 128px

function StickyNote({ text, bg, expandDir = 'right' }: { text: string; bg: string; expandDir?: 'right' | 'left' }) {
  const [pinned, setPinned] = useState(false)
  const isNarrow = useIsNarrowScreen()

  useEffect(() => {
    if (!isNarrow || !pinned) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isNarrow, pinned])

  const expandStyle = expandDir === 'left'
    ? { top: 0, right: 0 }   // expands leftward
    : { top: 0, left: 0 }    // expands rightward (default)

  const desktopPinned = !isNarrow && pinned
  const inlineExpandedClass = isNarrow
    ? 'hidden'
    : pinned
      ? 'block'
      : 'hidden group-hover:block'

  const mobileOverlay =
    typeof document !== 'undefined' &&
    isNarrow &&
    pinned &&
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nota ampliada"
        className="fixed inset-0 z-500 flex items-center justify-center p-4 sm:p-6 bg-black/50"
        onClick={() => setPinned(false)}
      >
        <div
          role="document"
          className="w-full max-w-[min(100vw-2rem,28rem)] max-h-[min(85vh,36rem)] overflow-y-auto rounded-2xl shadow-2xl border border-white/40 px-5 py-5 sm:px-6 sm:py-6 text-[15px] sm:text-base leading-relaxed text-gray-900"
          style={{ backgroundColor: bg }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="whitespace-pre-wrap wrap-break-word">{text}</p>
          <button
            type="button"
            className="mt-5 w-full rounded-xl bg-white/90 py-3 text-sm font-semibold text-gray-800 shadow-sm ring-1 ring-gray-200/80 hover:bg-white"
            onClick={() => setPinned(false)}
          >
            Cerrar
          </button>
          <p className="mt-2 text-center text-[11px] text-gray-600">Toca fuera de la tarjeta para cerrar</p>
        </div>
      </div>,
      document.body
    )

  return (
    <div
      className="group relative cursor-pointer"
      style={{ width: NOTE, height: NOTE, flexShrink: 0, zIndex: pinned ? 100 : undefined }}
      onClick={(e) => {
        e.stopPropagation()
        setPinned((p) => !p)
      }}
    >
      {mobileOverlay}

      {/* Compact square with small text preview */}
      <div
        className="absolute inset-0 rounded-[3px] shadow-sm overflow-hidden"
        style={{ backgroundColor: bg, padding: 5 }}
      >
        <p className="text-[7.5px] leading-[1.3] text-gray-700 wrap-break-word select-none">
          {text}
        </p>
      </div>

      {/* Expanded card — hover on desktop; en móvil se usa el portal para no heredar el scale del mapa */}
      <div
        className={`absolute rounded-[4px] shadow-xl z-50 p-2.5 sm:p-3 leading-normal text-gray-800 select-none ${inlineExpandedClass}`}
        style={{
          ...expandStyle,
          backgroundColor: bg,
          minWidth: desktopPinned ? 220 : 180,
          maxWidth: desktopPinned ? 320 : 240,
          minHeight: NOTE,
          fontSize: desktopPinned ? 13 : 12,
          border: '1.5px solid rgba(255,255,255,0.7)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
        }}
      >
        {text}
        {pinned && !isNarrow && (
          <span className="block mt-2 text-[9px] text-gray-500 opacity-60">
            Toca para cerrar
          </span>
        )}
      </div>
    </div>
  )
}

// Group of notes with configurable columns
function NoteGroup({ notes, bg, expandDir, cols = 2, justify = 'start' }: { notes: string[]; bg: string; expandDir?: 'right' | 'left'; cols?: number; justify?: 'start' | 'end' }) {
  const width = cols * NOTE + (cols - 1) * GUTTER
  return (
    <div className={`flex flex-wrap${justify === 'end' ? ' justify-end' : ''}`} style={{ width, gap: GUTTER }}>
      {notes.map((note, i) => (
        <StickyNote key={i} text={note} bg={bg} expandDir={expandDir} />
      ))}
    </div>
  )
}

// Hace layout: mirror of Dice but left-aligned
function HaceNoteGroup({ notes, bg }: { notes: string[]; bg: string }) {
  const [first, ...rest] = notes
  const rows: string[][] = []
  for (let i = 0; i < rest.length; i += 2) {
    rows.push(rest.slice(i, i + 2))
  }
  return (
    <div className="flex flex-col items-start" style={{ gap: GUTTER }}>
      <StickyNote text={first} bg={bg} />
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: GUTTER }}>
          {row.map((note, i) => (
            <StickyNote key={i} text={note} bg={bg} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Dice layout: 1ª nota sola arriba-derecha, resto en filas de 2, todo right-aligned
function DiceNoteGroup({ notes, bg }: { notes: string[]; bg: string }) {
  const [first, ...rest] = notes
  // Split remaining notes into rows of 2
  const rows: string[][] = []
  for (let i = 0; i < rest.length; i += 2) {
    rows.push(rest.slice(i, i + 2))
  }
  return (
    <div className="flex flex-col items-end" style={{ gap: GUTTER }}>
      {/* First note alone, right-aligned */}
      <StickyNote text={first} bg={bg} />
      {/* Remaining notes in rows of 2 */}
      {rows.map((row, ri) => (
        <div key={ri} className="flex" style={{ gap: GUTTER }}>
          {row.map((note, i) => (
            <StickyNote key={i} text={note} bg={bg} />
          ))}
        </div>
      ))}
    </div>
  )
}

// Section label
function SectionLabel({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'center' | 'right' }) {
  return (
    <p className={`text-[10px] font-semibold text-gray-400 tracking-widest uppercase w-full
      ${align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'}`}
    >
      {children}
    </p>
  )
}

// ── Section colors ─────────────────────────────────────────────────────────────

const COLORS = {
  piensaSiente: '#D4B8E8',
  ve: '#F9DF7A',
  oye: '#F5BAD8',
  dice: '#5DD9C4',
  hace: '#B3E8F8',
  dolor: '#F5B8A8',
  necesidades: '#A8D9B5',
}

// ── Visual empathy map ─────────────────────────────────────────────────────────

// Square canvas constants
const SQ  = 600           // top square size (px)
const cx  = SQ / 2        // 300 — center X
const cy  = 286           // center Y (slightly above midpoint for visual balance)
const GW3 = NOTE * 3 + GUTTER * 2  // 3-column group width = 194px

// Absolute positions for each note group within the square
const POS = {
  piensa: { top: 16,    left: cx - GW3 / 2 },      // centered top (3 cols)
  dice:   { bottom: 12, left: cx - GW - 10 },       // bottom-aligned, right edge near cx
  hace:   { bottom: 12, left: cx + 10 },             // bottom-aligned, left edge near cx
}

function EmpathyMapVisual({ data }: { data: EmpathyMapData }) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [scaledH, setScaledH] = useState(0)

  useEffect(() => {
    const update = () => {
      if (!outerRef.current || !innerRef.current) return
      const w = outerRef.current.clientWidth
      if (w > 0) {
        const s = w / SQ
        setScale(s)
        setScaledH(innerRef.current.scrollHeight * s)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    if (outerRef.current) ro.observe(outerRef.current)
    return () => ro.disconnect()
  }, [data])

  return (
    <div ref={outerRef} style={{ width: '100%', height: scaledH || undefined, overflow: 'hidden' }}>
      <div
        ref={innerRef}
        className="border border-gray-200 rounded-2xl overflow-hidden bg-white"
        style={{ width: SQ, transform: `scale(${scale})`, transformOrigin: 'top left' }}
      >
        {/* ── TOP SQUARE: 5 sections + avatar ── */}
        <div className="relative bg-white" style={{ width: SQ, height: SQ }}>

          {/* SVG structural lines */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={SQ} height={SQ}
            viewBox={`0 0 ${SQ} ${SQ}`}
          >
            {/* Vertical: solo desde el centro hacia abajo */}
            <line x1={cx} y1={cy} x2={cx} y2={SQ} stroke="#e5e7eb" strokeWidth="1" />
            {/* Diagonales desde cada esquina hasta el centro */}
            <line x1={0}   y1={0}  x2={cx} y2={cy} stroke="#e5e7eb" strokeWidth="1" />
            <line x1={SQ}  y1={0}  x2={cx} y2={cy} stroke="#e5e7eb" strokeWidth="1" />
            <line x1={0}   y1={SQ} x2={cx} y2={cy} stroke="#e5e7eb" strokeWidth="1" />
            <line x1={SQ}  y1={SQ} x2={cx} y2={cy} stroke="#e5e7eb" strokeWidth="1" />
          </svg>

          {/* Center avatar */}
          <div
            className="absolute flex items-center justify-center rounded-full bg-gray-50 border-2 border-white shadow-md text-2xl"
            style={{ width: 58, height: 58, left: cx - 29, top: cy - 29, zIndex: 10 }}
          >
            🧍‍♀️
          </div>

          {/* PIENSA Y SIENTE — top center */}
          <div className="absolute flex flex-col items-center gap-1" style={POS.piensa}>
            <SectionLabel align="center">Piensa y siente</SectionLabel>
            <NoteGroup notes={data.piensaSiente} bg={COLORS.piensaSiente} cols={3} />
          </div>

          {/* VE — left, vertically centered */}
          <div className="absolute flex flex-col gap-1" style={{ top: '50%', left: 10, transform: 'translateY(-50%)' }}>
            <NoteGroup notes={data.ve} bg={COLORS.ve} cols={3} />
            <SectionLabel>Ve</SectionLabel>
          </div>

          {/* OYE — right, vertically centered */}
          <div className="absolute flex flex-col gap-1" style={{ top: '50%', left: SQ - 10 - GW3, transform: 'translateY(-50%)' }}>
            <NoteGroup notes={data.oye} bg={COLORS.oye} expandDir="left" cols={3} justify="end" />
            <SectionLabel align="right">Oye</SectionLabel>
          </div>

          {/* DICE — 1 nota top-right + resto abajo, alineado a la derecha del cuadrante izq. */}
          <div className="absolute flex flex-col gap-1" style={POS.dice}>
            <DiceNoteGroup notes={data.dice} bg={COLORS.dice} />
            <SectionLabel>Dice</SectionLabel>
          </div>

          {/* HACE — 1 nota top-left + resto abajo, alineado a la izquierda del cuadrante der. */}
          <div className="absolute flex flex-col gap-1" style={POS.hace}>
            <HaceNoteGroup notes={data.hace} bg={COLORS.hace} />
            <SectionLabel>Hace</SectionLabel>
          </div>
        </div>

        {/* ── BOTTOM STRIP: Dolor + Necesidades ── */}
        <div className="flex border-t border-gray-200">
          {/* Dolor / Frustraciones — left */}
          <div className="flex-1 flex flex-col gap-2 p-4 border-r border-gray-200">
            <SectionLabel>Dolor / Frustraciones</SectionLabel>
            <NoteGroup notes={data.dolorFrustraciones} bg={COLORS.dolor} cols={4} />
          </div>

          {/* Necesidades / Deseos — right: notas alineadas a la derecha y expansión hacia la izquierda para no salirse del marco */}
          <div className="flex-1 flex flex-col gap-2 p-4 items-end">
            <SectionLabel align="right">Necesidades / Deseos</SectionLabel>
            <NoteGroup
              notes={data.necesidadesDeseos}
              bg={COLORS.necesidades}
              cols={4}
              expandDir="left"
              justify="end"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Detail list (accessible fallback + extra detail) ──────────────────────────

const SECTIONS: { key: keyof EmpathyMapData; label: string; color: string; bg: string }[] = [
  { key: 'piensaSiente', label: 'Piensa y siente', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-100' },
  { key: 've', label: 'Ve', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100' },
  { key: 'oye', label: 'Oye', color: 'text-pink-700', bg: 'bg-pink-50 border-pink-100' },
  { key: 'dice', label: 'Dice', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-100' },
  { key: 'hace', label: 'Hace', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-100' },
  { key: 'dolorFrustraciones', label: 'Dolor / Frustraciones', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-100' },
  { key: 'necesidadesDeseos', label: 'Necesidades / Deseos', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
]

function DetailEditIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

function DetailPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function DetailTrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

function EmpathyDetailList({
  data,
  onPatchNote,
  onAddNote,
  onDeleteNote,
}: {
  data: EmpathyMapData
  onPatchNote: (key: keyof EmpathyMapData, index: number, text: string) => void
  onAddNote: (key: keyof EmpathyMapData, text: string) => void
  onDeleteNote: (key: keyof EmpathyMapData, index: number) => void
}) {
  const [editing, setEditing] = useState<{ key: keyof EmpathyMapData; index: number } | null>(null)
  const [draft, setDraft] = useState('')
  const [addingKey, setAddingKey] = useState<keyof EmpathyMapData | null>(null)
  const [newDraft, setNewDraft] = useState('')

  const cancelAdd = () => {
    setAddingKey(null)
    setNewDraft('')
  }

  const openEdit = (key: keyof EmpathyMapData, index: number, text: string) => {
    cancelAdd()
    setEditing({ key, index })
    setDraft(text)
  }

  const cancelEdit = () => {
    setEditing(null)
    setDraft('')
  }

  const saveEdit = () => {
    if (!editing) return
    onPatchNote(editing.key, editing.index, draft.trim())
    cancelEdit()
  }

  const openAdd = (key: keyof EmpathyMapData) => {
    cancelEdit()
    setAddingKey(key)
    setNewDraft('')
  }

  const submitAdd = (key: keyof EmpathyMapData) => {
    const t = newDraft.trim()
    if (!t) return
    onAddNote(key, t)
    cancelAdd()
  }

  const handleDeleteNote = (key: keyof EmpathyMapData, index: number) => {
    if (editing?.key === key) cancelEdit()
    onDeleteNote(key, index)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {SECTIONS.map(({ key, label, color, bg }) => (
        <div key={key} className={`rounded-xl border p-4 space-y-2 ${bg}`}>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs font-bold uppercase tracking-wide ${color}`}>{label}</p>
            <button
              type="button"
              onClick={() => (addingKey === key ? cancelAdd() : openAdd(key))}
              className={`shrink-0 rounded-lg p-1.5 ring-1 ring-transparent focus:outline-none focus:ring-2 focus:ring-gray-300 ${
                addingKey === key
                  ? 'bg-white text-gray-900 ring-gray-300/80'
                  : 'text-gray-500 hover:bg-white/80 hover:text-gray-800 hover:ring-gray-200/80'
              }`}
              aria-expanded={addingKey === key}
              aria-label={addingKey === key ? 'Cerrar formulario de nueva nota' : `Añadir nota en ${label}`}
              title={addingKey === key ? 'Cerrar' : 'Añadir nota'}
            >
              <DetailPlusIcon className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-2">
            {data[key].map((note, i) => {
              const isEditing = editing?.key === key && editing?.index === i
              return (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 opacity-50 ${color.replace('text-', 'bg-')}`}
                  />
                  {isEditing ? (
                    <div className="min-w-0 flex-1 space-y-2">
                      <AutoTextarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                        aria-label={`Editar nota: ${label}`}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        El texto coincide con la nota del mapa; al guardar se actualiza el mapa y Sheets.
                      </p>
                    </div>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 leading-relaxed">{note}</span>
                      <div className="mt-0.5 flex shrink-0 items-start gap-0.5">
                        <button
                          type="button"
                          onClick={() => openEdit(key, i, note)}
                          className="rounded-lg p-1.5 text-gray-500 ring-1 ring-transparent hover:bg-white/80 hover:text-gray-800 hover:ring-gray-200/80 focus:outline-none focus:ring-2 focus:ring-gray-300"
                          aria-label={`Editar esta nota (${label})`}
                          title="Editar texto de la nota"
                        >
                          <DetailEditIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(key, i)}
                          className="rounded-lg p-1.5 text-gray-500 ring-1 ring-transparent hover:bg-red-50 hover:text-red-600 hover:ring-red-100 focus:outline-none focus:ring-2 focus:ring-red-200"
                          aria-label={`Eliminar esta nota (${label})`}
                          title="Eliminar nota"
                        >
                          <DetailTrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>

          {addingKey === key && (
            <div className="space-y-2 border-t border-black/5 pt-3">
              <label className="block">
                <span className="sr-only">Texto de la nueva nota</span>
                <AutoTextarea
                  value={newDraft}
                  onChange={(e) => setNewDraft(e.target.value)}
                  rows={2}
                  placeholder="Escribe la nueva nota…"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  maxLength={4000}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => submitAdd(key)}
                  disabled={!newDraft.trim()}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:pointer-events-none disabled:opacity-40"
                >
                  Añadir
                </button>
                <button
                  type="button"
                  onClick={cancelAdd}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                La nota aparecerá en el mapa y se guardará en Sheets al pulsar Añadir.
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Segment meta ───────────────────────────────────────────────────────────────

const SEGMENT_META: Record<
  EmpathySegment,
  {
    otherHref: string
    otherLabel: string
    insightsHref: string
    showPain: boolean
    accent: 'rose' | 'orange'
    mapCardTitle: string
    emptyLead: string
  }
> = {
  clientes: {
    otherHref: '/empathy/potenciales',
    otherLabel: 'Ver mapa de clientes potenciales →',
    insightsHref: '/insights/clientes',
    showPain: false,
    accent: 'rose',
    mapCardTitle: 'Mapa de empatía · Clientes actuales',
    emptyLead:
      'La IA usará el mismo filtrado que tengas activo en la encuesta de clientes (página Encuesta de satisfacción) más el contexto de la entrevista CEO guardada.',
  },
  potenciales: {
    otherHref: '/empathy/clientes',
    otherLabel: '← Ver mapa de clientes actuales',
    insightsHref: '/insights/potenciales',
    showPain: true,
    accent: 'orange',
    mapCardTitle: 'Mapa de empatía · Clientes potenciales',
    emptyLead:
      'La IA usará el mismo filtrado que tengas activo en la encuesta a clientes potenciales (página /potential) más el contexto de la entrevista CEO guardada.',
  },
}

// ── Main page component ────────────────────────────────────────────────────────

export function EmpathyMapPage({
  segment,
  embedTabs = false,
}: {
  segment: EmpathySegment
  /** Si true, no se muestra el enlace a la otra variante (p. ej. dentro de pestañas) */
  embedTabs?: boolean
}) {
  const meta = SEGMENT_META[segment]
  const [data, setData] = useState<EmpathyMapData | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(false)
  const [loadingSaved, setLoadingSaved] = useState(true)

  useEffect(() => {
    fetch(`/api/empathy-map-saved?segment=${segment}`)
      .then((r) => r.json())
      .then((saved) => {
        if (saved?.saved) {
          setData(saved.saved.data)
          setSavedAt(saved.saved.savedAt)
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSaved(false))
  }, [segment])

  const saveMap = useCallback(
    async (mapData: EmpathyMapData) => {
      setSaving(true)
      try {
        const filters = segmentFiltersToApi(readSegmentSurveyFilters(segment))
        const r = await fetch('/api/empathy-map-saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segment, data: mapData, filters }),
        })
        const d = await r.json()
        if (d.savedAt) setSavedAt(d.savedAt)
      } catch {}
      setSaving(false)
    },
    [segment]
  )

  const patchNote = useCallback((key: keyof EmpathyMapData, index: number, text: string) => {
    setData((prev) => {
      if (!prev) return prev
      const next: EmpathyMapData = {
        ...prev,
        [key]: prev[key].map((n, j) => (j === index ? text : n)),
      }
      void saveMap(next)
      return next
    })
  }, [saveMap])

  const addNote = useCallback((key: keyof EmpathyMapData, text: string) => {
    setData((prev) => {
      if (!prev) return prev
      const next: EmpathyMapData = {
        ...prev,
        [key]: [...prev[key], text],
      }
      void saveMap(next)
      return next
    })
  }, [saveMap])

  const deleteNote = useCallback((key: keyof EmpathyMapData, index: number) => {
    setData((prev) => {
      if (!prev) return prev
      const next: EmpathyMapData = {
        ...prev,
        [key]: prev[key].filter((_, j) => j !== index),
      }
      void saveMap(next)
      return next
    })
  }, [saveMap])

  const generate = async () => {
    setGenerating(true)
    setGenError(false)
    try {
      const filters = segmentFiltersToApi(readSegmentSurveyFilters(segment))
      const res = await fetch('/api/empathy-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, segment }),
      })
      if (!res.ok) throw new Error('Error')
      const d: EmpathyMapData = await res.json()
      setData(d)
      await saveMap(d)
    } catch {
      setGenError(true)
    } finally {
      setGenerating(false)
    }
  }

  const spinBorder = meta.accent === 'rose' ? 'border-rose-400' : 'border-orange-400'
  const genBtnCls =
    meta.accent === 'rose'
      ? 'bg-rose-500 hover:bg-rose-600'
      : 'bg-orange-500 hover:bg-orange-600'

  // ── Loading ──

  if (loadingSaved) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  // ── Generating ──

  if (generating) {
    return (
      <div className="space-y-5 py-4">
        <div className="text-center space-y-2 py-4">
          <div className={`inline-block h-6 w-6 border-2 ${spinBorder} border-t-transparent rounded-full animate-spin`} />
          <p className="text-sm text-gray-500">Analizando encuestas y construyendo el mapa…</p>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border p-5 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    )
  }

  // ── Error ──

  if (genError) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex items-center justify-between gap-4">
          <p className="text-sm text-red-600">No se pudo generar el mapa. Inténtalo de nuevo.</p>
          <button
            onClick={generate}
            className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // ── Empty state ──

  if (!data) {
    return (
      <div className="space-y-5">
        {!embedTabs && (
          <div className="flex flex-wrap justify-end">
            <Link href={meta.otherHref} className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
              {meta.otherLabel}
            </Link>
          </div>
        )}
        <SegmentFiltersReadBanner segment={segment} accent={meta.accent === 'rose' ? 'rose' : 'orange'} />
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center space-y-4">
          <div className="text-5xl">🗺️</div>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">Genera tu mapa de empatía</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">{meta.emptyLead}</p>
          </div>
          <button
            onClick={generate}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-white text-sm font-medium transition-colors shadow-sm ${genBtnCls}`}
          >
            ✦ Generar mapa de empatía
          </button>
        </div>

        <div className="border-t border-gray-200 pt-6 mt-2">
          <Link
            href={meta.insightsHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 underline underline-offset-4 hover:text-amber-950"
          >
            Ir a Insights
            <span aria-hidden>→</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1.5">Siguiente paso del panel: patrones a partir del mapa guardado.</p>
        </div>
      </div>
    )
  }

  // ── Results ──

  return (
    <div className="space-y-5">
      {!embedTabs && (
        <div className="flex flex-wrap justify-end">
          <Link href={meta.otherHref} className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2">
            {meta.otherLabel}
          </Link>
        </div>
      )}

      <SegmentFiltersReadBanner segment={segment} accent={meta.accent === 'rose' ? 'rose' : 'orange'} />

      {/* Saved / actions header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {saving ? (
            <>
              <span
                className={`inline-block h-3 w-3 border border-gray-300 rounded-full animate-spin ${
                  meta.accent === 'rose' ? 'border-t-rose-400' : 'border-t-orange-400'
                }`}
              />
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

      {/* Visual map */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">{meta.mapCardTitle}</p>
        <EmpathyMapVisual data={data} />
      </div>

      {/* Detail list */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Detalle completo
        </p>
        <EmpathyDetailList
          data={data}
          onPatchNote={patchNote}
          onAddNote={addNote}
          onDeleteNote={deleteNote}
        />
      </div>

      <div className="border-t border-gray-200 pt-6 pb-1">
        <Link
          href={meta.insightsHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800 underline underline-offset-4 hover:text-amber-950"
        >
          Ir a Insights
          <span aria-hidden>→</span>
        </Link>
        <p className="text-xs text-gray-500 mt-1.5">Siguiente paso del panel: patrones a partir del mapa guardado.</p>
      </div>
    </div>
  )
}
