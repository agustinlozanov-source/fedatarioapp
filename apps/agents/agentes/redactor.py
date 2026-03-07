"""
AGT-03 — Redactor
Genera el instrumento notarial con estructura fija.
Claude Sonnet — redacción con lenguaje jurídico estándar.
"""
from fastapi import APIRouter
from pydantic import BaseModel
import anthropic
import json
import os

router = APIRouter()
client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# La plantilla base del acta — se actualizará cuando se mapee la estructura real
PLANTILLA_BASE = """
INSTRUMENTO NÚMERO {numeroInstrumento}
(ACTA CONSTITUTIVA DE SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE)

En la ciudad de {domicilioSocial}, siendo las {hora} horas del día {fecha}, ante mí,
{nombreCorreder}, Corredor Público Número {numeroProtocolo} del Estado de {estadoCorreder},
comparecen:

{comparecientes}

MANIFIESTAN:

PRIMERO. - Los comparecientes tienen el propósito de constituir una sociedad de conformidad
con la Ley General de Sociedades Mercantiles, bajo las siguientes cláusulas:

CLÁUSULA PRIMERA.- DENOMINACIÓN: La sociedad se denominará "{nombreSociedad}",
con carácter de VARIABLE.

CLÁUSULA SEGUNDA.- OBJETO SOCIAL: {objetoSocial}

CLÁUSULA TERCERA.- DOMICILIO: El domicilio social de la empresa se establece en
{domicilioSocial}, sin perjuicio de establecer agencias o sucursales en cualquier
lugar de la República Mexicana o en el extranjero.

CLÁUSULA CUARTA.- DURACIÓN: {duracion}.

CLÁUSULA QUINTA.- CAPITAL SOCIAL: El capital social será de ${capitalSocial} M.N.
(pesos mexicanos), {capitalEnLetras}, dividido en {numeroAcciones} acciones
ordinarias, nominativas, con valor nominal de ${valorNominalAccion} cada una.

CLÁUSULA SEXTA.- SOCIOS Y SUSCRIPCIÓN DE ACCIONES:
{distribucionCapital}

CLÁUSULA SÉPTIMA.- ADMINISTRACIÓN: La administración de la sociedad estará
a cargo de un Administrador Único. Se designa como primer Administrador Único al
C. {administrador}.

{clausulasAdicionales}

CERTIFICACIÓN NOTARIAL
"""

SISTEMA = f"""Eres el Agente Redactor de Fedatario. Generas instrumentos notariales para Corredores Públicos en México.

Tu trabajo: tomar los datos validados jurídicamente y generar el borrador del acta constitutiva.

REGLAS ESTRICTAS:
- Usa ÚNICAMENTE los datos del JSON proporcionado. No inventes información.
- Mantén el lenguaje jurídico estándar mexicano.
- Sigue la estructura de la plantilla base.
- Para datos faltantes usa [PENDIENTE: nombre del campo] como marcador.
- Los campos de alta confianza se insertan directamente.
- Los campos de confianza < 0.8 se insertan pero se marcan con asterisco (*).
- Genera también el COMPENDIO PARA SECRETARIAS al final, con los datos clave para captura en sistemas de gobierno.
- Responde ÚNICAMENTE con JSON válido, sin backticks.

FORMATO DE RESPUESTA:
{{
  "borrador": string,
  "compendio": [
    {{"etiqueta": string, "valor": string, "fuente": string}}
  ],
  "camposPendientes": [string],
  "camposMarcados": [string],
  "confianzaRedaccion": float
}}"""

class RedactorRequest(BaseModel):
    instrumentoId: str
    numeroInstrumento: int
    datosValidados: dict
    plantillaId: str = "acta_constitutiva_v1"

class RedactorResponse(BaseModel):
    instrumentoId: str
    borrador: str
    compendio: list[dict]
    camposPendientes: list[str]
    camposMarcados: list[str]
    confianzaRedaccion: float

@router.post("/redactar", response_model=RedactorResponse)
async def redactar(req: RedactorRequest):
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        system=SISTEMA,
        messages=[{
            "role": "user",
            "content": f"""Datos validados para el instrumento número {req.numeroInstrumento}:

{json.dumps(req.datosValidados, ensure_ascii=False, indent=2)}

Plantilla base de referencia:
{PLANTILLA_BASE}

Genera el borrador del acta y el compendio para secretarias."""
        }]
    )

    texto = response.content[0].text.strip().replace("```json","").replace("```","").strip()
    resultado = json.loads(texto)

    return RedactorResponse(
        instrumentoId=req.instrumentoId,
        borrador=resultado.get("borrador", ""),
        compendio=resultado.get("compendio", []),
        camposPendientes=resultado.get("camposPendientes", []),
        camposMarcados=resultado.get("camposMarcados", []),
        confianzaRedaccion=resultado.get("confianzaRedaccion", 0.0),
    )
