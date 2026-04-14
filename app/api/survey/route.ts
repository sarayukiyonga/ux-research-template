import { NextRequest, NextResponse } from 'next/server'
import { getSurveyData } from '@/lib/sheets'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const gender = searchParams.get('gender') ?? 'all'
    const ageRangesParam = searchParams.get('ageRanges') ?? ''
    const ageRanges = ageRangesParam
      ? ageRangesParam.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const data = await getSurveyData({ gender, ageRanges })
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
