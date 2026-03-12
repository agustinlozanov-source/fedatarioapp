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

Uso independiente:
    from agt07_exportador_docs import exportar_a_docs
    resultado = exportar_a_docs(secciones, nombre_doc)
    print(resultado["url"])
"""

import os
import json
import logging
from typing import List

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# ─── Constantes de diseño ───────────────────────────────────────────────────

FONT_BODY        = "IM Fell English"   # Cambiar a "Hadassah Friedlaender" cuando esté disponible
FONT_SIZE_BODY   = 12.5               # pt
FONT_SIZE_ENC    = 10.0               # pt  (encabezados de sección)
LINE_SPACING     = 1.45               # múltiplo
COLOR_INK        = {"red": 0.05, "green": 0.05, "blue": 0.05}
COLOR_SOFT       = {"red": 0.27, "green": 0.27, "blue": 0.27}

# Márgenes en puntos (1 cm = 28.35 pt)
MARGIN_TOP    = int(3.4  * 28.35)
MARGIN_BOTTOM = int(3.0  * 28.35)
MARGIN_LEFT   = int(4.25 * 28.35)
MARGIN_RIGHT  = int(2.8  * 28.35)

SCOPES = [
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",
]


# ─── Autenticación ──────────────────────────────────────────────────────────

def _get_services():
    """
    Devuelve (docs_service, drive_service) autenticados con OAuth2.

    Lee GOOGLE_OAUTH_CREDENTIALS de dos formas:
      - En local:   ruta a un archivo JSON  (ej. "./refresh_token.txt")
      - En Railway: contenido JSON completo
    """
    oauth_env = os.environ.get("GOOGLE_OAUTH_CREDENTIALS", "")

    if not oauth_env:
        raise EnvironmentError(
            "GOOGLE_OAUTH_CREDENTIALS no está definida. "
            "En local apunta al archivo refresh_token.txt; en Railway pega el JSON completo."
        )

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


# ─── Helpers de requests ────────────────────────────────────────────────────

def _idx(index: int):
    return {"index": index}


def _text_style(bold=False, italic=False, font_size=FONT_SIZE_BODY, color=None):
    return {
        "bold": bold,
        "italic": italic,
        "fontSize": {"magnitude": font_size, "unit": "PT"},
        "foregroundColor": {"color": {"rgbColor": color or COLOR_INK}},
        "weightedFontFamily": {"fontFamily": FONT_BODY},
    }


def _text_style_fields(bold=False, italic=False):
    return "bold,italic,fontSize,foregroundColor,weightedFontFamily"


def _para_style(alignment="JUSTIFIED", spacing_after=0, spacing_before=0, line_spacing=LINE_SPACING):
    return {
        "alignment": alignment,
        "spaceAbove":  {"magnitude": spacing_before, "unit": "PT"},
        "spaceBelow":  {"magnitude": spacing_after,  "unit": "PT"},
        "lineSpacing": line_spacing * 100,
    }


# ─── Constructor de requests ────────────────────────────────────────────────

class DocsBuilder:
    """
    Acumula requests para la Docs API en orden.
    Procesa List[Seccion] con la misma lógica que AGT-06.
    """

    def __init__(self, doc_id: str):
        self.doc_id = doc_id
        self.reqs   = []
        self.cursor = 1  # Google Docs siempre empieza en índice 1

    def _insert(self, text: str):
        self.reqs.append({
            "insertText": {
                "location": _idx(self.cursor),
                "text": text,
            }
        })
        self.cursor += len(text)

    def _fmt_text(self, start: int, end: int, style: dict, fields: str):
        self.reqs.append({
            "updateTextStyle": {
                "range": {"startIndex": start, "endIndex": end},
                "textStyle": style,
                "fields": fields,
            }
        })

    def _fmt_para(self, start: int, end: int, style: dict, fields: str):
        self.reqs.append({
            "updateParagraphStyle": {
                "range": {"startIndex": start, "endIndex": end},
                "paragraphStyle": style,
                "fields": fields,
            }
        })

    def para_con_runs(self, runs: list, centered: bool = False):
        """
        Inserta un párrafo con runs (texto, es_negrita).
        Equivalente a _make_parrafo de AGT-06.
        """
        if not runs:
            start = self.cursor
            self._insert("\n")
            end = self.cursor
            self._fmt_para(start, end, _para_style(), "alignment,spaceAbove,spaceBelow,lineSpacing")
            return

        alignment = "CENTER" if centered else "JUSTIFIED"
        para_start = self.cursor

        for texto, es_bold in runs:
            run_start = self.cursor
            self._insert(texto)
            run_end = self.cursor
            self._fmt_text(
                run_start, run_end,
                _text_style(bold=es_bold, font_size=FONT_SIZE_ENC if centered else FONT_SIZE_BODY),
                _text_style_fields(bold=es_bold),
            )

        self._insert("\n")
        para_end = self.cursor

        self._fmt_para(
            para_start, para_end,
            _para_style(alignment=alignment),
            "alignment,spaceAbove,spaceBelow,lineSpacing",
        )

    def firma_block(self, nombre: str, cargo: str):
        """Bloque de firma al final."""
        for _ in range(3):
            self.para_con_runs([])

        start = self.cursor
        self._insert("_" * 50 + "\n")
        end = self.cursor
        self._fmt_para(start, end, {"alignment": "CENTER", "lineSpacing": 100}, "alignment,lineSpacing")
        self._fmt_text(start, end, _text_style(font_size=10), _text_style_fields())

        start = self.cursor
        self._insert(nombre.upper() + "\n")
        end = self.cursor
        self._fmt_para(start, end, {"alignment": "CENTER", "lineSpacing": 140}, "alignment,lineSpacing")
        self._fmt_text(start, end, _text_style(bold=True, font_size=10.5), _text_style_fields(bold=True))

        start = self.cursor
        self._insert(cargo + "\n")
        end = self.cursor
        self._fmt_para(start, end, {"alignment": "CENTER", "lineSpacing": 140}, "alignment,lineSpacing")
        self._fmt_text(start, end, _text_style(italic=True, font_size=9, color=COLOR_SOFT), _text_style_fields(italic=True))

    def flush(self, docs_service):
        """Ejecuta todos los requests acumulados en batch."""
        if not self.reqs:
            return
        docs_service.documents().batchUpdate(
            documentId=self.doc_id,
            body={"requests": self.reqs},
        ).execute()
        self.reqs = []


# ─── Función principal ──────────────────────────────────────────────────────

def exportar_a_docs(secciones: list, nombre_doc: str = "Instrumento Público") -> dict:
    """
    Exporta el instrumento a Google Docs.

    Args:
        secciones:  List[Seccion] generada por AGT-04 (mismo objeto que recibe AGT-06).
        nombre_doc: Nombre del documento en Drive.

    Returns:
        {
            "doc_id": str,
            "url":    str,
            "nombre": str,
        }
    """
    docs_svc, drive_svc = _get_services()

    folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID")

    # ── 1. Crear documento con Docs API ─────────────────────────────────────
    created_doc = docs_svc.documents().create(
        body={"title": nombre_doc}
    ).execute()
    doc_id = created_doc["documentId"]
    logger.info(f"AGT-07: Documento creado — {doc_id}")

    # ── 2. Mover a la carpeta de Drive ───────────────────────────────────────
    if folder_id:
        file = drive_svc.files().get(
            fileId=doc_id,
            fields="parents",
            supportsAllDrives=True,
        ).execute()
        previous_parents = ",".join(file.get("parents", []))
        drive_svc.files().update(
            fileId=doc_id,
            addParents=folder_id,
            removeParents=previous_parents,
            fields="id, parents",
            supportsAllDrives=True,
        ).execute()

    # ── 3. Configurar página (tamaño oficio, márgenes) ───────────────────────
    docs_svc.documents().batchUpdate(
        documentId=doc_id,
        body={"requests": [{
            "updateDocumentStyle": {
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
            }
        }]},
    ).execute()

    # ── 4. Construir contenido iterando List[Seccion] ────────────────────────
    b = DocsBuilder(doc_id)

    firma_nombre = "WILFREDO EMMANUEL RAMÍREZ NÚÑEZ"
    firma_cargo  = "Corredor Público Número 3 · Plaza del Estado de Tamaulipas"

    for sec in secciones:
        if sec.tipo == "vacio":
            b.para_con_runs([])

        elif sec.tipo in ("parrafo", "encabezado"):
            centered = sec.tipo == "encabezado"
            b.para_con_runs(sec.runs, centered=centered)

        elif sec.tipo == "tabla_accionaria":
            socios = sec.data.get("socios", []) if isinstance(sec.data, dict) else []
            b.para_con_runs([("Accionista | Nacionalidad | Acciones | Valor Nominal | %", True)], centered=True)
            for s in socios:
                if isinstance(s, dict):
                    nombre = s.get("nombre", "")
                    nac    = s.get("nacionalidad", "")
                    acc    = s.get("acciones", "")
                    val    = s.get("valor_nominal", "")
                    pct    = s.get("porcentaje", "")
                else:
                    nombre = getattr(s, "nombre_completo", getattr(s, "nombre", ""))
                    nac    = getattr(s, "nacionalidad_pais", "")
                    acc    = getattr(s, "acciones", "")
                    val    = getattr(s, "valor_nominal", "")
                    pct    = getattr(s, "porcentaje", "")
                linea = f"{nombre} | {nac} | {acc} | {val} | {pct}%"
                b.para_con_runs([(linea, False)])

        elif sec.tipo == "tabla_capital_srl":
            socios = sec.data.get("socios", []) if isinstance(sec.data, dict) else []
            b.para_con_runs([("Socio | Parte Social | Valor | Con Letra", True)], centered=True)
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
                linea = f"{nombre} | {monto} | {val} | {letra}"
                b.para_con_runs([(linea, False)])

        elif sec.tipo == "firma":
            nombre = sec.data.get("nombre", firma_nombre)
            b.firma_block(nombre, firma_cargo)

        elif sec.tipo == "corredor":
            b.para_con_runs([("_______________________________________________", True)], centered=True)
            b.para_con_runs([
                ("LICENCIADO WILFREDO EMMANUEL RAMÍREZ NÚÑEZ. "
                 "EL CORREDOR PÚBLICO NÚMERO 3 (TRES) "
                 "DE LA PLAZA DEL ESTADO DE TAMAULIPAS.", True)
            ], centered=True)

    # ── 5. Ejecutar todos los requests ──────────────────────────────────────
    b.flush(docs_svc)
    logger.info(f"AGT-07: Contenido escrito correctamente")

    url = f"https://docs.google.com/document/d/{doc_id}/edit"
    logger.info(f"AGT-07: Documento listo — {url}")

    return {
        "doc_id": doc_id,
        "url":    url,
        "nombre": nombre_doc,
    }


# ─── Nota para main.py ───────────────────────────────────────────────────────
# exportar_a_docs ahora recibe (secciones: List[Seccion], nombre_doc: str)
# El endpoint debe construir nombre_doc antes de llamar, por ejemplo:
#
# secciones = obtener_secciones_de_firestore(instrumento_id)
# nombre_doc = f"Póliza {instrumento_id}"
# resultado = exportar_a_docs(secciones, nombre_doc)
