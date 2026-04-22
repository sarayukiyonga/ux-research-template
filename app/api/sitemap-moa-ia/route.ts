import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { loadHmwIaContextOrFail, hmwIaContextToMarkdown } from '@/lib/hmw-ia-context'
import { moscowBundleToCombinedPersist, normalizeMoSCoWStoredJson } from '@/lib/moscow-types'
import { getMVPScopePersist, mvpPersistToPlainTextForIa, normalizeMVPStoredJson, type MVPPersist } from '@/lib/mvp-types'
import { DEFAULT_USER_JOURNEY_CANAL_ID } from '@/lib/user-journey-channels'
import { newSitemapId } from '@/lib/sitemap-moa-types'
import { CLIENT, CLIENT_LONG_DESC } from '@/lib/client-config'
import { loadCardSortingConfigFromSheets } from '@/lib/card-sorting-sheets'
import { loadCardSortingSubmissionsFromSheets } from '@/lib/card-sorting-submissions-sheets'
import { buildCardSortingBlockForSitemapIa } from '@/lib/card-sorting-for-sitemap-ia'

export const dynamic = 'force-dynamic'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

async function loadMVPPersistFromSheet(): Promise<MVPPersist | null> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: 'mvp!A2:B2',
    })
    const row = res.data.values?.[0]
    if (!row?.[1]?.trim()) return null
    const bundle = normalizeMVPStoredJson(JSON.parse(row[1]))
    /** Mapa del sitio: solo MVP del canal «Página web» (`web`), no otras matrices por canal. */
    return getMVPScopePersist(bundle, DEFAULT_USER_JOURNEY_CANAL_ID)
  } catch {
    return null
  }
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
    const bundle = normalizeMoSCoWStoredJson(JSON.parse(row[1]))
    return moscowBundleToCombinedPersist(bundle)
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
    const [mvp, moscow, ctxHmw, cardSortingSaved, cardSortingSubmissions] = await Promise.all([
      loadMVPPersistFromSheet(),
      loadMoSCoWData(),
      loadHmwIaContextOrFail(),
      loadCardSortingConfigFromSheets(),
      loadCardSortingSubmissionsFromSheets(),
    ])

    if (!mvp || mvp.notas.length === 0) {
      return NextResponse.json(
        {
          error:
            'No hay matriz MVP guardada para el canal «Página web» (web) o está vacía. En /mvp elige el canal **Página web**, genera o coloca las notas y pulsa «Guardar en Sheets» antes de generar el mapa del sitio.',
        },
        { status: 400 }
      )
    }

    const mvpBlock = `=== MATRIZ MVP — CANAL «PÁGINA WEB» (fuente principal del mapa; no uses MVP de otros canales) ===
Cada línea es una funcionalidad ya priorizada en valor negocio (x) y valor usuario (y) para el **sitio web**. La arquitectura del sitio debe **cubrirlas**: como página, subpágina, modal/flujo o bloque destacado en la portada. Puedes agrupar ítems muy relacionados en una sola pantalla si tiene sentido, pero no omitas funcionalidades relevantes.

${mvpPersistToPlainTextForIa(mvp)}`

    const contextoOpcional = ctxHmw.ok
      ? `=== Contexto complementario (POV, personas, empatía) ===
${hmwIaContextToMarkdown(ctxHmw.ctx)}`
      : '(No hay POV/personas/empatía guardados en Sheets; usa solo la matriz MVP y MoSCoW para nombrar páginas y no inventes productos digitales no mencionados.)'

    let moscowBlock = '(No hay clasificación MoSCoW guardada; las prioridades must/should/could infiérelas sobre todo de la matriz MVP.)'
    if (moscow) {
      const must = moscow.notas.must.map((n) => `  - [MUST] ${n.texto}`).join('\n')
      const should = moscow.notas.should.map((n) => `  - [SHOULD] ${n.texto}`).join('\n')
      const could = moscow.notas.could.map((n) => `  - [COULD] ${n.texto}`).join('\n')
      const wont = moscow.notas.wont.map((n) => `  - [WON'T] ${n.texto}`).join('\n')
      const joined = [must, should, could, wont].filter(Boolean).join('\n')
      if (joined.trim()) {
        moscowBlock = `=== MoSCoW (referencia cruzada; no sustituye al MVP) ===
${joined}`
      }
    }

    const cardSortingBlock = buildCardSortingBlockForSitemapIa(cardSortingSaved.config, cardSortingSubmissions)
    const cardSortingSection = `=== CARD SORTING (resultados guardados en Sheets; arquitectura percibida por participantes) ===
${cardSortingBlock}

`

    const prompt = `Eres un arquitecto de información y experto en UX para proyectos web de servicios.

${mvpBlock}

${contextoOpcional}

${moscowBlock}

${cardSortingSection}
=== TU TAREA ===
Genera el MAPA DEL SITIO completo de la nueva web de ${CLIENT_LONG_DESC}.

**Prioridad:** la estructura (portada + menú + subpáginas) debe reflejar **antes que nada** la matriz MVP de arriba. Las notas con mayor valor de negocio y de usuario (x alto, y bajo, tamaño lg o color naranja en la descripción) deben tener presencia clara: sección propia, página hija o widget en portada. Lo que quede débil en la matriz puede ir a páginas secundarias o prioridad could.

**Card sorting:** si hay participaciones en la sección CARD SORTING, úsalas para **alinear menú y agrupación** con el consenso de los usuarios (sin contradecir el MVP). Si no hay participaciones, ignora esa sección salvo el vocabulario de tarjetas.

El nodo raiz (tituloInicio) representa la pagina de BIENVENIDA de la web — usa un nombre evocador tipo "Bienvenida a ${CLIENT.name}" o "Inicio — Bienvenida", no un titulo tecnico como "Mapa del sitio".

Debes generar DOS partes:

--- PARTE 1: portadaDestacados ---
Lista de 3 a 7 BLOQUES o ACCESOS DIRECTOS que aparecen visiblemente en la pagina de inicio (no en el menu, sino en el cuerpo de la home). Son "shortcuts" o cards destacadas que el usuario ve nada mas entrar.
Deben **conectar con funcionalidades concretas del MVP** (reservas, precios, cuenta, clases, etc. según lo que diga la lista).
Ejemplos reales: "Hero: Reserva tu sesion" (CTA principal arriba), "Bloque: Proximas clases grupales", "Bloque: Sobre ${CLIENT.ownerFirstName} / Quienes somos", "Widget: Ultimas noticias o novedades", "Social proof: Testimonios de clientas", "Acceso rapido: Mi cuenta".
Para cada destacado: titulo (max 45 chars), descripcion breve (que ve o hace el usuario en este bloque), prioridad alineada con MVP/MoSCoW o null.

--- PARTE 2: secciones ---
Estructura jerarquica de navegacion de la web:
- Nivel 1: secciones principales (menu de navegacion principal)
- Nivel 2: paginas o vistas concretas dentro de cada seccion
- Las funcionalidades **fuertes en la matriz MVP** deben estar presentes como paginas en nivel 1 o 2
- IMPORTANTE: NO incluyas una seccion llamada "Inicio", "Home" o similar. La pagina de inicio ya esta representada por el nodo raiz y la Parte 1 (portadaDestacados). Las secciones son las que aparecen en el MENU de navegacion, excluyendo la pagina de inicio.

Para cada nodo:
- "titulo": nombre claro y especifico para ${CLIENT.name} (max 45 chars)
- "tipo": "seccion" o "pagina" para nivel 1; "pagina", "modal", "accion" o "widget" para nivel 2
- "prioridad": "must" | "should" | "could" | null (coherente con MVP: lo más crítico en matriz → must donde aplique)
- "descripcion": una frase de que hace esta pagina (max 80 chars) o null

Genera 4-8 secciones principales, cada una con 1-5 sub-paginas. Usa nombres reales especificos para ${CLIENT.name}.`

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
      titulo: result.object.tituloInicio || `Bienvenida a ${CLIENT.name}`,
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
