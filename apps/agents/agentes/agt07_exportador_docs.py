"""
AGT-07 — Exportador Google Docs
================================
Recibe List[Seccion] (mismo objeto que usa AGT-06) y genera
un documento en Google Docs con el diseño oficial de Fedatario.

Dependencias:
    pip install google-api-python-client google-auth google-auth-oauthlib

Variables de entorno requeridas:
    GOOGLE_OAUTH_CREDENTIALS  — JSON con client_id, client_secret, refresh_token
                                En local: ruta al archivo refresh_token.txt
                                En Railway: contenido JSON completo
    GOOGLE_DRIVE_FOLDER_ID    — ID de la carpeta destino en Drive
"""

import os
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
COLOR_TABLE_HDR  = {"red": 0.15, "green": 0.15, "blue": 0.15}
COLOR_WHITE      = {"red": 1.0,  "green": 1.0,  "blue": 1.0}

MARGIN_TOP    = int(3.0 * 28.35)
MARGIN_BOTTOM = int(3.0 * 28.35)
MARGIN_LEFT   = int(4.5 * 28.35)
MARGIN_RIGHT  = int(3.5 * 28.35)

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]

# ─── Detección de runs especiales ───────────────────────────────────────────

def _es_relleno(texto: str) -> bool:
    t = texto.strip()
    return t.startswith(".-") or (t.startswith("-") and len(set(t.replace(" ", ""))) <= 2)

def _es_enc(texto: str) -> bool:
    t = texto.strip()
    return t.startswith("=") and t.endswith("=")

def _extraer_enc(texto: str) -> str:
    return texto.strip().strip("=").strip()

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

# ─── Helpers ────────────────────────────────────────────────────────────────

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

# ─── Constructor ────────────────────────────────────────────────────────────

