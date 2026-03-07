"""
AGT-00 — Orquestador
Pipeline completo con LangGraph.
Dirige el flujo, gestiona contexto, detecta errores críticos.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Literal
from langgraph.graph import StateGraph, END
from typing_extensions import TypedDict
import httpx
import os

router = APIRouter()

# ── ESTADO DEL PIPELINE ───────────────────────

class PipelineState(TypedDict):
    instrumentoId: str
    transcripcion: Optional[str]
    datosExtraidos: Optional[dict]
    datosValidados: Optional[dict]
    borrador: Optional[str]
    compendio: Optional[list]
    scoreAuditoria: Optional[float]
    erroresCriticos: Optional[list]
    preguntaPendiente: Optional[str]
    etapaActual: str
    completado: bool

AGENTS_URL = "http://localhost:5001"

# ── NODOS DEL GRAFO ───────────────────────────

async def nodo_extractor(state: PipelineState) -> PipelineState:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{AGENTS_URL}/agentes/extractor/extraer", json={
            "instrumentoId": state["instrumentoId"],
            "transcripcion": state["transcripcion"] or "",
        })
        datos = r.json()
    return {**state, "datosExtraidos": datos["datos"], "etapaActual": "juridico"}

async def nodo_juridico(state: PipelineState) -> PipelineState:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{AGENTS_URL}/agentes/juridico/validar", json={
            "instrumentoId": state["instrumentoId"],
            "datos": state["datosExtraidos"],
        })
        datos = r.json()

    if not datos["aprobado"] and datos["erroresCriticos"]:
        # Pipeline se pausa — el Corredor debe resolver
        pregunta = _generar_pregunta(datos["erroresCriticos"])
        return {**state, "erroresCriticos": datos["erroresCriticos"], "preguntaPendiente": pregunta, "etapaActual": "esperando_corredor"}

    return {**state, "datosValidados": {**state["datosExtraidos"], "_validacionJuridica": datos}, "etapaActual": "redactor"}

async def nodo_redactor(state: PipelineState) -> PipelineState:
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(f"{AGENTS_URL}/agentes/redactor/redactar", json={
            "instrumentoId": state["instrumentoId"],
            "numeroInstrumento": 1249,  # TODO: obtener del proyecto
            "datosValidados": state["datosValidados"],
        })
        datos = r.json()
    return {**state, "borrador": datos["borrador"], "compendio": datos["compendio"], "etapaActual": "auditor"}

async def nodo_auditor(state: PipelineState) -> PipelineState:
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{AGENTS_URL}/agentes/auditor/auditar", json={
            "instrumentoId": state["instrumentoId"],
            "datosOriginales": state["datosValidados"],
            "actaGenerada": state["borrador"],
        })
        datos = r.json()
    return {**state, "scoreAuditoria": datos["scoreAuditoria"], "completado": datos["listo"], "etapaActual": "revision_corredor"}

def _decidir_ruta(state: PipelineState) -> Literal["redactor", "esperando_corredor"]:
    if state.get("preguntaPendiente"):
        return "esperando_corredor"
    return "redactor"

def _generar_pregunta(errores: list) -> str:
    if not errores:
        return ""
    primer_error = errores[0]
    return f"El sistema detectó un problema que requiere su atención: {primer_error.get('error', '')}. {primer_error.get('accion', '')}"

# ── CONSTRUCCIÓN DEL GRAFO ────────────────────

def build_pipeline():
    graph = StateGraph(PipelineState)
    graph.add_node("extractor", nodo_extractor)
    graph.add_node("juridico", nodo_juridico)
    graph.add_node("redactor", nodo_redactor)
    graph.add_node("auditor", nodo_auditor)

    graph.set_entry_point("extractor")
    graph.add_edge("extractor", "juridico")
    graph.add_conditional_edges("juridico", _decidir_ruta, {
        "redactor": "redactor",
        "esperando_corredor": END,
    })
    graph.add_edge("redactor", "auditor")
    graph.add_edge("auditor", END)
    return graph.compile()

pipeline = build_pipeline()

# ── ENDPOINTS ─────────────────────────────────

class PipelineRequest(BaseModel):
    instrumentoId: str
    transcripcion: Optional[str] = None
    datosFormulario: Optional[dict] = None

class PipelineResponse(BaseModel):
    instrumentoId: str
    completado: bool
    etapaActual: str
    scoreAuditoria: Optional[float]
    preguntaPendiente: Optional[str]
    compendio: Optional[list]

@router.post("/iniciar", response_model=PipelineResponse)
async def iniciar_pipeline(req: PipelineRequest):
    """Inicia el pipeline completo de agentes para un instrumento."""
    estado_inicial: PipelineState = {
        "instrumentoId": req.instrumentoId,
        "transcripcion": req.transcripcion,
        "datosExtraidos": req.datosFormulario,
        "datosValidados": None,
        "borrador": None,
        "compendio": None,
        "scoreAuditoria": None,
        "erroresCriticos": None,
        "preguntaPendiente": None,
        "etapaActual": "extractor",
        "completado": False,
    }

    resultado = await pipeline.ainvoke(estado_inicial)

    return PipelineResponse(
        instrumentoId=req.instrumentoId,
        completado=resultado.get("completado", False),
        etapaActual=resultado.get("etapaActual", ""),
        scoreAuditoria=resultado.get("scoreAuditoria"),
        preguntaPendiente=resultado.get("preguntaPendiente"),
        compendio=resultado.get("compendio"),
    )

@router.post("/responder")
async def responder_corredor(instrumentoId: str, respuesta: str):
    """El Corredor responde una pregunta del Orquestador para desbloquear el pipeline."""
    # TODO: reanudar el pipeline con la respuesta del Corredor
    return {"ok": True, "instrumentoId": instrumentoId, "mensaje": "Pipeline reanudado"}
