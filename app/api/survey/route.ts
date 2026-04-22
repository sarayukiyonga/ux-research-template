import { NextRequest, NextResponse } from 'next/server'
import { getSurveyData } from '@/lib/sheets'
import { friendlySheetsReadError } from '@/lib/sheets-link-errors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        {
          error:
            'Servidor sin credenciales de Google: configura GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en .env.local.',
        },
        { status: 500 }
      )
    }

    const { searchParams } = request.nextUrl
    const gender = searchParams.get('gender') ?? 'all'
    const ageRangesParam = searchParams.get('ageRanges') ?? ''
    const ageRanges = ageRangesParam
      ? ageRangesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const data = await getSurveyData({ gender, ageRanges })
    return NextResponse.json(data)
  } catch (error) {
    const raw = error instanceof Error ? error.message : 'Error desconocido'
    const message = friendlySheetsReadError(raw, 'SURVEY_SHEET_ID')
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
