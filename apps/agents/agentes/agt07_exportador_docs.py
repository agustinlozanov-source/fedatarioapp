"""
AGT-07 — Exportador Google Docs
================================
Recibe secciones_obj (mismo objeto que usa AGT-06) y genera
un documento en Google Docs con el diseño oficial de Fedatario.

Dependencias:
    pip install google-api-python-client google-auth

Variables de entorno requeridas:
    GOOGLE_OAUTH_CREDENTIALS  — JSON con client_id, client_secret y refresh_token
    GOOGLE_DRIVE_FOLDER_ID    — ID de la carpeta destino en Drive

Uso independiente:
    from agt07_exportador_docs import exportar_a_docs
    resultado = exportar_a_docs(secciones_obj)
    print(resultado["url"])

Integración con el pipeline (agt01_orquestador.py):
    El orquestador llama a exportar_a_docs() igual que llama a generar_docx().
    Son completamente independientes — uno no afecta al otro.
"""

import os
import json
import logging
from typing import Optional

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

# ─── Constantes de diseño ───────────────────────────────────────────────────

FONT_BODY        = "IM Fell English"   # Sustituir por "Hadassah Friedlaender" si se instala en el entorno
FONT_SIZE_BODY   = 12.5               # pt
FONT_SIZE_LABEL  = 7.5                # pt  (etiquetas de capítulo)
FONT_SIZE_TITLE  = 10.0               # pt  (título de capítulo)
FONT_SIZE_HEADER = 13.0               # pt  (INSTRUMENTO PÚBLICO)
LINE_SPACING     = 1.45               # múltiplo
COLOR_INK        = {"red": 0.05, "green": 0.05, "blue": 0.05}
COLOR_SOFT       = {"red": 0.27, "green": 0.27, "blue": 0.27}

# Márgenes en puntos (1 cm = 28.35 pt)
MARGIN_TOP    = int(3.4  * 28.35)
MARGIN_BOTTOM = int(3.0  * 28.35)
MARGIN_LEFT   = int(4.25 * 28.35)
MARGIN_RIGHT  = int(2.8  * 28.35)

# ─── Autenticación ──────────────────────────────────────────────────────────

