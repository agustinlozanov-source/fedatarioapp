/**
 * InstrumentParagraph.jsx
 * ─────────────────────────────────────────────────────────────────
 * Párrafo editable del instrumento. Cada segmento (bold/normal) es editable
 * inline. Al terminar la edición recalcula los guiones automáticamente.
 *
 * Props:
 *   segmentos:    [{ texto, bold }]
 *   tieneGuiones: boolean
 *   centrado:     boolean
 *   onChange:     (segmentosNuevos) => void
 *   calcGuionesSegmentos: fn del hook
 */

import { useState, useRef, useCallback, useEffect } from 'react'

export function InstrumentParagraph({
  segmentos = [],
  tieneGuiones = true,
  centrado = false,
  onChange,
  calcGuionesSegmentos,
  readOnly = false,
}) {
  const [editando, setEditando] = useState(false)
  const [segs, setSegs]         = useState(segmentos)
  const [guiones, setGuiones]   = useState('')
  const [editIdx, setEditIdx]   = useState(null)
  const inputRef = useRef(null)

  // Sincronizar props externas
  useEffect(() => { setSegs(segmentos) }, [segmentos])

  // Recalcular guiones cuando cambian los segmentos
  useEffect(() => {
    if (!tieneGuiones || !calcGuionesSegmentos) return
    const g = calcGuionesSegmentos(segs)
    setGuiones(g)
  }, [segs, tieneGuiones, calcGuionesSegmentos])

  const handleSegClick = useCallback((idx) => {
    if (readOnly) return
    setEditIdx(idx)
    setEditando(true)
  }, [readOnly])

  const handleSegChange = useCallback((idx, nuevoTexto) => {
    const nuevos = segs.map((s, i) => i === idx ? { ...s, texto: nuevoTexto } : s)
    setSegs(nuevos)
    onChange?.(nuevos)
  }, [segs, onChange])

  const handleBlur = useCallback(() => {
    setEditando(false)
    setEditIdx(null)
  }, [])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }, [])

  return (
    <div
      className={`instrument-paragraph ${centrado ? 'centrado' : ''} ${editando ? 'editando' : ''}`}
      style={{ position: 'relative' }}
    >
      {segs.map((seg, idx) => (
        editIdx === idx ? (
          <input
            key={idx}
            ref={inputRef}
            autoFocus
            className={`seg-input ${seg.bold ? 'bold' : ''}`}
            value={seg.texto}
            onChange={e => handleSegChange(idx, e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{ width: `${Math.max(seg.texto.length, 4)}ch` }}
          />
        ) : (
          <span
            key={idx}
            className={`seg ${seg.bold ? 'bold' : ''} ${!readOnly ? 'editable' : ''}`}
            onClick={() => handleSegClick(idx)}
            title={!readOnly ? 'Click para editar' : undefined}
          >
            {seg.texto}
          </span>
        )
      ))}
      {tieneGuiones && guiones && (
        <span className="guiones">{guiones}</span>
      )}
    </div>
  )
}
