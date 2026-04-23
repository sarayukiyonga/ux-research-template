'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CLIENT } from '@/lib/client-config'
import { newCardSortingId, type CardSortingCard, type CardSortingCategory } from '@/lib/card-sorting-types'
import { CardSortingAssignSheet } from '@/components/CardSortingAssignSheet'

type Assignment = Record<string, string>

const LS_PARTICIPANT = 'moa_card_sort_participant_v1'

export function CardSortingParticipantPage() {
  const [cards, setCards] = useState<CardSortingCard[]>([])
  const [baseCategories, setBaseCategories] = useState<CardSortingCategory[]>([])
  const [extraCategories, setExtraCategories] = useState<CardSortingCategory[]>([])
  const [assignment, setAssignment] = useState<Assignment>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [mvpScopeLabel, setMvpScopeLabel] = useState<string | null>(null)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isTouchMode, setIsTouchMode] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignCardId, setAssignCardId] = useState<string | null>(null)
  const [openCatId, setOpenCatId] = useState<string | null>(null)

  const allCategories = useMemo(
    () => [...baseCategories, ...extraCategories],
    [baseCategories, extraCategories]
  )

  const categoryLabelsPayload = useMemo(
    () => Object.fromEntries(allCategories.map((c) => [c.id, c.label])),
    [allCategories]
  )

  const latestRef = useRef({
    participantId: null as string | null,
    assignments: {} as Assignment,
    categoryLabels: {} as Record<string, string>,
    loading: true,
    cardCount: 0,
  })
  latestRef.current = {
    participantId,
    assignments: assignment,
    categoryLabels: categoryLabelsPayload,
    loading,
    cardCount: cards.length,
  }

  useEffect(() => {
    try {
      let id = localStorage.getItem(LS_PARTICIPANT)
      if (!id || id.length < 8) {
        id = crypto.randomUUID()
        localStorage.setItem(LS_PARTICIPANT, id)
      }
      setParticipantId(id)
    } catch {
      setParticipantId(crypto.randomUUID())
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => setIsTouchMode(Boolean(mq.matches))
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const load = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/card-sorting-public')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar')
      setCards(Array.isArray(data.cards) ? data.cards : [])
      setBaseCategories(Array.isArray(data.categories) ? data.categories : [])
      setMvpScopeLabel(typeof data.mvpScopeLabel === 'string' && data.mvpScopeLabel.trim() ? data.mvpScopeLabel : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const postSubmission = useCallback(async (body: { participantId: string; assignments: Assignment; categoryLabels: Record<string, string> }) => {
    const res = await fetch('/api/card-sorting-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al guardar')
    return data
  }, [])

  useEffect(() => {
    if (!participantId || loading || cards.length === 0) return
    const t = window.setTimeout(() => {
      void (async () => {
        setSaveStatus('saving')
        setSaveError(null)
        try {
          await postSubmission({
            participantId,
            assignments: assignment,
            categoryLabels: categoryLabelsPayload,
          })
          setSaveStatus('saved')
          window.setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2200)
        } catch (e) {
          setSaveStatus('error')
          setSaveError(e instanceof Error ? e.message : 'Error')
        }
      })()
    }, 1300)
    return () => window.clearTimeout(t)
  }, [
    participantId,
    loading,
    cards.length,
    assignment,
    categoryLabelsPayload,
    postSubmission,
    extraCategories,
    baseCategories,
  ])

  useEffect(() => {
    const flushBeacon = () => {
      const s = latestRef.current
      if (!s.participantId || s.loading || s.cardCount === 0) return
      const body = JSON.stringify({
        participantId: s.participantId,
        assignments: s.assignments,
        categoryLabels: s.categoryLabels,
      })
      try {
        navigator.sendBeacon('/api/card-sorting-submit', new Blob([body], { type: 'application/json' }))
      } catch {
        /* ignore */
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushBeacon()
    }
    window.addEventListener('pagehide', flushBeacon)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('pagehide', flushBeacon)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const unassigned = useMemo(() => {
    return cards.filter((c) => !assignment[c.id])
  }, [cards, assignment])

  const cardsInCategory = useCallback(
    (catId: string) => cards.filter((c) => assignment[c.id] === catId),
    [cards, assignment]
  )

  const onDragStart = (e: React.DragEvent, cardId: string) => {
    if (isTouchMode) return
    setDraggingId(cardId)
    e.dataTransfer.setData('text/plain', cardId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const onDragEnd = () => setDraggingId(null)

  const onDragOverZone = (e: React.DragEvent) => {
    if (isTouchMode) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const onDropPool = (e: React.DragEvent) => {
    if (isTouchMode) return
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggingId
    if (!id) return
    setAssignment((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setDraggingId(null)
  }

  const onDropCategory = (e: React.DragEvent, catId: string) => {
    if (isTouchMode) return
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || draggingId
    if (!id) return
    setAssignment((prev) => ({ ...prev, [id]: catId }))
    setDraggingId(null)
  }

  const openAssignForCard = (cardId: string) => {
    setAssignCardId(cardId)
    setAssignOpen(true)
  }

  const assignTo = (categoryId: string | null) => {
    const id = assignCardId
    if (!id) return
    if (categoryId == null) {
      setAssignment((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    } else {
      setAssignment((prev) => ({ ...prev, [id]: categoryId }))
    }
    setAssignOpen(false)
    setAssignCardId(null)
  }

  const addParticipantCategory = () => {
    setExtraCategories((prev) => [...prev, { id: newCardSortingId('cat'), label: 'Nueva categoría' }])
  }

  const updateExtraCategoryLabel = (id: string, label: string) => {
    setExtraCategories((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)))
  }

  const copySummary = async () => {
    const lines: string[] = [`Card sorting — ${CLIENT.name}`]
    if (mvpScopeLabel) lines.push(`Ámbito: ${mvpScopeLabel}`)
    lines.push('')
    for (const cat of allCategories) {
      const list = cardsInCategory(cat.id).map((c) => c.label)
      lines.push(`## ${cat.label}`)
      lines.push(list.length ? list.map((l) => `- ${l}`).join('\n') : '(vacío)')
      lines.push('')
    }
    const pool = unassigned.map((c) => c.label)
    lines.push('## Sin clasificar')
    lines.push(pool.length ? pool.map((l) => `- ${l}`).join('\n') : '(ninguna)')
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      window.prompt('Copia el texto manualmente:', text)
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
        Cargando tarjetas…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 cursor-pointer rounded-md px-2 py-1 text-sm font-medium text-violet-700 underline-offset-2 transition-colors hover:bg-violet-100 hover:no-underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (cards.length === 0 && baseCategories.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
        Aún no hay tarjetas configuradas. Quien organice la investigación debe guardar la lista en la página de
        administración (sesión iniciada).
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {mvpScopeLabel && (
        <p className="text-sm text-gray-600">
          <span className="text-gray-500">Ámbito del MVP:</span>{' '}
          <span className="font-semibold text-gray-900">{mvpScopeLabel}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <span className="text-gray-500">Tu ordenación se guarda sola en el servidor.</span>
        {saveStatus === 'saving' && <span className="text-amber-700 font-medium">Guardando…</span>}
        {saveStatus === 'saved' && <span className="text-emerald-700 font-medium">Guardado</span>}
        {saveStatus === 'error' && (
          <span className="text-red-700 font-medium" title={saveError ?? ''}>
            No se pudo guardar{saveError ? `: ${saveError}` : ''}
          </span>
        )}
      </div>

      {isTouchMode && (
        <div className="sticky top-0 z-10 -mx-4 px-4 py-2 bg-gray-50/90 backdrop-blur border-b border-gray-200">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-600">
              Sin clasificar: <span className="font-semibold text-gray-900">{unassigned.length}</span>
            </span>
            <span className="text-gray-500">
              {saveStatus === 'saving'
                ? 'Guardando…'
                : saveStatus === 'saved'
                  ? 'Guardado'
                  : saveStatus === 'error'
                    ? 'Error al guardar'
                    : ' '}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addParticipantCategory}
          className="cursor-pointer rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-900 shadow-sm transition-all hover:bg-violet-100 hover:shadow active:scale-[0.98]"
        >
          + Añadir otra categoría
        </button>
        <button
          type="button"
          onClick={copySummary}
          className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow active:scale-[0.98]"
        >
          Copiar resumen al portapapeles
        </button>
      </div>

      <div
        onDragOver={onDragOverZone}
        onDrop={onDropPool}
        className={`min-h-[100px] rounded-2xl border-2 border-dashed p-4 transition-colors ${
          draggingId ? 'border-violet-400 bg-violet-50/40' : 'border-gray-200 bg-gray-50/80'
        }`}
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Tarjetas sin clasificar</p>
        <div className="flex flex-wrap gap-2">
          {unassigned.map((c) => (
            <div
              key={c.id}
              draggable={!isTouchMode}
              onDragStart={(e) => onDragStart(e, c.id)}
              onDragEnd={onDragEnd}
              onClick={() => (isTouchMode ? openAssignForCard(c.id) : undefined)}
              className={`rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-medium text-amber-950 shadow-sm ${
                isTouchMode ? 'cursor-pointer active:scale-[0.99]' : 'cursor-grab active:cursor-grabbing'
              }`}
            >
              {c.label}
            </div>
          ))}
          {unassigned.length === 0 && <span className="text-sm text-gray-400">Todas las tarjetas están en columnas.</span>}
        </div>
      </div>

      {isTouchMode ? (
        <div className="space-y-3">
          {allCategories.map((cat) => {
            const isExtra = extraCategories.some((x) => x.id === cat.id)
            const inCol = cardsInCategory(cat.id)
            const isOpen = openCatId ? openCatId === cat.id : inCol.length > 0
            return (
              <section key={cat.id} className="rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    {isExtra ? (
                      <input
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm font-semibold text-gray-900"
                        value={cat.label}
                        onChange={(e) => updateExtraCategoryLabel(cat.id, e.target.value)}
                        aria-label="Nombre de la categoría añadida"
                      />
                    ) : (
                      <h3 className="text-sm font-semibold text-gray-900 truncate">{cat.label}</h3>
                    )}
                    <p className="text-[11px] text-gray-500">{inCol.length} tarjetas</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenCatId((cur) => (cur === cat.id ? null : cat.id))}
                    className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <div className="flex flex-col gap-2">
                      {inCol.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => openAssignForCard(c.id)}
                          className="w-full rounded-xl border border-teal-200 bg-teal-50/90 px-3 py-3 text-left text-sm font-medium text-teal-950 shadow-sm active:scale-[0.99]"
                        >
                          {c.label}
                        </button>
                      ))}
                      {inCol.length === 0 && <p className="text-sm text-gray-400">Vacío.</p>}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {allCategories.map((cat) => {
              const isExtra = extraCategories.some((x) => x.id === cat.id)
              const inCol = cardsInCategory(cat.id)
              return (
                <div
                  key={cat.id}
                  onDragOver={onDragOverZone}
                  onDrop={(e) => onDropCategory(e, cat.id)}
                  className={`flex w-[220px] shrink-0 flex-col rounded-2xl border-2 border-dashed p-3 ${
                    draggingId ? 'border-teal-400 bg-teal-50/30' : 'border-gray-200 bg-white'
                  }`}
                >
                  {isExtra ? (
                    <input
                      className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1 text-sm font-semibold text-gray-900"
                      value={cat.label}
                      onChange={(e) => updateExtraCategoryLabel(cat.id, e.target.value)}
                      aria-label="Nombre de la categoría añadida"
                    />
                  ) : (
                    <h3 className="mb-2 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900">{cat.label}</h3>
                  )}
                  <div className="flex min-h-[120px] flex-1 flex-col gap-2">
                    {inCol.map((c) => (
                      <div
                        key={c.id}
                        draggable={!isTouchMode}
                        onDragStart={(e) => onDragStart(e, c.id)}
                        onDragEnd={onDragEnd}
                        className="cursor-grab active:cursor-grabbing rounded-lg border border-teal-200 bg-teal-50/90 px-2 py-2 text-xs font-medium text-teal-950 shadow-sm"
                      >
                        {c.label}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        {isTouchMode
          ? 'Toca una tarjeta para moverla a una categoría. Puedes devolverla a «sin clasificar» desde el menú.'
          : 'Arrastra cada tarjeta a la columna que encaje. Puedes volver a dejarla en «sin clasificar» soltándola en la zona superior.'}
      </p>

      <CardSortingAssignSheet
        open={assignOpen && Boolean(assignCardId)}
        cardLabel={cards.find((c) => c.id === assignCardId)?.label ?? ''}
        categories={allCategories}
        onAssign={assignTo}
        onClose={() => {
          setAssignOpen(false)
          setAssignCardId(null)
        }}
      />
    </div>
  )
}
