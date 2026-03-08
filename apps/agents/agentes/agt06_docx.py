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
FUENTE     = "Hadassah Friedlaender"
SZ         = 20
INTERLINEA = 360
FONDO_GRIS = "C9C9C9"

PG_W, PG_H           = 12240, 20160
MAR_TOP, MAR_BOTTOM  = 2410, 2127
MAR_LEFT, MAR_RIGHT  = 2410, 1582
MAR_HEADER, MAR_FOOTER, MAR_GUTTER = 709, 760, 0

COLS_ACC = [2976, 1844, 1417, 1981]
COL_IZQ_PCT, COL_DER_PCT = 2651, 2349
COL_IZQ_DXA, COL_DER_DXA = 4373, 3875


# ─────────────────────────────────────────────
# HELPERS XML
# ─────────────────────────────────────────────

def _rPr(bold=False):
    rPr = OxmlElement('w:rPr')
    rf  = OxmlElement('w:rFonts')
    for attr in ['ascii','hAnsi','eastAsia','cs']:
        rf.set(qn(f'w:{attr}'), FUENTE)
    rPr.append(rf)
    if bold:
        rPr.append(OxmlElement('w:b'))
        rPr.append(OxmlElement('w:bCs'))
    for tag in ['w:sz', 'w:szCs']:
        el = OxmlElement(tag); el.set(qn('w:val'), str(SZ)); rPr.append(el)
    return rPr

def _pPr(centered=False):
    pPr = OxmlElement('w:pPr')
    sp  = OxmlElement('w:spacing')
    sp.set(qn('w:after'), '0')
    sp.set(qn('w:line'), str(INTERLINEA))
    sp.set(qn('w:lineRule'), 'auto')
    pPr.append(sp)
    jc = OxmlElement('w:jc')
    jc.set(qn('w:val'), 'center' if centered else 'both')
    pPr.append(jc)
    return pPr

def _make_run(texto: str, bold=False):
    r = OxmlElement('w:r')
    r.append(_rPr(bold))
    t = OxmlElement('w:t')
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    t.text = texto
    r.append(t)
    return r

def _make_parrafo(runs: List[Seg], centered=False):
    """Construye un elemento <w:p> con todos los runs."""
    p = OxmlElement('w:p')
    p.append(_pPr(centered))
    for texto, bold in runs:
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
    p = OxmlElement('w:p'); p.append(_pPr(centered)); p.append(_make_run(texto, bold))
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
# TABLA DE FIRMAS
# ─────────────────────────────────────────────

def _celda_firma(texto, bold=False, bordes_nil=None, col_pct=2651):
    tc   = OxmlElement('w:tc')
    tcPr = OxmlElement('w:tcPr')
    tcW  = OxmlElement('w:tcW')
    tcW.set(qn('w:w'), str(col_pct)); tcW.set(qn('w:type'), 'pct')
    tcPr.append(tcW)
    if bordes_nil:
        tcB = OxmlElement('w:tcBorders')
        for side in bordes_nil:
            b = OxmlElement(f'w:{side}'); b.set(qn('w:val'), 'nil'); tcB.append(b)
        tcPr.append(tcB)
    tc.append(tcPr)
    p = OxmlElement('w:p'); p.append(_pPr())
    if texto: p.append(_make_run(texto, bold))
    tc.append(p)
    return tc

def _build_tabla_firma(body, nombre: str, es_ultimo: bool):
    tbl  = OxmlElement('w:tbl')
    tblPr= OxmlElement('w:tblPr')
    tblW = OxmlElement('w:tblW'); tblW.set(qn('w:w'),'5000'); tblW.set(qn('w:type'),'pct')
    tblPr.append(tblW)
    tblB = OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        b = OxmlElement(f'w:{side}'); b.set(qn('w:val'),'single')
        b.set(qn('w:sz'),'4'); b.set(qn('w:space'),'0'); b.set(qn('w:color'),'auto')
        tblB.append(b)
    tblPr.append(tblB); tbl.append(tblPr)
    grid = OxmlElement('w:tblGrid')
    for w in [COL_IZQ_DXA, COL_DER_DXA]:
        gc = OxmlElement('w:gridCol'); gc.set(qn('w:w'), str(w)); grid.append(gc)
    tbl.append(grid)

    tr1 = OxmlElement('w:tr')
    tr1.append(_celda_firma(nombre + ".", bold=True,
                             bordes_nil=['left','bottom'], col_pct=COL_IZQ_PCT))
    tr1.append(_celda_firma("Nombre completo.",
                             bordes_nil=['bottom','right'], col_pct=COL_DER_PCT))
    tbl.append(tr1)

    tr2 = OxmlElement('w:tr')
    tr2.append(_celda_firma("Firma.",
                             bordes_nil=['top','left','bottom','right'], col_pct=COL_IZQ_PCT))
    tr2.append(_celda_firma("Huellas Índices Izquierdo y Derecho.",
                             bordes_nil=['top','left','bottom','right'], col_pct=COL_DER_PCT))
    tbl.append(tr2)

    if es_ultimo:
        tr3 = OxmlElement('w:tr')
        tr3.append(_celda_firma("", bordes_nil=['top','left','bottom','right'], col_pct=COL_IZQ_PCT))
        tr3.append(_celda_firma("", bordes_nil=['top','left','bottom','right'], col_pct=COL_DER_PCT))
        tbl.append(tr3)

    body.append(tbl)
    # Párrafo vacío tras tabla
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

        elif sec.tipo in ("parrafo", "encabezado"):
            centered = sec.tipo == "encabezado"
            body.append(_make_parrafo(sec.runs, centered=centered))

        elif sec.tipo == "tabla_accionaria":
            _build_tabla_accionaria(body, sec.data['socios'], sec.data['capital_fijo'])

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
