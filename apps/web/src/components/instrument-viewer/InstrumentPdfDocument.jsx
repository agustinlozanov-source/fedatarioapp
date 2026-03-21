/**
 * InstrumentPdfDocument.jsx
 * ─────────────────────────────────────────────────────────────────
 * Genera el PDF del instrumento usando @react-pdf/renderer.
 * Produce output idéntico siempre — sin dependencia del browser.
 *
 * Uso:
 *   import { InstrumentPdfDocument } from './InstrumentPdfDocument'
 *   <PDFViewer><InstrumentPdfDocument secciones={...} config={...} /></PDFViewer>
 */

import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'

// ─── Registrar Courier como fuente ────────────────────────────────
// @react-pdf usa sus propias fuentes — no las del browser.
// Courier es la única monoespaciada built-in garantizada.
// Si quieres otra fuente, debes registrarla con Font.register() y una URL.
Font.register({
  family: 'Courier',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/courierprime/v9/u-450q2lgwslOqpF_6gQ8kELY7pMf-c.ttf' },
    { src: 'https://fonts.gstatic.com/s/courierprime/v9/u-4n0q2lgwslOqpF_6gQ8kELWwIYFk.ttf', fontWeight: 'bold' },
  ],
})

// ─── Constantes de página ─────────────────────────────────────────
// Oficio/Legal: 8.5in × 14in en puntos (1in = 72pt)
const PAGE_W  = 8.5  * 72   // 612pt
const PAGE_H  = 14   * 72   // 1008pt

// ─── Helpers ─────────────────────────────────────────────────────

