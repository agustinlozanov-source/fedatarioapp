"""
AGT-06 — Generador de .docx v3
Fedatario · Correduría Pública No. 3 · Tamaulipas

Correcciones v3:
  - Página: 12240 × 20160 DXA (oficio/legal)
  - Márgenes espejo: top=2410 bottom=2127 left=2410 right=1582 (igual al original)
  - <w:mirrorMargins/> en settings para que Word alterne inner/outer
  - sectPr inyectado directamente en el XML del body
  - Tabla firmas: bordes exactos del original (tblBorders single, celdas nil selectivo)
  - Fila QR vacía al final de la última tabla de firma
  - Corredor: párrafo bold con guiones + nombre
"""

from __future__ import annotations
import io, re
from typing import List, Optional
from copy import deepcopy

from docx import Document
from docx.shared import Pt, Cm
from docx.oxml.ns import qn
from docx.oxml import OxmlElement


# ─────────────────────────────────────────────
# CONSTANTES
# ─────────────────────────────────────────────

FUENTE       = "Hadassah Friedlaender"
SZ           = 20        # half-points = 10pt
INTERLINEA   = 360
FONDO_GRIS   = "C9C9C9"

# Página oficio — valores exactos del original
PG_W         = 12240
PG_H         = 20160
MAR_TOP      = 2410
MAR_BOTTOM   = 2127
MAR_LEFT     = 2410   # margen interior (impar)
MAR_RIGHT    = 1582   # margen exterior (impar)
MAR_HEADER   = 709
MAR_FOOTER   = 760
MAR_GUTTER   = 0

# Columnas tabla accionaria (DXA)
COLS_ACC     = [2976, 1844, 1417, 1981]
# Columnas tabla firmas — porcentajes tipo pct (igual al original)
COL_FIRMA_IZQ_PCT = 2651   # pct units (de 5000)
COL_FIRMA_DER_PCT = 2349
COL_FIRMA_IZQ_DXA = 4373
COL_FIRMA_DER_DXA = 3875


# ─────────────────────────────────────────────
# HELPERS XML
# ─────────────────────────────────────────────

def _rPr(bold=False):
    rPr = OxmlElement('w:rPr')
    rf = OxmlElement('w:rFonts')
    rf.set(qn('w:ascii'),    FUENTE)
    rf.set(qn('w:hAnsi'),    FUENTE)
    rf.set(qn('w:eastAsia'), FUENTE)
    rf.set(qn('w:cs'),       FUENTE)
    rPr.append(rf)
    if bold:
        rPr.append(OxmlElement('w:b'))
        rPr.append(OxmlElement('w:bCs'))
    sz = OxmlElement('w:sz');   sz.set(qn('w:val'), str(SZ));   rPr.append(sz)
    szCs = OxmlElement('w:szCs'); szCs.set(qn('w:val'), str(SZ)); rPr.append(szCs)
    return rPr

def _pPr(centered=False):
    pPr = OxmlElement('w:pPr')
    sp = OxmlElement('w:spacing')
    sp.set(qn('w:after'), '0'); sp.set(qn('w:line'), str(INTERLINEA)); sp.set(qn('w:lineRule'), 'auto')
    pPr.append(sp)
    jc = OxmlElement('w:jc'); jc.set(qn('w:val'), 'center' if centered else 'both')
    pPr.append(jc)
    return pPr

def _run(texto, bold=False):
    r = OxmlElement('w:r')
    r.append(_rPr(bold))
    t = OxmlElement('w:t')
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
    t.text = texto
    r.append(t)
    return r

def _para(body, texto, bold=False, centered=False):
    p = OxmlElement('w:p')
    p.append(_pPr(centered))
    p.append(_run(texto, bold))
    body.append(p)

def _para_vacio(body):
    p = OxmlElement('w:p'); p.append(_pPr()); body.append(p)


# ─────────────────────────────────────────────
# SECTPR — página oficio + mirror margins
# ─────────────────────────────────────────────

def _make_sectPr():
    """Genera sectPr con tamaño oficio y márgenes espejo del original."""
    sectPr = OxmlElement('w:sectPr')

    pgSz = OxmlElement('w:pgSz')
    pgSz.set(qn('w:w'), str(PG_W))
    pgSz.set(qn('w:h'), str(PG_H))
    sectPr.append(pgSz)

    pgMar = OxmlElement('w:pgMar')
    pgMar.set(qn('w:top'),    str(MAR_TOP))
    pgMar.set(qn('w:right'),  str(MAR_RIGHT))
    pgMar.set(qn('w:bottom'), str(MAR_BOTTOM))
    pgMar.set(qn('w:left'),   str(MAR_LEFT))
    pgMar.set(qn('w:header'), str(MAR_HEADER))
    pgMar.set(qn('w:footer'), str(MAR_FOOTER))
    pgMar.set(qn('w:gutter'), str(MAR_GUTTER))
    sectPr.append(pgMar)

    return sectPr


