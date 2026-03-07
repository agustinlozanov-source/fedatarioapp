"""
AGT-02 — Jurídico
Valida datos extraídos contra LGSM y normativa vigente.
Claude Opus — razonamiento jurídico complejo.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import anthropic
import json
import os

router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SISTEMA = """Eres el Agente Jurídico de Fedatario. Eres un experto en derecho corporativo mexicano.

Tu trabajo: validar que los datos extraídos de una reunión sean legalmente válidos para constituir una sociedad en México.

NORMAS QUE APLICAS:
- Ley General de Sociedades Mercantiles (LGSM)
- Código de Comercio
- Requisitos SAT por tipo de sociedad
- Restricciones para socios extranjeros (Ley de Inversión Extranjera)
- Cláusula Calvo cuando aplique

INSTRUCCIONES:
- Valida cada campo contra la normativa.
- Identifica combinaciones imposibles o problemáticas.
- Detecta campos obligatorios faltantes que bloqueen la constitución.
- Señala restricciones para socios extranjeros si las hay.
- Genera alertas para campos que requieran atención sin bloquear.
- Responde ÚNICAMENTE con JSON válido, sin texto adicional ni backticks.

FORMATO DE RESPUESTA:
{
  "valido": boolean,
  "erroresCriticos": [
    {"campo": string, "error": string, "accion": string}
  ],
  "alertas": [
    {"campo": string, "alerta": string, "severidad": "alta"|"media"|"baja"}
  ],
  "clausulasRequeridas": [string],
  "notasSociosExtranjeros": string|null,
  "confianzaJuridica": float,
  "aprobado": boolean
}"""

class JuridicoRequest(BaseModel):
    instrumentoId: str
    datos: dict      # JSON del Extractor

class JuridicoResponse(BaseModel):
    instrumentoId: str
    valido: bool
    aprobado: bool
    erroresCriticos: list[dict]
    alertas: list[dict]
    clausulasRequeridas: list[str]
    notasSociosExtranjeros: Optional[str]
    confianzaJuridica: float

@router.post("/validar", response_model=JuridicoResponse)
async def validar(req: JuridicoRequest):
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=SISTEMA,
        messages=[{
            "role": "user",
            "content": f"Datos extraídos a validar:\n\n{json.dumps(req.datos, ensure_ascii=False, indent=2)}"
        }]
    )

    texto = response.content[0].text.strip().replace("```json","").replace("```","").strip()
    resultado = json.loads(texto)

    return JuridicoResponse(
        instrumentoId=req.instrumentoId,
        valido=resultado.get("valido", False),
        aprobado=resultado.get("aprobado", False),
        erroresCriticos=resultado.get("erroresCriticos", []),
        alertas=resultado.get("alertas", []),
        clausulasRequeridas=resultado.get("clausulasRequeridas", []),
        notasSociosExtranjeros=resultado.get("notasSociosExtranjeros"),
        confianzaJuridica=resultado.get("confianzaJuridica", 0.0),
    )
