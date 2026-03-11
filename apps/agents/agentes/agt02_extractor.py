"""
AGT-02 — Extractor
Fedatario · Correduría Pública No. 3 · Tamaulipas

Extrae datos de documentos oficiales y los guarda en Firestore.
Regla 4: El documento oficial es la única fuente de verdad.

Fuentes soportadas:
  - INE / Credencial para votar
  - CURP
  - RFC / Constancia de Situación Fiscal
  - Pasaporte
  - FM2 / FM3
  - Acta de nacimiento
  - Comprobante de domicilio
  - MUA (CUD) — bypass directo, sin Document AI

Endpoint FastAPI: POST /extractor/archivo
                  POST /extractor/url
"""

from __future__ import annotations

import io
import json
import os
from typing import Optional

import firebase_admin
import httpx
from anthropic import Anthropic
from dotenv import load_dotenv
from firebase_admin import credentials, firestore
from google.cloud import documentai
from google.oauth2 import service_account

from agentes.extractor_cud import ExtractorCUD

load_dotenv()

# ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────

GOOGLE_CREDENTIALS_PATH  = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
GOOGLE_PROJECT           = os.getenv("GOOGLE_CLOUD_PROJECT")
DOCUMENT_AI_LOCATION     = os.getenv("DOCUMENT_AI_LOCATION", "us")
OCR_PROCESSOR_ID         = os.getenv("DOCUMENT_AI_OCR_PROCESSOR_ID")
FORM_PROCESSOR_ID        = os.getenv("DOCUMENT_AI_FORM_PROCESSOR_ID")
ANTHROPIC_API_KEY        = os.getenv("ANTHROPIC_API_KEY")

# ── CAMPOS POR TIPO DE DOCUMENTO ──────────────────────────────────────────────

