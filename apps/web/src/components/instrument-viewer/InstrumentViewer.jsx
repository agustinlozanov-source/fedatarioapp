/**
 * InstrumentViewer.jsx
 * ─────────────────────────────────────────────────────────────────
 * Componente raíz del visor/editor de instrumentos.
 *
 * Props:
 *   secciones:    List[Seccion] — mismo formato que produce AGT-04
 *   instrumentoId: string       — para guardar edits en Firestore
 *   readOnly:     boolean
 *   font:         string        — fuente monoespaciada (default: 'Courier New')
 *   fontSize:     number        — pt (default: 11)
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useInstrumentLayout }   from './useInstrumentLayout'
import { InstrumentParagraph }   from './InstrumentParagraph'
import { InstrumentHeader }      from './InstrumentHeader'
import { InstrumentTable }       from './InstrumentTable'
import { InstrumentSignature }   from './InstrumentSignature'

// ─── Fuentes monoespaciadas disponibles ────────────────────────────
const FUENTES_MONO = [
  'Courier New',
  'Courier Prime',
  'Lucida Console',
  'Consolas',
  'IBM Plex Mono',
  'Source Code Pro',
  'Roboto Mono',
]

/**
 * @typedef {{ tipo: string, runs: Array<[string, boolean]>, data: Record<string, any> }} Seccion
 */

/**
 * @param {{ secciones?: Seccion[], instrumentoId: string, readOnly?: boolean, font?: string, fontSize?: number }} props
 */
