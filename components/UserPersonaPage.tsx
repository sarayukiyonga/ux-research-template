'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { AutoTextarea } from '@/components/ui/auto-textarea'
import { UserPersonaInsightsSource } from '@/components/UserPersonaInsightsSource'
import { readSegmentSurveyFilters, segmentFiltersToApi } from '@/lib/segment-survey-filters'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Personalidad {
  introvertidoExtrovertido: number
  pensamientoSentimiento: number
  organizadoEspontaneo: number
  seguroInseguro: number
  intuitivoObservador: number
}

interface HabilidadesTecnicas {
  internet: number
  redesSociales: number
  comprasOnline: number
}

interface Persona {
  nombre: string
  genero: 'mujer' | 'hombre' | 'no_binario'
  edad: number
  educacion: string
  ubicacion: string
  ocupacion: string
  tags: string[]
  frase: string
  motivaciones: string[]
  necesidades: string[]
  puntosDeDolor: string[]
  personalidad: Personalidad
  habilidadesTecnicas: HabilidadesTecnicas
  /** Medios que usa para informarse o resolver necesidades (encuesta + insights; editable). */
  canalesBusquedaSolucion?: string[]
}

interface UserPersonas {
  clienteActual: Persona
  clientePotencial: Persona
}

function normalizePersona(raw: Record<string, unknown>): Persona {
  const p = raw as unknown as Persona
  const c = raw.canalesBusquedaSolucion
  const canalesBusquedaSolucion = Array.isArray(c)
    ? c
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 12)
    : []
  return { ...p, canalesBusquedaSolucion }
}

function normalizePersonasPayload(raw: unknown): UserPersonas | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (!o.clienteActual || !o.clientePotencial || typeof o.clienteActual !== 'object' || typeof o.clientePotencial !== 'object')
    return null
  return {
    clienteActual: normalizePersona(o.clienteActual as Record<string, unknown>),
    clientePotencial: normalizePersona(o.clientePotencial as Record<string, unknown>),
  }
}

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

