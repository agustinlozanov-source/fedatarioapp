/**
 * app/(dashboard)/instrumentos/[id]/preview/page.tsx
 * ─────────────────────────────────────────────────────────────────
 * Ruta: /instrumentos/:id/preview
 * Carga las secciones del instrumento desde Firestore y las pasa al visor.
 */

'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { InstrumentViewer } from '@/components/instrument-viewer/InstrumentViewer'
import '@/styles/instrument-viewer.css'

export default function PreviewPage() {
  const { id } = useParams()
  const router  = useRouter()

  const [secciones,  setSecciones]  = useState<any[] | null>(null)
  const [denominacion, setDenominacion] = useState('')
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    async function cargar() {
      try {
        // 1. Intentar cargar edits guardados
        const editsSnap = await getDoc(
          doc(db, 'instrumentos', id as string, 'preview_edits', 'current')
        )

        if (editsSnap.exists()) {
          const data = editsSnap.data()
          setSecciones(data.secciones)
          return
        }

        // 2. Si no hay edits, cargar el instrumento original
        const instrSnap = await getDoc(doc(db, 'instrumentos', id as string))
        if (!instrSnap.exists()) {
          setError('Instrumento no encontrado.')
          return
        }

        const instr = instrSnap.data()
        setDenominacion(instr.denominacion_social ?? '')

        // Las secciones pueden venir pre-generadas o hay que generarlas
        if (instr.secciones) {
          setSecciones(instr.secciones)
        } else {
          setError('Este instrumento no tiene secciones generadas aún. Ejecuta el pipeline primero.')
        }
      } catch (e) {
        console.error(e)
        setError('Error al cargar el instrumento.')
      } finally {
        setLoading(false)
      }
    }

    cargar()
  }, [id])

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontFamily: 'Plus Jakarta Sans, system-ui',
        color: '#6E6E73', fontSize: 14,
      }}>
        Cargando instrumento…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh', gap: 16,
        fontFamily: 'Plus Jakarta Sans, system-ui',
      }}>
        <p style={{ color: '#FF3B30', fontSize: 14 }}>{error}</p>
        <button
          onClick={() => router.back()}
          style={{
            padding: '8px 16px', background: '#0071E3', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}
        >
          ← Volver
        </button>
      </div>
    )
  }

  return (
    <InstrumentViewer
      secciones={secciones ?? []}
      instrumentoId={id as string}
      readOnly={false}
      font="Courier New"
      fontSize={11}
    />
  )
}
