/** Variable de entorno del ID del libro de Sheets (para mensajes de error). */
export type SurveySheetIdEnvVar =
  | 'GOOGLE_SHEETS_ID'
  | 'SURVEY_SHEET_ID'
  | 'POTENTIAL_SURVEY_SHEET_ID'

/**
 * Convierte mensajes crudos de la API de Google Sheets en texto útil para el usuario.
 */
export function friendlySheetsReadError(
  message: string,
  sheetIdVar: SurveySheetIdEnvVar = 'GOOGLE_SHEETS_ID'
): string {
  const m = message.toLowerCase()
  if (m.includes('permission_denied') || m.includes('insufficient permission') || m.includes('403')) {
    return 'Sin permiso para leer la hoja. Comparte el documento de Sheets con el correo de tu Service Account (Editor o Lector).'
  }
  if (m.includes('not found') || m.includes('requested entity was not found') || m.includes('404')) {
    return `No se encontró el documento. Revisa que ${sheetIdVar} en .env.local sea el ID correcto de la URL del libro (…/spreadsheets/d/ESTE_ID/edit…).`
  }
  return message
}
