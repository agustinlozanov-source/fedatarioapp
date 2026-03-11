"""
Fedatario — Servidor de Agentes
FastAPI + LangGraph
Puerto: 5001
"""

import io
import json
import logging
import os
import sys
import traceback
from pathlib import Path
from typing import Optional

import firebase_admin
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from firebase_admin import credentials, firestore
from pydantic import BaseModel

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

sys.path.insert(0, str(Path(__file__).parent))

from agentes.agt01_orquestador import OrquestadorInput, orquestar
from agentes.agt02_extractor import extraer_documento, extraer_desde_url
from agentes.agt04_redactor import InstrumentoRedactorInput, generar_acta
from agentes.agt05_auditor import auditar_acta
from agentes.agt06_docx import generar_docx
from agentes.firestore_mapper import firestore_to_redactor_input
from agentes.extractor_cud import ExtractorCUD
from agentes.validador_roles import ValidadorRoles
from config.roles_config import get_roles_por_tipo, get_todos_los_tipos

load_dotenv()

# ── FIREBASE ──────────────────────────────────────────────────────────────────

db = None
if not firebase_admin._apps:
    try:
        cred_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
        elif cred_path:
            cred = credentials.Certificate(cred_path)
        else:
            logger.warning("No Firebase credentials found")
            cred = None

        if cred:
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            logger.info("Firebase initialized successfully")
    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")

# ── APP ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Fedatario Agents",
    description="API de agentes IA para procesamiento de documentos",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://fedatarioapp.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── HEALTH ────────────────────────────────────────────────────────────────────

@app.get("/")
def health():
    return {
        "status": "ok",
        "agentes": [
            "AGT-01 Orquestador",
            "AGT-02 Extractor",
            "AGT-04 Redactor",
            "AGT-05 Auditor",
            "AGT-06 Generador DOCX",
        ],
    }

# ── AGT-01 ORQUESTADOR ────────────────────────────────────────────────────────

@app.post("/orquestador/generar")
async def orquestador_generar(body: OrquestadorInput):
    """
    AGT-01 — Pipeline completo.
    Lee el Compendio de Firestore, consolida datos de todas las fuentes
    y ejecuta la cadena AGT-04 → AGT-05 → (AGT-06).
    """
    try:
        resultado = await orquestar(body)
        return {"ok": True, "data": resultado.dict()}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ── AGT-02 EXTRACTOR ──────────────────────────────────────────────────────────

class ExtraccionURLRequest(BaseModel):
    storage_url: str
    tipo_documento: str
    documento_id: Optional[str] = None
    datos_capturados: Optional[dict] = None
    cliente_id: Optional[str] = None          # ← NUEVO


@app.post("/extractor/archivo")
async def extraer_archivo(
    archivo: UploadFile = File(...),
    tipo_documento: str = Form(...),
    documento_id: Optional[str] = Form(None),
    datos_capturados: Optional[str] = Form(None),
    cliente_id: Optional[str] = Form(None),   # ← NUEVO
):
    """
    AGT-02 — Extrae datos de un documento subido directamente.
    Si se provee documento_id, guarda los datos en Firestore.
    Si se provee cliente_id, sincroniza los datos al perfil del cliente.
    """
    try:
        contenido = await archivo.read()
        mime_type = archivo.content_type or "application/pdf"
        datos_prev = json.loads(datos_capturados) if datos_capturados else None

        resultado = extraer_documento(
            contenido=contenido,
            mime_type=mime_type,
            tipo_documento=tipo_documento,
            documento_id=documento_id,
            datos_capturados=datos_prev,
            cliente_id=cliente_id,            # ← NUEVO
        )
        return {"ok": True, "data": resultado}
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/extractor/url")
async def extraer_url(request: ExtraccionURLRequest):
    """
    AGT-02 — Extrae datos de un documento en Firebase Storage.
    Si se provee documento_id, guarda los datos en Firestore.
    Si se provee cliente_id, sincroniza los datos al perfil del cliente.
    """
    try:
        resultado = await extraer_desde_url(
            storage_url=request.storage_url,
            tipo_documento=request.tipo_documento,
            documento_id=request.documento_id,
            datos_capturados=request.datos_capturados,
            cliente_id=request.cliente_id,    # ← NUEVO
        )
        return {"ok": True, "data": resultado}
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ── PROCESADOR DE CUD (MUA) ──────────────────────────────────────────────────

