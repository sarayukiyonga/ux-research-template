'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { AutoTextarea } from '@/components/ui/auto-textarea'
import type { JourneyForPersona } from '@/lib/user-journey-bundle'
import { isJourneyForPersona } from '@/lib/user-journey-bundle'
import {
  DEFAULT_USER_JOURNEY_CANAL_ID,
  JOURNEY_BASE_CANAL_ID,
  defaultJourneyCanalCatalogo,
  getCanalPromptFields,
  isKnownUserJourneyCanalId,
  normalizeCanalInCatalog,
  newCustomJourneyCanalId,
} from '@/lib/user-journey-channels'
import {
  createEmptyJourneyV3,
  parsePersistedJourneyCell,
  parseUserJourneySavedFilters,
  toJourneyV3,
  withJourneyBaseInCatalogs,
  type UserJourneySegmento,
  type UserJourneyV3Persist,
} from '@/lib/user-journey-persist'
import { UserJourneyIdeasSection } from '@/components/UserJourneyIdeasSection'

export type { JourneyEtapa, JourneyForPersona, UserJourneyBundle } from '@/lib/user-journey-bundle'

function applySavedFiltersToJourneyV3(
  v3: UserJourneyV3Persist,
  f: ReturnType<typeof parseUserJourneySavedFilters>
): UserJourneyV3Persist {
  const out: UserJourneyV3Persist = {
    ...v3,
    clienteActual: { ...v3.clienteActual },
    clientePotencial: { ...v3.clientePotencial },
  }
  if (f.canalPorSegmento?.clienteActual) {
    out.clienteActual.canalActivoId = normalizeCanalInCatalog(
      f.canalPorSegmento.clienteActual,
      out.clienteActual.catalogo
    )
  }
  if (f.canalPorSegmento?.clientePotencial) {
    out.clientePotencial.canalActivoId = normalizeCanalInCatalog(
      f.canalPorSegmento.clientePotencial,
      out.clientePotencial.catalogo
    )
  }
  return out
}

function hasValidPersonasSaved(personas: unknown): boolean {
  if (!personas || typeof personas !== 'object') return false
  const o = personas as Record<string, unknown>
  const ca = o.clienteActual
  const cp = o.clientePotencial
  if (!ca || !cp || typeof ca !== 'object' || typeof cp !== 'object') return false
  const check = (p: Record<string, unknown>) =>
    typeof p.nombre === 'string' &&
    Array.isArray(p.motivaciones) &&
    p.motivaciones.length > 0
  return check(ca as Record<string, unknown>) && check(cp as Record<string, unknown>)
}

