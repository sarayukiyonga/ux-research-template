export interface Question {
  id: number
  columnIndex: number
  title: string
  shortTitle: string
  type: 'demographic' | 'open'
}

// Q1 ocupa tres columnas: Hombre (1), Mujer (2), No binario (3)
export const DEMOGRAPHIC_COLUMNS = { men: 1, women: 2, nonBinary: 3 }

export const QUESTIONS: Question[] = [
  {
    id: 2,
    columnIndex: 4,
    title: '¿A qué te dedicas cuando no estás entrenando?',
    shortTitle: 'Ocupación / Profesión',
    type: 'open',
  },
  {
    id: 3,
    columnIndex: 5,
    title: '¿Qué te decían los médicos o tu entorno sobre tu salud antes de conocer a la entrenadora?',
    shortTitle: 'Situación de salud previa',
    type: 'open',
  },
  {
    id: 4,
    columnIndex: 6,
    title: '¿Qué actividad de tu vida diaria te costaba más realizar antes de empezar a entrenar?',
    shortTitle: 'Limitaciones antes de entrenar',
    type: 'open',
  },
  {
    id: 5,
    columnIndex: 7,
    title: '¿Qué te frenaba a la hora de apuntarte a un gimnasio convencional?',
    shortTitle: 'Barreras al gimnasio convencional',
    type: 'open',
  },
  {
    id: 6,
    columnIndex: 8,
    title: '¿Qué viste en ella que te dio la confianza para poner tu salud en sus manos?',
    shortTitle: 'Confianza en la entrenadora',
    type: 'open',
  },
  {
    id: 7,
    columnIndex: 9,
    title: '¿Cómo describirías la sensación física y mental justo después de una sesión grupal?',
    shortTitle: 'Sensación post-sesión',
    type: 'open',
  },
  {
    id: 8,
    columnIndex: 10,
    title: '¿Qué te aporta entrenar con otras personas con situaciones similares a la tuya?',
    shortTitle: 'Valor del entrenamiento grupal',
    type: 'open',
  },
  {
    id: 9,
    columnIndex: 11,
    title: '¿Qué esperas encontrar en el nuevo local que mejore tu experiencia actual?',
    shortTitle: 'Expectativas del nuevo local',
    type: 'open',
  },
  {
    id: 10,
    columnIndex: 12,
    title: '¿Sientes que lo que pagas por los entrenos es una inversión en tu salud o un gasto de ocio? ¿Por qué?',
    shortTitle: 'Inversión vs. gasto',
    type: 'open',
  },
  {
    id: 11,
    columnIndex: 13,
    title: '¿Recuerdas algún momento específico en el que sentiste que el entrenamiento realmente estaba funcionando?',
    shortTitle: 'Momento clave de mejora',
    type: 'open',
  },
  {
    id: 12,
    columnIndex: 14,
    title: 'Si pudieras cambiar algo del espacio donde entrenamos ahora, ¿qué sería?',
    shortTitle: 'Mejoras del espacio',
    type: 'open',
  },
  {
    id: 13,
    columnIndex: 15,
    title: 'En el sistema actual de Patri, ¿qué es lo que más te cuesta o te da más pereza?',
    shortTitle: 'Dificultades del sistema actual',
    type: 'open',
  },
]

export const SHEET_ID = '1qAc11BPmA0JkV8Hp2C2fcC7N3LndhPVDOpAfFOXHiWM'
export const SHEET_RANGE = 'A:P' // hasta col P (índice 15), ignoramos email en Q
