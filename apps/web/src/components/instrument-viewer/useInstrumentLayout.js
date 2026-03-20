/**
 * useInstrumentLayout.js
 * ─────────────────────────────────────────────────────────────────
 * Hook central del visor. Calcula guiones de relleno usando canvas.measureText()
 * — medición real de píxeles, exacta para cualquier fuente monoespaciada.
 *
 * Uso:
 *   const { calcGuiones, anchoRenglon } = useInstrumentLayout({ font, fontSize, pageWidthPt, margins })
 */

import { useRef, useCallback, useEffect, useState } from 'react'

// ─── Constantes por defecto ────────────────────────────────────────
const DEFAULTS = {
  font: 'Courier New',
  fontSize: 11,           // pt
  pageWidthPt: 612,       // US Letter = 612pt (8.5in × 72pt/in)
  pageHeightPt: 1008,     // Oficio = 14in × 72pt/in
  marginTopPt: 168,       // 2410 twips / 1440 * 72 ≈ 120pt  (ajustado al doc real)
  marginBottomPt: 106,
  marginLeftPt: 120,
  marginRightPt: 79,
  minDashes: 3,           // mínimo de "- " para que valga la pena en el renglón actual
  ptToPx: 96 / 72,        // conversión pt → px para canvas (screen 96dpi)
}

// ─── Separadores según contexto ───────────────────────────────────
const SEP_PUNTO  = '- '    // cuando el texto termina en punto (evita doble punto)
const SEP_NORMAL = '.- '   // separador estándar

