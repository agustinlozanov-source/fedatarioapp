/**
 * InstrumentHeader.jsx
 * ─────────────────────────────────────────────────────────────────
 * Encabezado de sección con === a ambos lados, calculados con canvas.
 * Editable inline al hacer click.
 */

import { useState, useEffect, useCallback } from 'react'

export function InstrumentHeader({
  titulo,
  onChange,
  medir,
  anchoTextoPx,
  readOnly = false,
}) {
  const [editando, setEditando]   = useState(false)
  const [textoLocal, setTextoLocal] = useState(titulo)
  const [encabezado, setEncabezado] = useState('')

  useEffect(() => { setTextoLocal(titulo) }, [titulo])

  // Calcular === con canvas
  useEffect(() => {
    if (!medir || !anchoTextoPx) return
    const anchoPag  = anchoTextoPx()
    const anchoTxt  = medir(` ${textoLocal} `)
    const anchoEq   = medir('=')
    const espacio   = anchoPag - anchoTxt
    const cantidad  = Math.max(Math.floor((espacio / anchoEq) / 2), 2)
    const eq        = '='.repeat(cantidad)
    setEncabezado(`${eq} ${textoLocal} ${eq}`)
  }, [textoLocal, medir, anchoTextoPx])

  const handleBlur = useCallback(() => {
    setEditando(false)
    onChange?.(textoLocal)
  }, [textoLocal, onChange])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
  }, [])

  if (editando) {
    return (
      <div className="instrument-header editando">
        <input
          autoFocus
          className="header-input"
          value={textoLocal}
          onChange={e => setTextoLocal(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      </div>
    )
  }

  return (
    <div
      className={`instrument-header ${!readOnly ? 'editable' : ''}`}
      onClick={() => !readOnly && setEditando(true)}
      title={!readOnly ? 'Click para editar' : undefined}
    >
      {encabezado}
    </div>
  )
}
