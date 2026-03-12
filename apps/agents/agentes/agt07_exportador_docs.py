"""
AGT-07 — Exportador Google Docs
================================
Recibe List[Seccion] (mismo objeto que usa AGT-06) y genera
un documento en Google Docs con el diseño oficial de Fedatario.

Dependencias:
    pip install google-api-python-client google-auth google-auth-oauthlib

Variables de entorno requeridas:
    GOOGLE_OAUTH_CREDENTIALS  — JSON con client_id, client_secret, refresh_token
    GOOGLE_DRIVE_FOLDER_ID    — ID de la carpeta destino en Drive
"""

import os
import re
import json
import logging

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

# ─── Constantes de diseño ───────────────────────────────────────────────────

FONT             = "Times New Roman"
FONT_SIZE_BODY   = 11.0
FONT_SIZE_ENC    = 11.0
FONT_SIZE_HEADER = 13.0
LINE_SPACING     = 1.5
COLOR_INK        = {"red": 0.05, "green": 0.05, "blue": 0.05}
COLOR_SOFT       = {"red": 0.35, "green": 0.35, "blue": 0.35}

MARGIN_TOP    = int(3.0 * 28.35)
MARGIN_BOTTOM = int(3.0 * 28.35)
MARGIN_LEFT   = int(4.5 * 28.35)
MARGIN_RIGHT  = int(3.5 * 28.35)

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]

# ─── Helpers de texto ────────────────────────────────────────────────────────

def _comprimir_espaciado(texto: str) -> str:
    """'I N S T R U M E N T O' → 'INSTRUMENTO'"""
    t = texto.strip()
    if '  ' in t:
        return texto  # doble espacio = no es espaciado entre letras
    chars = list(t)
    espacios = sum(1 for c in chars if c == ' ')
    no_espacios = len(chars) - espacios
    if espacios > 0 and abs(espacios - (no_espacios - 1)) <= 2 and no_espacios > 3:
        return t.replace(' ', '')
    return texto

def _es_relleno(texto: str) -> bool:
    t = texto.strip()
    return t.startswith(".-") or (t.startswith("-") and len(set(t.replace(" ", ""))) <= 2)

def _es_enc(texto: str) -> bool:
    t = texto.strip()
    return t.startswith("=") and t.endswith("=")

def _extraer_enc(texto: str) -> str:
    limpio = texto.strip().strip("=").strip()
    return _comprimir_espaciado(limpio)

def _runs_son_encabezado(runs: list) -> bool:
    no_relleno = [(t, b) for t, b in runs if not _es_relleno(t)]
    return bool(no_relleno) and all(_es_enc(t) for t, _ in no_relleno)

def _limpiar_runs(runs: list) -> list:
    return [(t, b) for t, b in runs if not _es_relleno(t)]

# ─── Autenticación ──────────────────────────────────────────────────────────

def _get_services():
    oauth_env = os.environ.get("GOOGLE_OAUTH_CREDENTIALS", "")
    if not oauth_env:
        raise EnvironmentError("GOOGLE_OAUTH_CREDENTIALS no está definida.")
    if oauth_env.strip().startswith("{"):
        oauth_info = json.loads(oauth_env)
    else:
        with open(oauth_env, "r") as f:
            oauth_info = json.load(f)
    creds = Credentials(
        token=None,
        refresh_token=oauth_info["refresh_token"],
        client_id=oauth_info["client_id"],
        client_secret=oauth_info["client_secret"],
        token_uri="https://oauth2.googleapis.com/token",
    )
    docs  = build("docs",  "v1", credentials=creds)
    drive = build("drive", "v3", credentials=creds)
    return docs, drive

# ─── Helpers de API ─────────────────────────────────────────────────────────

def _idx(i):
    return {"index": i}

def _ts(bold=False, italic=False, size=FONT_SIZE_BODY, color=None):
    return {
        "bold": bold,
        "italic": italic,
        "fontSize": {"magnitude": size, "unit": "PT"},
        "foregroundColor": {"color": {"rgbColor": color or COLOR_INK}},
        "weightedFontFamily": {"fontFamily": FONT},
    }

TSF = "bold,italic,fontSize,foregroundColor,weightedFontFamily"

def _border(width=0.75):
    return {
        "color": {"color": {"rgbColor": COLOR_INK}},
        "width": {"magnitude": width, "unit": "PT"},
        "padding": {"magnitude": 2, "unit": "PT"},
        "dashStyle": "SOLID",
    }

