import { NextRequest, NextResponse } from 'next/server'

const AGENTS_URL =
  process.env.AGENTS_URL ||
  process.env.NEXT_PUBLIC_AGENTS_URL ||
  'https://fedatario-production.up.railway.app'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const instrumento_id = params.id
  if (!instrumento_id) {
    return NextResponse.json({ error: 'instrumento_id requerido' }, { status: 400 })
  }

  try {
    const res = await fetch(`${AGENTS_URL}/secciones/generar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instrumento_id }),
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail ?? 'Error en el agente' },
        { status: res.status }
      )
    }

    if (!data.total || data.total === 0) {
      return NextResponse.json(
        { error: 'No se pudieron generar las secciones. Verifica que el instrumento tenga todos los datos requeridos.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ ok: true, total: data.total })
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? 'Error de conexión con el agente' },
      { status: 500 }
    )
  }
}
