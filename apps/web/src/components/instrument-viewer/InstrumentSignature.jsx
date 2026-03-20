/**
 * InstrumentSignature.jsx
 * ─────────────────────────────────────────────────────────────────
 * Bloque de firma: nombre + línea + espacio para firma y huellas.
 */

export function InstrumentSignature({ nombre, esCorredor = false }) {
  return (
    <div className={`instrument-signature ${esCorredor ? 'corredor' : ''}`}>
      <div className="sig-line" />
      <div className="sig-nombre">{nombre.toUpperCase()}</div>
      <div className="sig-labels">
        <span>Nombre completo.</span>
        <span>Firma.</span>
        <span>Huellas Índices Izquierdo y Derecho.</span>
      </div>
    </div>
  )
}
