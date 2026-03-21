'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useInstrumentLayout }   from './useInstrumentLayout'
import { InstrumentParagraph }   from './InstrumentParagraph'
import { InstrumentHeader }      from './InstrumentHeader'
import { InstrumentTable }       from './InstrumentTable'
import { InstrumentSignature }   from './InstrumentSignature'
import { InstrumentPdfViewer }  from './InstrumentPdfViewer'
import './instrument-pdf-viewer.css'

const FUENTES_MONO = [
  'Courier New', 'Courier Prime', 'Lucida Console',
  'Consolas', 'IBM Plex Mono', 'Source Code Pro', 'Roboto Mono',
]

const INTERLINEADOS = [
  { label: '1.0', value: 1.0 },
  { label: '1.2', value: 1.2 },
  { label: '1.5', value: 1.5 },
  { label: '2.0', value: 2.0 },
]

const MARGENES_PRESET = [
  { label: 'Correduría (4.5/3.5)', top: 4.2, bottom: 3.7, left: 4.5, right: 3.5 },
  { label: 'Normal (2.5/2.5)',     top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
  { label: 'Estrecho (1.5/1.5)',   top: 1.5, bottom: 1.5, left: 1.5, right: 1.5 },
]

// ── Parsear socio que llega como string repr de Python ─────────────
function parseSocio(s) {
  if (!s) return { nombre: '', rfc: '', acciones: 50 }

  // Si ya es un objeto con las propiedades correctas
  if (typeof s === 'object' && s !== null) {
    return {
      nombre:   s.nombre_completo ?? s.nombre ?? s.name ?? '',
      rfc:      s.rfc ?? s.RFC ?? '',
      acciones: Number(s.acciones ?? s.num_acciones ?? s.porcentaje ?? 50) || 50,
    }
  }

  // Si es un string con formato repr de Python: key='value' key=value
  if (typeof s === 'string') {
    const extract = (key) => {
      // key='value'
      const mq = s.match(new RegExp(`${key}='([^']*)'`))
      if (mq) return mq[1]
      // key=value (sin comillas)
      const mn = s.match(new RegExp(`${key}=([^\\s,)]+)`))
      if (mn) return mn[1]
      return ''
    }
    const pct = parseFloat(extract('porcentaje')) || 50
    return {
      nombre:   extract('nombre_completo'),
      rfc:      extract('rfc'),
      acciones: Math.round(pct),   // porcentaje = acciones en este caso
    }
  }

  return { nombre: '', rfc: '', acciones: 50 }
}

// ── Detectar si un texto es un encabezado con === ──────────────────
function esEncabezado(texto) {
  const t = (texto ?? '').trim()
  return t.startsWith('=') && t.endsWith('=') && t.length > 4
}

function limpiarEncabezado(texto) {
  return (texto ?? '').replace(/^=+\s*/, '').replace(/\s*=+$/, '').trim()
}

export function InstrumentViewer({
  secciones: seccionesIniciales = [],
  instrumentoId,
  readOnly = false,
  font: fontInicial = 'Courier New',
  fontSize: fontSizeInicial = 11,
  onRegenerar,
  regenerando = false,
}) {
  const [secciones, setSecciones]   = useState(seccionesIniciales)
  const [font, setFont]             = useState(fontInicial)
  const [fontSize, setFontSize]     = useState(fontSizeInicial)
  const [interlinea, setInterlinea] = useState(1.5)
  const [margenIdx, setMargenIdx]   = useState(0)
  const [guardando, setGuardando]   = useState(false)
  const [ultimoGuardado, setUltimo] = useState(null)
  const [anchoListo, setAnchoListo] = useState(false)
  const [visorPdf, setVisorPdf]     = useState(false)
  const saveTimer = useRef(null)
  const docRef    = useRef(null)

  const layout = useInstrumentLayout({ font, fontSize })

  useEffect(() => { setSecciones(seccionesIniciales) }, [seccionesIniciales])

  // ── Medir ancho real del DOM ──────────────────────────────────
  useEffect(() => {
    if (!docRef.current || !layout.ready) return
    const medir = () => {
      layout.medirAnchoDOM(docRef.current)
      setAnchoListo(true)  // forzar re-render de párrafos con el ancho correcto
    }
    // Primera medición con delay para que el DOM aplique paddings
    const t = setTimeout(medir, 100)
    window.addEventListener('resize', medir)
    return () => { clearTimeout(t); window.removeEventListener('resize', medir) }
  }, [layout.ready, margenIdx, font, fontSize])

  // ── Autoguardado ─────────────────────────────────────────────
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

  // ── Renderizar sección ────────────────────────────────────────
  const renderSeccion = useCallback((sec, idx) => {
    switch (sec.tipo) {

      case 'encabezado': {
        const raw    = sec.runs?.[0]
        const titulo = Array.isArray(raw) ? (raw[0] ?? '') : (raw?.texto ?? '')
        return (
          <InstrumentHeader
            key={idx}
            titulo={limpiarEncabezado(titulo)}
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

        // ── Detectar encabezado inline con === ──
        const textoCompleto = runs.map(r => r[0] ?? '').join('')
        if (esEncabezado(textoCompleto)) {
          return (
            <InstrumentHeader
              key={idx}
              titulo={limpiarEncabezado(textoCompleto)}
              medir={layout.medir}
              anchoTextoPx={layout.anchoTextoPx}
              readOnly={readOnly}
              onChange={t => handleHeaderChange(idx, t)}
            />
          )
        }

        // ── Detectar run de guiones al final ──
        const ultimoRun = runs[runs.length - 1]
        const esGuion   = ultimoRun && (
          (ultimoRun[0] ?? '').startsWith('.- ') ||
          (ultimoRun[0] ?? '').startsWith('- - ') ||
          (ultimoRun[0] ?? '').match(/^-\s/)
        )
        const segmentos = (esGuion ? runs.slice(0, -1) : runs)
          .map(([texto, bold]) => ({ texto: texto ?? '', bold: !!bold }))
          .filter(s => s.texto)

        return (
          <InstrumentParagraph
            key={`${idx}-${anchoListo}`}  // re-montar cuando el ancho esté listo
            segmentos={segmentos}
            tieneGuiones={!!esGuion}
            calcGuionesSegmentos={layout.calcGuionesSegmentos}
            readOnly={readOnly}
            onChange={segs => handleSeccionChange(idx, segs)}
          />
        )
      }

      case 'vacio':
        return <div key={idx} className="instrument-vacio" />

      case 'tabla_accionaria': {
        const sociosBrutos = sec.data?.socios ?? []
        const socios  = sociosBrutos.map(parseSocio)
        const headers = ['Accionista y RFC', 'Acciones', 'Valor nominal', 'Total']
        const filas   = socios.map(({ nombre, rfc, acciones }) => [
          rfc ? `${nombre} — ${rfc}` : nombre,
          `${acciones} Serie A`,
          '$1,000.00',
          `$${(acciones * 1000).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        ])
        const totalAcc   = socios.reduce((a, s) => a + s.acciones, 0)
        const totalMonto = totalAcc * 1000
        filas.push([
          'T O T A L',
          `${totalAcc} Serie A`,
          '$1,000.00',
          `$${totalMonto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
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
          ? (sec.data?.nombre ?? '') : ''
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
  }, [layout, readOnly, anchoListo, handleSeccionChange, handleHeaderChange])

  const mar = MARGENES_PRESET[margenIdx]

  const docStyle = {
    fontFamily:    `"${font}", monospace`,
    fontSize:      `${fontSize}pt`,
    lineHeight:    interlinea,
    paddingTop:    `${mar.top}cm`,
    paddingBottom: `${mar.bottom}cm`,
    paddingLeft:   `${mar.left}cm`,
    paddingRight:  `${mar.right}cm`,
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
            <button className="iv-btn-print" onClick={() => setVisorPdf(true)}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12v10H2zM5 4V2h6v2M6 8h4M6 11h4"
                  stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              Ver PDF
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
              <button onClick={onRegenerar} disabled={regenerando}
                className="iv-btn-secondary"
                style={{ opacity: regenerando ? 0.6 : 1 }}>
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

      {/* ── Páginas del documento ── */}
      <div className="iv-doc-wrap">
        <div ref={docRef} className="iv-document" style={docStyle}>
          {secciones.map((sec, idx) => renderSeccion(sec, idx))}
        </div>
      </div>

      {/* ── Visor PDF ── */}
      {visorPdf && (
        <InstrumentPdfViewer
          secciones={secciones}
          config={{
            fontSize:     fontSize,
            lineHeight:   interlinea,
            marginTop:    mar.top    * 28.35,
            marginBottom: mar.bottom * 28.35,
            marginLeft:   mar.left   * 28.35,
            marginRight:  mar.right  * 28.35,
          }}
          nombreArchivo={`instrumento-${instrumentoId ?? 'borrador'}`}
          onClose={() => setVisorPdf(false)}
        />
      )}

    </div>
  )
}