def _no_border():
    return {
        "color": {"color": {"rgbColor": {"red": 1.0, "green": 1.0, "blue": 1.0}}},
        "width": {"magnitude": 0, "unit": "PT"},
        "padding": {"magnitude": 0, "unit": "PT"},
        "dashStyle": "SOLID",
    }

# ─── Constructor ────────────────────────────────────────────────────────────

class DocsBuilder:
    def __init__(self, doc_id, docs_service):
        self.doc_id = doc_id
        self.svc    = docs_service
        self.reqs   = []
        self.cursor = 1

    def _insert(self, text):
        self.reqs.append({"insertText": {"location": _idx(self.cursor), "text": text}})
        self.cursor += len(text)

    def _fmt_text(self, s, e, style, fields):
        self.reqs.append({"updateTextStyle": {
            "range": {"startIndex": s, "endIndex": e},
            "textStyle": style, "fields": fields,
        }})

    def _fmt_para(self, s, e, style, fields):
        self.reqs.append({"updateParagraphStyle": {
            "range": {"startIndex": s, "endIndex": e},
            "paragraphStyle": style, "fields": fields,
        }})

    def flush(self):
        if not self.reqs:
            return
        self.svc.documents().batchUpdate(
            documentId=self.doc_id,
            body={"requests": self.reqs},
        ).execute()
        self.reqs = []

    # ── Primitivos ───────────────────────────────────────────────────────────

    def vacio(self):
        s = self.cursor
        self._insert("\n")
        self._fmt_para(s, self.cursor, {
            "alignment": "JUSTIFIED",
            "lineSpacing": LINE_SPACING * 100,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

    def _linea(self, width=0.75):
        ps = self.cursor
        self._insert("\n")
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": 50,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
            "borderBottom": _border(width),
        }, "alignment,lineSpacing,spaceAbove,spaceBelow,borderBottom")

    # ── Párrafo de cuerpo ────────────────────────────────────────────────────

    def parrafo(self, runs, centered=False):
        runs = _limpiar_runs(runs)
        if not runs:
            self.vacio()
            return
        ps = self.cursor
        for texto, bold in runs:
            rs = self.cursor
            self._insert(texto)
            self._fmt_text(rs, self.cursor, _ts(bold=bold), TSF)
        self._insert("\n")
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER" if centered else "JUSTIFIED",
            "lineSpacing": LINE_SPACING * 100,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

    # ── Encabezado del documento ─────────────────────────────────────────────
    # Orden visual: LIBRO + PÓLIZA | línea | INSTRUMENTO PÚBLICO
    # (igual que el acta original)

    def header_documento(self, libro, instrumento, poliza):
        self._linea(1.5)

        ps = self.cursor
        self._insert(libro + "\n")
        self._fmt_text(ps, self.cursor, _ts(bold=True, size=10.0), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER", "lineSpacing": 130,
            "spaceAbove": {"magnitude": 4, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

        ps = self.cursor
        self._insert(poliza + "\n")
        self._fmt_text(ps, self.cursor, _ts(bold=True, size=10.0), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER", "lineSpacing": 130,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

        self._linea(0.75)
        self.vacio()

        ps = self.cursor
        self._insert(instrumento + "\n")
        self._fmt_text(ps, self.cursor, _ts(bold=True, size=FONT_SIZE_HEADER), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER", "lineSpacing": 140,
            "spaceAbove": {"magnitude": 4, "unit": "PT"},
            "spaceBelow": {"magnitude": 4, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

        self._linea(1.5)
        self.vacio()

    # ── Encabezado de sección ────────────────────────────────────────────────

    def encabezado_seccion(self, titulo):
        self.vacio()
        self._linea(0.75)
        ps = self.cursor
        self._insert(titulo + "\n")
        self._fmt_text(ps, self.cursor, _ts(bold=True, size=FONT_SIZE_ENC), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER", "lineSpacing": LINE_SPACING * 100,
            "spaceAbove": {"magnitude": 5, "unit": "PT"},
            "spaceBelow": {"magnitude": 5, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        self._linea(0.75)
        self.vacio()

    # ── Tabla real via Docs API ──────────────────────────────────────────────

    def _insertar_tabla_real(self, num_filas, num_cols):
        """
        Hace flush, inserta la tabla vacía, lee el doc para obtener índices
        de celdas y devuelve (tabla_elem, celdas).
        celdas[row][col] = (para_start, para_end)
        """
        self.flush()
        tabla_pos = self.cursor

        self.svc.documents().batchUpdate(
            documentId=self.doc_id,
            body={"requests": [{"insertTable": {
                "rows": num_filas,
                "columns": num_cols,
                "location": _idx(tabla_pos),
            }}]},
        ).execute()

        doc = self.svc.documents().get(documentId=self.doc_id).execute()
        body = doc.get("body", {}).get("content", [])

        tabla_elem = None
        for elem in reversed(body):
            if "table" in elem:
                tabla_elem = elem          # StructuralElement completo (tiene startIndex/endIndex)
                break

        if not tabla_elem:
            self.cursor = body[-1].get("endIndex", tabla_pos + 10)
            return None, []

        celdas = []
        for row in tabla_elem["table"].get("tableRows", []):
            fila = []
            for cell in row.get("tableCells", []):
                content = cell.get("content", [])
                if content:
                    ps = content[0].get("startIndex", cell["startIndex"] + 1)
                    pe = content[0].get("endIndex", ps + 1)
                else:
                    ps = cell["startIndex"] + 1
                    pe = ps + 1
                fila.append((ps, pe))
            celdas.append(fila)

        return tabla_elem, celdas

    def _estilo_tabla_b(self, tabla_elem, num_filas, num_cols):
        """Borde solo horizontal — estilo B."""
        return [{
            "updateTableCellStyle": {
                "tableRange": {
                    "tableCellLocation": {
                        "tableStartLocation": {"index": tabla_elem["startIndex"]},
                        "rowIndex": 0,
                        "columnIndex": 0,
                    },
                    "rowSpan": num_filas,
                    "columnSpan": num_cols,
                },
                "tableCellStyle": {
                    "borderLeft":    _no_border(),
                    "borderRight":   _no_border(),
                    "borderTop":     _border(0.5),
                    "borderBottom":  _border(0.5),
                    "paddingTop":    {"magnitude": 4, "unit": "PT"},
                    "paddingBottom": {"magnitude": 4, "unit": "PT"},
                    "paddingLeft":   {"magnitude": 6, "unit": "PT"},
                    "paddingRight":  {"magnitude": 6, "unit": "PT"},
                },
                "fields": "borderLeft,borderRight,borderTop,borderBottom,paddingTop,paddingBottom,paddingLeft,paddingRight",
            }
        }]

    def _cell_req(self, para_s, para_e, texto, bold=False, centered=False):
        return [
            {"insertText": {"location": {"index": para_s}, "text": texto}},
            {"updateTextStyle": {
                "range": {"startIndex": para_s, "endIndex": para_s + len(texto)},
                "textStyle": _ts(bold=bold, size=9.5 if bold else 9.0),
                "fields": TSF,
            }},
            {"updateParagraphStyle": {
                "range": {"startIndex": para_s, "endIndex": para_e + len(texto)},
                "paragraphStyle": {
                    "alignment": "CENTER" if centered else "START",
                    "lineSpacing": 120,
                    "spaceAbove": {"magnitude": 2, "unit": "PT"},
                    "spaceBelow": {"magnitude": 2, "unit": "PT"},
                },
                "fields": "alignment,lineSpacing,spaceAbove,spaceBelow",
            }},
        ]

    # ── Tabla accionaria ─────────────────────────────────────────────────────

    def tabla_accionaria(self, socios, capital_fijo=0):
        filas = []
        total_acc = 0
        total_val = 0.0

        for s in socios:
            if isinstance(s, dict):
                nombre = s.get("nombre", "")
                nac    = s.get("nacionalidad", "México")
                acc    = s.get("acciones", 0)
                val    = s.get("valor_nominal", 0)
                pct    = s.get("porcentaje", 0)
            else:
                nombre = getattr(s, "nombre_completo", getattr(s, "nombre", ""))
                nac    = getattr(s, "nacionalidad_pais", "México")
                pct    = getattr(s, "porcentaje", 0) or 0
                acc_a  = getattr(s, "acciones", None)
                val_a  = getattr(s, "valor_nominal", None)
                if acc_a is None and capital_fijo and socios:
                    cap_s = float(capital_fijo) * (float(pct) / 100) if pct else float(capital_fijo) / len(socios)
                    acc = int(cap_s // 1000)
                    val = cap_s
                else:
                    acc = acc_a or 0
                    val = val_a or 0
            try:
                val_f = float(str(val).replace("$", "").replace(",", ""))
                acc_i = int(acc)
            except Exception:
                val_f = 0.0
                acc_i = 0
            total_acc += acc_i
            total_val += val_f
            filas.append((nombre, nac, acc_i, val_f, pct))

        num_filas = 1 + len(filas) + 1  # header + datos + total
        tabla_elem, celdas = self._insertar_tabla_real(num_filas, 4)
        if not tabla_elem:
            return

        reqs = []
        headers = ["ACCIONISTA Y RFC", "ACCIONES", "VALOR NOMINAL", "%"]
        for col, (ps, pe) in enumerate(celdas[0]):
            reqs += self._cell_req(ps, pe, headers[col], bold=True, centered=True)

        for ri, (nombre, nac, acc, val, pct) in enumerate(filas):
            row = celdas[1 + ri]
            vals = [f"{nombre}\n{nac}", str(acc), f"${val:,.2f}", f"{pct}%"]
            for col, (ps, pe) in enumerate(row):
                reqs += self._cell_req(ps, pe, vals[col], bold=False, centered=(col > 0))

        total_row = celdas[-1]
        totals = ["TOTAL", str(total_acc), f"${total_val:,.2f}", "100%"]
        for col, (ps, pe) in enumerate(total_row):
            reqs += self._cell_req(ps, pe, totals[col], bold=True, centered=(col > 0))

        reqs += self._estilo_tabla_b(tabla_elem, num_filas, 4)

        self.svc.documents().batchUpdate(
            documentId=self.doc_id, body={"requests": reqs}
        ).execute()

        self.cursor = tabla_elem["endIndex"]
        self.vacio()

    # ── Tabla capital SRL ────────────────────────────────────────────────────

    def tabla_capital_srl(self, socios):
        filas = []
        for s in socios:
            if isinstance(s, dict):
                nombre = s.get("nombre", "")
                monto  = s.get("monto_parte_social", "")
                val    = s.get("valor", "")
                letra  = s.get("con_letra", "")
            else:
                nombre = getattr(s, "nombre_completo", getattr(s, "nombre", ""))
                monto  = getattr(s, "monto_parte_social", "")
                val    = getattr(s, "valor", "")
                letra  = getattr(s, "con_letra", "")
            filas.append((nombre, str(monto), str(val), str(letra)))

        num_filas = 1 + len(filas)
        tabla_elem, celdas = self._insertar_tabla_real(num_filas, 4)
        if not tabla_elem:
            return

        reqs = []
        headers = ["SOCIO", "PARTE SOCIAL", "VALOR", "CON LETRA"]
        for col, (ps, pe) in enumerate(celdas[0]):
            reqs += self._cell_req(ps, pe, headers[col], bold=True, centered=True)

        for ri, (nombre, monto, val, letra) in enumerate(filas):
            row = celdas[1 + ri]
            vals = [nombre, monto, val, letra]
            for col, (ps, pe) in enumerate(row):
                reqs += self._cell_req(ps, pe, vals[col], bold=False, centered=(col > 0))

        reqs += self._estilo_tabla_b(tabla_elem, num_filas, 4)

        self.svc.documents().batchUpdate(
            documentId=self.doc_id, body={"requests": reqs}
        ).execute()

        self.cursor = tabla_elem["endIndex"]
        self.vacio()

    # ── Firmas ───────────────────────────────────────────────────────────────

    def firma_socio(self, nombre):
        self.vacio()
        self._linea(0.75)
        ps = self.cursor
        self._insert(nombre.upper() + "\n")
        self._fmt_text(ps, self.cursor, _ts(bold=True, size=10.5), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER", "lineSpacing": 130,
            "spaceAbove": {"magnitude": 4, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

        ps = self.cursor
        self._insert("Nombre completo.   Firma.   Huellas Índices Izquierdo y Derecho.\n")
        self._fmt_text(ps, self.cursor, _ts(italic=True, size=8.5, color=COLOR_SOFT), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER", "lineSpacing": 120,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 8, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

    def firma_corredor(self, nombre, cargo):
        for _ in range(2):
            self.vacio()
        self._linea(0.75)
        ps = self.cursor
        self._insert(nombre.upper() + "\n")
        self._fmt_text(ps, self.cursor, _ts(bold=True, size=10.5), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER", "lineSpacing": 130,
            "spaceAbove": {"magnitude": 4, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

        ps = self.cursor
        self._insert(cargo + "\n")
        self._fmt_text(ps, self.cursor, _ts(italic=True, size=9.0, color=COLOR_SOFT), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER", "lineSpacing": 120,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")


# ─── Función principal ──────────────────────────────────────────────────────

def exportar_a_docs(secciones: list, nombre_doc: str = "Instrumento Público") -> dict:
    docs_svc, drive_svc = _get_services()
    folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID")

    created_doc = docs_svc.documents().create(body={"title": nombre_doc}).execute()
    doc_id = created_doc["documentId"]
    logger.info(f"AGT-07: Documento creado — {doc_id}")

    if folder_id:
        file = drive_svc.files().get(fileId=doc_id, fields="parents", supportsAllDrives=True).execute()
        prev = ",".join(file.get("parents", []))
        drive_svc.files().update(
            fileId=doc_id, addParents=folder_id, removeParents=prev,
            fields="id,parents", supportsAllDrives=True,
        ).execute()

    docs_svc.documents().batchUpdate(
        documentId=doc_id,
        body={"requests": [{"updateDocumentStyle": {
            "documentStyle": {
                "pageSize": {
                    "width":  {"magnitude": 612,  "unit": "PT"},
                    "height": {"magnitude": 1008, "unit": "PT"},
                },
                "marginTop":    {"magnitude": MARGIN_TOP,    "unit": "PT"},
                "marginBottom": {"magnitude": MARGIN_BOTTOM, "unit": "PT"},
                "marginLeft":   {"magnitude": MARGIN_LEFT,   "unit": "PT"},
                "marginRight":  {"magnitude": MARGIN_RIGHT,  "unit": "PT"},
            },
            "fields": "pageSize,marginTop,marginBottom,marginLeft,marginRight",
        }}]},
    ).execute()

    b = DocsBuilder(doc_id, docs_svc)

    FIRMA_NOMBRE = "WILFREDO EMMANUEL RAMÍREZ NÚÑEZ"
    FIRMA_CARGO  = "Corredor Público Número 3 · Plaza del Estado de Tamaulipas"

    # ── Detectar y agrupar encabezado principal ───────────────────────────────
    header_map  = {}
    header_skip = set()

    for i, sec in enumerate(secciones):
        if sec.tipo != "parrafo" or not sec.runs:
            continue
        if not _runs_son_encabezado(sec.runs):
            continue
        limpio = _extraer_enc(sec.runs[0][0])
        if "LIBRO" in limpio and "libro" not in header_map:
            header_map["libro"] = limpio
            header_skip.add(i)
        elif ("INSTRUMENTO" in limpio or "PÚBLICO" in limpio or "PUBLICO" in limpio) and "instrumento" not in header_map:
            header_map["instrumento"] = limpio
            header_skip.add(i)
        elif ("PÓLIZA" in limpio or "POLIZA" in limpio) and "poliza" not in header_map:
            header_map["poliza"] = limpio
            header_skip.add(i)
        if len(header_map) == 3:
            break

    if len(header_map) == 3:
        b.header_documento(header_map["libro"], header_map["instrumento"], header_map["poliza"])
    else:
        for txt in header_map.values():
            b.parrafo([(txt, True)], centered=True)

    # ── Loop principal ────────────────────────────────────────────────────────
    for i, sec in enumerate(secciones):
        if i in header_skip:
            continue

        if sec.tipo == "vacio":
            b.vacio()

        elif sec.tipo == "encabezado":
            titulo = _extraer_enc(sec.runs[0][0]) if sec.runs else ""
            if titulo:
                b.encabezado_seccion(titulo)

        elif sec.tipo == "parrafo":
            if _runs_son_encabezado(sec.runs):
                titulo = _extraer_enc(sec.runs[0][0]) if sec.runs else ""
                if titulo:
                    b.encabezado_seccion(titulo)
            else:
                b.parrafo(sec.runs)

        elif sec.tipo == "tabla_accionaria":
            b.flush()
            socios       = sec.data.get("socios", []) if isinstance(sec.data, dict) else []
            capital_fijo = sec.data.get("capital_fijo", 0) if isinstance(sec.data, dict) else 0
            b.tabla_accionaria(socios, capital_fijo)

        elif sec.tipo == "tabla_capital_srl":
            b.flush()
            socios = sec.data.get("socios", []) if isinstance(sec.data, dict) else []
            b.tabla_capital_srl(socios)

        elif sec.tipo == "firma":
            nombre = (
                sec.data.get("nombre", "")
                if isinstance(sec.data, dict)
                else getattr(sec.data, "nombre", "")
            )
            if nombre:
                b.firma_socio(nombre)

        elif sec.tipo == "corredor":
            b.firma_corredor(FIRMA_NOMBRE, FIRMA_CARGO)

    b.flush()
    logger.info("AGT-07: Documento listo")

    url = f"https://docs.google.com/document/d/{doc_id}/edit"
    return {"doc_id": doc_id, "url": url, "nombre": nombre_doc}


# ─── Nota para main.py ───────────────────────────────────────────────────────
# exportar_a_docs(secciones: List[Seccion], nombre_doc: str)
