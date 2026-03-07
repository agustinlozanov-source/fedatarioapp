"""
Fedatario — Servidor de Agentes
FastAPI + LangGraph
Puerto: 5001
"""

import os
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from agentes.extractor import extraer_documento, extraer_desde_url
from agentes.agt04_redactor import generar_acta, InstrumentoRedactorInput
from agentes.agt05_auditor import auditar_acta, AuditorOutput

load_dotenv()

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
        resultado = generar_acta(datos)
        return {
            "ok": True,
            "data": resultado
        }
    except Exception as e:
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

# ── INICIO ────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=5001, reload=True)
