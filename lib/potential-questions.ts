export const POTENTIAL_SHEET_ID = '17TiRexoLK-jEWhgJ3sgO2KiK5BbqikoaZfUlqXabAJU'
export const POTENTIAL_SHEET_RANGE = 'A:Q'

// Q1 uses three columns: Men (1), Women (2), Non-binary (3)
export const POTENTIAL_DEMOGRAPHIC_COLUMNS = { men: 1, women: 2, nonBinary: 3 }

export type QuestionType = 'open' | 'closed'

export interface PotentialQuestion {
  id: number
  columnIndex: number
  title: string
  shortTitle: string
  type: QuestionType
}

export const POTENTIAL_QUESTIONS: PotentialQuestion[] = [
  {
    id: 1,
    columnIndex: 4,
    title: '¿Sufres alguna patología o dolor crónico que limite tu día a día?',
    shortTitle: 'Patología o dolor crónico',
    type: 'closed',
  },
  {
    id: 2,
    columnIndex: 5,
    title: '¿Qué es lo primero que piensas cuando oyes "Entrenamiento Personal de Salud"?',
    shortTitle: 'Primera impresión del concepto',
    type: 'open',
  },
  {
    id: 3,
    columnIndex: 6,
    title: '¿Haces ejercicio en algún centro actualmente?',
    shortTitle: 'Ejercicio en centro actual',
    type: 'closed',
  },
  {
    id: 4,
    columnIndex: 7,
    title: '¿En qué centro realizas ejercicio actualmente?',
    shortTitle: 'Centro actual',
    type: 'open',
  },
  {
    id: 5,
    columnIndex: 8,
    title: '¿Qué te gusta y qué no de tu centro actual?',
    shortTitle: 'Pros y contras del centro actual',
    type: 'open',
  },
  {
    id: 6,
    columnIndex: 9,
    title: '¿Cambiarías de centro si encuentras uno que se adapte mejor a lo que necesitas?',
    shortTitle: 'Disposición a cambiar de centro',
    type: 'closed',
  },
  {
    id: 7,
    columnIndex: 10,
    title: '¿Qué centros conoces? Nómbralos.',
    shortTitle: 'Centros conocidos',
    type: 'open',
  },
  {
    id: 8,
    columnIndex: 11,
    title: '¿Cuál es el motivo principal por el que no haces ejercicio dirigido actualmente?',
    shortTitle: 'Barreras al ejercicio dirigido',
    type: 'open',
  },
  {
    id: 9,
    columnIndex: 12,
    title: '¿Conoces algún centro especializado en patologías en Martorell?',
    shortTitle: 'Conocimiento de centros especializados',
    type: 'closed',
  },
  {
    id: 10,
    columnIndex: 13,
    title: 'Si buscaras ayuda para un dolor/lesión, ¿dónde mirarías primero?',
    shortTitle: 'Primera búsqueda de ayuda',
    type: 'open',
  },
  {
    id: 11,
    columnIndex: 14,
    title: '¿Qué valoras más en un profesional de la salud?',
    shortTitle: 'Valores en un profesional de salud',
    type: 'open',
  },
  {
    id: 12,
    columnIndex: 15,
    title: '¿Te resultaría atractivo un centro que combine ejercicio, quiromasajista y/o fisioterapia en un mismo plan?',
    shortTitle: 'Atractivo del modelo combinado MOA',
    type: 'closed',
  },
  {
    id: 13,
    columnIndex: 16,
    title: '¿Qué echas de menos en la oferta de bienestar actual en Martorell?',
    shortTitle: 'Carencias en la oferta actual',
    type: 'open',
  },
]