def _inject_settings_mirror(doc):
    """Inyecta <w:mirrorMargins/> y <w:evenAndOddHeaders/> en settings.xml."""
    settings_part = doc.settings.element
    nsmap = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    W = '{' + nsmap + '}'

    # Agregar mirrorMargins si no existe
    if settings_part.find(f'{W}mirrorMargins') is None:
        mm = OxmlElement('w:mirrorMargins')
        settings_part.insert(0, mm)

    # Agregar evenAndOddHeaders si no existe
    if settings_part.find(f'{W}evenAndOddHeaders') is None:
        eoh = OxmlElement('w:evenAndOddHeaders')
        settings_part.insert(1, eoh)


# ─────────────────────────────────────────────
# TABLA ACCIONARIA
# ─────────────────────────────────────────────

def _celda_acc(texto, bold=False, centered=False, fondo=None, col_w=2000, doble=False):
    tc = OxmlElement('w:tc')
    tcPr = OxmlElement('w:tcPr')
    tcW = OxmlElement('w:tcW'); tcW.set(qn('w:w'), str(col_w)); tcW.set(qn('w:type'), 'dxa')
    tcPr.append(tcW)
    tcB = OxmlElement('w:tcBorders')
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
    p = OxmlElement('w:p'); p.append(_pPr(centered)); p.append(_run(texto, bold)); tc.append(p)
    return tc

def _tabla_accionaria(body, socios_data):
    from agentes.agt04_redactor import numero_letra, pesos_letra
    tbl = OxmlElement('w:tbl')
    tblPr = OxmlElement('w:tblPr')
    tblW = OxmlElement('w:tblW'); tblW.set(qn('w:w'),'5000'); tblW.set(qn('w:type'),'pct')
    tblPr.append(tblW)
    tblB = OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        b = OxmlElement(f'w:{side}'); b.set(qn('w:val'),'single')
        b.set(qn('w:sz'),'4'); b.set(qn('w:space'),'0'); b.set(qn('w:color'),'auto')
        tblB.append(b)
    tblPr.append(tblB)
    tbl.append(tblPr)
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
    # Socios
    for s in socios_data:
        tr = OxmlElement('w:tr')
        cols = [
            f"{s['nombre']}.- {s['rfc']} ({s['rfc_letra']}).- - - - - - - - - - - -",
            f"- - - - {s['acciones']} - - - ({s['acciones_letra']}) - - Serie A - - - -",
            f"- $1,000.00 - (Un mil pesos 00/100 en Moneda Nacional) - - -",
            f"- - - ${s['monto']:,.2f} - - - ({s['monto_letra']}) - - - - - -",
        ]
        for txt, w in zip(cols, COLS_ACC):
            tr.append(_celda_acc(txt, bold=txt.startswith(s['nombre']), col_w=w))
        tbl.append(tr)
    # Total
    total_acc = sum(s['acciones'] for s in socios_data)
    total_mnt = sum(s['monto'] for s in socios_data)
    tr_t = OxmlElement('w:tr')
    cols_t = [
        f"T O T A L: - - - - - - - - - - - - - - - - - - - - -",
        f"- - - - {total_acc} - - ({numero_letra(total_acc).capitalize()}) - - Serie A - -",
        f"- $1,000.00 - (Un mil pesos 00/100 en Moneda Nacional) - -",
        f"- - - ${total_mnt:,.2f} - - - ({pesos_letra(total_mnt)}) - -",
    ]
    for txt, bold_c, w in zip(cols_t, [True,False,False,False], COLS_ACC):
        tr_t.append(_celda_acc(txt, bold=bold_c, col_w=w))
    tbl.append(tr_t)
    body.append(tbl)


# ─────────────────────────────────────────────
# TABLA DE FIRMAS — estructura exacta del original
# ─────────────────────────────────────────────
# Estructura de bordes por celda (del XML original):
#   Fila 1, col izq:  left=nil, bottom=nil  (top y right heredan de tblBorders=single)
#   Fila 1, col der:  bottom=nil, right=nil
#   Fila 2, col izq:  top=nil, left=nil, bottom=nil, right=nil
#   Fila 2, col der:  top=nil, left=nil, bottom=nil, right=nil
#   Fila 3 (QR):      todas nil (fila vacía)

