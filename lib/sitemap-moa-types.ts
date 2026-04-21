export const SITEMAP_VERSION = 1 as const

export type SitemapTipo = 'inicio' | 'seccion' | 'pagina' | 'modal' | 'accion' | 'widget'
export type SitemapPrioridad = 'must' | 'should' | 'could' | null

export interface SitemapNodo {
  id: string
  titulo: string
  tipo: SitemapTipo
  prioridad: SitemapPrioridad
  descripcion: string | null
  hijos: SitemapNodo[]
}

export interface SitemapPersist {
  version: typeof SITEMAP_VERSION
  /** Nodo raíz (Home/Inicio) cuyas hijos son las secciones principales */
  root: SitemapNodo
}

export function newSitemapId(): string {
  return `sm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

export function createDefaultRoot(): SitemapNodo {
  return { id: newSitemapId(), titulo: 'Inicio', tipo: 'inicio', prioridad: 'must', descripcion: null, hijos: [] }
}

export function createEmptySitemapPersist(): SitemapPersist {
  return { version: SITEMAP_VERSION, root: createDefaultRoot() }
}

function normalizeNodo(raw: unknown, depth = 0): SitemapNodo | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.titulo !== 'string' || !o.titulo.trim()) return null
  const hijos: SitemapNodo[] =
    depth < 3 && Array.isArray(o.hijos)
      ? (o.hijos as unknown[]).map((h) => normalizeNodo(h, depth + 1)).filter((n): n is SitemapNodo => n !== null)
      : []
  return {
    id: typeof o.id === 'string' ? o.id : newSitemapId(),
    titulo: String(o.titulo).trim().slice(0, 60),
    tipo: ['inicio', 'seccion', 'pagina', 'modal', 'accion', 'widget'].includes(o.tipo as string)
      ? (o.tipo as SitemapTipo)
      : 'pagina',
    prioridad: ['must', 'should', 'could'].includes(o.prioridad as string)
      ? (o.prioridad as SitemapPrioridad)
      : null,
    descripcion: typeof o.descripcion === 'string' ? o.descripcion.slice(0, 120) : null,
    hijos,
  }
}

export function normalizeSitemapPersist(raw: unknown): SitemapPersist {
  if (!raw || typeof raw !== 'object') return createEmptySitemapPersist()
  const o = raw as Record<string, unknown>
  if (o.version !== SITEMAP_VERSION) return createEmptySitemapPersist()
  const root = normalizeNodo(o.root, 0)
  if (!root) return createEmptySitemapPersist()
  return { version: SITEMAP_VERSION, root }
}

/** Convierte el árbol a texto para usarlo en prompts de IA (User Flow, etc.) */
export function sitemapToPromptBlock(root: SitemapNodo): string {
  function renderNodo(nodo: SitemapNodo, indent: string): string {
    const prio = nodo.prioridad ? ` [${nodo.prioridad.toUpperCase()}]` : ''
    const tipo = nodo.tipo === 'widget' ? ' (bloque portada)' : ''
    const lines = [`${indent}- ${nodo.titulo}${prio}${tipo}`]
    for (const hijo of nodo.hijos) {
      lines.push(renderNodo(hijo, indent + '  '))
    }
    return lines.join('\n')
  }
  return `=== MAPA DEL SITIO (estructura de páginas) ===
Usa estas páginas/secciones como nombres reales en el diagrama de flujo:
${renderNodo(root, '')}

Las páginas marcadas como [MUST] son obligatorias en el diagrama.
Los "bloques portada" son widgets/accesos directos visibles en la página de inicio.`
}
