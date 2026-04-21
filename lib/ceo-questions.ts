import { CLIENT } from './client-config'

export const CEO_SHEET_ID =
  process.env.GOOGLE_SHEETS_ID ?? '1X-L4I1OQJ6MR-c4IK19Er-d2bi2rgWvxXfr7po_n-KA'

export interface CeoQuestion {
  id: number
  columnIndex: number
  question: string
  theme: 'brand' | 'business' | 'web' | 'competition' | 'team' | 'communication'
  themeLabel: string
}

export const CEO_QUESTIONS: CeoQuestion[] = [
  {
    id: 1,
    columnIndex: 1,
    question: `¿Qué significa ${CLIENT.name}, por qué lo elegiste y qué valores debe transmitir el nuevo local?`,
    theme: 'brand',
    themeLabel: 'Marca',
  },
  {
    id: 2,
    columnIndex: 2,
    question: 'Respecto a los fisios independientes, ¿quieres que la web sea una plataforma de reserva centralizada o solo un escaparate con sus contactos?',
    theme: 'web',
    themeLabel: 'Web',
  },
  {
    id: 3,
    columnIndex: 3,
    question: '¿Qué porcentaje de ingresos esperas que venga de las clases grupales vs. los servicios de fisioterapia/masaje?',
    theme: 'business',
    themeLabel: 'Negocio',
  },
  {
    id: 4,
    columnIndex: 4,
    question: '¿Cuál es tu ventaja competitiva real frente a otros centros en la zona?',
    theme: 'competition',
    themeLabel: 'Competencia',
  },
  {
    id: 5,
    columnIndex: 5,
    question: '¿Qué acción exacta quieres que haga alguien que entra en la web por primera vez?',
    theme: 'web',
    themeLabel: 'Web',
  },
  {
    id: 6,
    columnIndex: 6,
    question: '¿Por qué crees que tus clientes te han seguido fielmente desde que no tenías local propio?',
    theme: 'brand',
    themeLabel: 'Marca',
  },
  {
    id: 7,
    columnIndex: 7,
    question: `¿Tienes pensado contratar a más personas bajo la marca ${CLIENT.name} o siempre serás tú la cara visible?`,
    theme: 'team',
    themeLabel: 'Equipo',
  },
  {
    id: 8,
    columnIndex: 8,
    question: '¿Necesitas que la web recoja informes de salud o patologías previos a la primera sesión?',
    theme: 'web',
    themeLabel: 'Web',
  },
  {
    id: 9,
    columnIndex: 9,
    question: '¿Te gustaría que la web tuviera un área para médicos o centros de salud que te derivan pacientes?',
    theme: 'web',
    themeLabel: 'Web',
  },
  {
    id: 10,
    columnIndex: 10,
    question: `Si ${CLIENT.name} hablara, ¿cómo se dirigiría a sus clientes?`,
    theme: 'communication',
    themeLabel: 'Comunicación',
  },
  {
    id: 11,
    columnIndex: 11,
    question: '¿Qué negocios crees que pueden ser tu competencia?',
    theme: 'competition',
    themeLabel: 'Competencia',
  },
  {
    id: 12,
    columnIndex: 12,
    question: '¿Qué te diferencia de cada uno de ellos?',
    theme: 'competition',
    themeLabel: 'Competencia',
  },
  {
    id: 13,
    columnIndex: 13,
    question: 'Dime tres páginas web que te gusten.',
    theme: 'web',
    themeLabel: 'Web',
  },
]

export const THEME_COLORS: Record<CeoQuestion['theme'], string> = {
  brand: '#7c3aed',
  business: '#2563eb',
  web: '#0891b2',
  competition: '#dc2626',
  team: '#059669',
  communication: '#d97706',
}
