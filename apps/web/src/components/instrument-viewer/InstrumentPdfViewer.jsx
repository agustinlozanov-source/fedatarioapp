/**
 * InstrumentPdfViewer.jsx
 * ─────────────────────────────────────────────────────────────────
 * Modal con visor PDF interno y botón de descarga.
 * No depende de ningún browser externo.
 *
 * Uso:
 *   <InstrumentPdfViewer
 *     secciones={secciones}
 *     config={{ fontSize: 11, lineHeight: 1.5, ... }}
 *     nombreArchivo="Instrumento-1234"
 *     onClose={() => setVisorAbierto(false)}
 *   />
 */

'use client'

import { useState, useEffect, useCallback } from 'react'

// @react-pdf se importa dinámicamente para evitar errores de SSR
// (usa APIs del browser que no existen en Node)
let PDFViewer, PDFDownloadLink

export function InstrumentPdfViewer({
  secciones = [],
  config = {},
  nombreArchivo = 'instrumento',
  onClose,
}) {
  const [componentes, setComponentes] = useState(null)
  const [PdfDoc, setPdfDoc]           = useState(null)
  const [cargando, setCargando]       = useState(true)
  const [error, setError]             = useState(null)

  // Importar @react-pdf dinámicamente (solo en el browser)
  useEffect(() => {
    let cancelled = false
    async function cargar() {
      try {
        const [reactPdf, { InstrumentPdfDocument }] = await Promise.all([
          import('@react-pdf/renderer'),
          import('./InstrumentPdfDocument'),
        ])
        if (cancelled) return
        setComponentes({
          PDFViewer:       reactPdf.PDFViewer,
          PDFDownloadLink: reactPdf.PDFDownloadLink,
        })
        setPdfDoc(() => InstrumentPdfDocument)
        setCargando(false)
      } catch (e) {
        console.error('Error cargando react-pdf:', e)
        setError('No se pudo cargar el generador de PDF.')
        setCargando(false)
      }
    }
    cargar()
    return () => { cancelled = true }
  }, [])

  // Cerrar con Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) onClose?.()
  }, [onClose])

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="pdf-modal-backdrop" onClick={handleBackdrop}>
      <div className="pdf-modal">

        {/* Header */}
        <div className="pdf-modal-header">
          <span className="pdf-modal-title">Vista previa del documento</span>
          <div className="pdf-modal-actions">
            {!cargando && !error && componentes && PdfDoc && (
              <componentes.PDFDownloadLink
                document={<PdfDoc secciones={secciones} config={config} />}
                fileName={`${nombreArchivo}.pdf`}
                className="pdf-btn-download"
              >
                {({ loading }) => loading ? 'Generando…' : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                      <path d="M7.5 1v9M4 7l3.5 3.5L11 7M2 13h11"
                        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Descargar PDF
                  </>
                )}
              </componentes.PDFDownloadLink>
            )}
            <button className="pdf-btn-close" onClick={onClose} title="Cerrar">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="pdf-modal-body">
          {cargando && (
            <div className="pdf-loading">
              <div className="pdf-spinner" />
              <span>Generando documento…</span>
            </div>
          )}

          {error && (
            <div className="pdf-error">{error}</div>
          )}

          {!cargando && !error && componentes && PdfDoc && (
            <componentes.PDFViewer
              style={{ width: '100%', height: '100%', border: 'none' }}
              showToolbar={false}
            >
              <PdfDoc secciones={secciones} config={config} />
            </componentes.PDFViewer>
          )}
        </div>

      </div>
    </div>
  )
}
