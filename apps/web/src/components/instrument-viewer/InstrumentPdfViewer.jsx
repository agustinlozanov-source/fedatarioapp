'use client'

import { useState, useEffect } from 'react'

// ─── Helpers de datos ─────────────────────────────────────────────

function parseSocio(s) {
  if (!s) return { nombre: '', rfc: '', acciones: 50 }
  if (typeof s === 'object') return {
    nombre:   s.nombre_completo ?? s.nombre ?? '',
    rfc:      s.rfc ?? '',
    acciones: Number(s.acciones ?? s.porcentaje ?? 50) || 50,
  }
  if (typeof s === 'string') {
    const ex = (key) => {
      const mq = s.match(new RegExp(`${key}='([^']*)'`))
      if (mq) return mq[1]
      const mn = s.match(new RegExp(`${key}=([^\\s,)]+)`))
      return mn ? mn[1] : ''
    }
    return {
      nombre:   ex('nombre_completo'),
      rfc:      ex('rfc'),
      acciones: Math.round(parseFloat(ex('porcentaje')) || 50),
    }
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

// ─── Motor de generación PDF ──────────────────────────────────────

function generarPdf(secciones, config, jsPDF) {
  const {
    fontSize     = 11,
    lineHeight   = 1.5,
    marginTop    = 4.2  * 28.35,
    marginBottom = 3.7  * 28.35,
    marginLeft   = 4.5  * 28.35,
    marginRight  = 3.5  * 28.35,
  } = config

  const PAGE_W = 612
  const PAGE_H = 1008
  const TEXT_W = PAGE_W - marginLeft - marginRight
  const LINE_H = fontSize * lineHeight

  const doc = new jsPDF({ unit: 'pt', format: [PAGE_W, PAGE_H] })
  doc.setFont('Courier', 'normal')
  doc.setFontSize(fontSize)

  let y = marginTop + fontSize

  const newPage = () => { doc.addPage(); y = marginTop + fontSize }
  const checkY  = (needed = LINE_H) => { if (y + needed > PAGE_H - marginBottom) newPage() }

  // Medición exacta con jsPDF — usa la fuente activa
  const medir = (texto, bold = false) => {
    doc.setFont('Courier', bold ? 'bold' : 'normal')
    const w = doc.getTextWidth(texto)
    doc.setFont('Courier', 'normal')
    return w
  }

  // Calcular === para un encabezado
  const calcEncabezado = (titulo) => {
    const anchoInner = medir(` ${titulo} `, true)
    const anchoEq    = medir('=', true)
    const espacio    = TEXT_W - anchoInner
    const cantidad   = Math.max(Math.floor((espacio / anchoEq) / 2), 2)
    const eq         = '='.repeat(cantidad)
    return `${eq} ${titulo} ${eq}`
  }

  // Calcular guiones dado xActual (px desde margen izq)
  const calcGuiones = (xActual, terminaPunto) => {
    const sep       = terminaPunto ? '- ' : '.- '
    const anchoSep  = medir(sep)
    const anchoDash = medir('- ')
    let espacio     = TEXT_W - xActual - anchoSep
    if (espacio < anchoDash * 3) espacio = TEXT_W - anchoSep
    const cantidad = Math.max(Math.floor(espacio / anchoDash), 1)
    return sep + Array(cantidad).fill('- ').join('').trimEnd()
  }

  // Escribir encabezado bold con ===
  const escribirEncabezado = (titulo) => {
    if (!titulo.trim()) return
    checkY()
    doc.setFont('Courier', 'bold')
    doc.text(calcEncabezado(titulo), marginLeft, y)
    doc.setFont('Courier', 'normal')
    y += LINE_H
  }

  // Escribir párrafo con runs mixtos bold/normal y guiones exactos
  const escribirParrafoConRuns = (runs, tieneGuiones) => {
    const segmentos  = runs.map(([texto, bold]) => ({ texto: texto ?? '', bold: !!bold }))
    const textoTotal = segmentos.map(s => s.texto).join('')
    if (!textoTotal.trim()) return

    // Word-wrap: obtener líneas
    doc.setFont('Courier', 'normal')
    const lineas = doc.splitTextToSize(textoTotal, TEXT_W)

    let charOffset = 0

    lineas.forEach((linea, idxLinea) => {
      checkY()
      const esUltima = idxLinea === lineas.length - 1
      let xCursor    = marginLeft
      let charEnLinea = 0
      const lineaLen  = linea.length

      // Renderizar cada segmento bold/normal en la posición correcta
      while (charEnLinea < lineaLen) {
        const posGlobal = charOffset + charEnLinea
        let segActual   = null
        let segStart    = 0
        let acum        = 0

        for (const seg of segmentos) {
          if (posGlobal < acum + seg.texto.length) {
            segActual = seg
            segStart  = posGlobal - acum
            break
          }
          acum += seg.texto.length
        }

        if (!segActual) break

        const charsDisp    = lineaLen - charEnLinea
        const charsEnSeg   = Math.min(segActual.texto.length - segStart, charsDisp)
        const textoSegmento = segActual.texto.substring(segStart, segStart + charsEnSeg)

        if (textoSegmento) {
          doc.setFont('Courier', segActual.bold ? 'bold' : 'normal')
          doc.text(textoSegmento, xCursor, y)
          xCursor += doc.getTextWidth(textoSegmento)
        }

        charEnLinea += charsEnSeg
      }

      // Guiones al final del último renglón
      if (esUltima && tieneGuiones) {
        const xFinal       = xCursor - marginLeft
        const terminaPunto = linea.trimEnd().endsWith('.')
        doc.setFont('Courier', 'normal')
        doc.text(calcGuiones(xFinal, terminaPunto), xCursor, y)
      }

      // Avanzar offset de caracteres
      charOffset += lineaLen
      if (idxLinea < lineas.length - 1 && textoTotal[charOffset] === ' ') charOffset++

      y += LINE_H
    })

    doc.setFont('Courier', 'normal')
  }

  // Escribir tabla
  const escribirTabla = (headers, filas) => {
    const COL_W = TEXT_W / headers.length
    const ROW_H = fontSize * 1.8
    checkY(ROW_H * (filas.length + 1))

    const renderFila = (fila, ri) => {
      fila.forEach((celda, ci) => {
        const x = marginLeft + ci * COL_W
        if (ri === 0) {
          doc.setFillColor(201, 201, 201)
          doc.rect(x, y - fontSize * 0.8, COL_W, ROW_H, 'FD')
          doc.setFont('Courier', 'bold')
        } else {
          doc.rect(x, y - fontSize * 0.8, COL_W, ROW_H, 'D')
          doc.setFont('Courier', ri === filas.length ? 'bold' : 'normal')
        }
        const txt = doc.splitTextToSize(String(celda ?? ''), COL_W - 6)
        doc.text(txt[0] ?? '', x + 3, y)
      })
      y += ROW_H
    }

    renderFila(headers, 0)
    filas.forEach((fila, ri) => renderFila(fila, ri + 1))
    doc.setFont('Courier', 'normal')
  }

  // Escribir firma
  const escribirFirma = (nombre) => {
    checkY(LINE_H * 4)
    y += LINE_H * 0.5
    doc.line(marginLeft, y, marginLeft + TEXT_W * 0.55, y)
    y += LINE_H * 0.5
    doc.setFont('Courier', 'bold')
    doc.text(nombre.toUpperCase(), marginLeft, y)
    doc.setFont('Courier', 'normal')
    y += LINE_H * 0.4
    doc.setFontSize(fontSize - 1.5)
    doc.setTextColor(110, 110, 115)
    doc.text('Nombre completo.     Firma.     Huellas Índices Izquierdo y Derecho.', marginLeft, y)
    doc.setFontSize(fontSize)
    doc.setTextColor(29, 29, 31)
    y += LINE_H
  }

  // ── Loop principal ──────────────────────────────────────────────
  for (const sec of secciones) {

    if (sec.tipo === 'vacio') {
      y += LINE_H * 0.5
      continue
    }

    if (sec.tipo === 'encabezado') {
      const raw    = sec.runs?.[0]
      const titulo = Array.isArray(raw) ? (raw[0] ?? '') : ''
      escribirEncabezado(limpiarEncabezado(titulo))
      continue
    }

    if (sec.tipo === 'parrafo') {
      const runs = (sec.runs ?? []).map(r =>
        Array.isArray(r) ? r : [r?.texto ?? '', r?.bold ?? false]
      )
      const textoCompleto = runs.map(r => r[0] ?? '').join('')

      if (esEncabezado(textoCompleto)) {
        escribirEncabezado(limpiarEncabezado(textoCompleto))
        continue
      }

      const ultimoRun    = runs[runs.length - 1]
      const tieneGuiones = !!ultimoRun && /^\.?-\s/.test(ultimoRun[0] ?? '')
      const runsLimpios  = tieneGuiones ? runs.slice(0, -1) : runs

      if (runsLimpios.some(r => (r[0] ?? '').trim())) {
        escribirParrafoConRuns(runsLimpios, tieneGuiones)
      }
      continue
    }

    if (sec.tipo === 'tabla_accionaria') {
      const socios   = (sec.data?.socios ?? []).map(parseSocio)
      const totalAcc = socios.reduce((a, s) => a + s.acciones, 0)
      const headers  = ['Accionista y RFC', 'Acciones', 'Valor nominal', 'Total']
      const filas    = [
        ...socios.map(({ nombre, rfc, acciones }) => [
          rfc ? `${nombre} — ${rfc}` : nombre,
          `${acciones} Serie A`,
          '$1,000.00',
          `$${(acciones * 1000).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        ]),
        ['T O T A L', `${totalAcc} Serie A`, '$1,000.00',
          `$${(totalAcc * 1000).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`],
      ]
      escribirTabla(headers, filas)
      continue
    }

    if (sec.tipo === 'tabla_capital_srl') {
      const socios  = sec.data?.socios ?? []
      const headers = ['Socio', 'Parte social', 'Valor', 'Con letra']
      const filas   = socios.map(s => [
        s.nombre_completo ?? s.nombre ?? '',
        s.monto_parte_social ?? '',
        s.valor ?? '',
        s.con_letra ?? '',
      ])
      escribirTabla(headers, filas)
      continue
    }

    if (sec.tipo === 'firma') {
      const nombre = sec.data?.nombre ?? ''
      if (nombre) escribirFirma(nombre)
      continue
    }

    if (sec.tipo === 'corredor') {
      escribirFirma('WILFREDO EMMANUEL RAMÍREZ NÚÑEZ')
      continue
    }
  }

  return doc
}

// ─── Componente React ─────────────────────────────────────────────

export function InstrumentPdfViewer({
  secciones     = [],
  config        = {},
  nombreArchivo = 'instrumento',
  onClose,
}) {
  const [pdfUrl,   setPdfUrl]   = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error,    setError]    = useState(null)

  useEffect(() => {
    let objectUrl = null
    async function generar() {
      try {
        const { jsPDF } = await import('jspdf')
        const doc = generarPdf(secciones, config, jsPDF)
        const blob = doc.output('blob')
        objectUrl = URL.createObjectURL(blob)
        setPdfUrl(objectUrl)
      } catch (e) {
        console.error('Error generando PDF:', e)
        setError('Error al generar el PDF: ' + e.message)
      } finally {
        setCargando(false)
      }
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
    a.href = pdfUrl
    a.download = `${nombreArchivo}.pdf`
    a.click()
  }

  return (
    <div
      className="pdf-modal-backdrop"
      onClick={e => e.target === e.currentTarget && onClose?.()}
    >
      <div className="pdf-modal">
        <div className="pdf-modal-header">
          <span className="pdf-modal-title">Vista previa del instrumento</span>
          <div className="pdf-modal-actions">
            {pdfUrl && (
              <button className="pdf-btn-download" onClick={handleDownload}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M7.5 1v9M4 7l3.5 3.5L11 7M2 13h11"
                    stroke="currentColor" strokeWidth="1.3"
                    strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Descargar PDF
              </button>
            )}
            <button className="pdf-btn-close" onClick={onClose} title="Cerrar (Esc)">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14"
                  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="pdf-modal-body">
          {cargando && (
            <div className="pdf-loading">
              <div className="pdf-spinner" />
              <span>Generando documento…</span>
            </div>
          )}
          {error && <div className="pdf-error">{error}</div>}
          {pdfUrl && (
            <iframe
              src={pdfUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Vista previa del instrumento"
            />
          )}
        </div>
      </div>
    </div>
  )
}