def _celda_firma(texto, bold=False, bordes_nil=None, col_pct=2651):
    """
    bordes_nil: lista de lados que van nil, el resto hereda single de tblBorders
    """
    tc = OxmlElement('w:tc')
    tcPr = OxmlElement('w:tcPr')
    tcW = OxmlElement('w:tcW')
    tcW.set(qn('w:w'), str(col_pct)); tcW.set(qn('w:type'), 'pct')
    tcPr.append(tcW)
    if bordes_nil:
        tcB = OxmlElement('w:tcBorders')
        for side in bordes_nil:
            b = OxmlElement(f'w:{side}'); b.set(qn('w:val'), 'nil')
            tcB.append(b)
        tcPr.append(tcB)
    tc.append(tcPr)
    p = OxmlElement('w:p'); p.append(_pPr(False))
    if texto:
        p.append(_run(texto, bold))
    tc.append(p)
    return tc

def _tabla_firma(body, nombre, es_ultimo=False):
    """
    Tabla de firma para un socio.
    es_ultimo: si True, agrega fila vacía para QR al final.
    """
    tbl = OxmlElement('w:tbl')
    tblPr = OxmlElement('w:tblPr')
    tblW = OxmlElement('w:tblW'); tblW.set(qn('w:w'),'5000'); tblW.set(qn('w:type'),'pct')
    tblPr.append(tblW)
    # tblBorders: single en todos — las celdas anulan los que no quieren
    tblB = OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        b = OxmlElement(f'w:{side}'); b.set(qn('w:val'),'single')
        b.set(qn('w:sz'),'4'); b.set(qn('w:space'),'0'); b.set(qn('w:color'),'auto')
        tblB.append(b)
    tblPr.append(tblB)
    tblLook = OxmlElement('w:tblLook')
    tblLook.set(qn('w:val'),'04A0'); tblLook.set(qn('w:firstRow'),'1')
    tblLook.set(qn('w:lastRow'),'0'); tblLook.set(qn('w:firstColumn'),'1')
    tblLook.set(qn('w:lastColumn'),'0'); tblLook.set(qn('w:noHBand'),'0')
    tblLook.set(qn('w:noVBand'),'1')
    tblPr.append(tblLook)
    tbl.append(tblPr)

    grid = OxmlElement('w:tblGrid')
    for w in [COL_FIRMA_IZQ_DXA, COL_FIRMA_DER_DXA]:
        gc = OxmlElement('w:gridCol'); gc.set(qn('w:w'), str(w)); grid.append(gc)
    tbl.append(grid)

    # Fila 1: nombre | "Nombre completo."
    tr1 = OxmlElement('w:tr')
    tr1.append(_celda_firma(nombre + ".", bold=True,
                             bordes_nil=['left','bottom'],
                             col_pct=COL_FIRMA_IZQ_PCT))
    tr1.append(_celda_firma("Nombre completo.", bold=False,
                             bordes_nil=['bottom','right'],
                             col_pct=COL_FIRMA_DER_PCT))
    tbl.append(tr1)

    # Fila 2: "Firma." | "Huellas Índices Izquierdo y Derecho."
    tr2 = OxmlElement('w:tr')
    tr2.append(_celda_firma("Firma.", bold=False,
                             bordes_nil=['top','left','bottom','right'],
                             col_pct=COL_FIRMA_IZQ_PCT))
    tr2.append(_celda_firma("Huellas Índices Izquierdo y Derecho.", bold=False,
                             bordes_nil=['top','left','bottom','right'],
                             col_pct=COL_FIRMA_DER_PCT))
    tbl.append(tr2)

    # Fila 3 QR — solo en el último socio (o siempre, como en el original)
    if es_ultimo:
        tr3 = OxmlElement('w:tr')
        tr3.append(_celda_firma("", bold=False,
                                 bordes_nil=['top','left','bottom','right'],
                                 col_pct=COL_FIRMA_IZQ_PCT))
        tr3.append(_celda_firma("", bold=False,
                                 bordes_nil=['top','left','bottom','right'],
                                 col_pct=COL_FIRMA_DER_PCT))
        tbl.append(tr3)

    body.append(tbl)
    _para_vacio(body)


# ─────────────────────────────────────────────
# PÁRRAFO DEL CORREDOR
# ─────────────────────────────────────────────

def _agregar_corredor(body, nombre_corredor="LICENCIADO WILFREDO EMMANUEL RAMÍREZ NÚÑEZ",
                       numero="3 (TRES)", estado="TAMAULIPAS"):
    _para(body, "_______________________________________________", bold=True)
    _para(body,
          f"{nombre_corredor}."
          f"EL CORREDOR PÚBLICO NÚMERO {numero} DE LA PLAZA DEL ESTADO DE {estado}.",
          bold=True)


