export type ResearchPdfRoute = { path: string; title: string }

/** Rutas del panel (mismo orden que el dashboard) para el PDF combinado. */
export const FULL_RESEARCH_PDF_ROUTES: ResearchPdfRoute[] = [
  { path: '/survey', title: 'Encuesta de clientes' },
  { path: '/potential', title: 'Encuesta a clientes potenciales' },
  { path: '/ceo', title: 'Entrevista a la CEO' },
  { path: '/empathy', title: 'Mapa de empatía' },
  { path: '/insights', title: 'Insights' },
  { path: '/user-persona', title: 'User Persona' },
  { path: '/pov', title: 'Point of View (POV)' },
  { path: '/hmw', title: 'How Might We (HMW)' },
  { path: '/user-journey', title: 'User Journey Map' },
  { path: '/user-flow', title: 'User Flow (flujo de usuario)' },
  { path: '/design', title: 'Principios de diseño' },
]
