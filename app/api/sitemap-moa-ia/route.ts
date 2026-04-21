import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { loadHmwIaContextOrFail, hmwIaContextToMarkdown } from '@/lib/hmw-ia-context'
import { normalizeMoSCoWPersist } from '@/lib/moscow-types'
import { newSitemapId } from '@/lib/sitemap-moa-types'

export const dynamic = 'force-dynamic'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function loadMoSCoWData() {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: 'moscow!A2:B2',
    })
    const row = res.data.values?.[0]
    if (!row || !row[1]) return null
    return normalizeMoSCoWPersist(JSON.parse(row[1]))
  } catch {
    return null
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────

const nodoN2 = z.object({
  titulo: z.string().max(50),
  tipo: z.enum(['pagina', 'modal', 'accion', 'widget']),
  prioridad: z.enum(['must', 'should', 'could']).nullable(),
  descripcion: z.string().max(100).nullable(),
})

const nodoN1 = z.object({
  titulo: z.string().max(50),
  tipo: z.enum(['seccion', 'pagina', 'widget']),
  prioridad: z.enum(['must', 'should', 'could']).nullable(),
  descripcion: z.string().max(100).nullable(),
  hijos: z.array(nodoN2).max(8),
})

const responseSchema = z.object({
  tituloInicio: z.string().max(30),
  /** Bloques/widgets que aparecen directamente en la página de inicio */
  portadaDestacados: z.array(z.object({
    titulo: z.string().max(50),
    descripcion: z.string().max(100).nullable(),
    prioridad: z.enum(['must', 'should', 'could']).nullable(),
  })).min(3).max(8),
  secciones: z.array(nodoN1).min(3).max(10),
})

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const [ctx, moscow] = await Promise.all([
      loadHmwIaContextOrFail(),
      loadMoSCoWData(),
    ])

    if (!ctx.ok) {
      return NextResponse.json({ error: ctx.message }, { status: 400 })
    }

    const contextoBase = hmwIaContextToMarkdown(ctx.ctx)

    let moscowBlock = '(No hay clasificacion MoSCoW guardada. Infiere las secciones del contexto.)'
    if (moscow) {
      const must = moscow.notas.must.map((n) => `  - [MUST] ${n.texto}`).join('\n')
      const should = moscow.notas.should.map((n) => `  - [SHOULD] ${n.texto}`).join('\n')
      const could = moscow.notas.could.map((n) => `  - [COULD] ${n.texto}`).join('\n')
      moscowBlock = [must, should, could].filter(Boolean).join('\n') || moscowBlock
    }

    const prompt = `Eres un arquitecto de informacion y experto en UX para proyectos web de servicios.

${contextoBase}

=== CLASIFICACION MOSCOW (funcionalidades priorizadas) ===
${moscowBlock}

=== TU TAREA ===
Genera el MAPA DEL SITIO completo de la nueva web de MOA (centro de osteopatia y movimiento de Patri).

El nodo raiz (tituloInicio) representa la pagina de BIENVENIDA de la web — usa un nombre evocador tipo "Bienvenida a MOA" o "Inicio — Bienvenida", no un titulo tecnico como "Mapa del sitio".

Debes generar DOS partes:

--- PARTE 1: portadaDestacados ---
Lista de 3 a 7 BLOQUES o ACCESOS DIRECTOS que aparecen visiblemente en la pagina de inicio (no en el menu, sino en el cuerpo de la home). Son "shortcuts" o cards destacadas que el usuario ve nada mas entrar.
Ejemplos reales: "Hero: Reserva tu sesion" (CTA principal arriba), "Bloque: Proximas clases grupales", "Bloque: Sobre Patri / Quienes somos", "Widget: Ultimas noticias o novedades", "Social proof: Testimonios de clientas", "Acceso rapido: Mi cuenta".
Para cada destacado: titulo (max 45 chars), descripcion breve (que ve o hace el usuario en este bloque), prioridad segun MoSCoW o null.

--- PARTE 2: secciones ---
Estructura jerarquica de navegacion de la web:
- Nivel 1: secciones principales (menu de navegacion principal)
- Nivel 2: paginas o vistas concretas dentro de cada seccion
- Las funcionalidades MUST deben estar presentes como paginas en nivel 1 o 2
- Las SHOULD pueden incluirse si tienen sentido en la arquitectura
- IMPORTANTE: NO incluyas una seccion llamada "Inicio", "Home" o similar. La pagina de inicio ya esta representada por el nodo raiz y la Parte 1 (portadaDestacados). Las secciones son las que aparecen en el MENU de navegacion, excluyendo la pagina de inicio.

Para cada nodo:
- "titulo": nombre claro y especifico para MOA (max 45 chars)
- "tipo": "seccion" o "pagina" para nivel 1; "pagina", "modal", "accion" o "widget" para nivel 2
- "prioridad": "must" | "should" | "could" | null
- "descripcion": una frase de que hace esta pagina (max 80 chars) o null

Genera 4-8 secciones principales, cada una con 1-5 sub-paginas. Usa nombres reales especificos para MOA.`

    const result = await generateObject({
      model: openai('gpt-4o'),
      schema: responseSchema,
      prompt,
    })

    // Construir el arbol de persistencia
    const portadaHijos = result.object.portadaDestacados.map((d) => ({
      id: newSitemapId(),
      titulo: d.titulo,
      tipo: 'widget' as const,
      prioridad: d.prioridad,
      descripcion: d.descripcion,
      hijos: [],
    }))

    const root = {
      id: newSitemapId(),
      titulo: result.object.tituloInicio || 'Bienvenida',
      tipo: 'inicio' as const,
      prioridad: 'must' as const,
      descripcion: null,
      hijos: [
        // Widgets de portada directamente en root (sin sección envolvente)
        ...portadaHijos,
        ...result.object.secciones.map((s) => ({
          id: newSitemapId(),
          titulo: s.titulo,
          tipo: s.tipo,
          prioridad: s.prioridad,
          descripcion: s.descripcion,
          hijos: s.hijos.map((h) => ({
            id: newSitemapId(),
            titulo: h.titulo,
            tipo: h.tipo,
            prioridad: h.prioridad,
            descripcion: h.descripcion,
            hijos: [],
          })),
        })),
      ],
    }

    return NextResponse.json({ root })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error generando sitemap' }, { status: 500 })
  }
}
