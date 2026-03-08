"""
Fedatario — Servidor de Agentes
FastAPI + LangGraph
Puerto: 5001
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
import io
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
import traceback
import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from agentes.extractor import extraer_documento, extraer_desde_url
from agentes.agt04_redactor import generar_acta, InstrumentoRedactorInput
from agentes.agt05_auditor import auditar_acta, AuditorOutput
from agentes.agt06_docx import generar_docx
from agentes.firestore_mapper import firestore_to_redactor_input
import google.cloud.firestore as firestore_mod

load_dotenv()

# Firebase init
cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
cred_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")

if not firebase_admin._apps:
    if cred_json:
        import json
        cred_dict = json.loads(cred_json)
        cred = credentials.Certificate(cred_dict)
    elif cred_path:
        cred = credentials.Certificate(cred_path)
    else:
        raise Exception("No Firebase credentials found")
    firebase_admin.initialize_app(cred)

db = firestore.client()

app = FastAPI(
    title="Fedatario Agents",
    description="API de agentes IA para procesamiento de documentos",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── HEALTH CHECK ──────────────────────────────

@app.get("/")
def health():
    return {"status": "ok", "agentes": ["AGT-02 Extractor"]}

# ── AGT-02 EXTRACTOR ──────────────────────────

class ExtraccionURLRequest(BaseModel):
    storage_url: str
    tipo_documento: str
    datos_capturados: Optional[dict] = None

@app.post("/extractor/archivo")
async def extraer_archivo(
    archivo: UploadFile = File(...),
    tipo_documento: str = Form(...),
    datos_capturados: Optional[str] = Form(None)
):
    """
    Extrae datos de un documento subido directamente
    """
    try:
        contenido = await archivo.read()
        mime_type = archivo.content_type or "application/pdf"
        
        datos_prev = None
        if datos_capturados:
            import json
            datos_prev = json.loads(datos_capturados)
        
        resultado = extraer_documento(
            contenido=contenido,
            mime_type=mime_type,
            tipo_documento=tipo_documento,
            datos_capturados=datos_prev
        )
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extractor/url")
async def extraer_url(request: ExtraccionURLRequest):
    """
    Extrae datos de un documento en Firebase Storage
    """
    try:
        resultado = await extraer_desde_url(
            storage_url=request.storage_url,
            tipo_documento=request.tipo_documento,
            datos_capturados=request.datos_capturados
        )
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/redactor/generar")
async def redactor_generar(datos: InstrumentoRedactorInput):
    """
    AGT-04 — Redactor de Actas Constitutivas
    Genera el texto completo del acta a partir del expediente.
    """
    try:
        if not datos.socios or len(datos.socios) == 0:
            raise HTTPException(status_code=400, detail="Se requiere al least un socio para generar el acta")
        
        # Normalizar datos para asegurar que estén en formato correcto
        # Nombres en mayúsculas, sin espacios extras
        for socio in datos.socios:
            socio.nombre_completo = socio.nombre_completo.upper().strip()
        
        datos.denominacion_social = datos.denominacion_social.upper().strip()
        datos.cud = datos.cud.strip()
        
        resultado = generar_acta(datos)
        return {
            "ok": True,
            "data": resultado
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"\n!!! ERROR EN REDACTOR_GENERAR !!!")
        print(f"Tipo: {type(e).__name__}")
        print(f"Mensaje: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

class AuditorInput(BaseModel):
    texto_acta: str
    datos: InstrumentoRedactorInput

@app.post("/auditor/verificar")
async def auditor_verificar(body: AuditorInput):
    """AGT-05 — Auditor: verifica el texto del acta generado por AGT-04."""
    try:
        resultado = auditar_acta(body.texto_acta, body.datos)
        return {"ok": True, "data": resultado}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DocxInput(BaseModel):
    texto_acta: str = ""
    nombre_archivo: str = "acta_constitutiva"
    nombres_socios: list[str] = []
    instrumento_id: str | None = None

@app.post("/docx/generar")
async def docx_generar(body: DocxInput):
    """AGT-06 — Genera el .docx con formato del despacho."""
    try:
        texto_acta = body.texto_acta
        nombres_socios = body.nombres_socios or None

        if body.instrumento_id:
            doc_ref = db.collection("instrumentos").document(body.instrumento_id)
            snap = doc_ref.get()
            if not snap.exists:
                raise HTTPException(status_code=404, detail="Instrumento no encontrado")
            redactor_input = firestore_to_redactor_input(snap.to_dict())
            resultado = generar_acta(redactor_input)
            texto_acta = resultado["texto_acta"]
            nombres_socios = [s.nombre_completo for s in redactor_input.socios]

        if not texto_acta:
            raise HTTPException(status_code=400, detail="Se requiere texto_acta o instrumento_id")

        docx_bytes = generar_docx(texto_acta, nombres_socios=nombres_socios)
        filename = f"{body.nombre_archivo}.docx"
        return StreamingResponse(
            io.BytesIO(docx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── INICIO ────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
