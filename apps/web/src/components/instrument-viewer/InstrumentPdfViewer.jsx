'use client'

import { useState, useEffect, useCallback } from 'react'

function parseSocio(s) {
  if (!s) return { nombre: '', rfc: '', acciones: 50 }
  if (typeof s === 'object') return {
    nombre: s.nombre_completo ?? s.nombre ?? '',
    rfc: s.rfc ?? '',
    acciones: Number(s.acciones ?? s.porcentaje ?? 50) || 50,
  }
  if (typeof s === 'string') {
    const ex = (key) => {
      const mq = s.match(new RegExp(`${key}='([^']*)'`))
      if (mq) return mq[1]
      const mn = s.match(new RegExp(`${key}=([^\\s,)]+)`))
      return mn ? mn[1] : ''
    }
    return { nombre: ex('nombre_completo'), rfc: ex('rfc'), acciones: Math.round(parseFloat(ex('porcentaje')) || 50) }
  }
  return { nombre: '', rfc: '', acciones: 50 }
}

function esEncabezado(texto) {
  const t = (texto ?? '').trim()
  return t.startsWith('=') && t.endsWith('=') && t.length > 4
}

function limpiarEncabezado(texto) {
  return (texto ?? '').replace(/^=+\s*/, '').replace(/\s*=+$/, '').trim()
}

function generarPdf(secciones, config, nombreArchivo, jsPDF) {
  const {
    fontSize = 11, lineHeight = 1.5,
    marginTop = 119, marginBottom = 105,
    marginLeft = 128, marginRight = 99,
  } = config
  const doc = new jsPDF({ unit: 'pt', format: [612, 1008], orientation: 'portrait' })
  doc.setFont('Courier', 'normal')
  doc.setFontSize(fontSize)

  const pageH = 1008
  const textW = 612 - marginLeft - marginRight
  const lineH = fontSize * lineHeight
  let y = marginTop + fontSize

  const newPage = () => { doc.addPage(); y = marginTop + fontSize }
  const checkY = (needed = lineH) => { if (y + needed > pageH - marginBottom) newPage() }
  const charW = fontSize * 0.6

  const calcEnc = (titulo) => {
    const charsTotal = Math.floor(textW / charW)
    const inner = ` ${titulo} `
    const pad = charsTotal - inner.length
    if (pad < 4) return inner.trim()
    const left = Math.floor(pad / 2)
    return '='.repeat(left) + inner + '='.repeat(pad - left)
  }

  const escribirParrafo = (texto, bold = false) => {
    doc.setFont('Courier', bold ? 'bold' : 'normal')
    const lines = doc.splitTextToSize(texto, textW)
    lines.forEach(line => { checkY(); doc.text(line, marginLeft, y); y += lineH })
    doc.setFont('Courier', 'normal')
  }

  const escribirEncabezado = (titulo) => {
    checkY(); doc.setFont('Courier', 'bold')
    doc.text(calcEnc(titulo), marginLeft, y)
    doc.setFont('Courier', 'normal'); y += lineH
  }

  for (const sec of secciones) {
    if (sec.tipo === 'vacio') { y += lineH; continue }
    if (sec.tipo === 'encabezado') {
      const raw = sec.runs?.[0]
      escribirEncabezado(limpiarEncabezado(Array.isArray(raw) ? (raw[0] ?? '') : ''))
      continue
    }
    if (sec.tipo === 'parrafo') {
      const runs = (sec.runs ?? []).map(r => Array.isArray(r) ? r : [r?.texto ?? '', r?.bold ?? false])
      const textoCompleto = runs.map(r => r[0] ?? '').join('')
      if (esEncabezado(textoCompleto)) { escribirEncabezado(limpiarEncabezado(textoCompleto)); continue }
      const ultimo = runs[runs.length - 1]
      const esGuion = ultimo && /^\.?-\s/.test(ultimo[0] ?? '')
      const runsLimpios = esGuion ? runs.slice(0, -1) : runs
      const textoParrafo = runsLimpios.map(r => r[0] ?? '').join('')
      if (textoParrafo.trim()) escribirParrafo(textoParrafo, false)
      continue
    }
    if (sec.tipo === 'tabla_accionaria') {
      const socios = (sec.data?.socios ?? []).map(parseSocio)
      const totalAcc = socios.reduce((a, s) => a + s.acciones, 0)
      const filas = [
        ['Accionista y RFC', 'Acciones', 'Valor', 'Total'],
        ...socios.map(({ nombre, rfc, acciones }) => [rfc ? `${nombre} - ${rfc}` : nombre, `${acciones} Serie A`, '$1,000.00', `$${(acciones * 1000).toLocaleString('es-MX')}`]),
        ['T O T A L', `${totalAcc} Serie A`, '$1,000.00', `$${(totalAcc * 1000).toLocaleString('es-MX')}`]
      ]
      const colW = textW / 4, rowH = fontSize * 1.6
      checkY(rowH * filas.length)
      filas.forEach((fila, ri) => {
        fila.forEach((celda, ci) => {
          const x = marginLeft + ci * colW
          if (ri === 0) { doc.setFillColor(201, 201, 201); doc.rect(x, y - fontSize, colW, rowH, 'F'); doc.setFont('Courier', 'bold') }
          else doc.setFont('Courier', ri === filas.length - 1 ? 'bold' : 'normal')
          doc.rect(x, y - fontSize, colW, rowH)
          doc.text(String(celda ?? ''), x + 3, y, { maxWidth: colW - 6 })
        })
        y += rowH
      })
      doc.setFont('Courier', 'normal'); continue
    }
    if (sec.tipo === 'firma' || sec.tipo === 'corredor') {
      const nombre = sec.tipo === 'corredor' ? 'WILFREDO EMMANUEL RAMÍREZ NÚÑEZ' : (sec.data?.nombre ?? '')
      if (!nombre) continue
      checkY(lineH * 3); y += lineH
      doc.line(marginLeft, y, marginLeft + textW * 0.55, y)
      y += lineH * 0.4; doc.setFont('Courier', 'bold')
      doc.text(nombre.toUpperCase(), marginLeft, y)
      doc.setFont('Courier', 'normal'); y += lineH
    }
  }
  return doc
}

