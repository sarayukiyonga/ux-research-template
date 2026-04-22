/**
 * Recorrido UX en 7 fases y 14 pasos.
 * Fuente única para la barra superior (ResearchJourneyBar) y el dashboard (app/page.tsx).
 */

export type DashboardColor =
  | 'violet'
  | 'orange'
  | 'blue'
  | 'rose'
  | 'amber'
  | 'sky'
  | 'indigo'
  | 'teal'
  | 'cyan'
  | 'emerald'

export interface ResearchJourneyStep {
  href: string
  short: string
  long: string
  emoji: string
  tag: string
  tagPulse?: boolean
  title: string
  description: string
  color: DashboardColor
}

export interface ResearchPhase {
  id: string
  number: number
  title: string
  subtitle: string
  steps: ResearchJourneyStep[]
}

export const RESEARCH_PHASES: ResearchPhase[] = [
  {
    id: 'research',
    number: 1,
    title: 'Investigación (Research)',
    subtitle: 'Primero recoges información (sin interpretar demasiado todavía).',
    steps: [
      {
        href: '/ceo',
        emoji: '🎙️',
        tag: 'Entrevista',
        title: 'Entrevista a la CEO',
        description:
          'Entender negocio, objetivos, visión y restricciones. Informe estratégico con IA a partir de las respuestas.',
        short: 'CEO',
        long: 'Entrevista al fundador/a: negocio, objetivos, visión y restricciones, con informe estratégico por IA.',
        color: 'blue',
      },
      {
        href: '/survey',
        emoji: '📊',
        tag: 'Tiempo real',
        tagPulse: true,
        title: 'Encuesta de clientes (actuales)',
        description: 'Qué opinan los que ya compran: respuestas agrupadas por pregunta y análisis con IA.',
        short: 'Encuesta',
        long: 'Encuesta a clientes actuales: qué opinan quienes ya son clientes; filtros y lectura de respuestas abiertas.',
        color: 'violet',
      },
      {
        href: '/potential',
        emoji: '🔍',
        tag: 'Tiempo real',
        tagPulse: true,
        title: 'Encuesta a clientes potenciales',
        description: 'Barreras, objeciones y oportunidades del público que aún no ha dado el paso.',
        short: 'Potencial',
        long: 'Encuesta a clientes potenciales: barreras, objeciones y oportunidades de captación.',
        color: 'orange',
      },
    ],
  },
  {
    id: 'understanding',
    number: 2,
    title: 'Síntesis (Understanding)',
    subtitle: 'Aquí conviertes datos en conocimiento.',
    steps: [
      {
        href: '/empathy',
        emoji: '🗺️',
        tag: 'Síntesis',
        title: 'Mapa de empatía',
        description: 'Ordenas lo que el cliente piensa, siente y hace (pestañas alineadas con los filtros de encuesta).',
        short: 'Empatía',
        long: 'Mapa de empatía: ordenar lo que el cliente piensa, siente y hace antes de extraer patrones.',
        color: 'rose',
      },
      {
        href: '/insights',
        emoji: '💡',
        tag: 'Síntesis',
        title: 'Insights',
        description:
          'Detectas patrones clave con IA (es crítico antes de seguir). Parte del mapa de empatía guardado.',
        short: 'Insights',
        long: 'Insights: patrones clave con IA — paso crítico antes de personas y definición del problema.',
        color: 'amber',
      },
      {
        href: '/user-persona',
        emoji: '👤',
        tag: 'Síntesis',
        title: 'User Persona',
        description: 'Perfiles claros de cliente actual y potencial, coherentes con insights y encuestas.',
        short: 'Persona',
        long: 'User Persona: perfiles claros (actual y potencial) alineados con datos e insights.',
        color: 'violet',
      },
    ],
  },
  {
    id: 'define',
    number: 3,
    title: 'Definición del problema (Define)',
    subtitle: 'POV y HMW encuadran el problema; el User Journey describe el recorrido del usuario sobre esas ideas.',
    steps: [
      {
        href: '/pov',
        emoji: '💬',
        tag: 'Define',
        title: 'Point of View (POV)',
        description: 'Problema claro centrado en el usuario, a partir de los user persona guardados.',
        short: 'POV',
        long: 'Point of View: problema claro centrado en el usuario (Design Thinking).',
        color: 'sky',
      },
      {
        href: '/hmw',
        emoji: '❓',
        tag: 'Define',
        title: 'How Might We (HMW)',
        description: 'Convertir el problema en oportunidades de diseño («¿Cómo podríamos…?»).',
        short: 'HMW',
        long: 'How Might We: del problema a oportunidades de diseño concretas para la web y la experiencia.',
        color: 'indigo',
      },
      {
        href: '/user-journey',
        emoji: '🛤️',
        tag: 'Define',
        title: 'User Journey Map',
        description: 'Cómo vive el usuario la experiencia por canal, a partir del HMW guardado.',
        short: 'Journey',
        long: 'User Journey: cómo vive el usuario la experiencia por canal (después del HMW).',
        color: 'teal',
      },
    ],
  },
  {
    id: 'ideation',
    number: 4,
    title: 'Ideación + priorización',
    subtitle: 'Aquí decides qué hacer.',
    steps: [
      {
        href: '/moscow',
        emoji: '📋',
        tag: 'Priorizar',
        title: 'MoSCoW (Must · Should · Could · Won’t)',
        description: 'Filtras ideas: qué es imprescindible, importante, deseable o fuera de alcance.',
        short: 'MoSCoW',
        long: 'MoSCoW: filtrar ideas en Must, Should, Could y Won’t para el lanzamiento.',
        color: 'violet',
      },
      {
        href: '/mvp',
        emoji: '🎯',
        tag: 'Priorizar',
        title: 'Priorización del MVP (matriz de valor)',
        description: 'Decides qué entra en el MVP real (valor para usuario vs. valor para el negocio).',
        short: 'MVP',
        long: 'Matriz MVP: qué entra en el producto mínimo y con qué peso relativo.',
        color: 'violet',
      },
    ],
  },
  {
    id: 'structure',
    number: 5,
    title: 'Estructura (Arquitectura UX)',
    subtitle: 'Arquitectura de información de la nueva web, alineada con el MVP guardado.',
    steps: [
      {
        href: '/mapa-sitio',
        emoji: '🗺️',
        tag: 'Arquitectura',
        title: 'Mapa del sitio',
        description: 'Qué páginas existen: arquitectura de información de la nueva web.',
        short: 'Mapa web',
        long: 'Mapa del sitio: qué páginas y secciones existen en la nueva web, a partir de la matriz MVP guardada.',
        color: 'teal',
      },
    ],
  },
  {
    id: 'interaction',
    number: 6,
    title: 'Interacción',
    subtitle: 'Flujo real de navegación y decisiones.',
    steps: [
      {
        href: '/user-flow',
        emoji: '🔀',
        tag: 'Interacción',
        title: 'User Flow',
        description: 'Diagrama de pantallas, clics y ramas hasta conversión (usa mapa + journey guardados).',
        short: 'User flow',
        long: 'User Flow: navegación y decisiones reales; requiere mapa del sitio, journey e ideas guardados en Sheets.',
        color: 'cyan',
      },
    ],
  },
  {
    id: 'identity',
    number: 7,
    title: 'Identidad y diseño',
    subtitle: 'Al final o en paralelo al diseño visual: principios que guían tono, estilo y consistencia.',
    steps: [
      {
        href: '/design',
        emoji: '🎨',
        tag: 'Identidad',
        title: 'Principios de diseño',
        description: 'Principios de marca y comunicación a partir de entrevista, encuestas y decisiones.',
        short: 'Diseño',
        long: 'Principios de diseño: identidad y comunicación (suele cerrar el ciclo o ir en paralelo al UI).',
        color: 'emerald',
      },
    ],
  },
]

/** Lista plana en orden para la barra de pasos y `researchJourneyStepIndex`. */
export const RESEARCH_JOURNEY_STEPS: ResearchJourneyStep[] = RESEARCH_PHASES.flatMap((p) => p.steps)

/** Índice del paso activo (0-based), o -1 si no coincide (p. ej. home). */
export function researchJourneyStepIndex(pathname: string | null): number {
  if (!pathname || pathname === '/') return -1
  const p = pathname.replace(/\/$/, '') || '/'
  const ordered = [...RESEARCH_JOURNEY_STEPS].sort((a, b) => b.href.length - a.href.length)
  for (const step of ordered) {
    if (p === step.href || p.startsWith(`${step.href}/`)) {
      return RESEARCH_JOURNEY_STEPS.findIndex((s) => s.href === step.href)
    }
  }
  return -1
}

/** Fase (1–7) del paso actual, o null en home / sin coincidencia. */
export function researchPhaseForPathname(pathname: string | null): ResearchPhase | null {
  const i = researchJourneyStepIndex(pathname)
  if (i < 0) return null
  let n = 0
  for (const ph of RESEARCH_PHASES) {
    for (let s = 0; s < ph.steps.length; s++) {
      if (n === i) return ph
      n++
    }
  }
  return null
}