export function InstrumentViewer({
  secciones: seccionesIniciales = [],
  instrumentoId,
  readOnly = false,
  font: fontInicial = 'Courier New',
  fontSize: fontSizeInicial = 11,
}) {
  const [secciones, setSecciones]   = useState(seccionesIniciales)
  const [font, setFont]             = useState(fontInicial)
  const [fontSize, setFontSize]     = useState(fontSizeInicial)
  const [guardando, setGuardando]   = useState(false)
  const [ultimoGuardado, setUltimo] = useState(null)
  const [barraVisible, setBarra]    = useState(true)
  const saveTimer = useRef(null)

  const layout = useInstrumentLayout({ font, fontSize })

  // Sincronizar props
  useEffect(() => { setSecciones(seccionesIniciales) }, [seccionesIniciales])

  // Autoguardado con debounce
  const guardarEdits = useCallback(async (secsActuales) => {
    if (!instrumentoId || readOnly) return
    setGuardando(true)
    try {
      const { doc, setDoc } = await import('firebase/firestore')
      const { db } = await import('@/lib/firebase')
      // Serializar runs como JSON string para evitar arrays anidados (Firestore no los soporta)
      const secsSerializadas = secsActuales.map(s => ({
        tipo: s.tipo,
        runs_json: JSON.stringify(Array.isArray(s.runs) ? s.runs : []),
        data: s.data ?? {},
      }))
      await setDoc(
        doc(db, 'instrumentos', instrumentoId, 'preview_edits', 'current'),
        { secciones: secsSerializadas, actualizadoEn: new Date().toISOString() }
      )
      setUltimo(new Date())
    } catch (e) {
      console.error('Error al guardar edits:', e)
    } finally {
      setGuardando(false)
    }
  }, [instrumentoId, readOnly])

  const handleSeccionChange = useCallback((idx, nuevosSegmentos) => {
    setSecciones(prev => {
      const nuevas = prev.map((s, i) =>
        i === idx ? { ...s, runs: nuevosSegmentos } : s
      )
      // Debounce 1.5s
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => guardarEdits(nuevas), 1500)
      return nuevas
    })
  }, [guardarEdits])

  const handleHeaderChange = useCallback((idx, nuevoTitulo) => {
    setSecciones(prev => {
      const sec = prev[idx]
      const nuevas = prev.map((s, i) =>
        i === idx
          ? { ...s, runs: [[nuevoTitulo, true]] }
          : s
      )
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => guardarEdits(nuevas), 1500)
      return nuevas
    })
  }, [guardarEdits])

  const handleImprimir = useCallback(() => {
    window.print()
  }, [])

  // ── Renderizar una sección ─────────────────────────────────────
  const renderSeccion = useCallback((sec, idx) => {
    switch (sec.tipo) {

      case 'encabezado': {
        const titulo = sec.runs?.[0]?.[0] ?? ''
        // Limpiar los = si vienen del pipeline
        const tituloLimpio = titulo.replace(/^=+\s*/, '').replace(/\s*=+$/, '').trim()
        return (
          <InstrumentHeader
            key={idx}
            titulo={tituloLimpio}
            medir={layout.medir}
            anchoTextoPx={layout.anchoTextoPx}
            readOnly={readOnly}
            onChange={(nuevoTitulo) => handleHeaderChange(idx, nuevoTitulo)}
          />
        )
      }

      case 'parrafo': {
        // Detectar si el último run es de guiones (empieza con '.- ' o '- ')
        const runs = sec.runs ?? []
        const ultimoRun = runs[runs.length - 1]
        const esGuion = ultimoRun && (
          ultimoRun[0]?.startsWith('.- ') ||
          ultimoRun[0]?.startsWith('- - ')
        )
        // Segmentos sin el run de guiones (lo calculamos en tiempo real)
        const segmentos = (esGuion ? runs.slice(0, -1) : runs)
          .map(([texto, bold]) => ({ texto, bold }))

        // Detectar si es un encabezado inline (viene del pipeline como parrafo con =)
        const textoCompleto = runs.map(r => r[0] ?? '').join('')
        if (textoCompleto.trim().startsWith('=') && textoCompleto.trim().endsWith('=')) {
          const tituloLimpio = textoCompleto.replace(/^=+\s*/, '').replace(/\s*=+$/, '').trim()
          return (
            <InstrumentHeader
              key={idx}
              titulo={tituloLimpio}
              medir={layout.medir}
              anchoTextoPx={layout.anchoTextoPx}
              readOnly={readOnly}
              onChange={(nuevoTitulo) => handleHeaderChange(idx, nuevoTitulo)}
            />
          )
        }

        return (
          <InstrumentParagraph
            key={idx}
            segmentos={segmentos}
            tieneGuiones={esGuion}
            calcGuionesSegmentos={layout.calcGuionesSegmentos}
            readOnly={readOnly}
            onChange={(nuevosSegs) => handleSeccionChange(idx, nuevosSegs)}
          />
        )
      }

      case 'vacio':
        return <div key={idx} className="instrument-vacio" />

      case 'tabla_accionaria': {
        const socios = sec.data?.socios ?? []
        const headers = ['Accionista y RFC', 'Acciones', 'Valor nominal', 'Total']
        const filas = socios.map(s => [
          `${s.nombre_completo} — ${s.rfc}`,
          `${s.acciones ?? 50} Serie A`,
          '$1,000.00',
          `$${(s.acciones ?? 50) * 1000 .toLocaleString('es-MX')}.00`,
        ])
        return <InstrumentTable key={idx} headers={headers} filas={filas} />
      }

      case 'tabla_capital_srl': {
        const socios = sec.data?.socios ?? []
        const headers = ['Socio', 'Parte social', 'Valor', 'Con letra']
        const filas = socios.map(s => [
          s.nombre_completo,
          s.monto_parte_social ?? '',
          s.valor ?? '',
          s.con_letra ?? '',
        ])
        return <InstrumentTable key={idx} headers={headers} filas={filas} />
      }

      case 'firma': {
        const nombre = typeof sec.data === 'object'
          ? sec.data?.nombre ?? ''
          : ''
        return <InstrumentSignature key={idx} nombre={nombre} />
      }

      case 'corredor':
        return (
          <InstrumentSignature
            key={idx}
            nombre="WILFREDO EMMANUEL RAMÍREZ NÚÑEZ"
            esCorredor
          />
        )

      default:
        return null
    }
  }, [layout, readOnly, handleSeccionChange, handleHeaderChange])

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="iv-root">

      {/* ── Barra de herramientas (solo en pantalla, oculta en print) ── */}
      {!readOnly && (
        <div className={`iv-toolbar ${barraVisible ? '' : 'oculta'}`}>
          <div className="iv-toolbar-left">
            <button
              className="iv-btn-print"
              onClick={handleImprimir}
              title="Imprimir / Exportar PDF"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4V1h8v3M4 11H2a1 1 0 01-1-1V6a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 01-1 1h-2M4 8h8v6H4V8z"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Imprimir / PDF
            </button>
          </div>

          <div className="iv-toolbar-center">
            <label className="iv-label">Fuente</label>
            <select
              className="iv-select"
              value={font}
              onChange={e => setFont(e.target.value)}
            >
              {FUENTES_MONO.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <label className="iv-label">Tamaño</label>
            <select
              className="iv-select iv-select-sm"
              value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}
            >
              {[9, 10, 11, 12].map(s => (
                <option key={s} value={s}>{s}pt</option>
              ))}
            </select>
          </div>

          <div className="iv-toolbar-right">
            {guardando && <span className="iv-status">Guardando…</span>}
            {!guardando && ultimoGuardado && (
              <span className="iv-status">
                Guardado {ultimoGuardado.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Documento ── */}
      <div className="iv-doc-wrap">
        <div
          className="iv-document"
          style={{
            fontFamily: `"${font}", monospace`,
            fontSize: `${fontSize}pt`,
          }}
        >
          {secciones.map((sec, idx) => renderSeccion(sec, idx))}
        </div>
      </div>
    </div>
  )
}
