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
  const [encabezado, setEncabezado] = useState(titulo ?? '')

  useEffect(() => { setTextoLocal(titulo) }, [titulo])

  // Calcular === con canvas
  useEffect(() => {
    const t = textoLocal.trim()
    if (!t) return

    // Si no hay ancho disponible todavía, mostrar solo el título
    const anchoPag = anchoTextoPx ? anchoTextoPx() : 0
    if (!anchoPag || !medir) {
      setEncabezado(t)
      return
    }

    const anchoTxt = medir(` ${t} `)
    const anchoEq  = medir('=')
    if (!anchoEq) {
      setEncabezado(t)
      return
    }

    const espacio  = anchoPag - anchoTxt
    const cantidad = Math.max(Math.floor((espacio / anchoEq) / 2), 2)
    const eq       = '='.repeat(cantidad)
    setEncabezado(`${eq} ${t} ${eq}`)
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