export function InstrumentPdfViewer({ secciones = [], config = {}, nombreArchivo = 'instrumento', onClose }) {
  const [pdfUrl, setPdfUrl]     = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    let objectUrl = null
    async function generar() {
      try {
        const { jsPDF } = await import('jspdf')
        const doc = generarPdf(secciones, config, nombreArchivo, jsPDF)
        const blob = doc.output('blob')
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
      } catch (e) {
        console.error('Error generando PDF:', e)
        setError('No se pudo generar el PDF: ' + e.message)
      } finally { setCargando(false) }
    }
    generar()
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleDownload = () => {
    if (!pdfUrl) return
    const a = document.createElement('a')
    a.href = pdfUrl; a.download = `${nombreArchivo}.pdf`; a.click()
  }

  return (
    <div className="pdf-modal-backdrop" onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="pdf-modal">
        <div className="pdf-modal-header">
          <span className="pdf-modal-title">Vista previa del documento</span>
          <div className="pdf-modal-actions">
            {pdfUrl && (
              <button className="pdf-btn-download" onClick={handleDownload}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M7.5 1v9M4 7l3.5 3.5L11 7M2 13h11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Descargar PDF
              </button>
            )}
            <button className="pdf-btn-close" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="pdf-modal-body">
          {cargando && (<div className="pdf-loading"><div className="pdf-spinner" /><span>Generando documento…</span></div>)}
          {error && <div className="pdf-error">{error}</div>}
          {pdfUrl && (<iframe src={pdfUrl} style={{ width: '100%', height: '100%', border: 'none' }} />)}
        </div>
      </div>
    </div>
  )
}
