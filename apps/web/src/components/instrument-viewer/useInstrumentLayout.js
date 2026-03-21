/**
 * useInstrumentLayout.js
 * ─────────────────────────────────────────────────────────────────
 * Hook central del visor. Calcula guiones de relleno usando canvas.measureText()
 * con medición real del DOM — exacto para cualquier fuente monoespaciada.
 *
 * FIX v2: En lugar de calcular el ancho desde constantes en pt,
 * mide el ancho real del elemento .iv-document en el DOM.
 * Esto garantiza que pantalla e impresión usen el mismo ancho.
 */

import { useRef, useCallback, useEffect, useState } from 'react'

const SEP_PUNTO  = '- '    // cuando el texto termina en punto
const SEP_NORMAL = '.- '   // separador estándar
const MIN_DASHES = 4       // mínimo de "- " útiles antes de saltar al renglón siguiente

export function useInstrumentLayout({ font = 'Courier New', fontSize = 11 } = {}) {
  const canvasRef   = useRef(null)
  const ctxRef      = useRef(null)
  const [ready, setReady] = useState(false)
  // anchoRef: ancho real del área de texto en px, medido del DOM
  const anchoRef    = useRef(0)

  // ── Inicializar canvas offscreen ──────────────────────────────
  useEffect(() => {
    const canvas = document.createElement('canvas')
    canvas.width  = 1
    canvas.height = 1
    canvasRef.current = canvas
    ctxRef.current    = canvas.getContext('2d')
    setReady(true)
  }, [])

  // ── Actualizar font cuando cambie config ──────────────────────
  useEffect(() => {
    if (!ctxRef.current) return
    // canvas usa px (96dpi), 1pt = 96/72 px
    const px = fontSize * (96 / 72)
    ctxRef.current.font = `${px}px "${font}"`
  }, [font, fontSize, ready])

  // ── Medir ancho real del documento desde el DOM ──────────────
  // Se llama desde InstrumentViewer pasando el ref del .iv-document
  const medirAnchoDOM = useCallback((docElement) => {
    if (!docElement) return
    // getComputedStyle devuelve px reales incluyendo zoom y DPR
    const style       = window.getComputedStyle(docElement)
    const paddingLeft = parseFloat(style.paddingLeft)  || 0
    const paddingRight= parseFloat(style.paddingRight) || 0
    const totalWidth  = docElement.clientWidth
    anchoRef.current  = totalWidth - paddingLeft - paddingRight
  }, [])

  // ── Medición de un string ────────────────────────────────────
  const medir = useCallback((texto) => {
    if (!ctxRef.current) return 0
    return ctxRef.current.measureText(texto).width
  }, [ready])

  // ── Ancho del área de texto ──────────────────────────────────
  const anchoTextoPx = useCallback(() => anchoRef.current, [])

  // ── Word-wrap real: devuelve la posición X al final del último renglón ──
  const _calcXFinal = useCallback((palabras, bold = false) => {
    if (!ctxRef.current || !anchoRef.current) return 0
    const ctx       = ctxRef.current
    const anchoPag  = anchoRef.current
    const pxBase    = fontSize * (96 / 72)
    const savedFont = ctx.font
    ctx.font = bold ? `bold ${pxBase}px "${font}"` : `${pxBase}px "${font}"`

    const anchoEsp  = ctx.measureText(' ').width
    let xActual     = 0

    for (let i = 0; i < palabras.length; i++) {
      const palabra = palabras[i]
      if (!palabra) continue
      const ancho   = ctx.measureText(palabra).width
      const total   = i < palabras.length - 1 ? ancho + anchoEsp : ancho

      if (xActual > 0 && xActual + total > anchoPag) {
        xActual = total   // salto de renglón
      } else {
        xActual += total
      }
    }

    ctx.font = savedFont
    return xActual
  }, [font, fontSize, ready])

  // ── Construir string de guiones dado xActual ─────────────────
  const _buildGuiones = useCallback((xActual, terminaPunto) => {
    if (!ctxRef.current || !anchoRef.current) return ''
    const ctx      = ctxRef.current
    const anchoPag = anchoRef.current
    const sep      = terminaPunto ? SEP_PUNTO : SEP_NORMAL
    const anchoSep = ctx.measureText(sep).width
    const anchoDash= ctx.measureText('- ').width
    if (!anchoDash) return ''

    let espacioLibre = anchoPag - xActual - anchoSep

    if (espacioLibre < anchoDash * MIN_DASHES) {
      // No caben — renglón nuevo completo
      espacioLibre = anchoPag - anchoSep
    }

    const cantidad = Math.max(Math.floor(espacioLibre / anchoDash), 1)
    return sep + Array(cantidad).fill('- ').join('').trimEnd()
  }, [ready])

  // ── API pública: calcGuiones (texto string simple) ────────────
  const calcGuiones = useCallback((textoCompleto) => {
    if (!textoCompleto) return ''
    const texto        = textoCompleto.trimEnd()
    const terminaPunto = texto.endsWith('.')
    const palabras     = texto.split(' ')
    const xFinal       = _calcXFinal(palabras, false)
    return _buildGuiones(xFinal, terminaPunto)
  }, [_calcXFinal, _buildGuiones])

  // ── API pública: calcGuionesSegmentos (array de {texto, bold}) ─
  const calcGuionesSegmentos = useCallback((segmentos) => {
    if (!segmentos?.length || !ctxRef.current || !anchoRef.current) return ''

    const ctx      = ctxRef.current
    const anchoPag = anchoRef.current
    const pxBase   = fontSize * (96 / 72)
    const anchoEsp = ctx.measureText(' ').width
    let xActual    = 0

    // Iterar todos los segmentos haciendo word-wrap real
    for (const seg of segmentos) {
      const fnt    = seg.bold
        ? `bold ${pxBase}px "${font}"`
        : `${pxBase}px "${font}"`
      ctx.font     = fnt
      const espLocal = ctx.measureText(' ').width
      const palabras = (seg.texto ?? '').split(' ')

      for (let i = 0; i < palabras.length; i++) {
        const palabra = palabras[i]
        if (!palabra) continue
        const ancho  = ctx.measureText(palabra).width
        const total  = i < palabras.length - 1 ? ancho + espLocal : ancho

        if (xActual > 0 && xActual + total > anchoPag) {
          xActual = total
        } else {
          xActual += total
        }
      }
    }

    // Restaurar font base
    ctx.font = `${pxBase}px "${font}"`

    const textoTotal   = segmentos.map(s => s.texto ?? '').join('').trimEnd()
    const terminaPunto = textoTotal.endsWith('.')
    return _buildGuiones(xActual, terminaPunto)
  }, [font, fontSize, _buildGuiones, ready])

  return {
    ready,
    medir,
    medirAnchoDOM,   // ← llamar con el ref del .iv-document
    calcGuiones,
    calcGuionesSegmentos,
    anchoTextoPx,
  }
}