def _get_services():
    """
    Devuelve (docs_service, drive_service) autenticados con OAuth2.

    Lee GOOGLE_OAUTH_CREDENTIALS de dos formas:
      - En local:   ruta a un archivo JSON  (ej. "./refresh_token.json")
      - En Railway: contenido JSON completo
    """
    oauth_env = os.environ.get("GOOGLE_OAUTH_CREDENTIALS", "")

    if not oauth_env:
        raise EnvironmentError(
            "GOOGLE_OAUTH_CREDENTIALS no está definida."
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
    """Shorthand para location index."""
    return {"index": index}


def _text_style(
    bold=False,
    italic=False,
    font_size=FONT_SIZE_BODY,
    color=None,
    letter_spacing=None,
):
    style = {
        "bold": bold,
        "italic": italic,
        "fontSize": {"magnitude": font_size, "unit": "PT"},
        "foregroundColor": {"color": {"rgbColor": color or COLOR_INK}},
        "weightedFontFamily": {"fontFamily": FONT_BODY},
    }
    return style


def _text_style_fields(bold=False, italic=False, custom_fields=None):
    fields = "bold,italic,fontSize,foregroundColor,weightedFontFamily"
    if custom_fields:
        fields += "," + custom_fields
    return fields


def _para_style(
    alignment="JUSTIFIED",
    spacing_after=0,
    spacing_before=0,
    line_spacing=LINE_SPACING,
    indent_first=0,
):
    return {
        "alignment": alignment,
        "spaceAbove":  {"magnitude": spacing_before, "unit": "PT"},
        "spaceBelow":  {"magnitude": spacing_after,  "unit": "PT"},
        "lineSpacing": line_spacing * 100,  # Docs API usa centésimas
        "indentFirstLine": {"magnitude": indent_first, "unit": "PT"},
    }


# ─── Constructor de requests ────────────────────────────────────────────────

class DocsBuilder:
    """
    Acumula requests para la Docs API en orden.
    Cada método inserta texto y aplica formato en la posición actual.
    """

    def __init__(self, doc_id: str):
        self.doc_id  = doc_id
        self.reqs    = []
        self.cursor  = 1  # Google Docs siempre empieza en índice 1

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

    # ── Primitivas públicas ──────────────────────────────────────────────────

    def newline(self):
        self._insert("\n")

    def body_para(self, text: str, bold_prefix: str = None):
        """
        Párrafo de cuerpo justificado.
        Si bold_prefix está definido, esa parte va en negrita.
        """
        start = self.cursor
        self._insert(text + "\n")
        end = self.cursor

        # Estilo de párrafo
        self._fmt_para(
            start, end,
            _para_style(),
            "alignment,spaceAbove,spaceBelow,lineSpacing",
        )

        # Estilo de texto base
        self._fmt_text(
            start, end,
            _text_style(),
            _text_style_fields(),
        )

        # Negrita en el prefijo (ej. "Primera. De los Accionistas.—")
        if bold_prefix and text.startswith(bold_prefix):
            prefix_end = start + len(bold_prefix)
            self._fmt_text(
                start, prefix_end,
                _text_style(bold=True),
                "bold",
            )

    def header_block(self, libro: str, poliza: str):
        """Encabezado principal con doble filete."""
        # Filete superior (simulado con línea horizontal vía tabla de 1 celda o párrafo con borde)
        # Google Docs API no tiene hr nativo — usamos bordes de párrafo
        self._header_rule(thick=True)
        self._header_rule(thick=False)
        self._header_line(libro.upper(), size=8, italic=True)
        self._header_line("INSTRUMENTO PÚBLICO", size=FONT_SIZE_HEADER, bold=True)
        self._header_line(poliza, size=9)
        self._header_rule(thick=False)
        self._header_rule(thick=True)

    def _header_line(self, text: str, size: float, bold=False, italic=False):
        start = self.cursor
        self._insert(text + "\n")
        end = self.cursor
        self._fmt_para(start, end, {
            "alignment": "CENTER",
            "lineSpacing": 160,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        self._fmt_text(start, end, _text_style(bold=bold, italic=italic, font_size=size), _text_style_fields(bold=bold, italic=italic))

    def _header_rule(self, thick=True):
        """Línea horizontal usando borde de párrafo."""
        width = 2.0 if thick else 0.5
        start = self.cursor
        self._insert("\n")
        end = self.cursor
        self.reqs.append({
            "updateParagraphStyle": {
                "range": {"startIndex": start, "endIndex": end},
                "paragraphStyle": {
                    "alignment": "CENTER",
                    "lineSpacing": 100,
                    "spaceAbove": {"magnitude": 1, "unit": "PT"},
                    "spaceBelow": {"magnitude": 1, "unit": "PT"},
                    "borderBottom": {
                        "color": {"color": {"rgbColor": COLOR_INK}},
                        "width": {"magnitude": width, "unit": "PT"},
                        "padding": {"magnitude": 1, "unit": "PT"},
                        "dashStyle": "SOLID",
                    },
                },
                "fields": "alignment,lineSpacing,spaceAbove,spaceBelow,borderBottom",
            }
        })

    def datos_header(self):
        """Separador 'Datos Generales' con líneas laterales."""
        # En Docs API simulamos con texto centrado en itálica
        start = self.cursor
        self._insert("— Datos Generales —\n")
        end = self.cursor
        self._fmt_para(start, end, {
            "alignment": "CENTER",
            "spaceAbove": {"magnitude": 8, "unit": "PT"},
            "spaceBelow": {"magnitude": 4, "unit": "PT"},
            "lineSpacing": 100,
        }, "alignment,spaceAbove,spaceBelow,lineSpacing")
        self._fmt_text(start, end, _text_style(italic=True, font_size=FONT_SIZE_LABEL, color=COLOR_SOFT), _text_style_fields(italic=True))

    def chapter(self, label: str, title: str = None):
        """Encabezado de capítulo con doble filete arriba y abajo."""
        self._header_rule(thick=True)
        self._header_rule(thick=False)

        # Etiqueta (ej. "Cláusulas de los Estatutos Sociales")
        start = self.cursor
        self._insert(label.upper() + "\n")
        end = self.cursor
        self._fmt_para(start, end, {
            "alignment": "CENTER",
            "lineSpacing": 180,
            "spaceAbove": {"magnitude": 0, "unit": "PT"},
            "spaceBelow": {"magnitude": 0, "unit": "PT"},
        }, "alignment,lineSpacing,spaceAbove,spaceBelow")
        self._fmt_text(start, end, _text_style(italic=True, font_size=FONT_SIZE_LABEL, color=COLOR_SOFT), _text_style_fields(italic=True))

        # Título (ej. "Capítulo Primero · De los Atributos")
        if title:
            start = self.cursor
            self._insert(title.upper() + "\n")
            end = self.cursor
            self._fmt_para(start, end, {
                "alignment": "CENTER",
                "lineSpacing": 160,
                "spaceAbove": {"magnitude": 0, "unit": "PT"},
                "spaceBelow": {"magnitude": 0, "unit": "PT"},
            }, "alignment,lineSpacing,spaceAbove,spaceBelow")
            self._fmt_text(start, end, _text_style(bold=True, font_size=FONT_SIZE_TITLE), _text_style_fields(bold=True))

        self._header_rule(thick=False)
        self._header_rule(thick=True)

    def firma_block(self, nombre: str, cargo: str):
        """Bloque de firma al final."""
        # Espacio antes
        for _ in range(4):
            self.newline()

        # Línea de firma centrada (simulada con subrayado en espacio)
        start = self.cursor
        self._insert("_" * 50 + "\n")
        end = self.cursor
        self._fmt_para(start, end, {"alignment": "CENTER", "lineSpacing": 100}, "alignment,lineSpacing")
        self._fmt_text(start, end, _text_style(font_size=10), _text_style_fields())

        # Nombre
        start = self.cursor
        self._insert(nombre.upper() + "\n")
        end = self.cursor
        self._fmt_para(start, end, {"alignment": "CENTER", "lineSpacing": 140}, "alignment,lineSpacing")
        self._fmt_text(start, end, _text_style(bold=True, font_size=10.5), _text_style_fields(bold=True))

        # Cargo
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

def _purgar_drive_sa(drive) -> int:
    """
    Elimina PERMANENTEMENTE todos los archivos propiedad de la cuenta de servicio,
    incluyendo los que ya están en papelera (siguen contando contra la cuota).
    Al final vacía la papelera para asegurar que se libera el espacio.
    Devuelve la cantidad de archivos eliminados.
    """
    eliminados = 0
    try:
        page_token = None
        while True:
            kwargs = dict(
                q="'me' in owners",
                fields="nextPageToken,files(id,name)",
                pageSize=100,
            )
            if page_token:
                kwargs["pageToken"] = page_token
            resultado = drive.files().list(**kwargs).execute()
            archivos = resultado.get("files", [])
            for archivo in archivos:
                try:
                    drive.files().delete(fileId=archivo["id"]).execute()
                    eliminados += 1
                    logger.info(f"AGT-07 purga: eliminado '{archivo['name']}' ({archivo['id']})")
                except Exception as e:
                    logger.warning(f"AGT-07 purga: no se pudo eliminar {archivo['id']}: {e}")
            page_token = resultado.get("nextPageToken")
            if not page_token:
                break
    except Exception as e:
        logger.warning(f"AGT-07 purga: error listando archivos: {e}")

    # Vaciar papelera — los archivos eliminados siguen en papelera y siguen
    # consumiendo cuota hasta que se vacía explícitamente
    try:
        drive.files().emptyTrash().execute()
        logger.info("AGT-07 purga: papelera vaciada")
    except Exception as e:
        logger.warning(f"AGT-07 purga: no se pudo vaciar papelera: {e}")

    logger.info(f"AGT-07 purga: {eliminados} archivos eliminados de la cuenta de servicio")
    return eliminados


def _transferir_propiedad(drive, doc_id: str, folder_id: str) -> bool:
    """
    Transfiere la propiedad del documento al dueño de la carpeta destino.
    Así los archivos futuros no consumen cuota de la cuenta de servicio.
    """
    try:
        folder = drive.files().get(fileId=folder_id, fields="owners").execute()
        owners = folder.get("owners", [])
        if not owners:
            logger.warning("AGT-07: la carpeta no tiene dueño identificable")
            return False
        owner_email = owners[0]["emailAddress"]
        drive.permissions().create(
            fileId=doc_id,
            body={"type": "user", "role": "owner", "emailAddress": owner_email},
            transferOwnership=True,
            fields="id",
        ).execute()
        logger.info(f"AGT-07: propiedad transferida a {owner_email}")
        return True
    except Exception as e:
        logger.warning(f"AGT-07: no se pudo transferir propiedad: {e}")
        return False


def exportar_a_docs(secciones_obj: dict) -> dict:
    """
    Exporta el instrumento a Google Docs.

    Args:
        secciones_obj: dict con las secciones generadas por AGT-04.
                       Misma estructura que recibe AGT-06.

    Returns:
        {
            "doc_id": str,
            "url": str,       # link directo para abrir en el navegador
            "nombre": str,    # nombre del documento en Drive
        }

    Raises:
        Exception si falla la autenticación o la API.
    """
    docs, drive = _get_services()

    # ── 1. Nombre del documento ──────────────────────────────────────────────
    denominacion = secciones_obj.get("denominacion", "SOCIEDAD")
    poliza_num   = secciones_obj.get("numero_poliza", "0000")
    nombre_doc   = f"Póliza {poliza_num} — {denominacion}"

    folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID")

    # ── 2. Crear documento en Drive (OAuth2 = sin problema de cuota) ─────────
    file_meta = {
        "name":     nombre_doc,
        "mimeType": "application/vnd.google-apps.document",
    }
    if folder_id:
        file_meta["parents"] = [folder_id]

    try:
        created = drive.files().create(body=file_meta, fields="id").execute()
    except HttpError as e:
        if e.resp.status == 404 and folder_id:
            # La cuenta OAuth no tiene acceso a la carpeta — crear en root
            logger.warning(f"AGT-07: carpeta {folder_id} no accesible, creando en root")
            file_meta.pop("parents", None)
            created = drive.files().create(body=file_meta, fields="id").execute()
        else:
            raise
    doc_id = created["id"]
    logger.info(f"AGT-07: Documento creado — {doc_id}")

    # ── 5. Configurar página (tamaño oficio, márgenes) ───────────────────────
    docs.documents().batchUpdate(
        documentId=doc_id,
        body={"requests": [{
            "updateDocumentStyle": {
                "documentStyle": {
                    "pageSize": {
                        "width":  {"magnitude": 612,  "unit": "PT"},  # carta (fallback)
                        "height": {"magnitude": 1008, "unit": "PT"},  # oficio = 14"
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

    # ── 6. Construir contenido ───────────────────────────────────────────────
    b = DocsBuilder(doc_id)

    # Encabezado
    libro  = secciones_obj.get("libro", "LIBRO DE REGISTRO 5 (CINCO)")
    poliza = secciones_obj.get("poliza_header", f"Póliza Número {poliza_num}")
    b.header_block(libro, poliza)

    # Texto introductorio
    intro = secciones_obj.get("encabezado", "")
    if intro:
        b.body_para(intro)

    # Socios / Datos generales
    for seccion in secciones_obj.get("socios", []):
        b.datos_header()
        for linea in seccion.get("lineas", []):
            b.body_para(linea, bold_prefix=linea.split(":")[0] + ":" if ":" in linea else None)

    # Protesta, Antecedentes, Declaraciones
    for key in ["protesta", "antecedentes", "declaraciones"]:
        texto = secciones_obj.get(key, "")
        if texto:
            b.body_para(texto, bold_prefix=texto.split(".—")[0] + ".—" if ".—" in texto else None)

    # Clausulado — iterar capítulos
    for cap in secciones_obj.get("capitulos", []):
        b.chapter(
            label=cap.get("label", ""),
            title=cap.get("title"),
        )
        for clausula in cap.get("clausulas", []):
            texto = clausula.get("texto", "")
            prefijo = clausula.get("numero", "")
            b.body_para(texto, bold_prefix=prefijo if prefijo else None)

    # Transitorias
    transitorias = secciones_obj.get("transitorias", [])
    if transitorias:
        b.chapter(label="Cláusulas Transitorias")
        for t in transitorias:
            b.body_para(t.get("texto", ""), bold_prefix=t.get("numero"))

    # Tabla accionaria — insertar como texto plano (formato tabular)
    # La Docs API sí soporta tablas reales — las dejamos como mejora v2
    tabla = secciones_obj.get("tabla_accionaria", [])
    if tabla:
        encabezado_tabla = "Accionista | Nacionalidad | Acciones | Valor Nominal | %\n"
        b.body_para(encabezado_tabla)
        for fila in tabla:
            linea = f"{fila['nombre']} | {fila['nacionalidad']} | {fila['acciones']} | {fila['valor']} | {fila['porcentaje']}\n"
            b.body_para(linea)

    # Documentos cotejados
    docs_cotejados = secciones_obj.get("documentos_cotejados", [])
    if docs_cotejados:
        b.chapter(
            label="Documentos en Copia Cotejada",
            title="Agregados al Archivo del Presente Instrumento",
        )
        for doc_item in docs_cotejados:
            b.body_para(doc_item)

    # Certificaciones
    certificaciones = secciones_obj.get("certificaciones", [])
    if certificaciones:
        b.chapter(
            label="Certificaciones",
            title="Yo el Corredor Público, doy fe, certifico y:",
        )
        for cert in certificaciones:
            texto = cert.get("texto", "")
            b.body_para(texto, bold_prefix=cert.get("letra", ""))

    # Firma
    corredor = secciones_obj.get("corredor", {})
    b.firma_block(
        nombre=corredor.get("nombre", "WILFREDO EMMANUEL RAMÍREZ NÚÑEZ"),
        cargo=corredor.get("cargo", "Corredor Público Número 3 · Plaza del Estado de Tamaulipas"),
    )

    # ── 7. Ejecutar todos los requests ──────────────────────────────────────
    b.flush(docs)
    logger.info(f"AGT-07: Contenido escrito — {len(b.reqs)} requests ejecutados")

    # ── 8. Hacer el documento visible (compartir con anyone con link) ────────
    # Opcional — comentar si no se quiere acceso público
    drive.permissions().create(
        fileId=doc_id,
        body={"role": "reader", "type": "anyone"},
    ).execute()

    url = f"https://docs.google.com/document/d/{doc_id}/edit"
    logger.info(f"AGT-07: Documento listo — {url}")

    return {
        "doc_id":  doc_id,
        "url":     url,
        "nombre":  nombre_doc,
    }


# ─── Endpoint FastAPI (opcional) ────────────────────────────────────────────
# Agregar a main.py:
#
# from agt07_exportador_docs import exportar_a_docs
#
# @app.post("/docx/exportar-docs")
# async def exportar_docs(request: Request):
#     body = await request.json()
#     instrumento_id = body.get("instrumento_id")
#     secciones_obj  = obtener_secciones_de_firestore(instrumento_id)  # tu función existente
#     resultado = exportar_a_docs(secciones_obj)
#     return resultado
