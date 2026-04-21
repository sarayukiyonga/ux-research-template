import { google } from 'googleapis'
import { CEO_SHEET_ID } from '@/lib/ceo-questions'
import { normalizeSitemapPersist, sitemapToPromptBlock } from '@/lib/sitemap-moa-types'

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

/**
 * Lee `sitemap_moa` en Sheets y devuelve el bloque de texto para prompts de IA.
 * Cadena vacía si no hay JSON, el árbol no tiene hijos bajo la raíz o hay error.
 */
export async function fetchSitemapPromptBlockFromSheets(): Promise<string> {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuth() })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: 'sitemap_moa!A2:B2',
    })
    const row = res.data.values?.[0]
    if (!row?.[1]?.trim()) return ''
    const persist = normalizeSitemapPersist(JSON.parse(row[1]))
    if (!persist.root.hijos?.length) return ''
    return sitemapToPromptBlock(persist.root)
  } catch {
    return ''
  }
}