class DocsBuilder:
    def __init__(self, doc_id):
        self.doc_id = doc_id
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

    # ── Párrafo vacío ────────────────────────────────────────────────────────

    def vacio(self):
        s = self.cursor
        self._insert("\n")
        self._fmt_para(s, self.cursor, {
            "alignment": "JUSTIFIED",
            "lineSpacing": LINE_SPACING * 100,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

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

    # ── Encabezado del documento (LIBRO / INSTRUMENTO / PÓLIZA) ─────────────

    def header_documento(self, libro, instrumento, poliza):
        # Línea horizontal gruesa superior
        self._linea(1.5)

        # LIBRO DE REGISTRO
        ps = self.cursor
        rs = self.cursor
        self._insert(libro + "\n")
        self._fmt_text(rs, self.cursor, _ts(bold=False, italic=True, size=9.5), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": 130,
            "spaceAbove": {"magnitude": 4, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

        # INSTRUMENTO PÚBLICO
        ps = self.cursor
        rs = self.cursor
        self._insert(instrumento + "\n")
        self._fmt_text(rs, self.cursor, _ts(bold=True, size=FONT_SIZE_HEADER), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": 140,
            "spaceAbove": {"magnitude": 2, "unit": "PT"},
            "spaceBelow": {"magnitude": 2, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

        # PÓLIZA NÚMERO
        ps = self.cursor
        rs = self.cursor
        self._insert(poliza + "\n")
        self._fmt_text(rs, self.cursor, _ts(bold=True, size=FONT_SIZE_BODY), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": 130,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 4, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

        # Línea horizontal gruesa inferior
        self._linea(1.5)
        self.vacio()

    def _linea(self, width=0.75):
        """Línea horizontal usando borderBottom de un párrafo vacío."""
        ps = self.cursor
        self._insert("\n")
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": 50,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
            "borderBottom": _border(width),
        }, "alignment,lineSpacing,spaceAbove,spaceBelow,borderBottom")

    # ── Encabezado de sección (DATOS GENERALES, CAPÍTULOS, etc.) ────────────

    def encabezado_seccion(self, titulo):
        self.vacio()
        self._linea(0.75)
        ps = self.cursor
        rs = self.cursor
        self._insert(titulo + "\n")
        self._fmt_text(rs, self.cursor, _ts(bold=True, size=FONT_SIZE_ENC), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": LINE_SPACING * 100,
            "spaceAbove": {"magnitude": 6, "unit": "PT"},
            "spaceBelow": {"magnitude": 6, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        self._linea(0.75)
        self.vacio()

    # ── Tabla accionaria estilo B (líneas horizontales, sin bordes laterales) ─

    def tabla_accionaria(self, socios, capital_fijo=0):
        self.vacio()

        # Calcular columnas
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
                val_f = float(str(val).replace("$","").replace(",",""))
                acc_i = int(acc)
            except:
                val_f = 0.0
                acc_i = 0
            total_acc += acc_i
            total_val += val_f
            filas.append((nombre, nac, acc_i, val_f, pct))

        # Insertar tabla via API — 4 columnas: Accionista+RFC | Acciones | Valor Nominal | %
        num_filas = len(filas) + 2  # header + datos + total
        self.reqs.append({"insertTable": {
            "rows": num_filas,
            "columns": 4,
            "location": _idx(self.cursor),
        }})
        # La tabla insertada mueve el cursor — necesitamos hacer flush parcial
        # En su lugar, usamos texto plano estilo B (líneas horizontales)
        # La Docs API requiere conocer los índices post-inserción para formatear celdas
        # Por ahora usamos el método probado de texto con separadores visuales

        # Cancelar el insertTable y usar texto estilo B
        self.reqs.pop()

        # Encabezado de tabla — línea + texto + línea
        self._linea(1.0)
        headers = [
            ("ACCIONISTA", 0.45),
            ("NACION.", 0.12),
            ("ACCIONES", 0.15),
            ("VALOR NOMINAL", 0.18),
            ("%", 0.10),
        ]
        ps = self.cursor
        header_txt = "  ".join(f"{h}" for h, _ in headers)
        rs = self.cursor
        self._insert(header_txt + "\n")
        self._fmt_text(rs, self.cursor, _ts(bold=True, size=9.5), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "JUSTIFIED",
            "lineSpacing": 130,
            "spaceAbove": {"magnitude": 3, "unit": "PT"},
            "spaceBelow": {"magnitude": 3, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        self._linea(0.75)

        # Filas
        for nombre, nac, acc, val, pct in filas:
            ps = self.cursor
            rs = self.cursor
            fila_txt = f"{nombre}   {nac}   {acc}   ${val:,.2f}   {pct}%"
            self._insert(fila_txt + "\n")
            self._fmt_text(rs, self.cursor, _ts(bold=False, size=10.0), TSF)
            self._fmt_para(ps, self.cursor, {
                "alignment": "JUSTIFIED",
                "lineSpacing": 130,
                "spaceAbove": {"magnitude": 2, "unit": "PT"},
                "spaceBelow": {"magnitude": 2, "unit": "PT"},
            }, "alignment,lineSpacing,spaceAbove,spaceBelow")

        # Línea de total
        self._linea(0.75)
        ps = self.cursor
        rs = self.cursor
        total_txt = f"TOTAL   —   {total_acc}   ${total_val:,.2f}   100%"
        self._insert(total_txt + "\n")
        self._fmt_text(rs, self.cursor, _ts(bold=True, size=10.0), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "JUSTIFIED",
            "lineSpacing": 130,
            "spaceAbove": {"magnitude": 3, "unit": "PT"},
            "spaceBelow": {"magnitude": 3, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        self._linea(1.0)
        self.vacio()

    # ── Tabla de capital SRL ─────────────────────────────────────────────────

    def tabla_capital_srl(self, socios):
        self.vacio()
        self._linea(1.0)
        ps = self.cursor
        rs = self.cursor
        self._insert("SOCIO   PARTE SOCIAL   VALOR   CON LETRA\n")
        self._fmt_text(rs, self.cursor, _ts(bold=True, size=9.5), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "JUSTIFIED",
            "lineSpacing": 130,
            "spaceAbove": {"magnitude": 3, "unit": "PT"},
            "spaceBelow": {"magnitude": 3, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        self._linea(0.75)
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
            ps = self.cursor
            rs = self.cursor
            self._insert(f"{nombre}   {monto}   {val}   {letra}\n")
            self._fmt_text(rs, self.cursor, _ts(bold=False, size=10.0), TSF)
            self._fmt_para(ps, self.cursor, {
                "alignment": "JUSTIFIED",
                "lineSpacing": 130,
                "spaceAbove": {"magnitude": 2, "unit": "PT"},
                "spaceBelow": {"magnitude": 2, "unit": "PT"},
            }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        self._linea(1.0)
        self.vacio()

    # ── Firma de socio (estilo acta original: tabla 4 celdas) ───────────────
    # Simulada con texto estructurado ya que tabla inline requiere flush

    def firma_socio(self, nombre):
        self.vacio()
        # Línea de firma
        self._linea(0.75)
        # Nombre
        ps = self.cursor
        rs = self.cursor
        self._insert(nombre.upper() + "\n")
        self._fmt_text(rs, self.cursor, _ts(bold=True, size=10.5), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": 130,
            "spaceAbove": {"magnitude": 4, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        # Etiqueta
        ps = self.cursor
        rs = self.cursor
        self._insert("Nombre completo.   Firma.   Huellas Índices Izquierdo y Derecho.\n")
        self._fmt_text(rs, self.cursor, _ts(italic=True, size=8.5, color=COLOR_SOFT), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": 120,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 8, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

    # ── Firma del Corredor ───────────────────────────────────────────────────

    def firma_corredor(self, nombre, cargo):
        for _ in range(2):
            self.vacio()
        self._linea(0.75)
        ps = self.cursor
        rs = self.cursor
        self._insert(nombre.upper() + "\n")
        self._fmt_text(rs, self.cursor, _ts(bold=True, size=10.5), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": 130,
            "spaceAbove": {"magnitude": 4, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        ps = self.cursor
        rs = self.cursor
        self._insert(cargo + "\n")
        self._fmt_text(rs, self.cursor, _ts(italic=True, size=9.0, color=COLOR_SOFT), TSF)
        self._fmt_para(ps, self.cursor, {
            "alignment": "CENTER",
            "lineSpacing": 120,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")

    def flush(self, docs_service):
        if not self.reqs:
            return
        docs_service.documents().batchUpdate(
            documentId=self.doc_id,
            body={"requests": self.reqs},
        ).execute()
        self.reqs = []


# ─── Función principal ──────────────────────────────────────────────────────

def exportar_a_docs(secciones: list, nombre_doc: str = "Instrumento Público") -> dict:
    docs_svc, drive_svc = _get_services()
    folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID")

    # Crear documento
    created_doc = docs_svc.documents().create(body={"title": nombre_doc}).execute()
    doc_id = created_doc["documentId"]
    logger.info(f"AGT-07: Documento creado — {doc_id}")

    # Mover a carpeta
    if folder_id:
        file = drive_svc.files().get(fileId=doc_id, fields="parents", supportsAllDrives=True).execute()
        prev = ",".join(file.get("parents", []))
        drive_svc.files().update(
            fileId=doc_id, addParents=folder_id, removeParents=prev,
            fields="id,parents", supportsAllDrives=True,
        ).execute()

    # Configurar página
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

    b = DocsBuilder(doc_id)

    FIRMA_NOMBRE = "WILFREDO EMMANUEL RAMÍREZ NÚÑEZ"
    FIRMA_CARGO  = "Corredor Público Número 3 · Plaza del Estado de Tamaulipas"

    # Detectar las 3 primeras secciones de encabezado (libro, instrumento, póliza)
    header_indices = []
    for i, sec in enumerate(secciones):
        if sec.tipo == "parrafo" and sec.runs and _runs_son_encabezado(sec.runs):
            limpio = _extraer_enc(sec.runs[0][0])
            if "LIBRO" in limpio or "INSTRUMENTO" in limpio or "PÓLIZA" in limpio or "POLIZA" in limpio:
                header_indices.append((i, limpio))
                if len(header_indices) == 3:
                    break

    skip = {i for i, _ in header_indices}

    if len(header_indices) == 3:
        libro      = header_indices[0][1]
        instrumento = header_indices[1][1]
        poliza     = header_indices[2][1]
        b.header_documento(libro, instrumento, poliza)
    elif len(header_indices) > 0:
        # Fallback: renderizar lo que haya
        for _, txt in header_indices:
            b.parrafo([(txt, True)], centered=True)

    for i, sec in enumerate(secciones):
        if i in skip:
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
            socios       = sec.data.get("socios", []) if isinstance(sec.data, dict) else []
            capital_fijo = sec.data.get("capital_fijo", 0) if isinstance(sec.data, dict) else 0
            b.tabla_accionaria(socios, capital_fijo)

        elif sec.tipo == "tabla_capital_srl":
            socios = sec.data.get("socios", []) if isinstance(sec.data, dict) else []
            b.tabla_capital_srl(socios)

        elif sec.tipo == "firma":
            nombre = sec.data.get("nombre", "") if isinstance(sec.data, dict) else getattr(sec.data, "nombre", "")
            if nombre:
                b.firma_socio(nombre)

        elif sec.tipo == "corredor":
            b.firma_corredor(FIRMA_NOMBRE, FIRMA_CARGO)

    b.flush(docs_svc)
    logger.info("AGT-07: Documento listo")

    url = f"https://docs.google.com/document/d/{doc_id}/edit"
    return {"doc_id": doc_id, "url": url, "nombre": nombre_doc}


# ─── Nota para main.py ───────────────────────────────────────────────────────
# exportar_a_docs(secciones: List[Seccion], nombre_doc: str)
