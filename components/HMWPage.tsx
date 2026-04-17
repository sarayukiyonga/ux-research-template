'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { AutoTextarea } from '@/components/ui/auto-textarea'
import {
  HMW_AYUDA_CRITERIOS,
  HMW_MARCA_MOTIVO_MAX_LEN,
  HMW_RESPUESTAS_MAX,
  enforceSingleMejor,
  syncMarcaMotivosToRespuestas,
  syncMarcasToRespuestas,
  type HMWQuestionsPayload,
  type HMWItem,
  type HMWRespuestaMarca,
  normalizeHmwPayload,
  mergeHmwRegeneratedPreservingAnswers,
  mergeHmwRegeneratedPreservingAnswersOneBlock,
  normalizeHmwItemArray,
} from '@/lib/hmw-payload'

export type { HMWQuestionsPayload, HMWItem, HMWRespuestaMarca } from '@/lib/hmw-payload'

const HMW_PREGUNTA_MAX_LEN = 500
const SAVE_DEBOUNCE_MS = 850
/** Texto inicial válido al añadir una pregunta (evita filas vacías al normalizar desde Sheets). */
const HMW_NUEVA_PREGUNTA_PLANTILLA = '¿Cómo podríamos…?'

function PencilIcon({ className }: { className?: string }) {
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

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
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
  blockKey,
  items,
  onRespuestaChange,
  onPreguntaChange,
  onFlushPreguntaEdit,
  onAddPregunta,
  onDeletePregunta,
  onAddRespuesta,
  onSetRespuestaMarca,
  onOpenMarcaMotivo,
  onPickMejorIa,
  pendingMejorIaKey,
  iaBusy,
  preguntasGenError,
  onDismissPreguntasGenError,
  onRegeneratePreguntas,
  generatingPreguntas,
  onGenerarRespuestasIa,
  generatingRespuestasIa,
}: {
  title: string
  accent: 'indigo' | 'violet'
  blockKey: 'clienteActual' | 'clientePotencial'
  items: HMWItem[]
  onRespuestaChange: (
    block: 'clienteActual' | 'clientePotencial',
    questionIndex: number,
    respuestaSlot: number,
    value: string
  ) => void
  onAddRespuesta: (block: 'clienteActual' | 'clientePotencial', questionIndex: number) => void
  onPreguntaChange: (
    block: 'clienteActual' | 'clientePotencial',
    questionIndex: number,
    value: string
  ) => void
  onFlushPreguntaEdit: (
    block: 'clienteActual' | 'clientePotencial',
    questionIndex: number,
    backupPregunta: string
  ) => void
  onAddPregunta: (block: 'clienteActual' | 'clientePotencial') => void
  onDeletePregunta: (block: 'clienteActual' | 'clientePotencial', questionIndex: number) => void
  onSetRespuestaMarca: (
    block: 'clienteActual' | 'clientePotencial',
    questionIndex: number,
    respuestaSlot: number,
    marca: HMWRespuestaMarca | null,
    opts?: { motivoParaSlot?: string | null }
  ) => void
  onOpenMarcaMotivo: (block: 'clienteActual' | 'clientePotencial', questionIndex: number, respuestaSlot: number) => void
  onPickMejorIa: (block: 'clienteActual' | 'clientePotencial', questionIndex: number) => void
  pendingMejorIaKey: string | null
  iaBusy: boolean
  preguntasGenError: string | null
  onDismissPreguntasGenError: () => void
  onRegeneratePreguntas: () => void
  generatingPreguntas: boolean
  onGenerarRespuestasIa: () => void
  generatingRespuestasIa: boolean
}) {
  const [editingPreguntaIndex, setEditingPreguntaIndex] = useState<number | null>(null)
  const preguntaBackupRef = useRef('')

  const border = accent === 'indigo' ? 'border-indigo-200 bg-indigo-50/60' : 'border-violet-200 bg-violet-50/60'
  const bullet = accent === 'indigo' ? 'text-indigo-500' : 'text-violet-500'
  const text = accent === 'indigo' ? 'text-indigo-950' : 'text-violet-950'
  const ring = accent === 'indigo' ? 'focus:border-indigo-400 focus:ring-indigo-200' : 'focus:border-violet-400 focus:ring-violet-200'
  const pencilRing =
    accent === 'indigo'
      ? 'text-indigo-600 hover:bg-white hover:text-indigo-900 hover:ring-indigo-200/80 focus:ring-indigo-300'
      : 'text-violet-600 hover:bg-white hover:text-violet-900 hover:ring-violet-200/80 focus:ring-violet-300'
  const plusRing =
    accent === 'indigo'
      ? 'text-indigo-600 hover:bg-white hover:text-indigo-900 hover:ring-indigo-200/80 focus:ring-indigo-300'
      : 'text-violet-600 hover:bg-white hover:text-violet-900 hover:ring-violet-200/80 focus:ring-violet-300'

  const handleAddPregunta = () => {
    const prevEdit = editingPreguntaIndex
    if (prevEdit !== null) {
      onFlushPreguntaEdit(blockKey, prevEdit, preguntaBackupRef.current)
      setEditingPreguntaIndex(null)
    }
    onAddPregunta(blockKey)
  }

  const openPreguntaEdit = (qi: number) => {
    const prev = editingPreguntaIndex
    if (prev !== null && prev !== qi) {
      onFlushPreguntaEdit(blockKey, prev, preguntaBackupRef.current)
    }
    preguntaBackupRef.current = items[qi]?.pregunta ?? ''
    setEditingPreguntaIndex(qi)
  }

  const closePreguntaEdit = (qi: number) => {
    onFlushPreguntaEdit(blockKey, qi, preguntaBackupRef.current)
    setEditingPreguntaIndex(null)
  }

  const togglePreguntaEdit = (qi: number) => {
    if (editingPreguntaIndex === qi) closePreguntaEdit(qi)
    else openPreguntaEdit(qi)
  }

  const handleDeletePregunta = (qi: number) => {
    if (!window.confirm('¿Eliminar esta pregunta y sus respuestas?')) return
    const e = editingPreguntaIndex
    if (e === qi) setEditingPreguntaIndex(null)
    else if (e !== null && e > qi) setEditingPreguntaIndex(e - 1)
    onDeletePregunta(blockKey, qi)
  }

  return (
    <div className={`rounded-2xl border-2 ${border} p-5 space-y-4`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h2>
        <button
          type="button"
          onClick={handleAddPregunta}
          className={`shrink-0 inline-flex items-center justify-center rounded-lg p-1.5 ring-1 ring-transparent focus:outline-none focus:ring-2 ${plusRing}`}
          aria-label="Añadir pregunta HMW"
          title="Añadir pregunta"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
      {preguntasGenError ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="min-w-0">{preguntasGenError}</p>
          <button
            type="button"
            onClick={onDismissPreguntasGenError}
            className="shrink-0 self-start sm:self-auto text-[11px] font-semibold underline underline-offset-2 text-red-800"
          >
            Cerrar
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onRegeneratePreguntas()}
          disabled={iaBusy || generatingPreguntas}
          className={`text-[11px] sm:text-xs px-2.5 py-1.5 rounded-full font-medium transition-colors disabled:opacity-45 disabled:pointer-events-none ${
            accent === 'indigo'
              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
              : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          {generatingPreguntas ? '…' : '↺'} Regenerar preguntas (este bloque)
        </button>
        <button
          type="button"
          onClick={() => void onGenerarRespuestasIa()}
          disabled={iaBusy || generatingRespuestasIa}
          className={`text-[11px] sm:text-xs px-2.5 py-1.5 rounded-full font-medium border transition-colors disabled:opacity-45 disabled:pointer-events-none ${
            accent === 'indigo'
              ? 'border-indigo-200 text-indigo-800 bg-white hover:bg-indigo-50'
              : 'border-violet-200 text-violet-900 bg-white hover:bg-violet-50'
          }`}
        >
          {generatingRespuestasIa ? '…' : '✦'} Respuestas (IA, este bloque)
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">Sin preguntas en este bloque. Pulsa + para añadir la primera.</p>
      ) : (
        <ul className="space-y-6">
          {items.map((item, qi) => (
            <li key={qi} className={`space-y-3 text-sm leading-relaxed ${text}`}>
              <div className="flex gap-2 items-start">
                <span className={`shrink-0 font-bold pt-0.5 ${bullet}`}>{qi + 1}.</span>
                <div className="min-w-0 flex-1 space-y-2">
                  {editingPreguntaIndex === qi ? (
                    <AutoTextarea
                      className={`w-full min-h-16 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${ring}`}
                      rows={2}
                      maxLength={HMW_PREGUNTA_MAX_LEN}
                      value={item.pregunta}
                      onChange={(e) => onPreguntaChange(blockKey, qi, e.target.value)}
                      spellCheck
                      aria-label={`Editar pregunta ${qi + 1}`}
                    />
                  ) : (
                    <p className="font-medium text-pretty wrap-break-word pt-0.5">{item.pregunta}</p>
                  )}
                </div>
                <div className="shrink-0 flex items-start gap-0.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => togglePreguntaEdit(qi)}
                    className={`rounded-lg p-1.5 ring-1 ring-transparent focus:outline-none focus:ring-2 ${pencilRing}`}
                    aria-expanded={editingPreguntaIndex === qi}
                    aria-label={editingPreguntaIndex === qi ? 'Cerrar edición de la pregunta' : 'Editar pregunta'}
                    title={editingPreguntaIndex === qi ? 'Cerrar edición' : 'Editar pregunta'}
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePregunta(qi)}
                    className="rounded-lg p-1.5 text-red-600 ring-1 ring-transparent hover:bg-white hover:text-red-700 hover:ring-red-200/80 focus:outline-none focus:ring-2 focus:ring-red-300"
                    aria-label="Eliminar pregunta"
                    title="Eliminar pregunta"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="pl-7 sm:pl-8 pt-1">
                <button
                  type="button"
                  onClick={() => onPickMejorIa(blockKey, qi)}
                  disabled={iaBusy || item.respuestas.every((t) => !t.trim())}
                  className={`text-[11px] font-semibold rounded-full px-3 py-1 border transition-colors ${
                    accent === 'indigo'
                      ? 'border-indigo-300 text-indigo-700 bg-white/90 hover:bg-indigo-50 disabled:opacity-40'
                      : 'border-violet-300 text-violet-800 bg-white/90 hover:bg-violet-50 disabled:opacity-40'
                  }`}
                  title="La IA elige qué respuesta marcar como «Mejor» usando POV, personas y mapas de empatía"
                >
                  {pendingMejorIaKey === `${blockKey}-${qi}` ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-3 border border-current border-t-transparent rounded-full animate-spin opacity-70" />
                      Analizando…
                    </span>
                  ) : (
                    '✦ Mejor respuesta (IA)'
                  )}
                </button>
              </div>
              <div className="pl-7 sm:pl-8 space-y-2.5">
                {item.respuestas.map((texto, ri) => {
                  const marca = item.respuestasMarcas?.[ri] ?? null
                  const boxBorder =
                    marca === 'mejor'
                      ? 'border-green-500 bg-green-50/40 shadow-sm ring-1 ring-green-200/80'
                      : marca === 'no_viable'
                        ? 'border-red-400 bg-red-50/40 shadow-sm ring-1 ring-red-200/70'
                        : 'border-gray-200/80 bg-white/50'
                  const btnBase =
                    'rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-colors'
                  return (
                    <div key={`${qi}-r-${ri}`} className={`rounded-xl border-2 p-2.5 ${boxBorder}`} data-pdf-avoid-break>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Respuesta {ri + 1}
                        </span>
                        <button
                          type="button"
                          data-hmw-marca-btn
                          onClick={() =>
                            onSetRespuestaMarca(blockKey, qi, ri, marca === 'mejor' ? null : 'mejor')
                          }
                          className={`${btnBase} ${
                            marca === 'mejor'
                              ? 'bg-green-600 text-white ring-2 ring-green-700'
                              : 'bg-white/90 text-green-700 ring-1 ring-green-300 hover:bg-green-100'
                          }`}
                          aria-pressed={marca === 'mejor'}
                          title={marca === 'mejor' ? 'Quitar marca de mejor opción' : 'Marcar como mejor opción'}
                        >
                          Mejor
                        </button>
                        <button
                          type="button"
                          data-hmw-marca-btn
                          onClick={() =>
                            onSetRespuestaMarca(blockKey, qi, ri, marca === 'no_viable' ? null : 'no_viable')
                          }
                          className={`${btnBase} ${
                            marca === 'no_viable'
                              ? 'bg-red-600 text-white ring-2 ring-red-800'
                              : 'bg-white/90 text-red-700 ring-1 ring-red-300 hover:bg-red-100'
                          }`}
                          aria-pressed={marca === 'no_viable'}
                          title={marca === 'no_viable' ? 'Quitar no viable' : 'Marcar como no viable'}
                        >
                          No viable
                        </button>
                        {marca === 'mejor' || marca === 'no_viable' ? (
                          <button
                            type="button"
                            onClick={() => onOpenMarcaMotivo(blockKey, qi, ri)}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-xs font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-400"
                            aria-label={
                              marca === 'mejor'
                                ? 'Ver o editar por qué esta respuesta es la mejor'
                                : 'Ver o editar por qué esta respuesta no es viable'
                            }
                            title="Explicación de la marca"
                          >
                            ?
                          </button>
                        ) : null}
                      </div>
                      <AutoTextarea
                        data-pdf-show
                        className={`w-full min-h-18 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 ${ring}`}
                        rows={2}
                        maxLength={2000}
                        value={texto}
                        onChange={(e) => onRespuestaChange(blockKey, qi, ri, e.target.value)}
                        placeholder="Ideas, notas o direcciones de solución…"
                      />
                    </div>
                  )
                })}
                {item.respuestas.length < HMW_RESPUESTAS_MAX ? (
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => onAddRespuesta(blockKey, qi)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-transparent focus:outline-none focus:ring-2 ${plusRing}`}
                      aria-label="Añadir otra respuesta"
                      title="Añadir otra respuesta"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Añadir respuesta
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function HMWPage() {
  const [questions, setQuestions] = useState<HMWQuestionsPayload | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  /** Ámbito del último error al regenerar preguntas (solo UI). */
  const [genErrorScope, setGenErrorScope] = useState<'clienteActual' | 'clientePotencial' | 'both' | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [povOk, setPovOk] = useState(false)
  /** null | bloque | 'both' = regenerar preguntas en los dos bloques a la vez. */
  const [generatingQuestionsBlock, setGeneratingQuestionsBlock] = useState<
    null | 'clienteActual' | 'clientePotencial' | 'both'
  >(null)
  /** null | bloque | 'both' = generar respuestas IA en ambos bloques. */
  const [generatingRespuestasBlock, setGeneratingRespuestasBlock] = useState<
    null | 'clienteActual' | 'clientePotencial' | 'both'
  >(null)
  const [respuestasIaError, setRespuestasIaError] = useState<string | null>(null)
  const [pendingMejorIaKey, setPendingMejorIaKey] = useState<string | null>(null)
  const [mejorIaError, setMejorIaError] = useState<string | null>(null)
  const [marcaMotivoEditor, setMarcaMotivoEditor] = useState<{
    block: 'clienteActual' | 'clientePotencial'
    qi: number
    ri: number
  } | null>(null)
  const [marcaMotivoDraft, setMarcaMotivoDraft] = useState('')

  const questionsRef = useRef<HMWQuestionsPayload | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/hmw-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/pov-saved').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([hmwSaved, povSaved]) => {
        if (hmwSaved?.saved?.questions) {
          const n = normalizeHmwPayload(hmwSaved.saved.questions)
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

  const saveQuestions = useCallback(async (data: HMWQuestionsPayload) => {
    setSaving(true)
    try {
      const r = await fetch('/api/hmw-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: data, filters: { fuente: 'pov', version: 2 } }),
      })
      const d = await r.json()
      if (d.savedAt) setSavedAt(d.savedAt)
    } catch {}
    setSaving(false)
  }, [])

  const scheduleSave = useCallback(
    (data: HMWQuestionsPayload) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        void saveQuestions(data)
      }, SAVE_DEBOUNCE_MS)
    },
    [saveQuestions]
  )

  /** Cierra edición de pregunta: guarda ya, restaura texto si quedó vacío. */
  const flushPreguntaEdit = useCallback(
    (block: 'clienteActual' | 'clientePotencial', questionIndex: number, backupPregunta: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const prev = questionsRef.current
      if (!prev) return
      const row = prev[block][questionIndex]
      if (!row) return
      const p = row.pregunta.trim() ? row.pregunta : backupPregunta
      const list = [...prev[block]]
      list[questionIndex] = { ...row, pregunta: p }
      const next: HMWQuestionsPayload = { ...prev, [block]: list }
      setQuestions(next)
      void saveQuestions(next)
    },
    [saveQuestions]
  )

  const updatePregunta = useCallback(
    (block: 'clienteActual' | 'clientePotencial', questionIndex: number, value: string) => {
      setQuestions((prev) => {
        if (!prev) return prev
        const list = [...prev[block]]
        const row = list[questionIndex]
        if (!row) return prev
        list[questionIndex] = { ...row, pregunta: value }
        const next: HMWQuestionsPayload = { ...prev, [block]: list }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  const updateRespuesta = useCallback(
    (block: 'clienteActual' | 'clientePotencial', questionIndex: number, slot: number, value: string) => {
      setQuestions((prev) => {
        if (!prev) return prev
        const list = [...prev[block]]
        const row = list[questionIndex]
        if (!row) return prev
        const resp = [...row.respuestas]
        if (slot < 0 || slot >= resp.length) return prev
        resp[slot] = value
        list[questionIndex] = { ...row, respuestas: resp }
        const next: HMWQuestionsPayload = { ...prev, [block]: list }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  const setRespuestaMarca = useCallback(
    (
      block: 'clienteActual' | 'clientePotencial',
      questionIndex: number,
      slot: number,
      marca: HMWRespuestaMarca | null,
      opts?: { motivoParaSlot?: string | null }
    ) => {
      setQuestions((prev) => {
        if (!prev) return prev
        const list = [...prev[block]]
        const row = list[questionIndex]
        if (!row) return prev
        const n = row.respuestas.length
        const marcas: Array<HMWRespuestaMarca | null> = [...(row.respuestasMarcas ?? Array(n).fill(null))]
        while (marcas.length < n) marcas.push(null)
        marcas.length = n

        if (marca === null) {
          marcas[slot] = null
        } else if (marca === 'mejor') {
          for (let j = 0; j < n; j++) {
            if (j !== slot && marcas[j] === 'mejor') marcas[j] = null
          }
          marcas[slot] = 'mejor'
        } else {
          marcas[slot] = 'no_viable'
        }

        const synced = syncMarcasToRespuestas(row.respuestas, enforceSingleMejor(marcas))
        const nextRow: HMWItem = { ...row }
        if (synced) nextRow.respuestasMarcas = synced
        else delete nextRow.respuestasMarcas

        const paddedMot: Array<string | null> = Array.from(
          { length: n },
          (_, i) => row.respuestasMarcaMotivos?.[i] ?? null
        )
        if (!synced) {
          delete nextRow.respuestasMarcaMotivos
        } else {
          for (let i = 0; i < n; i++) {
            if (!synced[i]) paddedMot[i] = null
          }
          if (opts?.motivoParaSlot !== undefined && (synced[slot] === 'mejor' || synced[slot] === 'no_viable')) {
            const t = opts.motivoParaSlot?.trim().slice(0, HMW_MARCA_MOTIVO_MAX_LEN) ?? ''
            paddedMot[slot] = t || null
          }
          const motivosOut = syncMarcaMotivosToRespuestas(n, synced, paddedMot)
          if (motivosOut) nextRow.respuestasMarcaMotivos = motivosOut
          else delete nextRow.respuestasMarcaMotivos
        }

        list[questionIndex] = nextRow
        const next: HMWQuestionsPayload = { ...prev, [block]: list }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  const setMarcaMotivoText = useCallback(
    (
      block: 'clienteActual' | 'clientePotencial',
      questionIndex: number,
      slot: number,
      texto: string
    ) => {
      setQuestions((prev) => {
        if (!prev) return prev
        const list = [...prev[block]]
        const row = list[questionIndex]
        if (!row) return prev
        const m = row.respuestasMarcas?.[slot]
        if (m !== 'mejor' && m !== 'no_viable') return prev
        const n = row.respuestas.length
        const marcas = row.respuestasMarcas
        if (!marcas) return prev
        const t = texto.trim().slice(0, HMW_MARCA_MOTIVO_MAX_LEN)
        const paddedMot: Array<string | null> = Array.from({ length: n }, (_, i) => row.respuestasMarcaMotivos?.[i] ?? null)
        paddedMot[slot] = t || null
        const motivosOut = syncMarcaMotivosToRespuestas(n, marcas, paddedMot)
        const nextRow: HMWItem = { ...row }
        if (motivosOut) nextRow.respuestasMarcaMotivos = motivosOut
        else delete nextRow.respuestasMarcaMotivos
        list[questionIndex] = nextRow
        const next: HMWQuestionsPayload = { ...prev, [block]: list }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  const addRespuestaSlot = useCallback(
    (block: 'clienteActual' | 'clientePotencial', questionIndex: number) => {
      setQuestions((prev) => {
        if (!prev) return prev
        const list = [...prev[block]]
        const row = list[questionIndex]
        if (!row) return prev
        if (row.respuestas.length >= HMW_RESPUESTAS_MAX) return prev
        const resp = [...row.respuestas, '']
        const prevLen = row.respuestas.length
        const m: Array<HMWRespuestaMarca | null> = [
          ...(row.respuestasMarcas ?? (Array(prevLen).fill(null) as Array<HMWRespuestaMarca | null>)),
          null,
        ]
        const synced = syncMarcasToRespuestas(resp, enforceSingleMejor(m))
        const prevMot = row.respuestasMarcaMotivos ?? []
        const paddedMot: Array<string | null> = Array.from({ length: resp.length }, (_, i) =>
          i < prevMot.length ? (prevMot[i] ?? null) : null
        )
        const motivosOut = synced ? syncMarcaMotivosToRespuestas(resp.length, synced, paddedMot) : undefined
        const nextItem: HMWItem = { ...row, respuestas: resp }
        if (synced) {
          nextItem.respuestasMarcas = synced
          if (motivosOut) nextItem.respuestasMarcaMotivos = motivosOut
          else delete nextItem.respuestasMarcaMotivos
        } else {
          delete nextItem.respuestasMarcas
          delete nextItem.respuestasMarcaMotivos
        }
        list[questionIndex] = nextItem
        const next: HMWQuestionsPayload = { ...prev, [block]: list }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  const addPregunta = useCallback(
    (block: 'clienteActual' | 'clientePotencial') => {
      const nueva: HMWItem = {
        pregunta: HMW_NUEVA_PREGUNTA_PLANTILLA,
        respuestas: [''],
      }
      setQuestions((prev) => {
        if (!prev) return prev
        const list = [...prev[block], nueva]
        const next: HMWQuestionsPayload = { ...prev, [block]: list }
        scheduleSave(next)
        return next
      })
    },
    [scheduleSave]
  )

  const deletePregunta = useCallback(
    (block: 'clienteActual' | 'clientePotencial', questionIndex: number) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      setQuestions((prev) => {
        if (!prev) return prev
        const list = prev[block].filter((_, i) => i !== questionIndex)
        const next: HMWQuestionsPayload = { ...prev, [block]: list }
        void saveQuestions(next)
        return next
      })
    },
    [saveQuestions]
  )

  /** Primera generación: ambos bloques, sin datos previos en pantalla. */
  const generate = async () => {
    setGenerating(true)
    setGenError(null)
    setGenErrorScope(null)
    try {
      const res = await fetch('/api/hmw', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'No se pudieron generar las preguntas HMW.')
        return
      }
      const fromApi = normalizeHmwPayload(d)
      if (!fromApi) {
        setGenError('La respuesta de la IA no tenía el formato esperado.')
        return
      }
      const merged = mergeHmwRegeneratedPreservingAnswers(fromApi, questionsRef.current)
      setQuestions(merged)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await saveQuestions(merged)
    } catch {
      setGenError('No se pudieron generar las preguntas HMW. Inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  const generatePreguntasForBlock = async (block: 'clienteActual' | 'clientePotencial') => {
    setGeneratingQuestionsBlock(block)
    setGenError(null)
    setGenErrorScope(null)
    try {
      const res = await fetch('/api/hmw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmento: block }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'No se pudieron generar las preguntas HMW.')
        setGenErrorScope(block)
        return
      }
      const rawArr = (d as Record<string, unknown>)[block]
      if (!Array.isArray(rawArr)) {
        setGenError('La respuesta de la IA no tenía el formato esperado.')
        setGenErrorScope(block)
        return
      }
      const fresh = normalizeHmwItemArray(rawArr)
      if (fresh.length === 0) {
        setGenError('La IA no devolvió preguntas para este bloque.')
        setGenErrorScope(block)
        return
      }
      const merged = mergeHmwRegeneratedPreservingAnswersOneBlock(block, fresh, questionsRef.current)
      setQuestions(merged)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await saveQuestions(merged)
    } catch {
      setGenError('No se pudieron generar las preguntas HMW. Inténtalo de nuevo.')
      setGenErrorScope(block)
    } finally {
      setGeneratingQuestionsBlock(null)
    }
  }

  const generatePreguntasBothBlocks = async () => {
    setGeneratingQuestionsBlock('both')
    setGenError(null)
    setGenErrorScope(null)
    try {
      const res = await fetch('/api/hmw', { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'No se pudieron generar las preguntas HMW.')
        setGenErrorScope('both')
        return
      }
      const fromApi = normalizeHmwPayload(d)
      if (!fromApi) {
        setGenError('La respuesta de la IA no tenía el formato esperado.')
        setGenErrorScope('both')
        return
      }
      const merged = mergeHmwRegeneratedPreservingAnswers(fromApi, questionsRef.current)
      setQuestions(merged)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await saveQuestions(merged)
    } catch {
      setGenError('No se pudieron generar las preguntas HMW. Inténtalo de nuevo.')
      setGenErrorScope('both')
    } finally {
      setGeneratingQuestionsBlock(null)
    }
  }

  const generateRespuestasIaForBlock = async (block: 'clienteActual' | 'clientePotencial') => {
    const current = questionsRef.current
    if (!current) return
    setGeneratingRespuestasBlock(block)
    setRespuestasIaError(null)
    try {
      const res = await fetch('/api/hmw-respuestas-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: current, segmento: block }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRespuestasIaError(typeof d.error === 'string' ? d.error : 'No se pudieron generar las respuestas con IA.')
        return
      }
      const merged = normalizeHmwPayload(d.questions)
      if (!merged) {
        setRespuestasIaError('La respuesta de la IA no tenía el formato esperado.')
        return
      }
      setQuestions(merged)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await saveQuestions(merged)
    } catch {
      setRespuestasIaError('Error de red al generar respuestas con IA. Inténtalo de nuevo.')
    } finally {
      setGeneratingRespuestasBlock(null)
    }
  }

  const generateRespuestasIaBothBlocks = async () => {
    const current = questionsRef.current
    if (!current) return
    setGeneratingRespuestasBlock('both')
    setRespuestasIaError(null)
    try {
      const res = await fetch('/api/hmw-respuestas-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: current }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRespuestasIaError(typeof d.error === 'string' ? d.error : 'No se pudieron generar las respuestas con IA.')
        return
      }
      const merged = normalizeHmwPayload(d.questions)
      if (!merged) {
        setRespuestasIaError('La respuesta de la IA no tenía el formato esperado.')
        return
      }
      setQuestions(merged)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await saveQuestions(merged)
    } catch {
      setRespuestasIaError('Error de red al generar respuestas con IA. Inténtalo de nuevo.')
    } finally {
      setGeneratingRespuestasBlock(null)
    }
  }

  const pickMejorRespuestaIa = useCallback(
    async (block: 'clienteActual' | 'clientePotencial', questionIndex: number) => {
      const current = questionsRef.current
      if (!current) return
      const key = `${block}-${questionIndex}`
      setPendingMejorIaKey(key)
      setMejorIaError(null)
      try {
        const res = await fetch('/api/hmw-marca-mejor-ia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions: current,
            block,
            questionIndex,
          }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok) {
          setMejorIaError(typeof d.error === 'string' ? d.error : 'No se pudo elegir la mejor respuesta con IA.')
          return
        }
        if (typeof d.mejorIndice !== 'number' || !Number.isInteger(d.mejorIndice)) {
          setMejorIaError('La respuesta del servidor no tenía el formato esperado.')
          return
        }
        const motivoIa = typeof d.motivo === 'string' ? d.motivo.trim() : ''
        setRespuestaMarca(block, questionIndex, d.mejorIndice, 'mejor', {
          motivoParaSlot: motivoIa || null,
        })
      } catch {
        setMejorIaError('Error de red al pedir la mejor respuesta con IA. Inténtalo de nuevo.')
      } finally {
        setPendingMejorIaKey(null)
      }
    },
    [setRespuestaMarca]
  )

  const openMarcaMotivoEditor = useCallback(
    (block: 'clienteActual' | 'clientePotencial', qi: number, ri: number) => {
      const row = questionsRef.current?.[block][qi]
      setMarcaMotivoDraft(row?.respuestasMarcaMotivos?.[ri] ?? '')
      setMarcaMotivoEditor({ block, qi, ri })
    },
    []
  )

  const iaBusy =
    generating ||
    generatingQuestionsBlock !== null ||
    generatingRespuestasBlock !== null ||
    pendingMejorIaKey !== null

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

  if (genError && !questions) {
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
          <p className="mt-2 text-xs text-gray-500">
            Tras generar, cada pregunta lleva un campo de notas y puedes sumar más (hasta {HMW_RESPUESTAS_MAX}); se guardan en
            Sheets y se usan al generar el{' '}
            <Link href="/user-journey" className="font-semibold text-indigo-600 underline underline-offset-2">
              User Journey Map
            </Link>
            .
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
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 space-y-2">
        <p>
          Fuente:{' '}
          <Link href="/pov" className="font-semibold text-indigo-600 underline underline-offset-2">
            POV guardados
          </Link>
          . Regenera si actualizas los POV en esa página.
        </p>
        <p className="text-xs text-gray-500">
          Puedes añadir retos con el +, editar con el lápiz o borrar con la papelera; por pregunta hay al menos una
          respuesta y puedes sumar más con el + bajo los textos (máx. {HMW_RESPUESTAS_MAX}). En cada columna puedes
          regenerar **solo ese bloque** o generar **respuestas IA solo para ese bloque**; arriba siguen los atajos para
          **ambos bloques a la vez**. La IA de respuestas usa los{' '}
          <Link href="/empathy" className="font-semibold text-indigo-600 underline underline-offset-2">
            mapas de empatía
          </Link>
          , las{' '}
          <Link href="/user-persona" className="font-semibold text-indigo-600 underline underline-offset-2">
            user personas
          </Link>{' '}
          y los POV guardados; la IA marca una respuesta como **mejor** (borde verde) y puede marcar **no viable**
          (borde rojo). Si escribes las respuestas a mano, en cada pregunta puedes usar **«Mejor respuesta (IA)»** para
          que la IA elija solo la mejor (sin regenerar el texto). Tú puedes cambiar esas marcas con los botones de
          cada respuesta; si hay marca activa, el icono **?** abre el texto que justifica esa marca (editable). Todo se
          guarda en Sheets con
          debounce (~{SAVE_DEBOUNCE_MS / 1000} s). Al cerrar la edición de una pregunta se guarda al momento. Esas notas se
          envían a la IA al generar el{' '}
          <Link href="/user-journey" className="font-semibold text-indigo-600 underline underline-offset-2">
            User Journey Map
          </Link>
          .
        </p>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-800">
        <summary className="cursor-pointer font-semibold text-slate-900 select-none">
          Criterios de ordenación y de las marcas «Mejor» / «No viable»
        </summary>
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-slate-700">
          <div>
            <p className="font-semibold text-slate-900">{HMW_AYUDA_CRITERIOS.ordenTitulo}</p>
            <p className="mt-1">{HMW_AYUDA_CRITERIOS.ordenIntro}</p>
            <ol className="mt-1.5 ml-4 list-decimal space-y-1">
              {HMW_AYUDA_CRITERIOS.ordenPasos.map((paso, i) => (
                <li key={i}>{paso}</li>
              ))}
            </ol>
            <p className="mt-1.5 text-slate-600">{HMW_AYUDA_CRITERIOS.ordenNota}</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">{HMW_AYUDA_CRITERIOS.marcasTitulo}</p>
            <p className="mt-1">{HMW_AYUDA_CRITERIOS.marcasMejor}</p>
            <p className="mt-1">{HMW_AYUDA_CRITERIOS.marcasNoViable}</p>
            <p className="mt-1">{HMW_AYUDA_CRITERIOS.marcasMotivo}</p>
          </div>
        </div>
      </details>

      {respuestasIaError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p>{respuestasIaError}</p>
          <button
            type="button"
            onClick={() => setRespuestasIaError(null)}
            className="shrink-0 self-start sm:self-auto text-[11px] font-semibold underline underline-offset-2"
          >
            Cerrar
          </button>
        </div>
      ) : null}

      {mejorIaError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p>{mejorIaError}</p>
          <button
            type="button"
            onClick={() => setMejorIaError(null)}
            className="shrink-0 self-start sm:self-auto text-[11px] font-semibold underline underline-offset-2"
          >
            Cerrar
          </button>
        </div>
      ) : null}

      {genError && genErrorScope === 'both' ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p>{genError}</p>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void generatePreguntasBothBlocks()}
              className="text-[11px] font-semibold underline underline-offset-2 text-red-900"
            >
              Reintentar (ambos bloques)
            </button>
            <button
              type="button"
              onClick={() => {
                setGenError(null)
                setGenErrorScope(null)
              }}
              className="text-[11px] font-semibold underline underline-offset-2 text-red-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1">
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
          {generatingRespuestasBlock ? (
            <>
              <span className="inline-block h-3 w-3 border border-gray-300 border-t-violet-500 rounded-full animate-spin" />
              <span className="text-violet-600">
                Generando respuestas (IA)
                {generatingRespuestasBlock === 'both'
                  ? ' · ambos bloques'
                  : generatingRespuestasBlock === 'clienteActual'
                    ? ' · clientes actuales'
                    : ' · clientes potenciales'}
                …
              </span>
            </>
          ) : null}
          {generatingQuestionsBlock ? (
            <>
              <span className="inline-block h-3 w-3 border border-gray-300 border-t-indigo-400 rounded-full animate-spin" />
              <span className="text-indigo-600">
                Regenerando preguntas
                {generatingQuestionsBlock === 'both'
                  ? ' · ambos bloques'
                  : generatingQuestionsBlock === 'clienteActual'
                    ? ' · clientes actuales'
                    : ' · clientes potenciales'}
                …
              </span>
            </>
          ) : null}
          {pendingMejorIaKey && !generatingRespuestasBlock ? (
            <>
              <span className="inline-block h-3 w-3 border border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
              <span className="text-emerald-700">Elegiendo mejor respuesta…</span>
            </>
          ) : null}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void generateRespuestasIaBothBlocks()}
            disabled={iaBusy}
            className="text-xs px-3 py-1.5 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            ✦ Respuestas (IA) — ambos bloques
          </button>
          <button
            type="button"
            onClick={() => void generatePreguntasBothBlocks()}
            disabled={iaBusy}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-45 disabled:pointer-events-none"
          >
            ↺ Preguntas — ambos bloques
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <HMWListBlock
          title="Clientes actuales"
          accent="indigo"
          blockKey="clienteActual"
          items={questions.clienteActual}
          onRespuestaChange={updateRespuesta}
          onPreguntaChange={updatePregunta}
          onFlushPreguntaEdit={flushPreguntaEdit}
          onAddPregunta={addPregunta}
          onDeletePregunta={deletePregunta}
          onAddRespuesta={addRespuestaSlot}
          onSetRespuestaMarca={setRespuestaMarca}
          onOpenMarcaMotivo={openMarcaMotivoEditor}
          onPickMejorIa={(b, qi) => void pickMejorRespuestaIa(b, qi)}
          pendingMejorIaKey={pendingMejorIaKey}
          iaBusy={iaBusy}
          preguntasGenError={genError && genErrorScope === 'clienteActual' ? genError : null}
          onDismissPreguntasGenError={() => {
            setGenError(null)
            setGenErrorScope(null)
          }}
          onRegeneratePreguntas={() => void generatePreguntasForBlock('clienteActual')}
          generatingPreguntas={
            generatingQuestionsBlock === 'clienteActual' || generatingQuestionsBlock === 'both'
          }
          onGenerarRespuestasIa={() => void generateRespuestasIaForBlock('clienteActual')}
          generatingRespuestasIa={
            generatingRespuestasBlock === 'clienteActual' || generatingRespuestasBlock === 'both'
          }
        />
        <HMWListBlock
          title="Clientes potenciales"
          accent="violet"
          blockKey="clientePotencial"
          items={questions.clientePotencial}
          onRespuestaChange={updateRespuesta}
          onPreguntaChange={updatePregunta}
          onFlushPreguntaEdit={flushPreguntaEdit}
          onAddPregunta={addPregunta}
          onDeletePregunta={deletePregunta}
          onAddRespuesta={addRespuestaSlot}
          onSetRespuestaMarca={setRespuestaMarca}
          onOpenMarcaMotivo={openMarcaMotivoEditor}
          onPickMejorIa={(b, qi) => void pickMejorRespuestaIa(b, qi)}
          pendingMejorIaKey={pendingMejorIaKey}
          iaBusy={iaBusy}
          preguntasGenError={genError && genErrorScope === 'clientePotencial' ? genError : null}
          onDismissPreguntasGenError={() => {
            setGenError(null)
            setGenErrorScope(null)
          }}
          onRegeneratePreguntas={() => void generatePreguntasForBlock('clientePotencial')}
          generatingPreguntas={
            generatingQuestionsBlock === 'clientePotencial' || generatingQuestionsBlock === 'both'
          }
          onGenerarRespuestasIa={() => void generateRespuestasIaForBlock('clientePotencial')}
          generatingRespuestasIa={
            generatingRespuestasBlock === 'clientePotencial' || generatingRespuestasBlock === 'both'
          }
        />
      </div>

      {marcaMotivoEditor ? (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/45"
          role="presentation"
          onClick={() => setMarcaMotivoEditor(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="hmw-marca-motivo-title"
            className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const { block, qi, ri } = marcaMotivoEditor
              const row = questions?.[block]?.[qi]
              const tipo = row?.respuestasMarcas?.[ri]
              const etiqueta =
                tipo === 'mejor' ? 'Mejor opción' : tipo === 'no_viable' ? 'No viable' : 'Marca'
              return (
                <>
                  <h2 id="hmw-marca-motivo-title" className="text-base font-semibold text-gray-900">
                    Por qué está marcada como «{etiqueta}»
                  </h2>
                  <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                    Aquí se guarda la justificación (la sugiere la IA si generaste respuestas o usaste «Mejor respuesta
                    (IA)»; si marcaste tú los botones, escribe o edita el motivo).
                  </p>
                  <textarea
                    className="mt-3 w-full min-h-32 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    rows={6}
                    maxLength={HMW_MARCA_MOTIVO_MAX_LEN}
                    value={marcaMotivoDraft}
                    onChange={(e) => setMarcaMotivoDraft(e.target.value)}
                    placeholder="Escribe por qué esta respuesta merece esta marca…"
                    aria-label="Explicación de la marca"
                  />
                  <p className="mt-1 text-[11px] text-gray-400">
                    {marcaMotivoDraft.length} / {HMW_MARCA_MOTIVO_MAX_LEN} caracteres
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMarcaMotivoDraft('')
                        setMarcaMotivoText(block, qi, ri, '')
                      }}
                      className="text-xs px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100"
                    >
                      Borrar texto
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarcaMotivoEditor(null)}
                      className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMarcaMotivoText(block, qi, ri, marcaMotivoDraft)
                        setMarcaMotivoEditor(null)
                      }}
                      className="text-xs px-4 py-1.5 rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-700"
                    >
                      Guardar
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      ) : null}
    </div>
  )
}
