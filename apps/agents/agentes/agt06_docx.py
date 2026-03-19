"""
AGT-06 — Compositor .docx v5
Fedatario · Correduría Pública No. 3 · Tamaulipas

Consume List[Seccion] de AGT-04 y construye el .docx
con estructura idéntica al original del Corredor:
  - Página oficio, márgenes espejo
  - Un párrafo Word por Seccion
  - Runs bold/normal exactos dentro de cada párrafo
  - Guiones de relleno calculados hasta LINE_WIDTH
  - Encabezados con = que llenan el margen
  - Tabla accionaria con fondo gris y bordes dobles
  - Tablas de firma con bordes selectivos del original
  - Fila QR en último socio
  - Párrafo del Corredor al final
"""
from __future__ import annotations
import io, re
from typing import List, Tuple, Optional

from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

from agentes.agt04_secciones import Seccion, Seg


# ─────────────────────────────────────────────
# CONSTANTES
# ─────────────────────────────────────────────
FUENTE        = "Courier New"
FUENTE_EAST   = "Courier New"        # monoespaciada — mismo en eastAsia
SZ            = 20                   # 10pt — en celdas (XML real: sz=20)
SZ_BODY       = 20                   # 10pt — en párrafos de cuerpo
INTERLINEA   = 360
FONDO_GRIS   = "C9C9C9"

PG_W, PG_H           = 12240, 20160
MAR_TOP, MAR_BOTTOM  = 2410, 2127
MAR_LEFT, MAR_RIGHT  = 2410, 1582
MAR_HEADER, MAR_FOOTER, MAR_GUTTER = 709, 760, 0

COLS_ACC = [2976, 1844, 1417, 1981]
COL_IZQ_PCT, COL_DER_PCT = 2651, 2349
COL_IZQ_DXA, COL_DER_DXA = 4373, 3875

# S de RL de CV — dos tablas de 3 columnas (medidas reales de documentos)
COLS_SRL_PARTES = [1691, 2552, 3969]   # PARTE SOCIAL | VALOR | CON LETRA
COLS_SRL_SOCIOS = [4243, 1417, 2562]   # NOMBRE+RFC   | VALOR | CON LETRA

# Courier New 10pt monoespaciada: 1 char = 6pt exacto
# Ancho texto = 12240 - 2410 - 1582 = 8248 twips = 412.4pt / 6pt = 68 chars
# Debe coincidir exactamente con LINE_WIDTH en agt04_secciones.py
LINE_CHARS = 68


# ─────────────────────────────────────────────
# HELPERS XML
# ─────────────────────────────────────────────

def _rPr(bold=False, sz=None):
    """sz=None usa SZ_BODY (párrafos), sz=SZ para celdas de tabla."""
    sz_val = sz if sz is not None else SZ_BODY
    rPr = OxmlElement('w:rPr')
    rf  = OxmlElement('w:rFonts')
    rf.set(qn('w:ascii'),    FUENTE)
    rf.set(qn('w:hAnsi'),    FUENTE)
    rf.set(qn('w:eastAsia'), FUENTE_EAST)
    rf.set(qn('w:cs'),       FUENTE)
    rPr.append(rf)
    if bold:
        rPr.append(OxmlElement('w:b'))
        rPr.append(OxmlElement('w:bCs'))
    for tag in ['w:sz', 'w:szCs']:
        el = OxmlElement(tag); el.set(qn('w:val'), str(sz_val)); rPr.append(el)
    return rPr

def _pPr(centered=False, borde=False):
    pPr = OxmlElement('w:pPr')
    sp  = OxmlElement('w:spacing')
    sp.set(qn('w:after'), '0')
    sp.set(qn('w:line'), str(INTERLINEA))
    sp.set(qn('w:lineRule'), 'auto')
    pPr.append(sp)
    jc = OxmlElement('w:jc')
    jc.set(qn('w:val'), 'center' if centered else 'both')
    pPr.append(jc)
    if borde:
        pBdr = OxmlElement('w:pBdr')
        for side in ('top', 'bottom'):
            b = OxmlElement(f'w:{side}')
            b.set(qn('w:val'), 'single')
            b.set(qn('w:sz'), '6')
            b.set(qn('w:space'), '1')
            b.set(qn('w:color'), 'auto')
            pBdr.append(b)
        pPr.append(pBdr)
    return pPr

