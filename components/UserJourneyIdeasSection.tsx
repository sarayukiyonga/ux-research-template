'use client'

import { useCallback, useEffect, useState } from 'react'
import { AutoTextarea } from '@/components/ui/auto-textarea'
import type { JourneyForPersona } from '@/lib/user-journey-bundle'
import type { UserJourneySegmento, UserJourneyV3Persist } from '@/lib/user-journey-persist'
import { getCanalPromptFields, normalizeCanalInCatalog } from '@/lib/user-journey-channels'
import {
  createEmptyIdeasPersist,
  newJourneyIdeaId,
  normalizeUserJourneyIdeasPersist,
  type JourneyIdeaItem,
  type JourneyIdeaTipo,
  type UserJourneyIdeasPersist,
} from '@/lib/user-journey-ideas-persist'

type Props = {
  persist: UserJourneyV3Persist
  segmento: UserJourneySegmento
}

function TrashMini({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden>
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

export function UserJourneyIdeasSection({ persist, segmento }: Props) {
  const seg = persist[segmento]
  const accent = segmento === 'clienteActual' ? 'teal' : 'orange'
  const ring = accent === 'teal' ? 'focus:ring-teal-500' : 'focus:ring-orange-500'
  const badgeFn = accent === 'teal' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' : 'bg-amber-50 text-amber-950 border-amber-200'
  const badgeCt = accent === 'teal' ? 'bg-sky-50 text-sky-900 border-sky-200' : 'bg-violet-50 text-violet-900 border-violet-200'

  const [ideasCanalId, setIdeasCanalId] = useState(() =>
    normalizeCanalInCatalog(seg.canalActivoId, seg.catalogo)
  )
  const [ideas, setIdeas] = useState<UserJourneyIdeasPersist>(() => createEmptyIdeasPersist())
  const [savedAt, setSavedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [genLoading, setGenLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTexto, setDraftTexto] = useState('')
  const [draftTipo, setDraftTipo] = useState<JourneyIdeaTipo>('funcionalidad')
  const [manualEtapa, setManualEtapa] = useState(1)
  const [manualOpen, setManualOpen] = useState(false)

  useEffect(() => {
    const nid = normalizeCanalInCatalog(seg.canalActivoId, seg.catalogo)
    setIdeasCanalId(nid)
  }, [segmento, seg.canalActivoId, seg.catalogo])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/user-journey-ideas-saved')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const raw = d?.saved?.ideas
        setIdeas(normalizeUserJourneyIdeasPersist(raw))
        if (typeof d?.saved?.savedAt === 'string') setSavedAt(d.saved.savedAt)
      })
      .catch(() => {
        if (!cancelled) setIdeas(createEmptyIdeasPersist())
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const journey: JourneyForPersona | null = seg.mapas[ideasCanalId] ?? null
  const canalLabel = getCanalPromptFields(ideasCanalId, seg.catalogo).label

  const listForKey = useCallback(
    (p: UserJourneyIdeasPersist, segKey: UserJourneySegmento, canal: string): JourneyIdeaItem[] => {
      const bucket = p[segKey]
      return bucket[canal] ?? []
    },
    []
  )

  const saveAll = useCallback(async (next: UserJourneyIdeasPersist) => {
    setSaving(true)
    try {
      const r = await fetch('/api/user-journey-ideas-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideas: next }),
      })
      const d = await r.json().catch(() => ({}))
      if (typeof d?.savedAt === 'string') setSavedAt(d.savedAt)
    } catch {
      window.alert('No se pudo guardar en Sheets.')
    } finally {
      setSaving(false)
    }
  }, [])

  const updateIdeasForChannel = useCallback(
    (mutate: (prev: JourneyIdeaItem[]) => JourneyIdeaItem[]) => {
      setIdeas((prevAll) => {
        const cur = listForKey(prevAll, segmento, ideasCanalId)
        const nextList = mutate([...cur])
        const next: UserJourneyIdeasPersist = {
          ...prevAll,
          [segmento]: { ...prevAll[segmento], [ideasCanalId]: nextList },
        }
        void saveAll(next)
        return next
      })
    },
    [ideasCanalId, listForKey, saveAll, segmento]
  )

  const handleGenerate = async () => {
    if (!journey) {
      window.alert('Primero genera y guarda el mapa de este canal para este segmento.')
      return
    }
    setGenLoading(true)
    try {
      const res = await fetch('/api/user-journey-ideas-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journey, canalEtiqueta: canalLabel }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        window.alert(typeof d.error === 'string' ? d.error : 'No se pudieron generar ideas.')
        return
      }
      const raw = d.ideas as Array<{ etapaOrden: number; tipo: JourneyIdeaTipo; texto: string }> | undefined
      if (!Array.isArray(raw) || raw.length === 0) {
        window.alert('La IA no devolvió ideas válidas.')
        return
      }
      const nuevas: JourneyIdeaItem[] = raw.map((i) => ({
        id: newJourneyIdeaId(),
        etapaOrden: i.etapaOrden,
        tipo: i.tipo === 'contenido' ? 'contenido' : 'funcionalidad',
        texto: String(i.texto).trim().slice(0, 400),
      }))
      setIdeas((prevAll) => {
        const cur = listForKey(prevAll, segmento, ideasCanalId)
        const merged = [...cur, ...nuevas]
        const next: UserJourneyIdeasPersist = {
          ...prevAll,
          [segmento]: { ...prevAll[segmento], [ideasCanalId]: merged },
        }
        void saveAll(next)
        return next
      })
    } catch {
      window.alert('Error de red al generar ideas.')
    } finally {
      setGenLoading(false)
    }
  }

  const handleClearCanal = () => {
    if (!window.confirm(`¿Borrar todas las ideas guardadas para «${canalLabel}» en este segmento?`)) return
    updateIdeasForChannel(() => [])
  }

  const startEdit = (item: JourneyIdeaItem) => {
    setEditingId(item.id)
    setDraftTexto(item.texto)
    setDraftTipo(item.tipo)
  }

  const saveEdit = () => {
    if (!editingId) return
    const t = draftTexto.trim()
    if (!t) {
      window.alert('El texto no puede estar vacío.')
      return
    }
    updateIdeasForChannel((list) =>
      list.map((i) => (i.id === editingId ? { ...i, texto: t.slice(0, 400), tipo: draftTipo } : i))
    )
    setEditingId(null)
  }

  const deleteIdea = (id: string) => {
    updateIdeasForChannel((list) => list.filter((i) => i.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const addManual = () => {
    if (!journey) return
    const ordenes = journey.etapas.map((e) => e.orden)
    const o = manualEtapa
    if (!ordenes.includes(o)) {
      window.alert('Elige una etapa válida del mapa.')
      return
    }
    const t = draftTexto.trim()
    if (!t) {
      window.alert('Escribe la idea.')
      return
    }
    updateIdeasForChannel((list) => [
      ...list,
      { id: newJourneyIdeaId(), etapaOrden: o, tipo: draftTipo, texto: t.slice(0, 400) },
    ])
    setDraftTexto('')
    setManualOpen(false)
  }

  const items = listForKey(ideas, segmento, ideasCanalId)
  const etapasSorted = journey?.etapas.slice().sort((a, b) => a.orden - b.orden) ?? []

  if (loading) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500" aria-busy>
        Cargando ideas de funcionalidades y contenido…
      </section>
    )
  }

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4"
      aria-label="Ideas de funcionalidades y contenido por canal"
    >
      <div>
        <h2 className="text-sm font-bold text-gray-900">Funcionalidades y contenido por canal</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Genera propuestas alineadas con <strong>cada etapa del User Journey</strong> del canal que elijas, para
          cubrir dolores y el rol MOA frente al POV. Puedes <strong>editar, borrar o añadir</strong> ideas a mano. Las
          ideas se guardan por <strong>segmento</strong> (actual / potencial) y <strong>canal</strong>.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-3">
        <label className="block min-w-[200px] flex-1">
          <span className="text-[11px] font-medium text-gray-500">Canal para las ideas</span>
          <select
            value={ideasCanalId}
            onChange={(e) => setIdeasCanalId(normalizeCanalInCatalog(e.target.value, seg.catalogo))}
            className={`mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white ${ring} focus:outline-none focus:ring-2`}
          >
            {seg.catalogo.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={genLoading || !journey}
            onClick={() => void handleGenerate()}
            className={`rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-45 ${
              accent === 'teal' ? 'bg-teal-600 hover:bg-teal-700' : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {genLoading ? 'Generando con IA…' : 'Generar ideas con IA'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!journey) return
              setManualEtapa(journey.etapas[0]?.orden ?? 1)
              setDraftTipo('funcionalidad')
              setDraftTexto('')
              setManualOpen(true)
            }}
            disabled={!journey}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-45"
          >
            Añadir idea manual
          </button>
          <button
            type="button"
            onClick={() => handleClearCanal()}
            disabled={items.length === 0}
            className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
          >
            Vaciar este canal
          </button>
        </div>
      </div>

      {!journey && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          No hay mapa guardado para <strong>{canalLabel}</strong> en este segmento. Genera el mapa en el canal
          correspondiente y vuelve aquí.
        </p>
      )}

      {journey && (
        <p className="text-xs text-gray-500">
          Mapa base: <strong>{journey.etiquetaPersona}</strong> · momento clave en etapa{' '}
          <strong>{journey.etapaOrdenPovResuelto}</strong>.
        </p>
      )}

      <div className="flex items-center gap-2 text-[11px] text-gray-400">
        {saving ? (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 border border-gray-300 border-t-teal-500 rounded-full animate-spin" />
            Guardando…
          </span>
        ) : savedAt ? (
          <span className="text-green-600">✓ Ideas en Sheets · {savedAt}</span>
        ) : (
          <span>Sin fecha de guardado aún</span>
        )}
      </div>

      {manualOpen && journey && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3 space-y-3">
          <p className="text-xs font-medium text-gray-700">Nueva idea manual</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="block text-xs">
              <span className="text-gray-500">Etapa</span>
              <select
                value={manualEtapa}
                onChange={(e) => setManualEtapa(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              >
                {etapasSorted.map((e) => (
                  <option key={e.orden} value={e.orden}>
                    {e.orden}. {e.titulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs">
              <span className="text-gray-500">Tipo</span>
              <select
                value={draftTipo}
                onChange={(e) => setDraftTipo(e.target.value as JourneyIdeaTipo)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              >
                <option value="funcionalidad">Funcionalidad</option>
                <option value="contenido">Contenido</option>
              </select>
            </label>
          </div>
          <AutoTextarea
            value={draftTexto}
            onChange={(e) => setDraftTexto(e.target.value)}
            placeholder="Describe la idea…"
            rows={3}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setManualOpen(false)
                setDraftTexto('')
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => addManual()}
              className={`text-xs px-3 py-1.5 rounded-lg text-white font-medium ${
                accent === 'teal' ? 'bg-teal-600' : 'bg-orange-600'
              }`}
            >
              Guardar idea
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && journey && (
        <p className="text-sm text-gray-500 py-2">Aún no hay ideas para este canal. Usa la IA o añade manualmente.</p>
      )}

      {journey &&
        etapasSorted.map((et) => {
          const stageIdeas = items.filter((i) => i.etapaOrden === et.orden)
          return (
            <div key={et.orden} className="rounded-lg border border-gray-100 bg-gray-50/40 px-3 py-3 space-y-2">
              <h3 className="text-xs font-bold text-gray-900">
                Etapa {et.orden}: {et.titulo}
                {et.orden === journey.etapaOrdenPovResuelto ? (
                  <span className="ml-2 font-normal text-teal-700">· momento clave POV</span>
                ) : null}
              </h3>
              {stageIdeas.length === 0 ? (
                <p className="text-[11px] text-gray-400">Sin ideas aún para esta etapa.</p>
              ) : (
                <ul className="space-y-2">
                  {stageIdeas.map((idea) => (
                    <li
                      key={idea.id}
                      className="rounded-lg border border-white bg-white px-3 py-2 shadow-sm flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded border ${idea.tipo === 'funcionalidad' ? badgeFn : badgeCt}`}
                          >
                            {idea.tipo === 'funcionalidad' ? 'Funcionalidad' : 'Contenido'}
                          </span>
                        </div>
                        {editingId === idea.id ? (
                          <div className="space-y-2">
                            <select
                              value={draftTipo}
                              onChange={(e) => setDraftTipo(e.target.value as JourneyIdeaTipo)}
                              className="text-xs rounded border border-gray-200 px-2 py-1"
                            >
                              <option value="funcionalidad">Funcionalidad</option>
                              <option value="contenido">Contenido</option>
                            </select>
                            <AutoTextarea
                              value={draftTexto}
                              onChange={(e) => setDraftTexto(e.target.value)}
                              rows={3}
                              className="w-full text-sm rounded-lg border border-gray-200 px-2 py-1.5"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit()}
                                className={`text-xs font-medium ${accent === 'teal' ? 'text-teal-700' : 'text-orange-800'}`}
                              >
                                Guardar
                              </button>
                              <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-500">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-800 whitespace-pre-wrap wrap-break-word">{idea.texto}</p>
                        )}
                      </div>
                      {editingId !== idea.id && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(idea)}
                            className="p-1.5 rounded text-gray-500 hover:bg-gray-100 text-xs"
                            aria-label="Editar idea"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteIdea(idea.id)}
                            className="p-1.5 rounded text-red-600 hover:bg-red-50"
                            aria-label="Eliminar idea"
                          >
                            <TrashMini className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
    </section>
  )
}