CAMPOS_POR_TIPO: dict[str, list[str]] = {
    "ine": [
        "nombre_completo",
        "fecha_nacimiento",
        "lugar_nacimiento",
        "curp",
        "domicilio_calle",
        "domicilio_numero",
        "domicilio_colonia",
        "domicilio_cp",
        "domicilio_ciudad",
        "domicilio_estado",
        "clave_elector",
        "seccion_ine",
        "idmex",
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
        "domicilio_fiscal_calle",
        "domicilio_fiscal_numero",
        "domicilio_fiscal_colonia",
        "domicilio_fiscal_cp",
        "domicilio_fiscal_ciudad",
        "domicilio_fiscal_estado",
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
        "domicilio_calle",
        "domicilio_numero",
        "domicilio_colonia",
        "domicilio_municipio",
        "domicilio_estado",
        "domicilio_cp",
        "fecha_emision",
    ],
    "mua": [
        "cud",
        "denominacion",
        "folio_solicitante",
        "rfc_solicitante",
        "nombre_solicitante",
        "rfc_funcionario",
        "nombre_funcionario",
        "cargo_funcionario",
        "fecha_emision",
        "vigencia_dias",
        "fecha_vencimiento",
        "texto_resolucion",
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

# ── MAPEO: datosExtraidos → perfil del cliente ────────────────────────────────
# Define qué campos de cada tipo de documento se sincronizan a clientes/{id}.
# Regla: si el cliente ya tiene el campo con valor, NO se sobreescribe.
# El domicilio (campos anidados) se maneja aparte en sincronizar_a_cliente().

MAPEO_A_CLIENTE: dict[str, dict[str, str]] = {
    "ine": {
        "nombre_completo":  "nombre_completo",
        "curp":             "curp",
        "fecha_nacimiento": "fecha_nacimiento",
        "lugar_nacimiento": "lugar_nacimiento",
        "clave_elector":    "clave_elector",
        "seccion_ine":      "seccion_ine",
        "idmex":            "idmex",
        "vigencia":         "vigencia_ine",
    },
    "curp": {
        "curp":             "curp",
        "nombre_completo":  "nombre_completo",
        "fecha_nacimiento": "fecha_nacimiento",
        "lugar_nacimiento": "lugar_nacimiento",
        "nacionalidad":     "nacionalidad",
        "sexo":             "genero",
    },
    "rfc": {
        "rfc":            "rfc",
        "nombre_completo":"nombre_completo",
        "regimen_fiscal": "regimen_fiscal",
    },
    "pasaporte": {
        "nombre_completo":   "nombre_completo",
        "fecha_nacimiento":  "fecha_nacimiento",
        "lugar_nacimiento":  "lugar_nacimiento",
        "nacionalidad":      "nacionalidad",
        "numero_pasaporte":  "numero_pasaporte",
        "fecha_vencimiento": "vigencia_pasaporte",
    },
    "fm2": {
        "nombre_completo": "nombre_completo",
        "nacionalidad":    "nacionalidad",
        "numero_fm2":      "numero_fm",
        "tipo_migratorio": "tipo_migratorio",
        "vigencia":        "vigencia_fm",
    },
    "fm3": {
        "nombre_completo": "nombre_completo",
        "nacionalidad":    "nacionalidad",
        "numero_fm3":      "numero_fm",
        "tipo_migratorio": "tipo_migratorio",
        "vigencia":        "vigencia_fm",
    },
    "acta_nacimiento": {
        "nombre_completo":  "nombre_completo",
        "fecha_nacimiento": "fecha_nacimiento",
        "lugar_nacimiento": "lugar_nacimiento",
        "curp":             "curp",
    },
    "comprobante_domicilio": {
        # Solo domicilio anidado — se maneja en sincronizar_a_cliente()
    },
}


# ── FIRESTORE ─────────────────────────────────────────────────────────────────

def get_firestore_client():
    """Retorna cliente Firestore. Soporta credencial por archivo o por JSON en env."""
    if not firebase_admin._apps:
        cred_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_json:
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
        elif cred_path:
            cred = credentials.Certificate(cred_path)
        else:
            raise RuntimeError("No Firebase credentials found")
        firebase_admin.initialize_app(cred)
    return firestore.client()


def sincronizar_a_cliente(
    cliente_id: str,
    datos_extraidos: dict,
    tipo_documento: str,
) -> dict:
    """
    Propaga datosExtraidos al perfil del cliente en clientes/{cliente_id}.

    Reglas:
    - Solo campos con valor no nulo y no vacío.
    - Si el cliente ya tiene el campo, NO se sobreescribe.
    - El domicilio se construye como objeto anidado.
    - Retorna dict con los campos que efectivamente se escribieron.
    """
    db = get_firestore_client()
    cliente_ref = db.collection("clientes").document(cliente_id)
    snap = cliente_ref.get()
    datos_actuales = snap.to_dict() or {} if snap.exists else {}

    mapeo = MAPEO_A_CLIENTE.get(tipo_documento, {})
    campos_a_actualizar: dict = {}

    # Campos planos
    for campo_doc, campo_cliente in mapeo.items():
        valor = datos_extraidos.get(campo_doc)
        if not valor:
            continue
        if datos_actuales.get(campo_cliente):
            continue  # ya tiene valor — no sobreescribir
        # Convertir a mayúsculas si es nombre_completo
        if campo_cliente == "nombre_completo" and isinstance(valor, str):
            valor = valor.upper()
        campos_a_actualizar[campo_cliente] = valor

    # Domicilio anidado (INE + comprobante_domicilio)
    if tipo_documento in ("ine", "comprobante_domicilio"):
        domicilio_existente = datos_actuales.get("domicilio") or {}
        candidatos = {
            "calle":   datos_extraidos.get("domicilio_calle"),
            "numero":  datos_extraidos.get("domicilio_numero"),
            "colonia": datos_extraidos.get("domicilio_colonia"),
            "cp":      datos_extraidos.get("domicilio_cp"),
            "ciudad":  datos_extraidos.get("domicilio_ciudad") or datos_extraidos.get("domicilio_municipio"),
            "estado":  datos_extraidos.get("domicilio_estado"),
            "pais":    "México",
        }
        domicilio_nuevo = {k: v for k, v in candidatos.items() if v and not domicilio_existente.get(k)}
        if domicilio_nuevo:
            campos_a_actualizar["domicilio"] = {**domicilio_existente, **domicilio_nuevo}

    if campos_a_actualizar:
        campos_a_actualizar["ultimaSincronizacion"] = firestore.SERVER_TIMESTAMP
        cliente_ref.update(campos_a_actualizar)

    return campos_a_actualizar


def guardar_en_firestore(
    documento_id: str,
    datos_extraidos: dict,
    confianza: int,
    cliente_id: Optional[str] = None,
    tipo_documento: Optional[str] = None,
) -> dict:
    """
    Escribe datosExtraidos en documentos_portal/{documento_id}
    y sincroniza al perfil del cliente si se proporciona cliente_id.

    Retorna dict con campos sincronizados al cliente (vacío si no aplica).
    """
    db = get_firestore_client()
    ref = db.collection("documentos_portal").document(documento_id)
    ref.update({
        "datosExtraidos": datos_extraidos,
        "confianza": confianza,
        "estado": "aprobado",
        "extraidoEn": firestore.SERVER_TIMESTAMP,
    })

    campos_sincronizados: dict = {}
    if cliente_id and tipo_documento:
        try:
            campos_sincronizados = sincronizar_a_cliente(cliente_id, datos_extraidos, tipo_documento)
        except Exception as e:
            # La sincronización nunca interrumpe el flujo principal
            print(f"[AGT-02] Advertencia: no se pudo sincronizar al cliente {cliente_id}: {e}")

    return campos_sincronizados


# ── DOCUMENT AI ───────────────────────────────────────────────────────────────

def get_documentai_client():
    cred_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if cred_json:
        import json as _json
        info = _json.loads(cred_json)
        creds = service_account.Credentials.from_service_account_info(
            info,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
    elif GOOGLE_CREDENTIALS_PATH:
        creds = service_account.Credentials.from_service_account_file(
            GOOGLE_CREDENTIALS_PATH,
            scopes=["https://www.googleapis.com/auth/cloud-platform"],
        )
    else:
        raise RuntimeError("No Google credentials found (GOOGLE_APPLICATION_CREDENTIALS_JSON or GOOGLE_APPLICATION_CREDENTIALS)")
    client_options = {"api_endpoint": f"{DOCUMENT_AI_LOCATION}-documentai.googleapis.com"}
    return documentai.DocumentProcessorServiceClient(
        credentials=creds,
        client_options=client_options,
    )


def extraer_texto_documentai(contenido: bytes, mime_type: str, usar_form_parser: bool = False) -> str:
    client = get_documentai_client()
    processor_id = FORM_PROCESSOR_ID if usar_form_parser else OCR_PROCESSOR_ID
    processor_name = client.processor_path(GOOGLE_PROJECT, DOCUMENT_AI_LOCATION, processor_id)

    if mime_type not in ("application/pdf", "image/jpeg", "image/png"):
        mime_type = "application/pdf"

    raw_document = documentai.RawDocument(content=contenido, mime_type=mime_type)
    request = documentai.ProcessRequest(name=processor_name, raw_document=raw_document)
    result = client.process_document(request=request)
    return result.document.text


# ── EXTRACCIÓN CON CLAUDE ─────────────────────────────────────────────────────

def extraer_campos_con_claude(texto_ocr: str, tipo_documento: str, campos: list[str]) -> dict:
    """
    Usa Claude para extraer campos específicos del texto OCR.
    Regla 4: extrae exactamente lo que dice el documento — sin inferencias.
    """
    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    campos_str = "\n".join(f"- {c}" for c in campos)

    # Instrucciones específicas por tipo — orden de nombre y contexto del doc
    _instrucciones: dict[str, str] = {
        "ine": (
            "NOMBRE: La INE imprime APELLIDO_PATERNO APELLIDO_MATERNO NOMBRE(S). "
            "Devuelve nombre_completo en orden correcto: NOMBRE(S) APELLIDO_PATERNO APELLIDO_MATERNO. "
            "Ejemplo: 'RAMÍREZ NÚÑEZ WILFREDO EMMANUEL' → 'WILFREDO EMMANUEL RAMÍREZ NÚÑEZ'. "
            "El domicilio suele estar al reverso: extrae calle, número, colonia, CP, ciudad y estado por separado."
        ),
        "fm2": (
            "NOMBRE: El FM2 imprime APELLIDOS NOMBRE(S). "
            "Devuelve nombre_completo en orden correcto: NOMBRE(S) APELLIDOS. "
            "Si la imagen contiene también pasaporte, extrae los campos del FM2 solamente."
        ),
        "fm3": (
            "NOMBRE: El FM3 imprime APELLIDOS NOMBRE(S). "
            "Devuelve nombre_completo en orden correcto: NOMBRE(S) APELLIDOS."
        ),
        "pasaporte": (
            "NOMBRE: El pasaporte separa apellidos y nombres en campos distintos. "
            "Combínalos como NOMBRE(S) APELLIDO_PATERNO APELLIDO_MATERNO en nombre_completo. "
            "Si la imagen contiene también FM2/FM3, extrae los campos del pasaporte solamente."
        ),
        "curp": (
            "NOMBRE: La CURP ya viene en orden correcto NOMBRE(S) APELLIDO_PATERNO APELLIDO_MATERNO. "
            "Extráelo exactamente así."
        ),
    }
    instruccion_extra = _instrucciones.get(tipo_documento.lower(), "")

    prompt = f"""Eres el AGT-02 Extractor de Fedatario. Tu única función es extraer datos exactos de documentos oficiales mexicanos.

REGLA FUNDAMENTAL: Extrae EXACTAMENTE lo que dice el documento. Sin correcciones ortográficas ni asunciones. Si un campo no está presente, devuelve null.

Tipo de documento: {tipo_documento.upper()}
{"INSTRUCCIÓN ESPECIAL: " + instruccion_extra if instruccion_extra else ""}
Campos a extraer:
{campos_str}

Texto del documento:
{texto_ocr}

Responde ÚNICAMENTE con JSON válido. Sin explicaciones, sin markdown.
Si un campo no aparece, usa null.
JSON:"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    texto = response.content[0].text.strip()
    if texto.startswith("```"):
        texto = texto.split("```")[1]
        if texto.startswith("json"):
            texto = texto[4:]

    return json.loads(texto.strip())


# ── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────────────

def extraer_documento(
    contenido: bytes,
    mime_type: str,
    tipo_documento: str,
    documento_id: Optional[str] = None,
    datos_capturados: Optional[dict] = None,
    cliente_id: Optional[str] = None,          # ← NUEVO
) -> dict:
    """
    Extrae datos de un documento oficial y los guarda en Firestore.

    Args:
        contenido:        bytes del archivo (PDF o imagen)
        mime_type:        tipo MIME del archivo
        tipo_documento:   ine | curp | rfc | pasaporte | fm2 | fm3 |
                          acta_nacimiento | comprobante_domicilio | mua
        documento_id:     ID del documento en documentos_portal (para guardar)
        datos_capturados: datos previos del formulario (para detectar discrepancias)
        cliente_id:       ID del cliente en Firestore (para sincronizar datos)  ← NUEVO

    Returns:
        dict con datos_extraidos, discrepancias, confianza, texto_ocr,
        campos_sincronizados (qué se escribió al perfil del cliente)
    """
    tipo = tipo_documento.lower()
    campos = CAMPOS_POR_TIPO.get(tipo, ["contenido_completo"])

    # ── BYPASS MUA ────────────────────────────────────────────────────────────
    if tipo == "mua":
        resultado_cud = ExtractorCUD().procesar_bytes(contenido)
        datos_extraidos = ExtractorCUD().a_dict(resultado_cud)
        confianza = round(resultado_cud.confianza * 100)

        discrepancias = _detectar_discrepancias(
            datos_extraidos, datos_capturados,
            excluir={"confianza", "errores", "texto_resolucion"},
        )

        campos_sincronizados: dict = {}
        if documento_id:
            campos_sincronizados = guardar_en_firestore(
                documento_id, datos_extraidos, confianza,
                cliente_id=cliente_id, tipo_documento=tipo,
            )

        return {
            "tipo_documento": "mua",
            "datos_extraidos": datos_extraidos,
            "discrepancias": discrepancias,
            "confianza": confianza,
            "campos_totales": len(campos),
            "campos_encontrados": sum(1 for v in datos_extraidos.values() if v),
            "texto_ocr": "",
            "guardado": bool(documento_id),
            "campos_sincronizados": campos_sincronizados,
        }
    # ── FIN BYPASS MUA ────────────────────────────────────────────────────────

    # 1. OCR con Document AI
    usar_form = tipo in ("rfc", "comprobante_domicilio")
    texto_ocr = extraer_texto_documentai(contenido, mime_type, usar_form_parser=usar_form)

    # 2. Extracción con Claude
    datos_extraidos = extraer_campos_con_claude(texto_ocr, tipo, campos)

    # 3. Discrepancias con datos capturados (Regla 4: el documento manda)
    discrepancias = _detectar_discrepancias(datos_extraidos, datos_capturados)

    # 4. Score de confianza
    campos_encontrados = sum(1 for v in datos_extraidos.values() if v is not None)
    confianza = round((campos_encontrados / len(campos)) * 100) if campos else 0

    # 5. Guardar en Firestore + sincronizar al cliente
    campos_sincronizados = {}
    if documento_id:
        campos_sincronizados = guardar_en_firestore(
            documento_id, datos_extraidos, confianza,
            cliente_id=cliente_id, tipo_documento=tipo,
        )

    return {
        "tipo_documento": tipo,
        "datos_extraidos": datos_extraidos,
        "discrepancias": discrepancias,
        "confianza": confianza,
        "campos_totales": len(campos),
        "campos_encontrados": campos_encontrados,
        "texto_ocr": texto_ocr,
        "guardado": bool(documento_id),
        "campos_sincronizados": campos_sincronizados,
    }


def _detectar_discrepancias(
    datos_extraidos: dict,
    datos_capturados: Optional[dict],
    excluir: set[str] | None = None,
) -> dict:
    """Compara datos extraídos vs capturados. El documento siempre gana (Regla 4)."""
    if not datos_capturados:
        return {}
    excluir = excluir or set()
    discrepancias = {}
    for campo, valor_extraido in datos_extraidos.items():
        if campo in excluir:
            continue
        if valor_extraido and campo in datos_capturados:
            valor_capturado = datos_capturados.get(campo, "")
            if valor_capturado and str(valor_extraido).strip().upper() != str(valor_capturado).strip().upper():
                discrepancias[campo] = {
                    "capturado": valor_capturado,
                    "extraido": valor_extraido,
                    "fuente_verdad": valor_extraido,
                }
    return discrepancias


# ── EXTRACCIÓN DESDE URL (Firebase Storage) ───────────────────────────────────

async def extraer_desde_url(
    storage_url: str,
    tipo_documento: str,
    documento_id: Optional[str] = None,
    datos_capturados: Optional[dict] = None,
    cliente_id: Optional[str] = None,          # ← NUEVO
) -> dict:
    """Descarga el documento de Firebase Storage y lo procesa."""
    async with httpx.AsyncClient() as client:
        response = await client.get(storage_url)
        response.raise_for_status()
        contenido = response.content
        mime_type = response.headers.get("content-type", "application/pdf")

    return extraer_documento(
        contenido, mime_type, tipo_documento,
        documento_id, datos_capturados, cliente_id,
    )