function deleteEtapaFromJourney(j: JourneyForPersona, ordenToRemove: number): JourneyForPersona | null {
  const idx = j.etapas.findIndex((e) => e.orden === ordenToRemove)
  if (idx < 0 || j.etapas.length <= 3) return null
  const keyIdx = j.etapas.findIndex((e) => e.orden === j.etapaOrdenPovResuelto)
  const filtered = j.etapas.filter((_, i) => i !== idx)
  const newEtapas = filtered.map((e, i) => ({ ...e, orden: i + 1 }))
  let newKeyIdx = keyIdx
  if (keyIdx === idx) newKeyIdx = Math.min(idx, filtered.length - 1)
  else if (keyIdx > idx) newKeyIdx = keyIdx - 1
  newKeyIdx = Math.max(0, Math.min(newKeyIdx, newEtapas.length - 1))
  const newClave = newEtapas[newKeyIdx]!.orden
  return { ...j, etapas: newEtapas, etapaOrdenPovResuelto: newClave }
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

/** Canal borrable: explícitamente propio, o sin marca de preset y no es id de preset del sistema. */
function isRemovableCustomCanal(c: { id: string; esPreset?: boolean }): boolean {
  if (c.esPreset === true) return false
  if (c.esPreset === false) return true
  if (c.id === JOURNEY_BASE_CANAL_ID || isKnownUserJourneyCanalId(c.id)) return false
  return true
}

function SegmentCanalPanel({
  persist,
  segmento,
  nuevoCanalLabel,
  onNuevoCanalLabel,
  onSelectSegment,
  onSelectCanal,
  onAddCustomCanal,
  onRemoveCanal,
  disabled,
}: {
  persist: UserJourneyV3Persist
  segmento: UserJourneySegmento
  nuevoCanalLabel: string
  onNuevoCanalLabel: (s: string) => void
  onSelectSegment: (s: UserJourneySegmento) => void
  onSelectCanal: (id: string) => void
  onAddCustomCanal: () => void
  onRemoveCanal: (id: string) => void
  disabled?: boolean
}) {
  const seg = persist[segmento]
  const accent = segmento === 'clienteActual' ? 'teal' : 'orange'
  const tabOn =
    accent === 'teal'
      ? 'border-teal-600 bg-teal-50 text-teal-900'
      : 'border-orange-500 bg-orange-50 text-orange-950'
  const tabOff = 'border-gray-200 text-gray-600 hover:bg-gray-50'

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4" aria-label="Segmento y canales">
      <div>
        <h2 className="text-sm font-bold text-gray-900">Tipo de cliente y canales</h2>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          <strong>Todos los canales</strong>: mapa end-to-end sin un solo medio (HMW + persona + POV). Los demás canales
          detallan la experiencia en <strong>cada medio</strong> (web, WhatsApp, etc.). Puedes añadir canales
          personalizados y borrarlos con la <strong className="font-semibold">X</strong> (solo los propios). El{' '}
          <strong>User Flow</strong> usa el canal guardado <strong>por segmento</strong>.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Segmento">
        <button
          type="button"
          role="tab"
          aria-selected={segmento === 'clienteActual'}
          disabled={disabled}
          onClick={() => onSelectSegment('clienteActual')}
          className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
            segmento === 'clienteActual' ? tabOn : tabOff
          } ${disabled ? 'opacity-45' : ''}`}
        >
          Cliente actual
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={segmento === 'clientePotencial'}
          disabled={disabled}
          onClick={() => onSelectSegment('clientePotencial')}
          className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
            segmento === 'clientePotencial' ? tabOn : tabOff
          } ${disabled ? 'opacity-45' : ''}`}
        >
          Cliente potencial
        </button>
      </div>
      <div>
        <p className="text-[11px] font-medium text-gray-500 mb-2">Canales para este segmento</p>
        <div className="flex flex-wrap gap-2">
          {seg.catalogo.map((c) => {
            const tiene = Boolean(seg.mapas[c.id])
            const active = seg.canalActivoId === c.id
            const esPropio = isRemovableCustomCanal(c)
            const pillClass = `text-xs font-medium rounded-full border transition-colors ${
              active ? tabOn : tabOff
            } ${disabled ? 'opacity-45' : ''} ${tiene && !active ? 'border-dashed border-gray-300' : ''}`
            return (
              <div
                key={c.id}
                className={`inline-flex max-w-full items-stretch overflow-hidden rounded-full ${pillClass} ${
                  disabled ? 'pointer-events-none' : ''
                }`}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectCanal(c.id)}
                  className={`min-w-0 flex-1 px-3 py-1.5 text-left ${active ? '' : 'hover:bg-gray-50'}`}
                >
                  <span className="font-medium">{c.label}</span>
                  {esPropio ? <span className="text-gray-400"> · propio</span> : null}
                  {tiene ? (
                    <span className={accent === 'teal' ? 'text-teal-800' : 'text-orange-900'}> · mapa</span>
                  ) : null}
                </button>
                {esPropio ? (
                  <button
                    type="button"
                    disabled={disabled}
                    title={`Eliminar canal «${c.label}»`}
                    aria-label={`Eliminar canal ${c.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveCanal(c.id)
                    }}
                    className={`shrink-0 border-l border-black/10 px-2 flex items-center justify-center transition-colors ${
                      accent === 'teal'
                        ? 'text-teal-800 hover:bg-teal-100/80 active:bg-teal-200/80'
                        : 'text-orange-950 hover:bg-orange-100/80 active:bg-orange-200/80'
                    } ${active ? '' : 'text-gray-600 hover:bg-gray-100'}`}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 items-end pt-1 border-t border-gray-100">
        <label className="flex-1 min-w-48 space-y-1">
          <span className="text-[11px] font-medium text-gray-500">Añadir canal personalizado</span>
          <input
            type="text"
            value={nuevoCanalLabel}
            onChange={(e) => onNuevoCanalLabel(e.target.value)}
            maxLength={80}
            disabled={disabled}
            placeholder="Nombre visible (p. ej. Newsletter barrio)"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={disabled || !nuevoCanalLabel.trim()}
          onClick={() => onAddCustomCanal()}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Añadir
        </button>
      </div>
    </section>
  )
}

function JourneyMapSection({
  journey,
  segmentLabel,
  accent,
  sintesisLoading,
  onRegenerateSintesis,
  onEditEtapa,
  onDeleteEtapa,
  clavePovLabel,
}: {
  journey: JourneyForPersona
  segmentLabel: string
  accent: 'teal' | 'orange'
  sintesisLoading: boolean
  onRegenerateSintesis: () => void
  onEditEtapa: (orden: number) => void
  onDeleteEtapa: (orden: number) => void
  clavePovLabel: string
}) {
  const ring = accent === 'teal' ? 'ring-teal-400 shadow-teal-100' : 'ring-orange-400 shadow-orange-100'
  const badge = accent === 'teal' ? 'bg-teal-600' : 'bg-orange-600'
  const pain = accent === 'teal' ? 'text-rose-700 bg-rose-50 border-rose-100' : 'text-rose-800 bg-rose-50 border-rose-100'
  const webBox = accent === 'teal' ? 'border-teal-200 bg-teal-50/80 text-teal-900' : 'border-orange-200 bg-orange-50/80 text-orange-950'
  const claveBadge =
    accent === 'teal' ? 'text-teal-800 bg-teal-100' : 'text-orange-900 bg-orange-100'
  const iconBtn =
    accent === 'teal'
      ? 'rounded-lg p-1.5 text-teal-700 hover:bg-teal-50 ring-1 ring-transparent hover:ring-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-300'
      : 'rounded-lg p-1.5 text-orange-700 hover:bg-orange-50 ring-1 ring-transparent hover:ring-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300'
  const sintesisBtn =
    accent === 'teal'
      ? 'shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 border border-teal-300 text-teal-800 bg-white hover:bg-teal-50 disabled:opacity-45'
      : 'shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 border border-orange-300 text-orange-900 bg-white hover:bg-orange-50 disabled:opacity-45'

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{segmentLabel}</h2>
          <p className="text-sm text-gray-500">{journey.etiquetaPersona}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:justify-between">
          <p className="text-sm text-gray-700 leading-relaxed flex-1 min-w-0">
            <span className="font-semibold text-gray-800">Síntesis: </span>
            {journey.sintesis}
          </p>
          <button
            type="button"
            onClick={() => onRegenerateSintesis()}
            disabled={sintesisLoading}
            className={sintesisBtn}
            title="Regenerar la síntesis con IA a partir de las etapas actuales"
          >
            {sintesisLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 border border-current border-t-transparent rounded-full animate-spin opacity-70" />
                Generando…
              </span>
            ) : (
              '✦ Síntesis (IA)'
            )}
          </button>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-3 pt-1 snap-x snap-mandatory scroll-smooth">
          {journey.etapas.map((e, cardIdx) => {
            const clave = e.orden === journey.etapaOrdenPovResuelto
            const minEtapas = journey.etapas.length <= 3
            return (
              <div
                key={`${segmentLabel}-${cardIdx}-${e.orden}`}
                className={`snap-start shrink-0 w-[min(100%,20rem)] rounded-2xl border-2 bg-white p-4 space-y-3 transition-shadow ${
                  clave ? `ring-2 ${ring} shadow-md` : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shrink-0 ${badge}`}
                  >
                    {e.orden}
                  </span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    {clave ? (
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${claveBadge}`}>
                        {clavePovLabel}
                      </span>
                    ) : (
                      <span className="w-px h-4" />
                    )}
                    <button
                      type="button"
                      onClick={() => onEditEtapa(e.orden)}
                      className={iconBtn}
                      aria-label={`Editar etapa ${e.orden}`}
                      title="Editar etapa"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (minEtapas) return
                        if (!window.confirm(`¿Eliminar la etapa «${e.titulo}»?`)) return
                        onDeleteEtapa(e.orden)
                      }}
                      disabled={minEtapas}
                      className={`${iconBtn} text-red-600 hover:bg-red-50 hover:ring-red-200 disabled:opacity-30 disabled:pointer-events-none`}
                      aria-label={`Eliminar etapa ${e.orden}`}
                      title={minEtapas ? 'Mínimo 3 etapas' : 'Eliminar etapa'}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 text-sm leading-snug">{e.titulo}</h3>
                <p className="text-xs text-gray-600 leading-relaxed">{e.descripcion}</p>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-600 mb-1.5">Punto de dolor</p>
                  <ul className="space-y-1">
                    {e.puntosDeDolor.map((d, i) => (
                      <li
                        key={i}
                        className={`text-xs rounded-lg border px-2.5 py-1.5 leading-snug ${pain}`}
                      >
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
                {(e.canalesDeMarketing || '') && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50/70 px-3 py-2.5 text-xs leading-relaxed">
                    <p className="font-semibold text-[10px] uppercase tracking-wide text-violet-600 mb-1">Canales de marketing</p>
                    <p className="text-violet-900">{e.canalesDeMarketing}</p>
                  </div>
                )}
                <div className={`rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${webBox}`}>
                  <p className="font-semibold text-[10px] uppercase tracking-wide opacity-80 mb-1">Oportunidad web</p>
                  <p>{e.rolWebFrenteAlPov}</p>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-1 hidden sm:block">
          Desplaza horizontalmente para ver todas las etapas →
        </p>
      </div>
    </section>
  )
}

type EditEtapaDraft = {
  titulo: string
  descripcion: string
  doloresText: string
  canalesMarketing: string
  rolWeb: string
  esClave: boolean
}

function EtapaEditModal({
  open,
  title,
  draft,
  onChange,
  onSave,
  onClose,
  accent,
  rolCampoLabel,
  clavePovCheckboxLabel,
}: {
  open: boolean
  title: string
  draft: EditEtapaDraft | null
  onChange: (d: EditEtapaDraft) => void
  onSave: () => void
  onClose: () => void
  accent: 'teal' | 'orange'
  rolCampoLabel: string
  clavePovCheckboxLabel: string
}) {
  if (!open || !draft) return null
  const ring = accent === 'teal' ? 'focus:ring-teal-200' : 'focus:ring-orange-200'
  const saveCls =
    accent === 'teal'
      ? 'rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700'
      : 'rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="journey-etapa-edit-title"
        className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(ev) => ev.stopPropagation()}
      >
        <h2 id="journey-etapa-edit-title" className="text-base font-semibold text-gray-900">
          {title}
        </h2>
        <div className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-gray-500">Título</span>
            <input
              type="text"
              value={draft.titulo}
              onChange={(e) => onChange({ ...draft, titulo: e.target.value })}
              maxLength={72}
              className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-gray-500">Descripción</span>
            <AutoTextarea
              value={draft.descripcion}
              onChange={(e) => onChange({ ...draft, descripcion: e.target.value })}
              rows={4}
              maxLength={420}
              className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-gray-500">Punto de dolor (uno por línea)</span>
            <AutoTextarea
              value={draft.doloresText}
              onChange={(e) => onChange({ ...draft, doloresText: e.target.value })}
              rows={4}
              maxLength={2000}
              className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 ${ring}`}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-gray-500">Canales de marketing</span>
            <AutoTextarea
              value={draft.canalesMarketing}
              onChange={(e) => onChange({ ...draft, canalesMarketing: e.target.value })}
              rows={2}
              maxLength={260}
              placeholder="Ej: Boca a boca / Instagram / WhatsApp"
              className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-gray-500">{rolCampoLabel}</span>
            <AutoTextarea
              value={draft.rolWeb}
              onChange={(e) => onChange({ ...draft, rolWeb: e.target.value })}
              rows={3}
              maxLength={260}
              className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 ${ring}`}
            />
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.esClave}
              onChange={(e) => onChange({ ...draft, esClave: e.target.checked })}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">{clavePovCheckboxLabel}</span>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="button" onClick={() => onSave()} className={saveCls}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}