function linesToList(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function listToLines(arr: string[]): string {
  return arr.join('\n')
}

function PersonaInlineEditor({
  draft,
  onChange,
  accent,
}: {
  draft: Persona
  onChange: (next: Persona) => void
  accent: string
}) {
  const patch = (partial: Partial<Persona>) => onChange({ ...draft, ...partial })

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[10px] font-medium text-gray-500">Nombre</span>
          <input
            type="text"
            value={draft.nombre}
            onChange={(e) => patch({ nombre: e.target.value.slice(0, 80) })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-medium text-gray-500">Edad</span>
          <input
            type="number"
            min={18}
            max={99}
            value={draft.edad}
            onChange={(e) => patch({ edad: Math.min(99, Math.max(18, parseInt(e.target.value, 10) || 18)) })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-medium text-gray-500">Género (persona)</span>
          <select
            value={draft.genero}
            onChange={(e) => patch({ genero: e.target.value as Persona['genero'] })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
          >
            <option value="mujer">Mujer</option>
            <option value="hombre">Hombre</option>
            <option value="no_binario">No binario</option>
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[10px] font-medium text-gray-500">Frase (1ª persona)</span>
          <AutoTextarea
            value={draft.frase}
            onChange={(e) => patch({ frase: e.target.value.slice(0, 130) })}
            rows={2}
            maxLength={130}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-medium text-gray-500">Educación</span>
          <input
            type="text"
            value={draft.educacion}
            onChange={(e) => patch({ educacion: e.target.value.slice(0, 120) })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-medium text-gray-500">Ubicación</span>
          <input
            type="text"
            value={draft.ubicacion}
            onChange={(e) => patch({ ubicacion: e.target.value.slice(0, 120) })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[10px] font-medium text-gray-500">Ocupación</span>
          <input
            type="text"
            value={draft.ocupacion}
            onChange={(e) => patch({ ocupacion: e.target.value.slice(0, 120) })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[10px] font-medium text-gray-500">Tags (coma entre cada uno)</span>
          <input
            type="text"
            value={draft.tags.join(', ')}
            onChange={(e) =>
              patch({
                tags: e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean)
                  .slice(0, 8)
                  .map((t) => t.slice(0, 20)),
              })
            }
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1">
          <span className="text-[10px] font-medium text-gray-500">Motivaciones (una por línea)</span>
          <AutoTextarea
            value={listToLines(draft.motivaciones)}
            onChange={(e) => patch({ motivaciones: linesToList(e.target.value).slice(0, 8) })}
            rows={5}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-medium text-gray-500">Necesidades (una por línea)</span>
          <AutoTextarea
            value={listToLines(draft.necesidades)}
            onChange={(e) => patch({ necesidades: linesToList(e.target.value).slice(0, 8) })}
            rows={5}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-[10px] font-medium text-gray-500">Puntos de dolor (uno por línea)</span>
          <AutoTextarea
            value={listToLines(draft.puntosDeDolor)}
            onChange={(e) => patch({ puntosDeDolor: linesToList(e.target.value).slice(0, 8) })}
            rows={5}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs font-mono"
          />
        </label>
      </div>

      <div className="rounded-xl border border-gray-100 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Personalidad (1–5)</p>
        <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
          {(
            [
              ['introvertidoExtrovertido', 'Introvertido → Extrovertido'],
              ['pensamientoSentimiento', 'Analítico → Emocional'],
              ['organizadoEspontaneo', 'Organizado → Espontáneo'],
              ['seguroInseguro', 'Seguro → Ansioso'],
              ['intuitivoObservador', 'Intuitivo → Observador'],
            ] as const
          ).map(([key, lab]) => (
            <label key={key} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-[10px] leading-tight">{lab}</span>
              <input
                type="range"
                min={1}
                max={5}
                value={draft.personalidad[key]}
                onChange={(e) => {
                  const v = Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 3))
                  patch({
                    personalidad: {
                      ...draft.personalidad,
                      [key]: v,
                    },
                  })
                }}
                className="flex-1 accent-violet-600"
                style={{ accentColor: accent }}
              />
              <span className="w-4 text-center font-mono text-[10px]">{draft.personalidad[key]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Habilidades técnicas (1–5)</p>
        {(['internet', 'redesSociales', 'comprasOnline'] as const).map((key) => (
          <label key={key} className="flex items-center gap-3 text-xs text-gray-600">
            <span className="w-32 shrink-0 capitalize">{key === 'redesSociales' ? 'Redes sociales' : key === 'comprasOnline' ? 'Compras online' : 'Internet'}</span>
            <input
              type="range"
              min={1}
              max={5}
              value={draft.habilidadesTecnicas[key]}
              onChange={(e) =>
                patch({
                  habilidadesTecnicas: {
                    ...draft.habilidadesTecnicas,
                    [key]: parseInt(e.target.value, 10),
                  },
                })
              }
              className="flex-1"
              style={{ accentColor: accent }}
            />
            <span className="w-4 text-center font-mono text-[10px]">{draft.habilidadesTecnicas[key]}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

const SUGERENCIAS_CANALES_BUSQUEDA = [
  'Búsqueda web / Google',
  'Instagram u otras redes',
  'Recomendación médica o fisioterapeuta',
  'Boca a boca / conocidos',
  'WhatsApp',
  'Email o newsletter',
  'Centro o gimnasio cercano',
  'Llamada telefónica',
]

// ── Trait bar component ─────────────────────────────────────────────────────────

function TraitBar({
  label,
  leftLabel,
  rightLabel,
  value,
  color,
}: {
  label?: string
  leftLabel: string
  rightLabel: string
  value: number  // 1–5
  color: string
}) {
  const pct = ((value - 1) / 4) * 100
  return (
    <div className="space-y-0.5">
      {label && <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 w-16 text-right shrink-0">{leftLabel}</span>
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 relative">
          <div
            className="absolute top-0 h-1.5 rounded-full transition-all"
            style={{ left: `${pct}%`, width: 8, height: 8, marginTop: -3, marginLeft: -4, backgroundColor: color }}
          />
          <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(to right, ${color}22, ${color}44)` }} />
        </div>
        <span className="text-[10px] text-gray-500 w-16 shrink-0">{rightLabel}</span>
      </div>
    </div>
  )
}

// ── Tech skill dots ─────────────────────────────────────────────────────────────

function SkillDots({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-600 truncate">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-2.5 w-2.5 rounded-full border"
            style={{
              backgroundColor: i < value ? color : 'transparent',
              borderColor: i < value ? color : '#d1d5db',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Persona card ───────────────────────────────────────────────────────────────

const AVATAR_EMOJIS: Record<string, string> = {
  mujer: '👩',
  hombre: '👨',
  no_binario: '🧑',
}

function PersonaCanalesSection({
  items,
  accent,
  onChange,
}: {
  items: string[]
  accent: string
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const addOne = (raw: string) => {
    const t = raw.trim().slice(0, 80)
    if (!t || items.includes(t) || items.length >= 12) return
    onChange([...items, t])
    setDraft('')
  }
  const removeAt = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx))
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1">
          📡 Canales para buscar soluciones
        </p>
        <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
          Dónde se informa o busca ayuda para cubrir sus necesidades (basado en encuesta e insights; puedes afinar la
          lista).
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((c, i) => (
          <span
            key={`${c}-${i}`}
            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-[11px] font-medium border border-gray-200 bg-white text-gray-800"
          >
            {c}
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="rounded-full p-0.5 text-gray-400 hover:text-red-600 hover:bg-red-50"
              aria-label={`Quitar ${c}`}
            >
              ×
            </button>
          </span>
        ))}
        {items.length === 0 ? <span className="text-xs text-gray-400 italic">Ninguno definido — añade desde sugerencias o texto libre.</span> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] text-gray-400 w-full">Sugerencias rápidas</span>
        {SUGERENCIAS_CANALES_BUSQUEDA.map((s) => (
          <button
            key={s}
            type="button"
            disabled={items.includes(s) || items.length >= 12}
            onClick={() => addOne(s)}
            className="text-[10px] rounded-full px-2 py-1 border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-35"
          >
            + {s}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="flex-1 min-w-40 space-y-1">
          <span className="text-[10px] font-medium text-gray-500">Añadir canal (texto libre)</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOne(draft)
              }
            }}
            maxLength={80}
            placeholder="p. ej. Grupo de Facebook local"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs"
          />
        </label>
        <button
          type="button"
          disabled={!draft.trim() || items.length >= 12}
          onClick={() => addOne(draft)}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          style={{ backgroundColor: accent }}
        >
          Añadir
        </button>
      </div>
    </div>
  )
}

function PersonaCard({
  persona,
  type,
  onSavePersona,
}: {
  persona: Persona
  type: 'clienteActual' | 'clientePotencial'
  onSavePersona?: (p: Persona) => void
}) {
  const isClient = type === 'clienteActual'
  const accent = isClient ? '#7c3aed' : '#ea580c'
  const accentLight = isClient ? '#ede9fe' : '#ffedd5'
  const accentText = isClient ? 'text-violet-700' : 'text-orange-600'
  const accentBorder = isClient ? 'border-violet-200' : 'border-orange-200'
  const label = isClient ? 'Cliente actual' : 'Cliente potencial'
  const canales = persona.canalesBusquedaSolucion ?? []

  const [draft, setDraft] = useState<Persona | null>(null)
  const canalesEditRef = useRef<HTMLDivElement>(null)
  const didScrollToCanales = useRef(false)

  const startEdit = () => {
    didScrollToCanales.current = false
    const raw = JSON.parse(JSON.stringify(persona)) as Persona
    setDraft({
      ...raw,
      canalesBusquedaSolucion: [...(raw.canalesBusquedaSolucion ?? [])],
    })
  }

  useEffect(() => {
    if (!draft) {
      didScrollToCanales.current = false
      return
    }
    if (didScrollToCanales.current) return
    didScrollToCanales.current = true
    requestAnimationFrame(() => {
      canalesEditRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [draft])

  const handleSaveEdit = () => {
    if (!draft || !onSavePersona) return
    if (draft.motivaciones.length < 1 || draft.necesidades.length < 1 || draft.puntosDeDolor.length < 1) {
      window.alert('Motivaciones, necesidades y puntos de dolor deben tener al menos una línea cada una.')
      return
    }
    if (draft.tags.length < 1) {
      window.alert('Añade al menos un tag (separados por coma).')
      return
    }
    if (!draft.nombre.trim()) {
      window.alert('El nombre no puede estar vacío.')
      return
    }
    onSavePersona(draft)
    setDraft(null)
  }

  const cancelEdit = () => setDraft(null)

  return (
    <div className={`rounded-2xl border-2 ${accentBorder} bg-white overflow-hidden`}>
      <div className="px-5 py-3 flex items-center justify-between gap-2 flex-wrap" style={{ backgroundColor: accentLight }}>
        <span className={`text-xs font-semibold uppercase tracking-wider ${accentText}`}>
          {label}
          {draft ? <span className="font-normal text-gray-500 normal-case"> · editando</span> : null}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {draft ? (
            <>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="text-xs font-semibold rounded-lg px-3 py-1.5 text-white shadow-sm hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="text-xs font-medium rounded-lg px-3 py-1.5 border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              {onSavePersona ? (
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center justify-center rounded-lg p-2 text-gray-500 border border-transparent hover:bg-white/70 hover:text-gray-900 hover:border-gray-200/80 transition-colors"
                  aria-label="Editar perfil"
                  title="Editar perfil"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              ) : null}
              <span className="text-xs text-gray-400">
                {persona.edad} años · {persona.ubicacion}
              </span>
            </>
          )}
        </div>
      </div>

      {draft ? (
        <div className="p-5 space-y-5">
          <div ref={canalesEditRef} className="scroll-mt-4">
            <p className="text-[11px] font-medium text-gray-500 mb-2">
              Canales para buscar soluciones — edita aquí o más abajo el resto del perfil; todo se guarda con
              &nbsp;<strong className="text-gray-700">Guardar</strong>.
            </p>
            <PersonaCanalesSection
              items={draft.canalesBusquedaSolucion ?? []}
              accent={accent}
              onChange={(nextCanales) =>
                setDraft((d) => (d ? { ...d, canalesBusquedaSolucion: nextCanales } : null))
              }
            />
          </div>
          <PersonaInlineEditor draft={draft} onChange={setDraft} accent={accent} />
        </div>
      ) : (
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <div
                  className="h-20 w-20 rounded-full flex items-center justify-center text-4xl border-4 border-white shadow-md"
                  style={{ backgroundColor: accentLight }}
                >
                  {AVATAR_EMOJIS[persona.genero] ?? '🧑'}
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{persona.nombre}</p>
                  <p className="text-xs text-gray-500 mt-0.5 italic leading-snug max-w-[180px]">
                    &ldquo;{persona.frase}&rdquo;
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 p-3 space-y-1.5 text-xs">
                <DataRow icon="🎂" label="Edad" value={`${persona.edad} años`} />
                <DataRow icon="🎓" label="Estudios" value={persona.educacion} />
                <DataRow icon="📍" label="Ubicación" value={persona.ubicacion} />
                <DataRow icon="💼" label="Ocupación" value={persona.ocupacion} />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {persona.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                    style={{ backgroundColor: accentLight, color: accent, borderColor: `${accent}33` }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InsightBlock title="Motivaciones" items={persona.motivaciones} dotColor={accent} icon="⚡" />
              <InsightBlock title="Necesidades" items={persona.necesidades} dotColor={accent} icon="🎯" />
              <InsightBlock title="Puntos de dolor" items={persona.puntosDeDolor} dotColor="#ef4444" icon="😣" />

              <div className="space-y-4">
                <div className="rounded-xl border border-gray-100 p-3 space-y-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    🧠 Personalidad
                  </p>
                  <TraitBar leftLabel="Introvertido" rightLabel="Extrovertido" value={persona.personalidad.introvertidoExtrovertido} color={accent} />
                  <TraitBar leftLabel="Analítico" rightLabel="Emocional" value={persona.personalidad.pensamientoSentimiento} color={accent} />
                  <TraitBar leftLabel="Organizado" rightLabel="Espontáneo" value={persona.personalidad.organizadoEspontaneo} color={accent} />
                  <TraitBar leftLabel="Seguro" rightLabel="Ansioso" value={persona.personalidad.seguroInseguro} color={accent} />
                  <TraitBar leftLabel="Intuitivo" rightLabel="Observador" value={persona.personalidad.intuitivoObservador} color={accent} />
                </div>

                <div className="rounded-xl border border-gray-100 p-3 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                    💻 Habilidades técnicas
                  </p>
                  <SkillDots label="Internet" value={persona.habilidadesTecnicas.internet} color={accent} />
                  <SkillDots label="Redes sociales" value={persona.habilidadesTecnicas.redesSociales} color={accent} />
                  <SkillDots label="Compras online" value={persona.habilidadesTecnicas.comprasOnline} color={accent} />
                </div>
              </div>
            </div>
          </div>

          {canales.length > 0 ? (
            <div className="rounded-xl border border-gray-100 p-3 bg-gray-50/30">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                📡 Canales para buscar soluciones
              </p>
              <ul className="flex flex-wrap gap-2">
                {canales.map((c, i) => (
                  <li
                    key={`${i}-${c}`}
                    className="text-[11px] px-2 py-1 rounded-full bg-white border border-gray-100 text-gray-700"
                  >
                    {c}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-gray-400 mt-2">Pulsa el lápiz arriba para editar canales y el perfil.</p>
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic px-1">
              📡 Sin canales definidos — pulsa el lápiz para añadir por dónde busca soluciones.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function DataRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-sm shrink-0">{icon}</span>
      <span className="text-gray-400 shrink-0 w-16">{label}</span>
      <span className="text-gray-700 font-medium leading-snug">{value}</span>
    </div>
  )
}

function InsightBlock({ title, items, dotColor, icon }: { title: string; items: string[]; dotColor: string; icon: string }) {
  return (
    <div className="rounded-xl border border-gray-100 p-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {icon} {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
            <span
              className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Main page component ────────────────────────────────────────────────────────

function hasValidInsightsPayload(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false
  const o = data as Record<string, unknown>
  return (
    typeof o.resumen === 'string' &&
    o.resumen.trim().length > 0 &&
    Array.isArray(o.bloques) &&
    o.bloques.length > 0
  )
}

export function UserPersonaPage({
  businessName,
  ownerFirstName,
}: {
  businessName: string
  ownerFirstName: string
}) {
  const [personas, setPersonas] = useState<UserPersonas | null>(null)
  const [savedAt, setSavedAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [insightsClientesOk, setInsightsClientesOk] = useState(false)
  const [insightsPotencialesOk, setInsightsPotencialesOk] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/user-persona-saved').then((r) => r.json()).catch(() => ({})),
      fetch('/api/insights-survey-saved?segment=clientes').then((r) => r.json()).catch(() => ({})),
      fetch('/api/insights-survey-saved?segment=potenciales').then((r) => r.json()).catch(() => ({})),
    ])
      .then(([saved, ic, ip]) => {
        if (saved?.saved?.personas) {
          const n = normalizePersonasPayload(saved.saved.personas)
          if (n) setPersonas(n)
          setSavedAt(saved.saved.savedAt)
        }
        setInsightsClientesOk(hasValidInsightsPayload(ic?.saved?.data))
        setInsightsPotencialesOk(hasValidInsightsPayload(ip?.saved?.data))
      })
      .finally(() => setLoadingSaved(false))
  }, [])

  const savePersonas = async (data: UserPersonas) => {
    setSaving(true)
    try {
      const filters = {
        fuente: 'insights',
        clientes: segmentFiltersToApi(readSegmentSurveyFilters('clientes')),
        potenciales: segmentFiltersToApi(readSegmentSurveyFilters('potenciales')),
      }
      const r = await fetch('/api/user-persona-saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personas: data, filters }),
      })
      const d = await r.json()
      if (d.savedAt) setSavedAt(d.savedAt)
    } catch {}
    setSaving(false)
  }

  const savePersonaSegment = (seg: 'clienteActual' | 'clientePotencial', next: Persona) => {
    setPersonas((prev) => {
      if (!prev) return prev
      const merged: UserPersonas = { ...prev, [seg]: next }
      void savePersonas(merged)
      return merged
    })
  }

  const generate = async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/user-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filtersClientes: segmentFiltersToApi(readSegmentSurveyFilters('clientes')),
          filtersPotenciales: segmentFiltersToApi(readSegmentSurveyFilters('potenciales')),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setGenError(typeof d.error === 'string' ? d.error : 'No se pudieron generar los perfiles.')
        return
      }
      const personasPayload = normalizePersonasPayload(d)
      if (!personasPayload) {
        setGenError('La respuesta de la IA no tiene el formato esperado.')
        return
      }
      setPersonas(personasPayload)
      await savePersonas(personasPayload)
    } catch {
      setGenError('No se pudieron generar los perfiles. Inténtalo de nuevo.')
    } finally {
      setGenerating(false)
    }
  }

  // ── Loading ──

  if (loadingSaved) {
    return (
      <div className="space-y-4 py-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-3">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
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
          <div className="inline-block h-6 w-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Leyendo insights y construyendo los dos perfiles…</p>
        </div>
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border p-5 space-y-3">
            <Skeleton className="h-6 w-1/4" />
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
      <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="text-sm text-red-600">{genError}</p>
        <button
          onClick={generate}
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors self-start sm:self-auto"
        >
          Reintentar
        </button>
      </div>
    )
  }

  const canGeneratePersonas = insightsClientesOk && insightsPotencialesOk

  // ── Empty state ──

  if (!personas) {
    return (
      <div className="space-y-5">
        <UserPersonaInsightsSource variant="full" />
        {!canGeneratePersonas && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-2">
            <p className="font-medium">Faltan insights guardados</p>
            <p className="text-xs text-amber-800 leading-relaxed">
              Necesitas haber generado y guardado los insights en <strong>ambas</strong> pestañas antes de crear los user
              persona.
            </p>
            <ul className="text-xs space-y-1 list-disc list-inside text-amber-900">
              <li>
                Clientes actuales:{' '}
                {insightsClientesOk ? (
                  <span className="text-green-700 font-medium">listo</span>
                ) : (
                  <>
                    <span className="text-amber-800">pendiente</span> —{' '}
                    <Link href="/insights" className="underline font-medium">
                      Ir a Insights (clientes)
                    </Link>
                  </>
                )}
              </li>
              <li>
                Clientes potenciales:{' '}
                {insightsPotencialesOk ? (
                  <span className="text-green-700 font-medium">listo</span>
                ) : (
                  <>
                    <span className="text-amber-800">pendiente</span> —{' '}
                    <Link href="/insights?tab=potenciales" className="underline font-medium">
                      Ir a Insights (potenciales)
                    </Link>
                  </>
                )}
              </li>
            </ul>
          </div>
        )}
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-8 py-16 text-center space-y-4">
          <div className="text-5xl">👤</div>
          <div className="space-y-1">
            <p className="font-semibold text-gray-800">Genera los User Personas de {businessName}</p>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              La IA combina los <strong>insights guardados</strong> de cada segmento con la <strong>encuesta filtrada</strong>{' '}
              (edad, género, ocupación, muestras de respuestas y recuentos en potenciales) más la entrevista a{' '}
              {ownerFirstName}.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={!canGeneratePersonas}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-45 disabled:pointer-events-none"
          >
            ✦ Generar User Personas
          </button>
        </div>
      </div>
    )
  }

  // ── Results ──

  return (
    <div className="space-y-5">
      <UserPersonaInsightsSource variant="full" />

      {/* Header actions */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs text-gray-400 flex items-center gap-1.5">
          {saving ? (
            <>
              <span className="inline-block h-3 w-3 border border-gray-300 border-t-violet-400 rounded-full animate-spin" />
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

      {/* Persona cards */}
      <PersonaCard persona={personas.clienteActual} type="clienteActual" onSavePersona={(p) => savePersonaSegment('clienteActual', p)} />
      <PersonaCard persona={personas.clientePotencial} type="clientePotencial" onSavePersona={(p) => savePersonaSegment('clientePotencial', p)} />

      <div className="rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-violet-950">
          <p className="font-semibold text-violet-900">Siguiente paso</p>
          <p className="text-xs text-violet-800/90 mt-1 leading-relaxed">
            Define los <strong>POV</strong> (punto de vista) para cliente actual y potencial: encajan con las personas y
            los usarás en HMW, User Journey y User Flow.
          </p>
        </div>
        <Link
          href="/pov"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors"
        >
          Ir a POV →
        </Link>
      </div>
    </div>
  )
}
