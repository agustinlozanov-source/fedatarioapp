"""
AGT-02 — Extractor
Extrae datos de documentos oficiales usando Google Document AI
Regla 4: El documento oficial es la única fuente de verdad
"""

import os
import json
from pathlib import Path
from typing import Optional
import fitz  # PyMuPDF
from PIL import Image
import io
import httpx
from google.cloud import documentai
from google.oauth2 import service_account
from anthropic import Anthropic
from dotenv import load_dotenv
import langsmith

load_dotenv()

# ── CONFIGURACIÓN ─────────────────────────────

GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
GOOGLE_PROJECT           = os.getenv("GOOGLE_CLOUD_PROJECT")
DOCUMENT_AI_LOCATION     = os.getenv("DOCUMENT_AI_LOCATION", "us")
OCR_PROCESSOR_ID         = os.getenv("DOCUMENT_AI_OCR_PROCESSOR_ID")
FORM_PROCESSOR_ID        = os.getenv("DOCUMENT_AI_FORM_PROCESSOR_ID")
ANTHROPIC_API_KEY        = os.getenv("ANTHROPIC_API_KEY")

# Mapa: tipo de documento → qué campos extraer
CAMPOS_POR_TIPO = {
    "ine": [
        "nombre_completo",
        "fecha_nacimiento",
        "lugar_nacimiento",
        "curp",
        "domicilio",
        "clave_elector",
        "vigencia",
    ],
    "curp": [
        "curp",
        "nombre_completo",
        "fecha_nacimiento",
        "lugar_nacimiento",
        "nacionalidad",
        "sexo",
    ],
    "rfc": [
        "rfc",
        "nombre_completo",
        "fecha_inicio_operaciones",
        "regimen_fiscal",
        "domicilio_fiscal",
    ],
    "pasaporte": [
        "nombre_completo",
        "fecha_nacimiento",
        "lugar_nacimiento",
        "nacionalidad",
        "numero_pasaporte",
        "fecha_vencimiento",
    ],
    "fm2": [
        "nombre_completo",
        "nacionalidad",
        "numero_fm2",
        "tipo_migratorio",
        "vigencia",
    ],
    "fm3": [
        "nombre_completo",
        "nacionalidad",
        "numero_fm3",
        "tipo_migratorio",
        "vigencia",
    ],
    "acta_nacimiento": [
        "nombre_completo",
        "fecha_nacimiento",
        "lugar_nacimiento",
        "nombre_padre",
        "nombre_madre",
        "curp",
    ],
    "comprobante_domicilio": [
        "nombre_titular",
        "domicilio_completo",
        "calle",
        "numero",
        "colonia",
        "municipio",
        "estado",
        "cp",
        "fecha_emision",
    ],
    "mua": [
        "cud",  # Clave Única de Documento — el dato crítico
        "denominacion_autorizada",
        "fecha_autorizacion",
        "vigencia",
    ],
    "acta_constitutiva_moral": [
        "denominacion_social",
        "tipo_sociedad",
        "objeto_social",
        "capital_social",
        "domicilio_social",
        "rfc",
        "numero_instrumento",
    ],
}

# ── CLIENTE DOCUMENT AI ───────────────────────

