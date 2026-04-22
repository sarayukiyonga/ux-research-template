// Q1 en el Sheet: tres columnas de edad (1), (2), (3) según género del formulario.
export const DEMOGRAPHIC_COLUMNS = { men: 1, women: 2, nonBinary: 3 }

export const SHEET_ID =
  process.env.SURVEY_SHEET_ID ?? '1qAc11BPmA0JkV8Hp2C2fcC7N3LndhPVDOpAfFOXHiWM'

/** Rango amplio: las preguntas y sus títulos vienen de la fila 1; no fijar última columna en código. */
export const SHEET_RANGE = 'A:ZZ'