function parseSocio(s) {
  if (!s) return { nombre: '', rfc: '', acciones: 50 }
  if (typeof s === 'object') {
    return {
      nombre:   s.nombre_completo ?? s.nombre ?? '',
      rfc:      s.rfc ?? '',
      acciones: Number(s.acciones ?? s.porcentaje ?? 50) || 50,
    }
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

// Calcular === para un título dado el ancho de página en pt
function calcEncabezado(titulo, marLeft, marRight, fontSize) {
  // Ancho del área de texto en pt
  const anchoTexto = PAGE_W - marLeft - marRight
  // Courier New monoespaciada: ancho de carácter ≈ fontSize * 0.6
  const charW      = fontSize * 0.6
  const charsTotal = Math.floor(anchoTexto / charW)
  const inner      = ` ${titulo} `
  const padding    = charsTotal - inner.length
  if (padding < 4) return inner.trim()
  const left  = Math.floor(padding / 2)
  const right = padding - left
  return '='.repeat(left) + inner + '='.repeat(right)
}

// ─── Estilos ──────────────────────────────────────────────────────
function makeStyles(cfg) {
  const { fontSize, marginTop, marginBottom, marginLeft, marginRight, lineHeight } = cfg
  return StyleSheet.create({
    page: {
      fontFamily:    'Courier',
      fontSize:      fontSize,
      lineHeight:    lineHeight,
      paddingTop:    marginTop,
      paddingBottom: marginBottom,
      paddingLeft:   marginLeft,
      paddingRight:  marginRight,
      color:         '#1D1D1F',
    },
    parrafo: {
      textAlign:  'justify',
      marginBottom: 0,
      flexDirection: 'row',
      flexWrap:   'wrap',
    },
    segNormal: {
      fontWeight: 'normal',
    },
    segBold: {
      fontWeight: 'bold',
    },
    encabezado: {
      fontWeight:  'bold',
      textAlign:   'left',
      marginBottom: 0,
    },
    vacio: {
      height: fontSize * lineHeight,
    },
    // Tabla
    tabla: {
      width:      '100%',
      marginTop:  4,
      marginBottom: 4,
    },
    tablaFila: {
      flexDirection: 'row',
      borderBottom: '0.5pt solid #1D1D1F',
    },
    tablaCeldaHeader: {
      flex:            1,
      padding:         '2pt 4pt',
      backgroundColor: '#C9C9C9',
      fontWeight:      'bold',
      textAlign:       'center',
      fontSize:        fontSize - 0.5,
      borderRight:     '0.5pt solid #1D1D1F',
    },
    tablaCelda: {
      flex:        1,
      padding:     '2pt 4pt',
      fontSize:    fontSize - 0.5,
      borderRight: '0.5pt solid #1D1D1F',
    },
    tablaCeldaTotal: {
      flex:        1,
      padding:     '2pt 4pt',
      fontSize:    fontSize - 0.5,
      fontWeight:  'bold',
      borderRight: '0.5pt solid #1D1D1F',
    },
    tablaWrap: {
      border: '0.5pt solid #1D1D1F',
    },
    // Firma
    firma: {
      marginTop:   24,
      width:       '55%',
    },
    firmaLinea: {
      borderBottom: '0.5pt solid #1D1D1F',
      marginBottom: 4,
    },
    firmaNombre: {
      fontWeight: 'bold',
      fontSize:   fontSize - 0.5,
    },
    firmaLabels: {
      flexDirection: 'row',
      gap:           12,
      fontSize:      fontSize - 1.5,
      color:         '#6E6E73',
      marginTop:     2,
    },
  })
}

// ─── Componentes de renderizado PDF ──────────────────────────────

function PdfParrafo({ runs, tieneGuiones, styles, cfg }) {
  // Reconstruir texto completo para los guiones
  // En PDF usamos el texto tal como viene — @react-pdf hace el layout
  const segmentos = runs.map(r =>
    Array.isArray(r) ? { texto: r[0] ?? '', bold: !!r[1] } : r
  )
  return (
    <View style={styles.parrafo}>
      {segmentos.map((seg, i) => (
        <Text key={i} style={seg.bold ? styles.segBold : styles.segNormal}>
          {seg.texto}
        </Text>
      ))}
    </View>
  )
}

function PdfEncabezado({ titulo, styles, cfg }) {
  const enc = calcEncabezado(titulo, cfg.marginLeft, cfg.marginRight, cfg.fontSize)
  return (
    <Text style={styles.encabezado}>{enc}</Text>
  )
}

function PdfTabla({ headers, filas, styles }) {
  return (
    <View style={[styles.tabla, styles.tablaWrap]}>
      {/* Header */}
      <View style={styles.tablaFila}>
        {headers.map((h, i) => (
          <Text key={i} style={styles.tablaCeldaHeader}>{h}</Text>
        ))}
      </View>
      {/* Filas */}
      {filas.map((fila, ri) => (
        <View key={ri} style={styles.tablaFila}>
          {fila.map((celda, ci) => (
            <Text
              key={ci}
              style={ri === filas.length - 1 ? styles.tablaCeldaTotal : styles.tablaCelda}
            >
              {celda}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function PdfFirma({ nombre, styles }) {
  return (
    <View style={styles.firma}>
      <View style={styles.firmaLinea} />
      <Text style={styles.firmaNombre}>{nombre.toUpperCase()}</Text>
      <View style={styles.firmaLabels}>
        <Text>Nombre completo.</Text>
        <Text>Firma.</Text>
        <Text>Huellas Índices Izquierdo y Derecho.</Text>
      </View>
    </View>
  )
}

// ─── Componente principal ─────────────────────────────────────────

export function InstrumentPdfDocument({ secciones = [], config = {} }) {
  const cfg = {
    fontSize:      config.fontSize      ?? 11,
    lineHeight:    config.lineHeight    ?? 1.5,
    marginTop:     config.marginTop     ?? 4.2  * 28.35,  // cm → pt
    marginBottom:  config.marginBottom  ?? 3.7  * 28.35,
    marginLeft:    config.marginLeft    ?? 4.5  * 28.35,
    marginRight:   config.marginRight   ?? 3.5  * 28.35,
  }

  const styles = makeStyles(cfg)

  const renderSeccion = (sec, idx) => {
    switch (sec.tipo) {

      case 'encabezado': {
        const raw    = sec.runs?.[0]
        const titulo = Array.isArray(raw) ? (raw[0] ?? '') : ''
        return <PdfEncabezado key={idx} titulo={limpiarEncabezado(titulo)} styles={styles} cfg={cfg} />
      }

      case 'parrafo': {
        const runs = (sec.runs ?? []).map(r =>
          Array.isArray(r) ? r : [r?.texto ?? '', r?.bold ?? false]
        )
        const textoCompleto = runs.map(r => r[0] ?? '').join('')

        if (esEncabezado(textoCompleto)) {
          return <PdfEncabezado key={idx} titulo={limpiarEncabezado(textoCompleto)} styles={styles} cfg={cfg} />
        }

        const ultimoRun = runs[runs.length - 1]
        const esGuion   = ultimoRun && /^\.?-\s/.test(ultimoRun[0] ?? '')
        const runsLimpios = esGuion ? runs.slice(0, -1) : runs

        return (
          <PdfParrafo
            key={idx}
            runs={runsLimpios}
            tieneGuiones={!!esGuion}
            styles={styles}
            cfg={cfg}
          />
        )
      }

      case 'vacio':
        return <View key={idx} style={styles.vacio} />

      case 'tabla_accionaria': {
        const socios  = (sec.data?.socios ?? []).map(parseSocio)
        const headers = ['Accionista y RFC', 'Acciones', 'Valor nominal', 'Total']
        const filas   = socios.map(({ nombre, rfc, acciones }) => [
          rfc ? `${nombre} — ${rfc}` : nombre,
          `${acciones} Serie A`,
          '$1,000.00',
          `$${(acciones * 1000).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        ])
        const totalAcc = socios.reduce((a, s) => a + s.acciones, 0)
        filas.push([
          'T O T A L',
          `${totalAcc} Serie A`,
          '$1,000.00',
          `$${(totalAcc * 1000).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
        ])
        return <PdfTabla key={idx} headers={headers} filas={filas} styles={styles} />
      }

      case 'firma': {
        const nombre = sec.data?.nombre ?? ''
        return nombre ? <PdfFirma key={idx} nombre={nombre} styles={styles} /> : null
      }

      case 'corredor':
        return (
          <PdfFirma
            key={idx}
            nombre="WILFREDO EMMANUEL RAMÍREZ NÚÑEZ"
            styles={styles}
          />
        )

      default:
        return null
    }
  }

  return (
    <Document>
      <Page
        size={[PAGE_W, PAGE_H]}
        style={styles.page}
        wrap
      >
        {secciones.map((sec, idx) => renderSeccion(sec, idx))}
      </Page>
    </Document>
  )
}