def get_documentai_client():
    credentials = service_account.Credentials.from_service_account_file(
        GOOGLE_CREDENTIALS_PATH,
        scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    client_options = {"api_endpoint": f"{DOCUMENT_AI_LOCATION}-documentai.googleapis.com"}
    return documentai.DocumentProcessorServiceClient(
        credentials=credentials,
        client_options=client_options
    )

# ── PROCESAMIENTO DE ARCHIVOS ─────────────────

def pdf_a_imagen(pdf_bytes: bytes) -> bytes:
    """Convierte la primera página de un PDF a imagen PNG"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc[0]
    mat = fitz.Matrix(2.0, 2.0)  # 2x zoom para mejor calidad
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    doc.close()
    return img_bytes

def preparar_documento(contenido: bytes, mime_type: str) -> tuple[bytes, str]:
    """Prepara el documento para Document AI"""
    if mime_type == "application/pdf":
        # Para PDFs, Document AI los acepta directamente
        return contenido, "application/pdf"
    elif mime_type in ["image/jpeg", "image/jpg"]:
        return contenido, "image/jpeg"
    elif mime_type == "image/png":
        return contenido, "image/png"
    else:
        # Intentar como PDF por defecto
        return contenido, "application/pdf"

# ── OCR CON DOCUMENT AI ───────────────────────

def extraer_texto_documentai(contenido: bytes, mime_type: str, usar_form_parser: bool = False) -> str:
    """Extrae texto usando Google Document AI"""
    client = get_documentai_client()
    
    processor_id = FORM_PROCESSOR_ID if usar_form_parser else OCR_PROCESSOR_ID
    processor_name = client.processor_path(
        GOOGLE_PROJECT,
        DOCUMENT_AI_LOCATION,
        processor_id
    )
    
    contenido_preparado, mime_final = preparar_documento(contenido, mime_type)
    
    raw_document = documentai.RawDocument(
        content=contenido_preparado,
        mime_type=mime_final
    )
    
    request = documentai.ProcessRequest(
        name=processor_name,
        raw_document=raw_document
    )
    
    result = client.process_document(request=request)
    return result.document.text

# ── EXTRACCIÓN INTELIGENTE CON CLAUDE ─────────

def extraer_campos_con_claude(
    texto_ocr: str,
    tipo_documento: str,
    campos_requeridos: list[str]
) -> dict:
    """
    Usa Claude para extraer campos específicos del texto OCR
    Aplica la Regla 4 — extrae exactamente lo que dice el documento
    """
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    
    campos_str = "\n".join([f"- {campo}" for campo in campos_requeridos])
    
    prompt = f"""Eres el AGT-02 Extractor de Fedatario. Tu única función es extraer datos exactos de documentos oficiales mexicanos.

REGLA FUNDAMENTAL: Extrae EXACTAMENTE lo que dice el documento. Sin interpretaciones, sin correcciones, sin asunciones. Si un campo no está presente, devuelve null.

Tipo de documento: {tipo_documento.upper()}

Campos a extraer:
{campos_str}

Texto extraído del documento:
{texto_ocr}

Responde ÚNICAMENTE con un JSON válido con los campos solicitados. Sin explicaciones, sin markdown, sin texto adicional.
Ejemplo de formato:
{{"nombre_completo": "JUAN PEREZ GARCIA", "fecha_nacimiento": "01/01/1980", "curp": "PEGJ800101HDFRRN09"}}

Si un campo no aparece en el documento, usa null.
JSON:"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}]
    )
    
    texto_respuesta = response.content[0].text.strip()
    
    # Limpiar posibles backticks
    if texto_respuesta.startswith("```"):
        texto_respuesta = texto_respuesta.split("```")[1]
        if texto_respuesta.startswith("json"):
            texto_respuesta = texto_respuesta[4:]
    
    return json.loads(texto_respuesta)

# ── FUNCIÓN PRINCIPAL ─────────────────────────

@langsmith.traceable(name="AGT-02 Extractor")
def extraer_documento(
    contenido: bytes,
    mime_type: str,
    tipo_documento: str,
    datos_capturados: Optional[dict] = None
) -> dict:
    """
    Función principal del AGT-02
    
    Args:
        contenido: bytes del archivo (PDF o imagen)
        mime_type: tipo MIME del archivo
        tipo_documento: ine, curp, rfc, pasaporte, fm2, fm3, mua, etc.
        datos_capturados: datos previos del formulario (para comparar)
    
    Returns:
        dict con:
            - datos_extraidos: campos extraídos del documento
            - discrepancias: diferencias con datos_capturados
            - confianza: score 0-100
            - texto_ocr: texto completo extraído
    """
    
    tipo = tipo_documento.lower()
    campos = CAMPOS_POR_TIPO.get(tipo, ["contenido_completo"])
    
    # 1. OCR con Document AI
    usar_form = tipo in ["rfc", "comprobante_domicilio"]
    texto_ocr = extraer_texto_documentai(contenido, mime_type, usar_form_parser=usar_form)
    
    # 2. Extracción inteligente con Claude
    datos_extraidos = extraer_campos_con_claude(texto_ocr, tipo, campos)
    
    # 3. Detectar discrepancias con datos capturados
    discrepancias = {}
    if datos_capturados:
        for campo, valor_extraido in datos_extraidos.items():
            if valor_extraido and campo in datos_capturados:
                valor_capturado = datos_capturados.get(campo, "")
                if valor_capturado and str(valor_extraido).strip().upper() != str(valor_capturado).strip().upper():
                    discrepancias[campo] = {
                        "capturado": valor_capturado,
                        "extraido": valor_extraido,
                        "fuente_verdad": valor_extraido  # Regla 4
                    }
    
    # 4. Score de confianza
    campos_encontrados = sum(1 for v in datos_extraidos.values() if v is not None)
    confianza = round((campos_encontrados / len(campos)) * 100) if campos else 0
    
    return {
        "tipo_documento": tipo,
        "datos_extraidos": datos_extraidos,
        "discrepancias": discrepancias,
        "confianza": confianza,
        "campos_totales": len(campos),
        "campos_encontrados": campos_encontrados,
        "texto_ocr": texto_ocr,
        "fuente_verdad": True  # Regla 4 — siempre
    }

# ── EXTRACCIÓN DESDE URL (Firebase Storage) ───

async def extraer_desde_url(
    storage_url: str,
    tipo_documento: str,
    datos_capturados: Optional[dict] = None
) -> dict:
    """Descarga el documento de Firebase Storage y lo procesa"""
    
    async with httpx.AsyncClient() as client:
        response = await client.get(storage_url)
        response.raise_for_status()
        contenido = response.content
        mime_type = response.headers.get("content-type", "application/pdf")
    
    return extraer_documento(contenido, mime_type, tipo_documento, datos_capturados)