def _make_run(texto: str, bold=False, sz=None):
    r = OxmlElement('w:r')
    r.append(_rPr(bold, sz=sz))
    t = OxmlElement('w:t')
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    t.text = texto
    r.append(t)
    return r

def _fill_dashes(texto_previo: str) -> str:
    """Genera guiones de relleno hasta LINE_CHARS.

    Con Courier New monoespaciada calcula el último renglón via módulo.
    Si el texto termina en punto, evita el doble punto (..- - -).
    Lógica idéntica a _g() en agt04_secciones.
    """
    texto = texto_previo.rstrip() if isinstance(texto_previo, str) else ""
    n = len(texto) if texto else max(int(texto_previo), 0)
    ultimo = n % LINE_CHARS
    termina_en_punto = texto.endswith('.')

    if termina_en_punto:
        faltantes = max(LINE_CHARS - ultimo - 2, 4)  # -2 por '- '
        relleno = ("- " * (faltantes // 2 + 2))[:faltantes].rstrip()
        return f"- {relleno}"
    else:
        faltantes = max(LINE_CHARS - ultimo - 3, 4)  # -3 por '.- '
        relleno = ("- " * (faltantes // 2 + 2))[:faltantes].rstrip()
        return f".- {relleno}"


def _make_parrafo(runs: List[Seg], centered=False, borde=False):
    """Construye un elemento <w:p> con todos los runs.
    
    Los runs que vienen de _g() en secciones tienen texto que empieza con '.- ' o '- '
    y son el relleno de guiones. Los recalculamos aquí con LINE_CHARS real
    pasando el texto acumulado completo para word-wrap correcto.
    """
    p = OxmlElement('w:p')
    p.append(_pPr(centered, borde=borde))

    # Acumular todo el texto previo al run de relleno
    texto_acumulado = ""
    runs_procesados = []
    for texto, bold in runs:
        if texto and (texto.startswith('.- ') or texto.startswith('- - ')):
            # Es un run de relleno _g() — recalcular con texto acumulado real
            nuevo_relleno = _fill_dashes(texto_acumulado)
            runs_procesados.append((nuevo_relleno, bold))
        else:
            runs_procesados.append((texto, bold))
            texto_acumulado += (texto or '')

    for texto, bold in runs_procesados:
        if texto:
            p.append(_make_run(texto, bold))
    return p


# ─────────────────────────────────────────────
# SETTINGS Y SECTPR
# ─────────────────────────────────────────────

def _inject_settings(doc):
    s = doc.settings.element
    W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
    if s.find(f'{W}mirrorMargins') is None:
        s.insert(0, OxmlElement('w:mirrorMargins'))
    if s.find(f'{W}evenAndOddHeaders') is None:
        s.insert(1, OxmlElement('w:evenAndOddHeaders'))

def _make_sectPr():
    sectPr = OxmlElement('w:sectPr')
    pgSz   = OxmlElement('w:pgSz')
    pgSz.set(qn('w:w'), str(PG_W)); pgSz.set(qn('w:h'), str(PG_H))
    sectPr.append(pgSz)
    pgMar = OxmlElement('w:pgMar')
    for k, v in [('top',MAR_TOP),('right',MAR_RIGHT),('bottom',MAR_BOTTOM),
                 ('left',MAR_LEFT),('header',MAR_HEADER),('footer',MAR_FOOTER),('gutter',MAR_GUTTER)]:
        pgMar.set(qn(f'w:{k}'), str(v))
    sectPr.append(pgMar)
    return sectPr


# ─────────────────────────────────────────────
# TABLA ACCIONARIA
# ─────────────────────────────────────────────

def _celda_acc(texto, bold=False, centered=False, fondo=None, col_w=2000, doble=False):
    tc   = OxmlElement('w:tc')
    tcPr = OxmlElement('w:tcPr')
    tcW  = OxmlElement('w:tcW'); tcW.set(qn('w:w'), str(col_w)); tcW.set(qn('w:type'), 'dxa')
    tcPr.append(tcW)
    tcB  = OxmlElement('w:tblBorders') if False else OxmlElement('w:tcBorders')
    for side in ['top','left','bottom','right']:
        b = OxmlElement(f'w:{side}')
        b.set(qn('w:val'), 'double' if doble else 'single')
        b.set(qn('w:sz'), '4'); b.set(qn('w:space'), '0'); b.set(qn('w:color'), 'auto')
        tcB.append(b)
    tcPr.append(tcB)
    if fondo:
        shd = OxmlElement('w:shd'); shd.set(qn('w:val'),'clear')
        shd.set(qn('w:color'),'auto'); shd.set(qn('w:fill'), fondo); tcPr.append(shd)
    vA = OxmlElement('w:vAlign'); vA.set(qn('w:val'),'center'); tcPr.append(vA)
    tc.append(tcPr)
    p = OxmlElement('w:p'); p.append(_pPr(centered)); p.append(_make_run(texto, bold, sz=SZ))
    tc.append(p)
    return tc

def _build_tabla_accionaria(body, socios, capital_fijo):
    from agentes.agt04_redactor import numero_letra, pesos_letra, deletrear_alfanumerico

    tbl  = OxmlElement('w:tbl')
    tblPr = OxmlElement('w:tblPr')
    tblW  = OxmlElement('w:tblW'); tblW.set(qn('w:w'),'5000'); tblW.set(qn('w:type'),'pct')
    tblPr.append(tblW)
    tblB  = OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        b = OxmlElement(f'w:{side}'); b.set(qn('w:val'),'single')
        b.set(qn('w:sz'),'4'); b.set(qn('w:space'),'0'); b.set(qn('w:color'),'auto')
        tblB.append(b)
    tblPr.append(tblB); tbl.append(tblPr)
    grid = OxmlElement('w:tblGrid')
    for w in COLS_ACC:
        gc = OxmlElement('w:gridCol'); gc.set(qn('w:w'), str(w)); grid.append(gc)
    tbl.append(grid)

    # Encabezado
    tr0 = OxmlElement('w:tr')
    for h, w in zip(["Accionista y Registro Federal de Contribuyentes:",
                      "Número de Acciones y Serie","Valor nominal","Total, con letra:"], COLS_ACC):
        tr0.append(_celda_acc(h, bold=True, centered=True, fondo=FONDO_GRIS, col_w=w, doble=True))
    tbl.append(tr0)

    cap_socio = capital_fijo // len(socios)
    acc_socio = cap_socio // 1000
    for s in socios:
        rfc_l  = deletrear_alfanumerico(s.rfc)
        acc_l  = numero_letra(acc_socio).capitalize()
        monto_l= pesos_letra(cap_socio)
        tr = OxmlElement('w:tr')
        cols = [
            (f"{s.nombre_completo}.- {s.rfc} ({rfc_l}).- - - - - - - - - - - -", True),
            (f"- - - - {acc_socio} - - - ({acc_l}) - - Serie A - - - -", False),
            (f"- $1,000.00 - (Un mil pesos 00/100 en Moneda Nacional) - - -", False),
            (f"- - - ${cap_socio:,.2f} - - - ({monto_l}) - - - - - -", False),
        ]
        for (txt, bold_c), w in zip(cols, COLS_ACC):
            tr.append(_celda_acc(txt, bold=bold_c, col_w=w))
        tbl.append(tr)

    # Total
    total_acc  = acc_socio * len(socios)
    total_mnt  = cap_socio * len(socios)
    total_acc_l= numero_letra(total_acc).capitalize()
    total_mnt_l= pesos_letra(total_mnt)
    tr_t = OxmlElement('w:tr')
    for (txt, bold_c), w in zip([
        (f"T O T A L: - - - - - - - - - - - - - - - - - - - - -", True),
        (f"- - - - {total_acc} - - ({total_acc_l}) - - Serie A - -", False),
        (f"- $1,000.00 - (Un mil pesos 00/100 en Moneda Nacional) - -", False),
        (f"- - - ${total_mnt:,.2f} - - - ({total_mnt_l}) - -", False),
    ], COLS_ACC):
        tr_t.append(_celda_acc(txt, bold=bold_c, col_w=w))
    tbl.append(tr_t)
    body.append(tbl)


# ─────────────────────────────────────────────
# TABLAS DE CAPITAL — S DE RL DE CV
# ─────────────────────────────────────────────

def _celda_srl(texto, bold=False, centered=False, fondo=None, col_w=2000):
    """Celda para tablas de S de RL de CV (bordes simples)."""
    tc   = OxmlElement('w:tc')
    tcPr = OxmlElement('w:tcPr')
    tcW  = OxmlElement('w:tcW')
    tcW.set(qn('w:w'), str(col_w)); tcW.set(qn('w:type'), 'dxa')
    tcPr.append(tcW)
    tcB = OxmlElement('w:tcBorders')
    for side in ['top', 'left', 'bottom', 'right']:
        b = OxmlElement(f'w:{side}')
        b.set(qn('w:val'), 'single')
        b.set(qn('w:sz'), '4'); b.set(qn('w:space'), '0'); b.set(qn('w:color'), 'auto')
        tcB.append(b)
    tcPr.append(tcB)
    if fondo:
        shd = OxmlElement('w:shd'); shd.set(qn('w:val'), 'clear')
        shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), fondo); tcPr.append(shd)
    vA = OxmlElement('w:vAlign'); vA.set(qn('w:val'), 'center'); tcPr.append(vA)
    tc.append(tcPr)
    p = OxmlElement('w:p'); p.append(_pPr(centered)); p.append(_make_run(texto, bold, sz=SZ))
    tc.append(p)
    return tc


def _tbl_srl_base(cols):
    """Crea la estructura base de una tabla SRL con los anchos dados."""
    tbl  = OxmlElement('w:tbl')
    tblPr = OxmlElement('w:tblPr')
    tblW  = OxmlElement('w:tblW'); tblW.set(qn('w:w'), '5000'); tblW.set(qn('w:type'), 'pct')
    tblPr.append(tblW)
    tblB  = OxmlElement('w:tblBorders')
    for side in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        b = OxmlElement(f'w:{side}'); b.set(qn('w:val'), 'single')
        b.set(qn('w:sz'), '4'); b.set(qn('w:space'), '0'); b.set(qn('w:color'), 'auto')
        tblB.append(b)
    tblPr.append(tblB); tbl.append(tblPr)
    grid = OxmlElement('w:tblGrid')
    for w in cols:
        gc = OxmlElement('w:gridCol'); gc.set(qn('w:w'), str(w)); grid.append(gc)
    tbl.append(grid)
    return tbl


def _build_tabla_capital_srl(body, socios, capital_fijo):
    """
    Construye las DOS tablas de capital para S de RL de CV:
      1. Tabla de partes sociales (3 cols: PARTE | VALOR | CON LETRA)
      2. Tabla de socios con RFC   (3 cols: NOMBRE+RFC | VALOR | CON LETRA)
    """
    from agentes.agt04_redactor import numero_letra, pesos_letra, deletrear_alfanumerico

    cap_por_socio = capital_fijo // len(socios)

    # ── Tabla A: Partes Sociales ──────────────────────────────
    tblA = _tbl_srl_base(COLS_SRL_PARTES)

    # Header
    tr_hA = OxmlElement('w:tr')
    for txt, w in zip(
        ["PARTE SOCIAL - - - - - - - - - - - - - - - - - - - - -",
         "VALOR DE CADA PARTE: - - - - - - - - - - - - - - - -",
         "- - - VALOR DESCRITO CON LETRA - - - - - - - - - - - - - - - - - - - - -"],
        COLS_SRL_PARTES
    ):
        tr_hA.append(_celda_srl(txt, bold=True, centered=True, fondo=FONDO_GRIS, col_w=w))
    tblA.append(tr_hA)

    # Filas socios
    for s in socios:
        monto_l = pesos_letra(cap_por_socio)
        tr = OxmlElement('w:tr')
        tr.append(_celda_srl(f"- - - - - - U N A - - - - - - - - - - - - - - - - - - - - - - - - - - - -",
                             col_w=COLS_SRL_PARTES[0]))
        tr.append(_celda_srl(f"- - - ${cap_por_socio:,.2f} - - - - - - - - - - - - - - - - - -",
                             col_w=COLS_SRL_PARTES[1]))
        tr.append(_celda_srl(f"{monto_l}.- - - - - - - - - - - - - - - - - - - - - - - - - -",
                             col_w=COLS_SRL_PARTES[2]))
        tblA.append(tr)

    # Total
    total_mnt   = cap_por_socio * len(socios)
    total_mnt_l = pesos_letra(total_mnt)
    tr_tA = OxmlElement('w:tr')
    tr_tA.append(_celda_srl("T O T A L: - - - - - - - - - - - - - - - - - - - - - - - - - -",
                             bold=True, col_w=COLS_SRL_PARTES[0]))
    tr_tA.append(_celda_srl(f"- - - ${total_mnt:,.2f} - - - - - - - - - - - - - - - -",
                             col_w=COLS_SRL_PARTES[1]))
    tr_tA.append(_celda_srl(f"- - - {total_mnt_l}.- - - - - - - - - - - - - - - - - - - -",
                             col_w=COLS_SRL_PARTES[2]))
    tblA.append(tr_tA)
    body.append(tblA)
    body.append(_make_parrafo([]))

    # ── Tabla B: Socios con RFC ───────────────────────────────
    tblB = _tbl_srl_base(COLS_SRL_SOCIOS)

    # Header
    tr_hB = OxmlElement('w:tr')
    for txt, w in zip(
        ["NOMBRE COMPLETO DEL SOCIO Y REGISTRO FEDERAL DE CONTRIBUYENTES: - - - - - - - - - - - - - - -",
         "- - VALOR - - - - PARTE SOCIAL - - - - - - - - - - - -",
         "- - - - - - CON LETRA - - - - - - - - - - - - - - - - - - - - - - - - - -"],
        COLS_SRL_SOCIOS
    ):
        tr_hB.append(_celda_srl(txt, bold=True, centered=True, fondo=FONDO_GRIS, col_w=w))
    tblB.append(tr_hB)

    # Filas socios
    for s in socios:
        rfc_l   = deletrear_alfanumerico(s.rfc)
        monto_l = pesos_letra(cap_por_socio)
        tr = OxmlElement('w:tr')
        tr.append(_celda_srl(
            f"{s.nombre_completo}.- {s.rfc} ({rfc_l}).- - - - - - - - - - - - - - -",
            bold=True, col_w=COLS_SRL_SOCIOS[0]))
        tr.append(_celda_srl(
            f"- - ${cap_por_socio:,.2f} - - - - - - - - - - - - - - - -",
            col_w=COLS_SRL_SOCIOS[1]))
        tr.append(_celda_srl(
            f"- - {monto_l}.- - - - - - - - - - - - - - - - - -",
            col_w=COLS_SRL_SOCIOS[2]))
        tblB.append(tr)

    # Total
    tr_tB = OxmlElement('w:tr')
    tr_tB.append(_celda_srl("T O T A L: - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -",
                             bold=True, col_w=COLS_SRL_SOCIOS[0]))
    tr_tB.append(_celda_srl(f"- - ${total_mnt:,.2f} - - - - - - - - - - - - - - - -",
                             col_w=COLS_SRL_SOCIOS[1]))
    tr_tB.append(_celda_srl(f"- - {total_mnt_l}.- - - - - - - - - - - - - - - - - -",
                             col_w=COLS_SRL_SOCIOS[2]))
    tblB.append(tr_tB)
    body.append(tblB)


# ─────────────────────────────────────────────
# TABLA DE FIRMAS
# ─────────────────────────────────────────────

def _celda_firma(texto, bold=False, bordes_nil=None, col_w=COL_IZQ_DXA):
    """
    col_w en DXA. bordes_nil: lista de lados a poner 'nil' (sin borde).
    Lados no listados quedan con borde 'single'.
    """
    tc   = OxmlElement('w:tc')
    tcPr = OxmlElement('w:tcPr')
    tcW  = OxmlElement('w:tcW')
    tcW.set(qn('w:w'), str(col_w)); tcW.set(qn('w:type'), 'dxa')
    tcPr.append(tcW)
    nil_set = set(bordes_nil or [])
    tcB = OxmlElement('w:tcBorders')
    for side in ['top', 'left', 'bottom', 'right']:
        b = OxmlElement(f'w:{side}')
        if side in nil_set:
            b.set(qn('w:val'), 'nil')
        else:
            b.set(qn('w:val'), 'single')
            b.set(qn('w:sz'), '6')
            b.set(qn('w:space'), '0')
            b.set(qn('w:color'), 'auto')
        tcB.append(b)
    tcPr.append(tcB)
    tc.append(tcPr)
    p = OxmlElement('w:p'); p.append(_pPr())
    if texto: p.append(_make_run(texto, bold, sz=SZ))
    tc.append(p)
    return tc

def _build_tabla_firma(body, nombre: str, es_ultimo: bool):
    """
    Tabla de firma de 2 columnas × 2 filas:
      Fila 1 (nombre): [NOMBRE. | Nombre completo.]
                        bordes top+bottom visibles (bottom = línea de firma)
                        bordes left+right=nil
      Fila 2 (firma):  [Firma. | Huellas...]
                        sin ningún borde (espacio físico para firma/huella)
      Fila 3 (solo último socio): fila vacía de altura extra
    """
    tbl  = OxmlElement('w:tbl')
    tblPr= OxmlElement('w:tblPr')
    tblW = OxmlElement('w:tblW')
    tblW.set(qn('w:w'), str(COL_IZQ_DXA + COL_DER_DXA))
    tblW.set(qn('w:type'), 'dxa')
    tblPr.append(tblW)
    # Sin bordes de tabla — los bordes se controlan por celda
    tblB = OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        b = OxmlElement(f'w:{side}'); b.set(qn('w:val'), 'none')
        tblB.append(b)
    tblPr.append(tblB); tbl.append(tblPr)
    grid = OxmlElement('w:tblGrid')
    for w in [COL_IZQ_DXA, COL_DER_DXA]:
        gc = OxmlElement('w:gridCol'); gc.set(qn('w:w'), str(w)); grid.append(gc)
    tbl.append(grid)

    # Fila 1: nombre + "Nombre completo."
    # Borde top+bottom visibles (bottom es la línea donde firma); left+right=nil
    # La separación central (insideV) también nil — no hay línea vertical entre columnas
    tr1 = OxmlElement('w:tr')
    tr1.append(_celda_firma(nombre + ".", bold=True,
                             bordes_nil=['left', 'right'],
                             col_w=COL_IZQ_DXA))
    tr1.append(_celda_firma("Nombre completo.",
                             bordes_nil=['left', 'right'],
                             col_w=COL_DER_DXA))
    tbl.append(tr1)

    # Fila 2: "Firma." | "Huellas..." — sin bordes (espacio físico)
    tr2 = OxmlElement('w:tr')
    tr2.append(_celda_firma("Firma.",
                             bordes_nil=['top', 'left', 'bottom', 'right'],
                             col_w=COL_IZQ_DXA))
    tr2.append(_celda_firma("Huellas Índices Izquierdo y Derecho.",
                             bordes_nil=['top', 'left', 'bottom', 'right'],
                             col_w=COL_DER_DXA))
    tbl.append(tr2)

    # Fila 3 (solo último socio): fila vacía de altura extra para espacio de firma
    if es_ultimo:
        tr3 = OxmlElement('w:tr')
        # Altura mínima para el espacio físico de firma (~1.5cm = 850 twips)
        trPr3 = OxmlElement('w:trPr')
        trH3  = OxmlElement('w:trHeight')
        trH3.set(qn('w:val'), '850'); trH3.set(qn('w:hRule'), 'atLeast')
        trPr3.append(trH3); tr3.append(trPr3)
        tr3.append(_celda_firma("", bordes_nil=['top','left','bottom','right'], col_w=COL_IZQ_DXA))
        tr3.append(_celda_firma("", bordes_nil=['top','left','bottom','right'], col_w=COL_DER_DXA))
        tbl.append(tr3)

    body.append(tbl)
    body.append(_make_parrafo([]))


# ─────────────────────────────────────────────
# FUNCIÓN PRINCIPAL
# ─────────────────────────────────────────────

def generar_docx(texto_acta: str,
                 nombres_socios: Optional[List[str]] = None,
                 secciones: Optional[List[Seccion]] = None) -> bytes:
    """
    Genera el .docx final.
    Si recibe secciones (nuevo flujo): las usa directamente.
    Si solo recibe texto_acta (flujo legacy): modo de compatibilidad.
    """
    doc = Document()
    _inject_settings(doc)

    body = doc.element.body
    for child in list(body): body.remove(child)

    if secciones:
        _procesar_secciones(body, secciones)
    else:
        _procesar_texto_legacy(body, texto_acta, nombres_socios or [])

    body.append(_make_sectPr())

    out = io.BytesIO()
    doc.save(out)
    out.seek(0)
    return out.read()


def _procesar_secciones(body, secciones: List[Seccion]):
    """Construye el body a partir de la lista de Seccion."""
    for sec in secciones:
        if sec.tipo == "vacio":
            body.append(_make_parrafo([]))

        elif sec.tipo == "encabezado":
            # Extraer texto limpio quitando los = del _enc() de secciones
            texto_raw = ''.join(t for t, _ in sec.runs)
            import re as _re
            m = _re.match(r'^=+\s*(.*?)\s*=+$', texto_raw.strip())
            titulo = m.group(1) if m else texto_raw.strip()
            # Formato correcto: === centrado con jc=both, SIN bordes horizontales
            # Los = llenan hasta el margen igual que los guiones — norma fedataria
            espacio = LINE_CHARS - len(titulo) - 2
            izq = max(espacio // 2, 2)
            der = max(espacio - izq, 2)
            enc_txt = f"{'=' * izq} {titulo} {'=' * der}"
            body.append(_make_parrafo([(enc_txt, True)], centered=False, borde=False))

        elif sec.tipo == "parrafo":
            body.append(_make_parrafo(sec.runs))

        elif sec.tipo == "tabla_accionaria":
            _build_tabla_accionaria(body, sec.data['socios'], sec.data['capital_fijo'])

        elif sec.tipo == "tabla_capital_srl":
            _build_tabla_capital_srl(body, sec.data['socios'], sec.data['capital_fijo'])

        elif sec.tipo == "firma":
            _build_tabla_firma(body, sec.data['nombre'], sec.data['es_ultimo'])

        elif sec.tipo == "corredor":
            body.append(_make_parrafo([
                ("_______________________________________________", True)
            ]))
            body.append(_make_parrafo([
                ("LICENCIADO WILFREDO EMMANUEL RAMÍREZ NÚÑEZ. "
                 "EL CORREDOR PÚBLICO NÚMERO 3 (TRES) "
                 "DE LA PLAZA DEL ESTADO DE TAMAULIPAS.", True)
            ]))


def _procesar_texto_legacy(body, texto_acta: str, nombres_socios: List[str]):
    """Modo de compatibilidad: texto plano → párrafos simples."""
    for linea in texto_acta.split('\n'):
        s = linea.strip()
        if not s:
            body.append(_make_parrafo([]))
        else:
            body.append(_make_parrafo([(s, False)]))
