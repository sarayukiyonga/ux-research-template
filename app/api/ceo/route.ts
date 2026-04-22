import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { CEO_SHEET_ID, CEO_QUESTIONS } from '@/lib/ceo-questions'

export const dynamic = 'force-dynamic'

function friendlySheetsError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('permission_denied') || m.includes('insufficient permission') || m.includes('403')) {
    return 'Sin permiso para leer la hoja. Comparte el documento de Sheets con el correo de tu Service Account (Editor o Lector).'
  }
  if (m.includes('not found') || m.includes('requested entity was not found') || m.includes('404')) {
    return 'No se encontró el documento. Revisa que GOOGLE_SHEETS_ID en .env.local sea el ID correcto de la URL del libro.'
  }
  return message
}

export async function GET() {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Servidor sin credenciales de Google: configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY.' },
        { status: 500 }
      )
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: CEO_SHEET_ID,
      range: 'A:N',
    })

    const rows = res.data.values ?? []
    const dataRow = rows[1] // Row 0 = headers, Row 1 = answers

    if (!dataRow) {
      return NextResponse.json(
        {
          error:
            'Sin respuestas en la hoja: en la primera pestaña del libro, la fila 2 debe contener las respuestas de la entrevista (fila 1 = cabeceras).',
        },
        { status: 404 }
      )
    }

    const qas = CEO_QUESTIONS.map((q) => ({
      id: q.id,
      question: q.question,
      answer: dataRow[q.columnIndex]?.trim() ?? '',
      theme: q.theme,
      themeLabel: q.themeLabel,
    }))

    return NextResponse.json({ timestamp: dataRow[0] ?? '', qas })
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Error desconocido'
    const msg = friendlySheetsError(raw)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