@app.post("/procesar-cud-pdf")
async def procesar_cud_pdf(
    archivo: UploadFile = File(...),
    instrumento_id: str = Form(...),
):
    """
    Procesa el PDF del CUD (Constancia de Autorización de Uso de Denominación)
    y guarda los datos extraídos en Firestore bajo instrumento/{id}/mua_datos.
    
    Retorna:
    {
        "ok": True,
        "cud": "A202602090932258301",
        "texto_resolucion": "SECRETARÍA DE ECONOMÍA...",
        "confianza": 0.95,
        "errores": []
    }
    """
    try:
        contenido = await archivo.read()
        
        # Procesar con ExtractorCUD
        extractor = ExtractorCUD()
        resultado_cud = extractor.procesar_bytes(contenido)
        
        # Preparar datos para guardar
        datos_mua = {
            "cud": resultado_cud.cud,
            "denominacion": resultado_cud.denominacion,
            "nombre_solicitante": resultado_cud.nombre_solicitante,
            "rfc_solicitante": resultado_cud.rfc_solicitante,
            "texto_resolucion": resultado_cud.texto_resolucion,
            "confianza": resultado_cud.confianza,
            "errores": resultado_cud.errores,
            "fecha_extraccion": firestore.SERVER_TIMESTAMP,
        }
        
        # Intentar guardar en Firestore (best-effort: el frontend también lo guarda)
        if db:
            try:
                db.collection("instrumentos").document(instrumento_id).update({
                    "mua_datos": datos_mua
                })
            except Exception as fs_err:
                logger.warning(f"No se pudo guardar en Firestore desde backend (el frontend lo hará): {fs_err}")

        return {
            "ok": True,
            "cud": resultado_cud.cud,
            "denominacion": resultado_cud.denominacion,
            "nombre_solicitante": resultado_cud.nombre_solicitante,
            "rfc_solicitante": resultado_cud.rfc_solicitante,
            "texto_resolucion": resultado_cud.texto_resolucion,
            "confianza": round(resultado_cud.confianza * 100),
            "errores": resultado_cud.errores,
        }
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ── AGT-04 REDACTOR ───────────────────────────────────────────────────────────

@app.post("/redactor/generar")
async def redactor_generar(datos: InstrumentoRedactorInput):
    """
    AGT-04 — Genera el texto completo del acta a partir del expediente.
    """
    try:
        if not datos.socios:
            raise HTTPException(status_code=400, detail="Se requiere al menos un socio")

        for socio in datos.socios:
            socio.nombre_completo = socio.nombre_completo.upper().strip()

        datos.denominacion_social = datos.denominacion_social.upper().strip()
        datos.cud = datos.cud.strip()

        resultado = generar_acta(datos)
        return {"ok": True, "data": resultado}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ── AGT-05 AUDITOR ────────────────────────────────────────────────────────────

class AuditorInput(BaseModel):
    texto_acta: str
    datos: InstrumentoRedactorInput