# ─────────────────────────────────────────────
# EXTRACCIÓN DATOS ACCIONARIOS
# ─────────────────────────────────────────────

def _extraer_datos_accionarios(texto, nombres):
    from agentes.agt04_redactor import numero_letra, pesos_letra, deletrear_alfanumerico
    match = re.search(r'\$(\d{1,3}(?:,\d{3})*)\.\d{2}.*?en Moneda Nacional', texto)
    capital = int(match.group(1).replace(',','')) if match else 100000
    rfcs = list(dict.fromkeys(re.findall(r'\b([A-Z]{4}\d{6}[A-Z0-9]{3})\b', texto)))
    n = len(nombres); monto = capital // n; acciones = monto // 1000
    return [{
        'nombre':         nombre,
        'rfc':            rfcs[i] if i < len(rfcs) else 'RFC000000000',
        'rfc_letra':      deletrear_alfanumerico(rfcs[i]) if i < len(rfcs) else '',
        'acciones':       acciones,
        'acciones_letra': numero_letra(acciones).capitalize(),
        'monto':          monto,
        'monto_letra':    pesos_letra(monto),
    } for i, nombre in enumerate(nombres)]


# ─────────────────────────────────────────────
# DETECCIÓN
# ─────────────────────────────────────────────

def _es_bold(s, nombres):
    for n in nombres:
        if s.startswith(n): return True
    if re.match(r'^(SEGUNDA|TERCERA|CUARTA|QUINTA)\.', s): return True
    if s.startswith('___'): return True
    if 'LICENCIADO WILFREDO EMMANUEL' in s: return True
    return False


# ─────────────────────────────────────────────
# FUNCIÓN PRINCIPAL
# ─────────────────────────────────────────────

def generar_docx(texto_acta: str, nombres_socios: Optional[List[str]] = None) -> bytes:
    if not nombres_socios:
        matches = re.findall(r'Nombre completo: ([A-ZÁÉÍÓÚÑ ]+)\.-', texto_acta)
        nombres_socios = [m.strip() for m in matches]

    datos_acc = _extraer_datos_accionarios(texto_acta, nombres_socios)

    # Crear doc base con python-docx
    doc = Document()

    # Inyectar mirror margins en settings
    _inject_settings_mirror(doc)

    # Limpiar body y reconstruir desde XML
    body = doc.element.body
    for child in list(body): body.remove(child)

    MARCADOR_TABLA = "PRIMERA.- Los comparecientes suscriben"
    AUX_FIRMA = {"Nombre completo.", "Firma.", "Huellas Índices Izquierdo y Derecho."}
    tabla_hecha = False
    n_socios = len(nombres_socios)

    lineas = texto_acta.split('\n')
    i = 0
    while i < len(lineas):
        s = lineas[i].strip()

        if not s:
            _para_vacio(body); i += 1; continue

        # ── Omitir línea del Corredor del texto (la generamos nosotros al final) ──
        if s.startswith('___') or 'LICENCIADO WILFREDO EMMANUEL' in s:
            i += 1; continue

        # ── Tabla accionaria ──────────────────────────────────────────────────
        if not tabla_hecha and MARCADOR_TABLA in s:
            _para(body, s, bold=False)
            _tabla_accionaria(body, datos_acc)
            tabla_hecha = True
            i += 1
            while i < len(lineas):
                if lineas[i].strip().startswith("SEGUNDA.-"): break
                i += 1
            continue

        # ── Tablas de firma ───────────────────────────────────────────────────
        if tabla_hecha:
            nombre_match = next((n for n in nombres_socios if s == n + "." or s == n), None)
            if nombre_match:
                idx = nombres_socios.index(nombre_match)
                es_ultimo = (idx == n_socios - 1)
                _tabla_firma(body, nombre_match, es_ultimo=es_ultimo)
                i += 1
                while i < len(lineas) and lineas[i].strip() in AUX_FIRMA:
                    i += 1
                continue
            if s in AUX_FIRMA:
                i += 1; continue

        _para(body, s, bold=_es_bold(s, nombres_socios))
        i += 1

    # Agregar sección del Corredor al final
    _para_vacio(body)
    _agregar_corredor(body)

    # Inyectar sectPr al final del body (requerido por spec OOXML)
    body.append(_make_sectPr())

    output = io.BytesIO()
    doc.save(output)
    output.seek(0)
    return output.read()
