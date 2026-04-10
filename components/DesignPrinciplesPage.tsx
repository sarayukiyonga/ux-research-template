'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Palette {
  name: string
  hex: string
  usage: string
}

interface Typography {
  heading: string
  body: string
  rationale: string
}

interface Moodboard {
  adjectives: string[]
  palette: Palette[]
  typography: Typography
  imageStyle: string
}

interface Principle {
  category: string
  icon: string
  title: string
  description: string
  guidelines: string[]
  color: string
  doExample: string
  dontExample: string
}

interface VoiceGuidelines {
  tone: string
  doWords: string[]
  dontWords: string[]
  exampleHeadline: string
  exampleCta: string
}

interface DesignData {
  moodboard: Moodboard
  principles: Principle[]
  voiceGuidelines: VoiceGuidelines
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border p-6 space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      ))}
    </div>
  )
}

function MoodboardSection({ data }: { data: Moodboard }) {
  return (
    <div className="space-y-6">
      {/* Adjectives */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Personalidad visual
        </h3>
        <div className="flex flex-wrap gap-2">
          {data.adjectives.map((adj) => (
            <span
              key={adj}
              className="rounded-full bg-violet-100 text-violet-800 px-3 py-1 text-sm font-medium"
            >
              {adj}
            </span>
          ))}
        </div>
      </div>

      {/* Palette */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Paleta de color
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {data.palette.map((c) => (
            <div key={c.hex} className="rounded-xl overflow-hidden border border-gray-100 shadow-sm">
              <div className="h-14 w-full" style={{ backgroundColor: c.hex }} />
              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-800">{c.name}</p>
                <p className="text-xs text-gray-400 font-mono">{c.hex}</p>
                <p className="text-xs text-gray-500 mt-1 leading-snug">{c.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Tipografía
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-100 p-4 bg-white">
            <p className="text-xs text-gray-400 mb-1">Títulos</p>
            <p className="text-lg font-bold text-gray-900">{data.typography.heading}</p>
          </div>
          <div className="rounded-xl border border-gray-100 p-4 bg-white">
            <p className="text-xs text-gray-400 mb-1">Cuerpo de texto</p>
            <p className="text-base text-gray-700">{data.typography.body}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2 italic">{data.typography.rationale}</p>
      </div>

      {/* Image style */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Estilo fotográfico
        </h3>
        <p className="text-sm text-gray-700 leading-relaxed">{data.imageStyle}</p>
      </div>
    </div>
  )
}

function PrincipleCard({ p }: { p: Principle }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-2xl border-2 overflow-hidden transition-shadow hover:shadow-md"
      style={{ borderColor: p.color + '40' }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-5 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <span
            className="text-2xl shrink-0 mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: p.color + '18' }}
          >
            {p.icon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: p.color }}
              >
                {p.category}
              </span>
              <span
                className="text-gray-400 shrink-0 transition-transform duration-200"
                style={{
                  display: 'inline-block',
                  fontSize: '22px',
                  lineHeight: 1,
                  transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▾
              </span>
            </div>
            <p className="text-base font-bold text-gray-900 leading-snug">{p.title}</p>
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{p.description}</p>
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div
          className="border-t px-5 pb-5 pt-4 space-y-4"
          style={{ borderColor: p.color + '30', backgroundColor: p.color + '06' }}
        >
          {/* Guidelines */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Reglas de diseño
            </p>
            <ul className="space-y-1.5">
              {p.guidelines.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  {g}
                </li>
              ))}
            </ul>
          </div>

          {/* Do / Don't */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-50 border border-green-100 p-3">
              <p className="text-xs font-semibold text-green-700 mb-1">✓ Hazlo así</p>
              <p className="text-xs text-green-800 leading-relaxed">{p.doExample}</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-100 p-3">
              <p className="text-xs font-semibold text-red-600 mb-1">✗ Evita esto</p>
              <p className="text-xs text-red-700 leading-relaxed">{p.dontExample}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VoiceSection({ data }: { data: VoiceGuidelines }) {
  return (
    <div className="space-y-5">
      {/* Tone */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tono</h3>
        <p className="text-sm text-gray-700 leading-relaxed">{data.tone}</p>
      </div>

      {/* Example headline + CTA */}
      <div className="rounded-2xl bg-violet-50 border border-violet-100 p-5 space-y-3">
        <div>
          <p className="text-xs text-violet-500 font-semibold mb-1">Titular de ejemplo para la home</p>
          <p className="text-lg font-bold text-violet-900 leading-snug">"{data.exampleHeadline}"</p>
        </div>
        <div>
          <p className="text-xs text-violet-500 font-semibold mb-1">CTA principal</p>
          <span className="inline-block rounded-full bg-violet-600 text-white px-5 py-2 text-sm font-medium">
            {data.exampleCta}
          </span>
        </div>
      </div>

      {/* Words */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
            ✓ Palabras que SÍ usar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.doWords.map((w) => (
              <span
                key={w}
                className="rounded-full bg-green-50 border border-green-200 text-green-800 px-2.5 py-0.5 text-xs"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">
            ✗ Palabras que NO usar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.dontWords.map((w) => (
              <span
                key={w}
                className="rounded-full bg-red-50 border border-red-200 text-red-700 px-2.5 py-0.5 text-xs"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DesignPrinciplesPage() {
  const [design, setDesign] = useState<DesignData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function generate() {
    setLoading(true)
    setError(false)
    setDesign(null)

    try {
      // First fetch the CEO Q&A data
      const surveyRes = await fetch('/api/ceo')
      if (!surveyRes.ok) throw new Error('Error cargando datos CEO')
      const { qas } = await surveyRes.json()

      // Then generate design principles
      const designRes = await fetch('/api/design-principles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qas }),
      })
      if (!designRes.ok) throw new Error('Error generando principios')
      const data = await designRes.json()
      setDesign(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) return <LoadingSkeleton />

  if (error || !design) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 px-5 py-6 flex items-center justify-between gap-4">
        <p className="text-sm text-red-600">No se pudieron generar los principios de diseño.</p>
        <button
          onClick={generate}
          className="shrink-0 text-xs px-4 py-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors font-medium"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-10">

      {/* Retry button */}
      <div className="flex justify-end">
        <button
          onClick={generate}
          className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
        >
          ↺ Regenerar
        </button>
      </div>

      {/* 1 — Moodboard */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center text-lg">
            🎨
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Moodboard & Identidad visual</h2>
            <p className="text-xs text-gray-400">Paleta, tipografía y estilo visual de MOA</p>
          </div>
        </div>
        <Card className="border-violet-100">
          <CardContent className="pt-6">
            <MoodboardSection data={design.moodboard} />
          </CardContent>
        </Card>
      </section>

      {/* 2 — Principles */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center text-lg">
            🧭
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Principios de diseño</h2>
            <p className="text-xs text-gray-400">
              {design.principles.length} principios · Haz clic para ver reglas y ejemplos
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {design.principles.map((p) => (
            <PrincipleCard key={p.title} p={p} />
          ))}
        </div>
      </section>

      {/* 3 — Voice */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-8 rounded-xl bg-violet-100 flex items-center justify-center text-lg">
            🗣️
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Voz de marca</h2>
            <p className="text-xs text-gray-400">Tono, palabras clave y ejemplos de copy</p>
          </div>
        </div>
        <Card className="border-violet-100">
          <CardContent className="pt-6">
            <VoiceSection data={design.voiceGuidelines} />
          </CardContent>
        </Card>
      </section>

    </div>
  )
}
