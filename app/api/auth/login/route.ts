import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { password } = await req.json()

  if (!process.env.AUTH_PASSWORD || !process.env.AUTH_SECRET) {
    return NextResponse.json({ error: 'Servidor no configurado' }, { status: 500 })
  }

  if (password !== process.env.AUTH_PASSWORD) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })

  response.cookies.set('moa_session', process.env.AUTH_SECRET, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
