"""
AGT-00 Input — Whisper
Transcripción de audio a texto con OpenAI Whisper
"""
from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel
from openai import AsyncOpenAI
import os

router = APIRouter()
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class TranscripcionResponse(BaseModel):
    texto: str
    duracionSegundos: float
    idioma: str
    confianza: float

@router.post("/transcribir", response_model=TranscripcionResponse)
async def transcribir(audio: UploadFile = File(...)):
    """
    Recibe archivo de audio y devuelve transcripción con Whisper.
    Optimizado para español mexicano y terminología jurídica.
    """
    contenido = await audio.read()

    # TODO: descomentar cuando haya API key
    # transcript = await client.audio.transcriptions.create(
    #     model="whisper-1",
    #     file=(audio.filename, contenido, audio.content_type),
    #     language="es",
    #     prompt="Reunión con Corredor Público. Terminología jurídica mexicana. "
    #            "Objeto social, capital social, socios, administrador único, SA de CV, S de RL."
    # )
    # return TranscripcionResponse(
    #     texto=transcript.text,
    #     duracionSegundos=0,
    #     idioma="es",
    #     confianza=0.95,
    # )

    # Mock por ahora
    return TranscripcionResponse(
        texto="[Transcripción pendiente — conectar Whisper API]",
        duracionSegundos=0,
        idioma="es",
        confianza=0.0,
    )