export function UserJourneyPage({ businessName }: { businessName: string }) {
  const [persist, setPersist] = useState<UserJourneyV3Persist | null>(null)
  const [segmento, setSegmento] = useState<UserJourneySegmento>('clienteActual')
  const [nuevoCanalLabel, setNuevoCanalLabel] = useState('')
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [depsOk, setDepsOk] = useState({ persona: false, pov: false })
  const [sintesisLoading, setSintesisLoading] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editOrden, setEditOrden] = useState(1)
  const [editDraft, setEditDraft] = useState<EditEtapaDraft | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [genAllProgress, setGenAllProgress] = useState<{
    current: number
    total: number
    segmento: UserJourneySegmento
    canalLabel: string
  } | null>(null)

  const segState = persist ? persist[segmento] : null
  const canalActivoId = segState?.canalActivoId ?? DEFAULT_USER_JOURNEY_CANAL_ID
  const journey = segState && segState.mapas[canalActivoId] ? segState.mapas[canalActivoId] : null
  const canalPrompt = segState
    ? getCanalPromptFields(canalActivoId, segState.catalogo)
    : getCanalPromptFields(DEFAULT_USER_JOURNEY_CANAL_ID, defaultJourneyCanalCatalogo())
  const isBaseChannel = canalActivoId === JOURNEY_BASE_CANAL_ID
  const clavePovLabel = isBaseChannel ? 'POV ↔ recorrido' : `POV ↔ ${canalPrompt.label}`
  const rolBloqueTitulo = isBaseChannel
    ? `${businessName} frente al POV (recorrido global)`
    : `${canalPrompt.label} y el POV`
  const clavePovCheckboxLabel = isBaseChannel
    ? `Momento clave: ${businessName} aporta más al POV en el recorrido`
    : `Esta etapa es el momento clave POV ↔ ${canalPrompt.label}`

  useEffect(() => {
    Promise.all([
      fetch('/api/user-journey-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/user-persona-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/pov-saved').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([jSaved, personaSaved, povSaved]) => {
        const filt = parseUserJourneySavedFilters(jSaved?.saved?.filters)
        let v3: UserJourneyV3Persist
        if (jSaved?.saved?.journey) {
          const p = parsePersistedJourneyCell(jSaved.saved.journey)
          v3 = p ? toJourneyV3(p) : createEmptyJourneyV3()
        } else {
          v3 = createEmptyJourneyV3()
        }
        v3 = withJourneyBaseInCatalogs(v3)
        v3 = applySavedFiltersToJourneyV3(v3, filt)
        setPersist(v3)
        if (filt.segmentoActivo === 'clientePotencial' || filt.segmentoActivo === 'clienteActual') {
          setSegmento(filt.segmentoActivo)
        }
        if (typeof jSaved?.saved?.savedAt === 'string') setSavedAt(jSaved.saved.savedAt)
        setDepsOk({
          persona: hasValidPersonasSaved(personaSaved?.saved?.personas),
          pov: hasValidPovSaved(povSaved?.saved?.statements),
        })
      })
      .finally(() => setLoadingSaved(false))
  }, [])

  const buildFilters = (p: UserJourneyV3Persist, seg: UserJourneySegmento) => ({
    fuente: 'user-persona+pov+hmw',
    segmentoActivo: seg,
    canalPorSegmento: {
      clienteActual: p.clienteActual.canalActivoId,
      clientePotencial: p.clientePotencial.canalActivoId,
    },
  })

  const savePersist = async (data: UserJourneyV3Persist, segForFilter: UserJourneySegmento = segmento) => {
    setSaving(true)
    setSaveError(null)
    try {
      const r = await fetch('/api/user-journey-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journey: data,
          filters: buildFilters(data, segForFilter),
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(typeof d.error === 'string' ? d.error : 'Error al guardar en Sheets')
      if (d.savedAt) setSavedAt(d.savedAt)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar en Sheets')
    }
    setSaving(false)
  }

  /**
   * Guarda solo el journey del canal activo (POST incremental).
   * Preserva el resto de canales ya guardados en Sheets.
   */
  const saveCanalPersist = async (
    data: UserJourneyV3Persist,
    seg: UserJourneySegmento,
    canalId: string
  ) => {
    const journey = data[seg].mapas[canalId]
    if (!journey) return
    setSaving(true)
    setSaveError(null)
    try {
      const r = await fetch('/api/user-journey-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'canal',
          segmento: seg,
          canalId,
          journey,
          meta: {
            clienteActual: {
              canalActivoId: data.clienteActual.canalActivoId,
              catalogo: data.clienteActual.catalogo,
            },
            clientePotencial: {
              canalActivoId: data.clientePotencial.canalActivoId,
              catalogo: data.clientePotencial.catalogo,
            },
            filters: buildFilters(data, seg),
          },
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(typeof d.error === 'string' ? d.error : 'Error al guardar en Sheets')
      if (d.savedAt) setSavedAt(d.savedAt)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar en Sheets')
    }
    setSaving(false)
  }

  const handleSelectSegment = async (s: UserJourneySegmento) => {
    setSegmento(s)
    if (persist) await savePersist(persist, s)
  }

  const handleSelectCanal = async (id: string) => {
    if (!persist) return
    const seg = persist[segmento]
    const nid = normalizeCanalInCatalog(id, seg.catalogo)
    const next: UserJourneyV3Persist = {
      ...persist,
      [segmento]: { ...seg, canalActivoId: nid },
    }
    setPersist(next)
    await savePersist(next)
  }

  const handleAddCustomCanal = async () => {
    if (!persist) return
    const label = nuevoCanalLabel.trim()
    if (!label) return
    const id = newCustomJourneyCanalId()
    const seg = persist[segmento]
    const next: UserJourneyV3Persist = {
      ...persist,
      [segmento]: {
        ...seg,
        catalogo: [...seg.catalogo, { id, label, esPreset: false }],
        canalActivoId: id,
        mapas: { ...seg.mapas },
      },
    }
    setNuevoCanalLabel('')
    setPersist(next)
    await savePersist(next)
  }

  const handleRemoveCanal = async (canalId: string) => {
    if (!persist) return
    const seg = persist[segmento]
    const canal = seg.catalogo.find((c) => c.id === canalId)
    if (!canal || !isRemovableCustomCanal(canal)) return
    if (!window.confirm(`¿Eliminar el canal «${canal.label}»? Se borrará también el mapa guardado para este canal en este segmento.`)) {
      return
    }
    const newCatalogo = seg.catalogo.filter((c) => c.id !== canalId)
    const newMapas = { ...seg.mapas }
    delete newMapas[canalId]
    const preferido =
      seg.canalActivoId === canalId ? JOURNEY_BASE_CANAL_ID : seg.canalActivoId
    const canalActivoId = normalizeCanalInCatalog(preferido, newCatalogo)
    const next: UserJourneyV3Persist = {
      ...persist,
      [segmento]: {
        ...seg,
        catalogo: newCatalogo,
        canalActivoId,
        mapas: newMapas,
      },
    }
    setPersist(next)
    await savePersist(next)
  }

  const commitJourney = async (nextJourney: JourneyForPersona) => {
    if (!persist) return
    const seg = persist[segmento]
    const cid = seg.canalActivoId
    const next: UserJourneyV3Persist = {
      ...persist,
      [segmento]: {
        ...seg,
        mapas: { ...seg.mapas, [cid]: nextJourney },
      },
    }
    setPersist(next)
    await saveCanalPersist(next, segmento, cid)
  }

  const regenerateSintesis = async () => {
    if (!journey) return
    setSintesisLoading(true)
    try {
      const res = await fetch('/api/user-journey-sintesis-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journey, canalEtiqueta: canalPrompt.label }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        window.alert(typeof d.error === 'string' ? d.error : 'No se pudo generar la síntesis.')
        return
      }
      if (typeof d.sintesis !== 'string' || !d.sintesis.trim()) {
        window.alert('La IA no devolvió una síntesis válida.')
        return
      }
      await commitJourney({ ...journey, sintesis: d.sintesis.trim().slice(0, 300) })
    } catch {
      window.alert('Error de red al generar la síntesis.')
    } finally {
      setSintesisLoading(false)
    }
  }

  const openEditEtapa = (orden: number) => {
    if (!journey) return
    const e = journey.etapas.find((x) => x.orden === orden)
    if (!e) return
    setEditOrden(orden)
    setEditDraft({
      titulo: e.titulo,
      descripcion: e.descripcion,
      doloresText: e.puntosDeDolor.join('\n'),
      canalesMarketing: e.canalesDeMarketing ?? '',
      rolWeb: e.rolWebFrenteAlPov,
      esClave: e.orden === journey.etapaOrdenPovResuelto,
    })
    setEditOpen(true)
  }

  const saveEditEtapa = async () => {
    if (!journey || !editDraft) return
    const dolores = editDraft.doloresText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const finalDolores = dolores.length ? dolores : ['(Sin dolor indicado)']
    let etapaOrdenPovResuelto = journey.etapaOrdenPovResuelto
    if (editDraft.esClave) {
      etapaOrdenPovResuelto = editOrden
    } else if (etapaOrdenPovResuelto === editOrden) {
      etapaOrdenPovResuelto = journey.etapas[0]?.orden ?? 1
    }
    const etapas = journey.etapas.map((e) =>
      e.orden === editOrden
        ? {
            ...e,
            titulo: editDraft.titulo.trim().slice(0, 72) || e.titulo,
            descripcion: editDraft.descripcion.trim().slice(0, 420),
            puntosDeDolor: finalDolores.map((t) => t.slice(0, 140)).slice(0, 5),
            canalesDeMarketing: editDraft.canalesMarketing.trim().slice(0, 260),
            rolWebFrenteAlPov: editDraft.rolWeb.trim().slice(0, 260),
          }
        : e
    )
    const nextJ: JourneyForPersona = { ...journey, etapas, etapaOrdenPovResuelto }
    if (!etapas.some((e) => e.orden === etapaOrdenPovResuelto)) {
      nextJ.etapaOrdenPovResuelto = etapas[0]!.orden
    }
    setEditOpen(false)
    setEditDraft(null)
    await commitJourney(nextJ)
  }

  const deleteEtapa = async (orden: number) => {
    if (!journey) return
    const nextJ = deleteEtapaFromJourney(journey, orden)
    if (!nextJ) return
    await commitJourney(nextJ)
  }

  const generate = async () => {
    if (!persist) return
    const seg = persist[segmento]
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/user-journey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canalId: seg.canalActivoId,
          segmento,
          catalogo: seg.catalogo,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'No se pudo generar el User Journey Map.')
        return
      }
      if (!isJourneyForPersona(d.journey)) {
        setGenError('La respuesta de la IA no tenía el formato esperado.')
        return
      }
      const next: UserJourneyV3Persist = {
        ...persist,
        [segmento]: {
          ...seg,
          mapas: { ...seg.mapas, [seg.canalActivoId]: d.journey },
        },
      }
      setPersist(next)
      await saveCanalPersist(next, segmento, seg.canalActivoId)
    } catch {
      setGenError('No se pudo generar el mapa. Inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  /**
   * Genera journeys para todos los canales de ambos segmentos.
   * Si regenerate=false, solo genera los que aún no tienen mapa.
   */
  const generateAll = async (regenerate: boolean) => {
    if (!persist) return
    const pairs: Array<{ segmento: UserJourneySegmento; canalId: string; canalLabel: string }> = []
    for (const seg of ['clienteActual', 'clientePotencial'] as const) {
      for (const canal of persist[seg].catalogo) {
        if (regenerate || !persist[seg].mapas[canal.id]) {
          pairs.push({ segmento: seg, canalId: canal.id, canalLabel: canal.label })
        }
      }
    }
    if (!pairs.length) return

    setGeneratingAll(true)
    setGenError(null)
    setSaveError(null)

    let currentPersist = persist
    const errors: string[] = []

    for (let i = 0; i < pairs.length; i++) {
      const { segmento: seg, canalId, canalLabel } = pairs[i]
      setGenAllProgress({ current: i + 1, total: pairs.length, segmento: seg, canalLabel })
      try {
        const segState = currentPersist[seg]
        const res = await fetch('/api/user-journey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canalId, segmento: seg, catalogo: segState.catalogo }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok || !isJourneyForPersona(d.journey)) {
          errors.push(
            `${seg === 'clienteActual' ? 'Cliente actual' : 'Cliente potencial'} · ${canalLabel}`
          )
          continue
        }
        currentPersist = {
          ...currentPersist,
          [seg]: {
            ...currentPersist[seg],
            mapas: { ...currentPersist[seg].mapas, [canalId]: d.journey },
          },
        }
        setPersist(currentPersist)
        await saveCanalPersist(currentPersist, seg, canalId)
      } catch {
        errors.push(
          `${seg === 'clienteActual' ? 'Cliente actual' : 'Cliente potencial'} · ${canalLabel}`
        )
      }
    }

    setGenAllProgress(null)
    setGeneratingAll(false)
    if (errors.length > 0) {
      setGenError(`No se pudieron generar: ${errors.join(', ')}`)
    }
  }

  const prereqOk = depsOk.persona && depsOk.pov

  if (loadingSaved || !persist) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    )
  }

  const panelPersist = persist
  const segLabel = segmento === 'clienteActual' ? 'Cliente actual' : 'Cliente potencial'
  const accent = segmento === 'clienteActual' ? 'teal' : 'orange'

  // Cuenta cuántos canales faltan en total (ambos segmentos)
  const missingCount =
    persist.clienteActual.catalogo.filter((c) => !persist.clienteActual.mapas[c.id]).length +
    persist.clientePotencial.catalogo.filter((c) => !persist.clientePotencial.mapas[c.id]).length
  const totalCount =
    persist.clienteActual.catalogo.length + persist.clientePotencial.catalogo.length

  const batchBar = prereqOk ? (
    generatingAll && genAllProgress ? (
      <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-3 flex items-center gap-3">
        <span className="inline-block h-4 w-4 border-2 border-teal-400 border-t-transparent rounded-full animate-spin shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-teal-900">
            Generando todos los mapas ({genAllProgress.current}/{genAllProgress.total})
          </p>
          <p className="text-xs text-teal-700 mt-0.5">
            {genAllProgress.segmento === 'clienteActual' ? 'Cliente actual' : 'Cliente potencial'}{' '}
            · {genAllProgress.canalLabel}
          </p>
        </div>
      </div>
    ) : (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void generateAll(false)}
          disabled={generatingAll || generating || missingCount === 0}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full bg-teal-600 text-white font-semibold hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-40 disabled:pointer-events-none"
        >
          ✦ Generar los que faltan
          {missingCount > 0 && (
            <span className="bg-white/25 rounded-full px-1.5 py-0.5 text-[10px] font-bold">
              {missingCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => void generateAll(true)}
          disabled={generatingAll || generating || totalCount === 0}
          className="inline-flex items-center gap-1.5 text-xs px-4 py-2 rounded-full border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          ↺ Regenerar todos
          <span className="text-gray-400 text-[10px]">({totalCount})</span>
        </button>
      </div>
    )
  ) : null

  if (generating) {
    return (
      <div className="space-y-5 py-4">
        <SegmentCanalPanel
          persist={panelPersist}
          segmento={segmento}
          nuevoCanalLabel=""
          onNuevoCanalLabel={() => {}}
          onSelectSegment={() => {}}
          onSelectCanal={() => {}}
          onAddCustomCanal={() => {}}
          onRemoveCanal={() => {}}
          disabled
        />
        <div className="text-center space-y-2 py-4">
          <div className="inline-block h-6 w-6 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">
            Generando mapa para <strong>{segLabel}</strong> en <strong>{canalPrompt.label}</strong>…
          </p>
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (genError) {
    return (
      <div className="space-y-4">
        <SegmentCanalPanel
          persist={panelPersist}
          segmento={segmento}
          nuevoCanalLabel={nuevoCanalLabel}
          onNuevoCanalLabel={setNuevoCanalLabel}
          onSelectSegment={(s) => void handleSelectSegment(s)}
          onSelectCanal={(id) => void handleSelectCanal(id)}
          onAddCustomCanal={() => void handleAddCustomCanal()}
          onRemoveCanal={(id) => void handleRemoveCanal(id)}
        />
        {batchBar}
        <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-red-600">{genError}</p>
          <button
            type="button"
            onClick={() => void generate()}
            className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  const intro = (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 space-y-2">
      <p>
        El mapa se basa <strong>principalmente en el HMW</strong> del segmento elegido; <strong>POV</strong> y{' '}
        <strong>User Persona</strong> complementan. Genera <strong>un mapa por segmento y canal</strong> (puedes
        añadir canales propios solo en ese tipo de cliente).
      </p>
      <p className="text-xs text-gray-500">
        Requiere{' '}
        <Link href="/hmw" className="font-semibold text-teal-700 underline underline-offset-2">
          HMW
        </Link>{' '}
        con ideas con texto,{' '}
        <Link href="/user-persona" className="font-semibold text-teal-700 underline underline-offset-2">
          User Persona
        </Link>{' '}
        y{' '}
        <Link href="/pov" className="font-semibold text-teal-700 underline underline-offset-2">
          POV
        </Link>
        .
      </p>
    </div>
  )

  if (!journey) {
    return (
      <div className="space-y-5">
        <SegmentCanalPanel
          persist={panelPersist}
          segmento={segmento}
          nuevoCanalLabel={nuevoCanalLabel}
          onNuevoCanalLabel={setNuevoCanalLabel}
          onSelectSegment={(s) => void handleSelectSegment(s)}
          onSelectCanal={(id) => void handleSelectCanal(id)}
          onAddCustomCanal={() => void handleAddCustomCanal()}
          onRemoveCanal={(id) => void handleRemoveCanal(id)}
          disabled={generatingAll}
        />
        {batchBar}
        {intro}
        {(!depsOk.persona || !depsOk.pov) && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-medium">Faltan datos guardados</p>
            <ul className="text-xs list-disc pl-4 space-y-1">
              {!depsOk.persona && <li>User Persona (ambos segmentos) guardados.</li>}
              {!depsOk.pov && <li>Los dos POV guardados.</li>}
            </ul>
          </div>
        )}
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-12 text-center space-y-4">
          <p className="text-sm text-gray-600">
            No hay mapa guardado para <strong>{segLabel}</strong> en <strong>{canalPrompt.label}</strong>.
          </p>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={!prereqOk}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-45 disabled:pointer-events-none"
          >
            ✦ Generar mapa
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <SegmentCanalPanel
        persist={panelPersist}
        segmento={segmento}
        nuevoCanalLabel={nuevoCanalLabel}
        onNuevoCanalLabel={setNuevoCanalLabel}
        onSelectSegment={(s) => void handleSelectSegment(s)}
        onSelectCanal={(id) => void handleSelectCanal(id)}
        onAddCustomCanal={() => void handleAddCustomCanal()}
        onRemoveCanal={(id) => void handleRemoveCanal(id)}
        disabled={generatingAll}
      />
      {batchBar}
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 flex flex-wrap items-center justify-between gap-2">
        <p>
          <strong>{segLabel}</strong> · canal <strong>{canalPrompt.label}</strong>. Fuente principal:{' '}
          <Link href="/hmw" className="font-semibold text-teal-700 underline underline-offset-2">
            HMW
          </Link>
          ; complemento:{' '}
          <Link href="/pov" className="font-semibold text-teal-700 underline underline-offset-2">
            POV
          </Link>{' '}
          +{' '}
          <Link href="/user-persona" className="font-semibold text-teal-700 underline underline-offset-2">
            User Persona
          </Link>
          .
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {saving ? (
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-3 w-3 border border-gray-300 border-t-teal-500 rounded-full animate-spin" />
                Guardando…
              </span>
            ) : saveError ? (
              <span className="text-red-500" title={saveError}>⚠ Error al guardar en Sheets</span>
            ) : savedAt ? (
              <span className="text-green-600">✓ Sheets · {savedAt}</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generatingAll}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            ↺ Regenerar este mapa
          </button>
        </div>
      </div>

      <JourneyMapSection
        journey={journey}
        segmentLabel={segLabel}
        accent={accent}
        sintesisLoading={sintesisLoading}
        onRegenerateSintesis={() => void regenerateSintesis()}
        onEditEtapa={(orden) => openEditEtapa(orden)}
        onDeleteEtapa={(orden) => void deleteEtapa(orden)}
        clavePovLabel={clavePovLabel}
      />

      <UserJourneyIdeasSection persist={panelPersist} segmento={segmento} businessName={businessName} />

      <EtapaEditModal
        open={editOpen}
        title={`Editar etapa ${editOrden}`}
        draft={editDraft}
        onChange={setEditDraft}
        onSave={() => void saveEditEtapa()}
        onClose={() => {
          setEditOpen(false)
          setEditDraft(null)
        }}
        accent={accent}
        rolCampoLabel={rolBloqueTitulo}
        clavePovCheckboxLabel={clavePovCheckboxLabel}
      />
    </div>
  )
}
