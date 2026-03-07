"""
AGT-04 — Auditor
Confronta JSON original vs acta generada.
Detecta inconsistencias antes de que el Corredor revise.
"""
from fastapi import APIRouter
from pydantic import BaseModel
import anthropic
import json
import os

router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SISTEMA = """Eres el Agente Auditor de Fedatario. Eres el control de calidad del sistema.

Tu trabajo: confrontar el JSON de datos originales con el acta generada por el Redactor.

INSTRUCCIONES:
- Verifica que CADA campo del JSON aparezca correctamente en el acta.
- Detecta datos perdidos en la transformación.
- Identifica inconsistencias internas (ej: porcentajes que no suman 100%).
- Marca pasajes del acta para revisión prioritaria del Corredor.
- Genera un score de confianza final (0-100%).
- Responde ÚNICAMENTE con JSON válido, sin backticks.

UMBRALES:
- Score >= 90%: Acta lista para revisión normal del Corredor
- Score 75-89%: Revisión reforzada con zonas marcadas
- Score < 75%: Pipeline debe pausar y pedir clarificación

FORMATO DE RESPUESTA:
{
  "scoreAuditoria": float,
  "listo": boolean,
  "discrepancias": [
    {"campo": string, "valorJSON": string, "valorActa": string, "severidad": "critica"|"media"|"menor"}
  ],
  "inconsistenciasInternas": [string],
  "pasajesParaRevision": [{"pasaje": string, "motivo": string}],
  "resumen": string
}"""

class AuditorRequest(BaseModel):
    instrumentoId: str
    datosOriginales: dict
    actaGenerada: str

class AuditorResponse(BaseModel):
    instrumentoId: str
    scoreAuditoria: float
    listo: bool
    discrepancias: list[dict]
    inconsistenciasInternas: list[str]
    pasajesParaRevision: list[dict]
    resumen: str

@router.post("/auditar", response_model=AuditorResponse)
async def auditar(req: AuditorRequest):
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=SISTEMA,
        messages=[{
            "role": "user",
            "content": f"""DATOS ORIGINALES (JSON):
{json.dumps(req.datosOriginales, ensure_ascii=False, indent=2)}

ACTA GENERADA:
{req.actaGenerada}

Realiza la auditoría completa."""
        }]
    )

    texto = response.content[0].text.strip().replace("```json","").replace("```","").strip()
    resultado = json.loads(texto)

    return AuditorResponse(
        instrumentoId=req.instrumentoId,
        scoreAuditoria=resultado.get("scoreAuditoria", 0.0),
        listo=resultado.get("listo", False),
        discrepancias=resultado.get("discrepancias", []),
        inconsistenciasInternas=resultado.get("inconsistenciasInternas", []),
        pasajesParaRevision=resultado.get("pasajesParaRevision", []),
        resumen=resultado.get("resumen", ""),
    )
