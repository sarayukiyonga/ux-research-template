import { SitemapMoaPage } from '@/components/SitemapMoaPage'
import Link from 'next/link'

export default function MapaSitioRoute() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors mb-6"
        >
          ← Volver al dashboard
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 mb-3">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
            Design Thinking
          </div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Mapa del Sitio
          </h1>
          <p className="mt-1 text-gray-500 text-sm">
            MOA · Arquitectura de información generada a partir del MoSCoW · Estructura jerárquica de páginas y secciones
          </p>
        </div>

        {/* Info */}
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-5 py-4 mb-8 space-y-2 text-sm text-violet-950 leading-relaxed">
          <p>
            La IA organiza las funcionalidades{' '}
            <Link href="/moscow" className="font-semibold underline underline-offset-2 text-violet-700">
              Must · Should · Could
            </Link>{' '}
            en secciones y páginas concretas de la web de MOA.
            El mapa resultante se usa como base para el{' '}
            <Link href="/user-flow" className="font-semibold underline underline-offset-2 text-violet-700">
              User Flow
            </Link>.
          </p>
          <ul className="text-xs text-violet-800/80 space-y-0.5 pl-4 list-disc">
            <li><strong>Nivel 1</strong>: secciones principales de navegación</li>
            <li><strong>Nivel 2</strong>: páginas o vistas concretas dentro de cada sección</li>
            <li>Doble clic para editar · + para añadir hijos · × para eliminar</li>
          </ul>
        </div>

        <SitemapMoaPage />

        <div className="mt-10 flex items-center justify-between text-xs text-gray-400">
          <Link href="/moscow" className="text-violet-600 font-medium hover:underline underline-offset-2">
            ← Must · Should · Could · Won&apos;t
          </Link>
          <Link href="/user-flow" className="text-violet-600 font-medium hover:underline underline-offset-2">
            User Flow →
          </Link>
        </div>
      </div>
    </main>
  )
}