@app.post("/auditor/verificar")
async def auditor_verificar(body: AuditorInput):
    """AGT-05 — Verifica el texto del acta generado por AGT-04."""
    try:
        resultado = auditar_acta(body.texto_acta, body.datos)
        return {"ok": True, "data": resultado}
    except Exception as e:
        logger.error(f"Error en auditor/verificar: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ── AGT-06 GENERADOR DOCX ─────────────────────────────────────────────────────

class DocxInput(BaseModel):
    texto_acta: str = ""
    nombre_archivo: str = "acta_constitutiva"
    nombres_socios: list[str] = []
    instrumento_id: Optional[str] = None


@app.post("/docx/generar")
async def docx_generar(body: DocxInput):
    """AGT-06 — Genera el .docx con formato del despacho."""
    try:
        texto_acta = body.texto_acta
        nombres_socios = body.nombres_socios or None

        if body.instrumento_id and not texto_acta:
            if not db:
                raise HTTPException(status_code=500, detail="Firebase no disponible")
            snap = db.collection("instrumentos").document(body.instrumento_id).get()
            if not snap.exists:
                raise HTTPException(status_code=404, detail="Instrumento no encontrado")
            redactor_input = firestore_to_redactor_input(snap.to_dict())
            resultado = generar_acta(redactor_input)
            texto_acta = resultado["texto_acta"]
            nombres_socios = [s.nombre_completo for s in redactor_input.socios]

        if not texto_acta:
            raise HTTPException(status_code=400, detail="Se requiere texto_acta o instrumento_id válido")

        docx_bytes = generar_docx(texto_acta, nombres_socios=nombres_socios)
        filename = f"{body.nombre_archivo}.docx"

        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ── ROLES Y VALIDACIÓN ────────────────────────────────────────────────────────

class RolesSeleccionadosRequest(BaseModel):
    roles: list[str]
    tipo_sociedad: str


@app.get("/roles/tipos")
def obtener_tipos_sociedad():
    """Retorna los tipos de sociedad disponibles."""
    return {
        "ok": True,
        "tipos": get_todos_los_tipos()
    }


@app.get("/roles/{tipo_sociedad}")
def obtener_roles(tipo_sociedad: str):
    """Retorna los roles permitidos para un tipo de sociedad específico."""
    config = get_roles_por_tipo(tipo_sociedad)
    if not config:
        raise HTTPException(status_code=404, detail=f"Tipo de sociedad no encontrado: {tipo_sociedad}")
    
    return {
        "ok": True,
        "tipo": config["tipo"],
        "nombre_largo": config["nombre_largo"],
        "roles": config["roles_permitidos"],
        "reglas": config["reglas_validacion"]
    }


@app.post("/roles/validar")
def validar_roles(body: RolesSeleccionadosRequest):
    """Valida un conjunto de roles seleccionados."""
    try:
        validador = ValidadorRoles(body.tipo_sociedad)
        resultado = validador.validar(body.roles)
        return {
            "ok": resultado["valido"],
            "valido": resultado["valido"],
            "errores": resultado["errores"],
            "advertencias": resultado["advertencias"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


class ValidarAgregarRolRequest(BaseModel):
    rol_id: str
    roles_actuales: list[str]
    tipo_sociedad: str


@app.post("/roles/validar-agregar")
def validar_agregar_rol(body: ValidarAgregarRolRequest):
    """Valida si se puede agregar un rol a los actuales (para validación en tiempo real)."""
    try:
        validador = ValidadorRoles(body.tipo_sociedad)
        resultado = validador.validar_seleccionar_rol(body.rol_id, body.roles_actuales)
        return {
            "ok": resultado["puede_agregar"],
            "puede_agregar": resultado["puede_agregar"],
            "motivo": resultado["motivo"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


class ValidarRemoverRolRequest(BaseModel):
    rol_id: str
    roles_actuales: list[str]
    tipo_sociedad: str


@app.post("/roles/validar-remover")
def validar_remover_rol(body: ValidarRemoverRolRequest):
    """Valida si se puede remover un rol de los actuales (para validación en tiempo real)."""
    try:
        validador = ValidadorRoles(body.tipo_sociedad)
        resultado = validador.validar_remover_rol(body.rol_id, body.roles_actuales)
        return {
            "ok": resultado["puede_remover"],
            "puede_remover": resultado["puede_remover"],
            "motivo": resultado["motivo"]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

# ── INICIO ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