export function useInstrumentLayout(overrides = {}) {
  const cfg = { ...DEFAULTS, ...overrides }
  const canvasRef = useRef(null)
  const ctxRef    = useRef(null)
  const [ready, setReady] = useState(false)

  // Inicializar canvas offscreen
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width  = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    canvasRef.current = canvas
    ctxRef.current    = ctx
    setReady(true)
  }, [])

  // Actualizar font cuando cambie config
  useEffect(() => {
    if (!ctxRef.current) return
    const px = cfg.fontSize * cfg.ptToPx
    ctxRef.current.font = `${px}px "${cfg.font}"`
  }, [cfg.font, cfg.fontSize, cfg.ptToPx, ready])

  /**
   * Mide el ancho real en px de un string con la fuente configurada.
   */
  const medir = useCallback((texto) => {
    if (!ctxRef.current) return 0
    return ctxRef.current.measureText(texto).width
  }, [ready])

  /**
   * Ancho real del área de texto en px.
   */
  const anchoTextoPx = useCallback(() => {
    const totalPt = cfg.pageWidthPt - cfg.marginLeftPt - cfg.marginRightPt
    return totalPt * cfg.ptToPx
  }, [cfg.pageWidthPt, cfg.marginLeftPt, cfg.marginRightPt, cfg.ptToPx])

  /**
   * Calcula los guiones de relleno para un párrafo dado.
   *
   * @param {string} textoCompleto  — todo el texto del párrafo ANTES del relleno
   * @returns {string}              — string de guiones ej. "- - - - - - - - - -"
   */
  const calcGuiones = useCallback((textoCompleto) => {
    if (!ctxRef.current || !textoCompleto) return ''

    const ctx        = ctxRef.current
    const anchoPagina = anchoTextoPx()
    const texto      = textoCompleto.trimEnd()
    const terminaPunto = texto.endsWith('.')
    const sep        = terminaPunto ? SEP_PUNTO : SEP_NORMAL

    // ── Calcular posición real en el último renglón ──────────────────
    // Usamos word-wrap real: iterar palabra por palabra igual que Word
    const palabras   = texto.split(' ')
    let xActual      = 0  // posición en el renglón actual (px)
    const anchoEspacio = medir(' ')

    for (let i = 0; i < palabras.length; i++) {
      const palabra    = palabras[i]
      const anchoPalab = medir(palabra)
      const anchoConEsp = (i < palabras.length - 1)
        ? anchoPalab + anchoEspacio
        : anchoPalab

      if (xActual + anchoConEsp > anchoPagina && xActual > 0) {
        // Esta palabra no cabe → nuevo renglón
        xActual = anchoConEsp
      } else {
        xActual += anchoConEsp
      }
    }

    // xActual es ahora la posición exacta donde termina el texto en el último renglón

    // ── Calcular cuántos "- " caben en el espacio restante ──────────
    const anchoSep   = medir(sep)
    const anchoDash  = medir('- ')
    const espacioLibre = anchoPagina - xActual - anchoSep

    if (espacioLibre < anchoDash * cfg.minDashes) {
      // No caben suficientes guiones → renglón nuevo completo
      const guionesCompleto = Math.floor((anchoPagina - anchoSep) / anchoDash)
      return sep + Array(guionesCompleto).fill('- ').join('').trimEnd()
    }

    const cantidad = Math.floor(espacioLibre / anchoDash)
    return sep + Array(cantidad).fill('- ').join('').trimEnd()
  }, [ready, anchoTextoPx, medir, cfg.minDashes])

  /**
   * Calcula guiones para texto que ya tiene runs múltiples (bold + normal).
   * Recibe array de segmentos [{ texto, bold }] y los mide individualmente
   * porque bold puede tener ancho distinto incluso en monoespaciada.
   *
   * @param {Array<{texto: string, bold: boolean}>} segmentos
   * @returns {string}
   */
  const calcGuionesSegmentos = useCallback((segmentos) => {
    if (!ctxRef.current || !segmentos?.length) return ''

    const ctx         = ctxRef.current
    const anchoPagina = anchoTextoPx()
    const pxBase      = cfg.fontSize * cfg.ptToPx
    const fontNormal  = `${pxBase}px "${cfg.font}"`
    const fontBold    = `bold ${pxBase}px "${cfg.font}"`

    // Reconstruir texto completo para detectar si termina en punto
    const textoCompleto = segmentos.map(s => s.texto).join('').trimEnd()
    const terminaPunto  = textoCompleto.endsWith('.')
    const sep           = terminaPunto ? SEP_PUNTO : SEP_NORMAL

    // Medir cada segmento con su peso correcto haciendo word-wrap real
    let xActual = 0

    for (const seg of segmentos) {
      ctx.font = seg.bold ? fontBold : fontNormal
      const anchoEspacio = ctx.measureText(' ').width
      const palabras     = seg.texto.split(' ')

      for (let i = 0; i < palabras.length; i++) {
        const palabra     = palabras[i]
        if (!palabra) continue
        const anchoPalab  = ctx.measureText(palabra).width
        const anchoConEsp = (i < palabras.length - 1)
          ? anchoPalab + anchoEspacio
          : anchoPalab

        if (xActual + anchoConEsp > anchoPagina && xActual > 0) {
          xActual = anchoConEsp
        } else {
          xActual += anchoConEsp
        }
      }
    }

    // Restaurar font normal para medir el separador
    ctx.font = fontNormal
    const anchoSep  = ctx.measureText(sep).width
    const anchoDash = ctx.measureText('- ').width
    const espacioLibre = anchoPagina - xActual - anchoSep

    if (espacioLibre < anchoDash * cfg.minDashes) {
      const guionesCompleto = Math.floor((anchoPagina - anchoSep) / anchoDash)
      return sep + Array(guionesCompleto).fill('- ').join('').trimEnd()
    }

    const cantidad = Math.floor(espacioLibre / anchoDash)
    return sep + Array(cantidad).fill('- ').join('').trimEnd()
  }, [ready, anchoTextoPx, cfg.font, cfg.fontSize, cfg.ptToPx, cfg.minDashes])

  return {
    ready,
    medir,
    calcGuiones,
    calcGuionesSegmentos,
    anchoTextoPx,
    cfg,
  }
}
