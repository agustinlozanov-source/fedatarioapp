'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useInstrumentLayout }   from './useInstrumentLayout'
import { InstrumentParagraph }   from './InstrumentParagraph'
import { InstrumentHeader }      from './InstrumentHeader'
import { InstrumentTable }       from './InstrumentTable'
import { InstrumentSignature }   from './InstrumentSignature'

const FUENTES_MONO = [
  'Courier New',
  'Courier Prime',
  'Lucida Console',
  'Consolas',
  'IBM Plex Mono',
  'Source Code Pro',
  'Roboto Mono',
]

const INTERLINEADOS = [
  { label: '1.0', value: 1.0 },
  { label: '1.2', value: 1.2 },
  { label: '1.5', value: 1.5 },
  { label: '2.0', value: 2.0 },
]

// Márgenes en cm — oficio con márgenes legales de correduría
const MARGENES_PRESET = [
  { label: 'Correduría (4.5/3.5)', top: 4.2, bottom: 3.7, left: 4.5, right: 3.5 },
  { label: 'Normal (2.5/2.5)',     top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
  { label: 'Estrecho (1.5/1.5)',   top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
]

export function InstrumentViewer({
  secciones: seccionesIniciales = [],
  instrumentoId,
  readOnly = false,
  font: fontInicial = 'Courier New',
  fontSize: fontSizeInicial = 11,
  onRegenerar,
  regenerando = false,
}) {
  const [secciones, setSecciones]     = useState(seccionesIniciales)
  const [font, setFont]               = useState(fontInicial)
  const [fontSize, setFontSize]       = useState(fontSizeInicial)
  const [interlinea, setInterlinea]   = useState(1.5)
  const [margenIdx, setMargenIdx]     = useState(0)
  const [guardando, setGuardando]     = useState(false)
  const [ultimoGuardado, setUltimo]   = useState(null)
  const saveTimer   = useRef(null)
  // ── ref al elemento .iv-document para medir ancho real ──
  const docRef      = useRef(null)

  const layout = useInstrumentLayout({ font, fontSize })

  // Sincronizar props
  useEffect(() => { setSecciones(seccionesIniciales) }, [seccionesIniciales])

  // ── Medir ancho DOM cuando el documento esté en pantalla ──────
  // Se vuelve a medir si cambian márgenes, fuente o tamaño
  useEffect(() => {
    if (!docRef.current || !layout.ready) return
    // Pequeño delay para que el DOM termine de aplicar el nuevo padding
    const t = setTimeout(() => {
      layout.medirAnchoDOM(docRef.current)
    }, 50)
    return () => clearTimeout(t)
  }, [layout.ready, margenIdx, font, fontSize, interlinea])

  // También medir en resize
  useEffect(() => {
    const onResize = () => {
      if (docRef.current) layout.medirAnchoDOM(docRef.current)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [layout.medirAnchoDOM])

  // ── Autoguardado con debounce ─────────────────────────────────
  const guardarEdits = useCallback(async (secsActuales) => {
    if (!instrumentoId || readOnly) return
    setGuardando(true)
    try {
      const { doc, setDoc } = await import('firebase/firestore')
      const { db } = await import('@/lib/firebase')
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
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => guardarEdits(nuevas), 1500)
      return nuevas
    })
  }, [guardarEdits])

  const handleHeaderChange = useCallback((idx, nuevoTitulo) => {
    setSecciones(prev => {
      const nuevas = prev.map((s, i) =>
        i === idx ? { ...s, runs: [[nuevoTitulo, true]] } : s
      )
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => guardarEdits(nuevas), 1500)
      return nuevas
    })
  }, [guardarEdits])

  // ── Normalizar un socio que puede venir con diferentes estructuras ──
  const normalizarSocio = (s) => {
    if (!s || typeof s !== 'object') return { nombre: '', rfc: '', acciones: 50 }
    return {
      nombre:   s.nombre_completo ?? s.nombre ?? s.name ?? 'Sin nombre',
      rfc:      s.rfc ?? s.RFC ?? '',
      acciones: Number(s.acciones ?? s.num_acciones ?? 50) || 50,
    }
  }

  // ── Renderizar sección ────────────────────────────────────────
  const renderSeccion = useCallback((sec, idx) => {
    switch (sec.tipo) {

      case 'encabezado': {
        const raw    = sec.runs?.[0]
        const titulo = Array.isArray(raw) ? (raw[0] ?? '') : (raw?.texto ?? '')
        const limpio = titulo.replace(/^=+\s*/, '').replace(/\s*=+$/, '').trim()
        return (
          <InstrumentHeader
            key={idx}
            titulo={limpio}
            medir={layout.medir}
            anchoTextoPx={layout.anchoTextoPx}
            readOnly={readOnly}
            onChange={t => handleHeaderChange(idx, t)}
          />
        )
      }

      case 'parrafo': {
        const runs = (sec.runs ?? []).map(r =>
          Array.isArray(r) ? r : [r?.texto ?? '', r?.bold ?? false]
        )
        const ultimoRun = runs[runs.length - 1]
        const esGuion   = ultimoRun && (
          ultimoRun[0]?.startsWith('.- ') ||
          ultimoRun[0]?.startsWith('- - ') ||
          ultimoRun[0]?.startsWith('- ')
        )
        const segmentos = (esGuion ? runs.slice(0, -1) : runs)
          .map(([texto, bold]) => ({ texto, bold }))

        // Detectar encabezado inline con ===
        const textoCompleto = runs.map(r => r[0] ?? '').join('')
        if (textoCompleto.trim().startsWith('=') && textoCompleto.trim().endsWith('=')) {
          const limpio = textoCompleto.replace(/^=+\s*/, '').replace(/\s*=+$/, '').trim()
          return (
            <InstrumentHeader
              key={idx}
              titulo={limpio}
              medir={layout.medir}
              anchoTextoPx={layout.anchoTextoPx}
              readOnly={readOnly}
              onChange={t => handleHeaderChange(idx, t)}
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
            onChange={segs => handleSeccionChange(idx, segs)}
          />
        )
      }

      case 'vacio':
        return <div key={idx} className="instrument-vacio" />

      case 'tabla_accionaria': {
        // FIX: normalizar socios independientemente de la estructura
        const socios  = sec.data?.socios ?? []
        const headers = ['Accionista y RFC', 'Acciones', 'Valor nominal', 'Total']
        const filas   = socios.map(s => {
          const { nombre, rfc, acciones } = normalizarSocio(s)
          const total = acciones * 1000
          return [
            rfc ? `${nombre} — ${rfc}` : nombre,
            `${acciones} Serie A`,
            '$1,000.00',
            `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
          ]
        })
        // Fila de totales
        const totalAcciones = socios.reduce((acc, s) => acc + (normalizarSocio(s).acciones), 0)
        const totalMonto    = totalAcciones * 1000
        filas.push([
          'T O T A L',
          `${totalAcciones} Serie A`,
          '$1,000.00',
          `$${totalMonto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
        ])
        return <InstrumentTable key={idx} headers={headers} filas={filas} />
      }

      case 'tabla_capital_srl': {
        const socios  = sec.data?.socios ?? []
        const headers = ['Socio', 'Parte social', 'Valor', 'Con letra']
        const filas   = socios.map(s => [
          s.nombre_completo ?? s.nombre ?? '',
          s.monto_parte_social ?? '',
          s.valor ?? '',
          s.con_letra ?? '',
        ])
        return <InstrumentTable key={idx} headers={headers} filas={filas} />
      }

      case 'firma': {
        const nombre = typeof sec.data === 'object'
          ? (sec.data?.nombre ?? '')
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

  // ── Márgenes del preset seleccionado ─────────────────────────
  const mar = MARGENES_PRESET[margenIdx]

  // ── Estilos CSS variables dinámicos ──────────────────────────
  const docStyle = {
    fontFamily:   `"${font}", monospace`,
    fontSize:     `${fontSize}pt`,
    lineHeight:   interlinea,
    paddingTop:    `${mar.top}cm`,
    paddingBottom: `${mar.bottom}cm`,
    paddingLeft:   `${mar.left}cm`,
    paddingRight:  `${mar.right}cm`,
    // Pasar márgenes a CSS vars para que @media print los use también
    '--iv-print-mar-top':    `${mar.top}cm`,
    '--iv-print-mar-bottom': `${mar.bottom}cm`,
    '--iv-print-mar-left':   `${mar.left}cm`,
    '--iv-print-mar-right':  `${mar.right}cm`,
  }

  return (
    <div className="iv-root">

      {/* ── Toolbar ── */}
      {!readOnly && (
        <div className="iv-toolbar">
          <div className="iv-toolbar-left">
            <button className="iv-btn-print" onClick={() => window.print()}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4V1h8v3M4 11H2a1 1 0 01-1-1V6a1 1 0 011-1h12a1 1 0 011 1v4a1 1 0 01-1 1h-2M4 8h8v6H4V8z"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Imprimir / PDF
            </button>
          </div>

          <div className="iv-toolbar-center">
            <label className="iv-label">Fuente</label>
            <select className="iv-select" value={font} onChange={e => setFont(e.target.value)}>
              {FUENTES_MONO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>

            <label className="iv-label">Tamaño</label>
            <select className="iv-select iv-select-sm" value={fontSize}
              onChange={e => setFontSize(Number(e.target.value))}>
              {[9, 10, 11, 12].map(s => <option key={s} value={s}>{s}pt</option>)}
            </select>

            <label className="iv-label">Interlineado</label>
            <select className="iv-select iv-select-sm" value={interlinea}
              onChange={e => setInterlinea(Number(e.target.value))}>
              {INTERLINEADOS.map(({ label, value }) =>
                <option key={value} value={value}>{label}</option>)}
            </select>

            <label className="iv-label">Márgenes</label>
            <select className="iv-select" value={margenIdx}
              onChange={e => setMargenIdx(Number(e.target.value))}>
              {MARGENES_PRESET.map((m, i) =>
                <option key={i} value={i}>{m.label}</option>)}
            </select>
          </div>

          <div className="iv-toolbar-right">
            {onRegenerar && (
              <button
                onClick={onRegenerar}
                disabled={regenerando}
                className="iv-btn-secondary"
                style={{ opacity: regenerando ? 0.6 : 1, cursor: regenerando ? 'not-allowed' : 'pointer' }}
              >
                {regenerando ? 'Regenerando…' : '↺ Regenerar'}
              </button>
            )}
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
          ref={docRef}
          className="iv-document"
          style={docStyle}
        >
          {secciones.map((sec, idx) => renderSeccion(sec, idx))}
        </div>
      </div>
    </div>
  )
}
