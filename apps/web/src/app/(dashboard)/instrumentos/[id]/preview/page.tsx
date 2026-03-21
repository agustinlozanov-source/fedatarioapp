'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, getDocFromServer } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { InstrumentViewer } from '@/components/instrument-viewer/InstrumentViewer'
import '@/styles/instrument-viewer.css'

export default function PreviewPage() {
  const { id } = useParams()
  const router  = useRouter()

  const [secciones,    setSecciones]    = useState<any[] | null>(null)
  const [denominacion, setDenominacion] = useState('')
  const [loading,      setLoading]      = useState(true)
  const [generando,    setGenerando]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const sanitizeRuns = (raw: any): [string, boolean][] => {
    try {
      const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : [])
      return arr
        .filter((r: any) => Array.isArray(r) && r.length >= 2)
        .map((r: any) => [String(r[0] ?? ''), Boolean(r[1])] as [string, boolean])
    } catch { return [] }
  }

  async function cargar() {
    setLoading(true)
    try {
      const editsSnap = await getDoc(
        doc(db, 'instrumentos', id as string, 'preview_edits', 'current')
      )
      if (editsSnap.exists()) {
        const raw = editsSnap.data().secciones ?? []
        const parsed = raw.map((s: any) => ({
          ...s,
          runs: sanitizeRuns(s.runs_json ?? s.runs)
        }))
        setSecciones(parsed)
        return
      }

      const instrSnap = await getDocFromServer(doc(db, 'instrumentos', id as string))
      if (!instrSnap.exists()) { setError('Instrumento no encontrado.'); return }

      const instr = instrSnap.data()
      setDenominacion(instr.denominacion_social ?? '')

      if (instr.secciones?.length) {
        const parsed = instr.secciones.map((s: any) => ({
          ...s,
          runs: sanitizeRuns(s.runs_json ?? s.runs)
        }))
        setSecciones(parsed)
      } else {
        setSecciones([])   // vacío → muestra pantalla de "generar"
      }
    } catch (e) {
      console.error(e)
      setError('Error al cargar el instrumento.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (id) cargar() }, [id])

  useEffect(() => {
    if (secciones) {
      console.log('Total secciones:', secciones.length)
      secciones.slice(0, 5).forEach((sec, i) => {
        console.log(`Sec ${i}:`, JSON.stringify(sec))
      })
    }
  }, [secciones])

  const handleGenerar = async () => {
    setGenerando(true)
    setError(null)
    try {
      const agentsUrl = process.env.NEXT_PUBLIC_AGENTS_URL || 'https://fedatario-production.up.railway.app'
      const res = await fetch(`${agentsUrl}/secciones/generar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrumento_id: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Error generando secciones')
      if (!data.total) throw new Error('No se generaron secciones. Verifica que el instrumento tenga todos sus datos.')
      await cargar()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setGenerando(false)
    }
  }

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'Plus Jakarta Sans, system-ui',
      color: '#6E6E73', fontSize: 14,
    }}>
      Cargando instrumento…
    </div>
  )

  // Estado vacío — secciones no generadas aún
  if (!loading && secciones !== null && secciones.length === 0 && !error) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 16,
      fontFamily: 'Plus Jakarta Sans, system-ui',
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ color: '#C7C7CC' }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.5"/>
        <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="16" y1="13" x2="8" y2="13" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="16" y1="17" x2="8" y2="17" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
      <p style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F', margin: 0 }}>
        Sin vista previa generada
      </p>
      <p style={{ fontSize: 13, color: '#86868B', margin: 0, textAlign: 'center', maxWidth: 300 }}>
        Las secciones se generan la primera vez que descargas el .docx o exportas a Docs.
        También puedes generarlas ahora directamente.
      </p>
      {error && <p style={{ fontSize: 12, color: '#FF3B30' }}>{error}</p>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleGenerar}
          disabled={generando}
          style={{
            padding: '9px 20px', background: '#0071E3', color: 'white',
            border: 'none', borderRadius: 10, cursor: generando ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, opacity: generando ? 0.6 : 1,
          }}
        >
          {generando ? 'Generando…' : 'Generar secciones'}
        </button>
        <button
          onClick={() => router.back()}
          style={{
            padding: '9px 20px', background: '#F5F5F7', color: '#1D1D1F',
            border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          ← Volver
        </button>
      </div>
    </div>
  )

  if (error) return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: 16,
      fontFamily: 'Plus Jakarta Sans, system-ui',
    }}>
      <p style={{ color: '#FF3B30', fontSize: 14 }}>{error}</p>
      <button onClick={() => router.back()} style={{
        padding: '8px 16px', background: '#0071E3', color: 'white',
        border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
      }}>
        ← Volver
      </button>
    </div>
  )

  return (
    <InstrumentViewer
      secciones={(secciones ?? []) as any}
      instrumentoId={id as string}
      readOnly={false}
      font="Courier New"
      fontSize={11}
    />
  )
}
