/**
 * InstrumentTable.jsx
 * ─────────────────────────────────────────────────────────────────
 * Tabla accionaria o de capital. Recibe filas y headers genéricos.
 */

export function InstrumentTable({ headers, filas, caption }) {
  return (
    <div className="instrument-table-wrap">
      {caption && <div className="table-caption">{caption}</div>}
      <table className="instrument-table">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {fila.map((celda, j) => (
                <td key={j} className={j > 0 ? 'centrado' : ''}>{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
