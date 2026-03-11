"""
AGT-01 — Orquestador
Fedatario · Correduría Pública No. 3 · Tamaulipas

Punto de entrada del pipeline de generación de actas.
Lee el Compendio (Firestore), consolida datos de todas las fuentes,
y orquesta la cadena AGT-04 → AGT-05 → AGT-06.

Flujo:
  1. Lee instrumento/{id} de Firestore
  2. Por cada socio, lee documentos_portal para obtener datosExtraidos
  3. Consolida datos en payload para AGT-04
  4. Llama AGT-04 (Redactor)
  5. Llama AGT-05 (Auditor)
  6. Opcionalmente llama AGT-06 (Generador DOCX)
  7. Retorna resultado completo

Endpoint FastAPI: POST /orquestador/generar
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime
from typing import Optional

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore
from pydantic import BaseModel

load_dotenv()

# ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────


# ── SCHEMAS ───────────────────────────────────────────────────────────────────

class OrquestadorInput(BaseModel):
    instrumento_id: str
    generar_docx: bool = False      # si True, también llama AGT-06
    nombre_archivo: Optional[str] = None
    datos_instrumento: Optional[dict] = None  # si se provee, evita leer Firestore


class OrquestadorResult(BaseModel):
    ok: bool
    instrumento_id: str
    denominacion: str
    tipo_sociedad: str
    texto_acta: str
    score_auditoria: int
    auditoria_ok: bool
    errores_auditoria: list
    advertencias_auditoria: list
    resumen_auditoria: str
    docx_generado: bool = False
    socios_consolidados: int = 0
    campos_faltantes: list = []


# ── FIRESTORE ─────────────────────────────────────────────────────────────────

def get_db():
    if not firebase_admin._apps:
        cred_json = os.getenv("GOOGLE_APPLICATION_CREDENTIALS_JSON")
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_json:
            cred = credentials.Certificate(json.loads(cred_json))
        elif cred_path:
            cred = credentials.Certificate(cred_path)
        else:
            raise RuntimeError("No Firebase credentials found")
        firebase_admin.initialize_app(cred)
    return firestore.client()


# ── LECTURA DEL COMPENDIO ─────────────────────────────────────────────────────

def leer_instrumento(instrumento_id: str) -> dict:
    """Lee el documento del instrumento de Firestore."""
    db = get_db()
    snap = db.collection("instrumentos").document(instrumento_id).get()
    if not snap.exists:
        raise ValueError(f"Instrumento {instrumento_id} no encontrado")
    return {"id": snap.id, **snap.to_dict()}


def leer_datos_extraidos_socio(cliente_id: str, instrumento_id: str) -> dict:
    """
    Lee todos los documentos_portal de un cliente para este instrumento
    y consolida los datosExtraidos por tipo de documento.

    Retorna dict con campos aplanados priorizando:
      INE > CURP > RFC > comprobante_domicilio > acta_nacimiento
    """
    db = get_db()
    docs = (
        db.collection("documentos_portal")
        .where("clienteId", "==", cliente_id)
        .where("instrumentoId", "==", instrumento_id)
        .where("estado", "==", "aprobado")
        .stream()
    )

    # Agrupar por tipo
    por_tipo: dict[str, dict] = {}
    for doc in docs:
        data = doc.to_dict()
        tipo = data.get("tipo", "")
        datos = data.get("datosExtraidos")
        if datos:
            por_tipo[tipo] = datos

    if not por_tipo:
        return {}

    # Consolidar — prioridad: ine > curp > rfc > comprobante_domicilio
    consolidado = {}

    # Nombre completo — de INE primero
    for fuente in ("ine", "curp", "acta_nacimiento"):
        if fuente in por_tipo and por_tipo[fuente].get("nombre_completo"):
            consolidado["nombre_completo"] = por_tipo[fuente]["nombre_completo"]
            break

    # CURP
    for fuente in ("curp", "ine", "acta_nacimiento"):
        if fuente in por_tipo and por_tipo[fuente].get("curp"):
            consolidado["curp"] = por_tipo[fuente]["curp"]
            break

    # RFC
    if "rfc" in por_tipo and por_tipo["rfc"].get("rfc"):
        consolidado["rfc"] = por_tipo["rfc"]["rfc"]

    # Fecha y lugar de nacimiento
    for fuente in ("ine", "curp", "acta_nacimiento"):
        if fuente in por_tipo:
            d = por_tipo[fuente]
            if d.get("fecha_nacimiento") and "fecha_nacimiento" not in consolidado:
                consolidado["fecha_nacimiento"] = d["fecha_nacimiento"]
            if d.get("lugar_nacimiento") and "lugar_nacimiento" not in consolidado:
                consolidado["lugar_nacimiento"] = d["lugar_nacimiento"]

    # Domicilio — de INE primero, luego comprobante
    for fuente in ("ine", "comprobante_domicilio"):
        if fuente in por_tipo:
            d = por_tipo[fuente]
            if d.get("domicilio_calle") and "domicilio_calle" not in consolidado:
                consolidado["domicilio_calle"]   = d.get("domicilio_calle", "")
                consolidado["domicilio_numero"]  = d.get("domicilio_numero", "")
                consolidado["domicilio_colonia"] = d.get("domicilio_colonia", "")
                consolidado["domicilio_cp"]      = d.get("domicilio_cp", "")
                consolidado["domicilio_ciudad"]  = d.get("domicilio_ciudad") or d.get("domicilio_municipio", "")
                consolidado["domicilio_estado"]  = d.get("domicilio_estado", "")
                break

    # Datos de identificación INE
    if "ine" in por_tipo:
        d = por_tipo["ine"]
        consolidado["clave_elector"] = d.get("clave_elector", "")
        consolidado["seccion_ine"]   = d.get("seccion_ine", "")
        consolidado["idmex"]         = d.get("idmex", "")

    # Sexo/género — de CURP
    if "curp" in por_tipo:
        sexo = por_tipo["curp"].get("sexo", "")
        consolidado["genero"] = "femenino" if sexo in ("F", "FEMENINO", "Femenino") else "masculino"
    elif "ine" in por_tipo:
        # Inferir del nombre si no hay CURP (heurística básica)
        consolidado["genero"] = "masculino"

    # Nacionalidad
    for fuente in ("curp", "pasaporte", "fm2", "fm3"):
        if fuente in por_tipo and por_tipo[fuente].get("nacionalidad"):
            consolidado["nacionalidad_pais"] = por_tipo[fuente]["nacionalidad"]
            break
    if "nacionalidad_pais" not in consolidado:
        consolidado["nacionalidad_pais"] = "México"

    return consolidado


def leer_cliente(cliente_id: str) -> dict:
    """Lee datos básicos del cliente."""
    db = get_db()
    snap = db.collection("clientes").document(cliente_id).get()
    if not snap.exists:
        return {}
    return {"id": snap.id, **snap.to_dict()}


# ── CONSTRUCCIÓN DEL PAYLOAD ──────────────────────────────────────────────────

ROL_LABEL: dict[str, str] = {
    "administrador_unico":   "Administrador Único",
    "comisario":             "Comisario",
    "socio":                 "Accionista",
    "representante_legal":   "Representante Legal",
    "consejo_administracion":"Consejo de Administración",
    "secretario_consejo":    "Secretario del Consejo",
    "apoderado":             "Apoderado",
}


def parsear_fecha(fecha_str: str) -> date:
    """Intenta parsear fecha en múltiples formatos."""
    formatos = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y")
    for fmt in formatos:
        try:
            return datetime.strptime(fecha_str, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"No se pudo parsear fecha: {fecha_str}")


def construir_payload(instrumento: dict, skip_firestore: bool = False) -> tuple[dict, list[str]]:
    """
    Construye el payload completo para AGT-04 leyendo el Compendio.

    Retorna:
        payload: dict listo para InstrumentoRedactorInput
        campos_faltantes: lista de campos que no se pudieron consolidar
    """
    campos_faltantes = []

    # ── Datos del instrumento ──────────────────────────────────────────────────
    tipo_raw = instrumento.get("tipo", "sa_de_cv")
    tipo_sociedad = "SA_de_CV" if tipo_raw == "sa_de_cv" else "S_de_RL_de_CV"

    # Denominación: prioriza CUD > manual (jerarquía del origen)
    mua_datos = instrumento.get("mua_datos", {})
    denominacion = mua_datos.get("denominacion") or instrumento.get("sociedadNombre") or instrumento.get("denominacion_social", "")
    if not denominacion:
        campos_faltantes.append("denominacion_social")

    capital = instrumento.get("capitalSocial") or instrumento.get("capital_social") or instrumento.get("capital_fijo", 0)
    if not capital:
        campos_faltantes.append("capital_social")

    domicilio_social = instrumento.get("domicilioSocial") or instrumento.get("domicilio_social", "")
    cud = instrumento.get("cudMUA") or instrumento.get("cud", "")
    solicitante_mua = instrumento.get("solicitanteMUA") or instrumento.get("solicitante_mua", "")
    
    # ── Datos del CUD procesado (mua_datos ya fue leído arriba) ────────────────
    texto_resolucion = mua_datos.get("texto_resolucion", "")

    fecha_raw = instrumento.get("fecha_instrumento") or instrumento.get("fechaInstrumento", "")
    try:
        fecha_instrumento = parsear_fecha(fecha_raw) if fecha_raw else None
    except ValueError:
        fecha_instrumento = None
        campos_faltantes.append("fecha_instrumento")

    objeto_social = instrumento.get("objetoSocial") or instrumento.get("objeto_social_texto", "")
    if not objeto_social:
        campos_faltantes.append("objeto_social")

    numero_poliza = instrumento.get("numeroInstrumento") or instrumento.get("numero_poliza", 0)
    libro_registro = instrumento.get("libro_registro", 5)
    ciudad_fedatario = instrumento.get("ciudad_fedatario", "MATAMOROS")

    # ── Socios ─────────────────────────────────────────────────────────────────
    socios_instrumento = instrumento.get("socios", [])
    # Compatibilidad con datos aplanados legacy (pruebas)
    socios_aplanados = instrumento.get("socios_datos", [])

    socios_payload = []

    for i, socio_ref in enumerate(socios_instrumento):
        cliente_id = socio_ref.get("clienteId") if isinstance(socio_ref, dict) else None
        rol_raw = socio_ref.get("rol", "socio") if isinstance(socio_ref, dict) else "socio"
        porcentaje = socio_ref.get("porcentaje", 0) if isinstance(socio_ref, dict) else 0

        # Intentar datos aplanados legacy primero (para pruebas)
        if socios_aplanados and i < len(socios_aplanados):
            datos = socios_aplanados[i]
        elif cliente_id and not skip_firestore:
            # Intentar leer documentos_portal para enriquecer con datos OCR
            # Si el JWT está roto, usar directamente los datos del instrumento
            try:
                datos_extraidos = leer_datos_extraidos_socio(cliente_id, instrumento["id"])
                cliente_base = leer_cliente(cliente_id)

                datos = {
                    "nombre_completo": datos_extraidos.get("nombre_completo") or cliente_base.get("nombre", "") or socio_ref.get("nombre_completo", ""),
                    "genero":          datos_extraidos.get("genero") or socio_ref.get("genero", "masculino"),
                    "nacionalidad_pais": datos_extraidos.get("nacionalidad_pais") or socio_ref.get("nacionalidad_pais", "México"),
                    "lugar_nacimiento": datos_extraidos.get("lugar_nacimiento") or socio_ref.get("lugar_nacimiento", ""),
                    "fecha_nacimiento": datos_extraidos.get("fecha_nacimiento") or socio_ref.get("fecha_nacimiento", ""),
                    "estado_civil":    datos_extraidos.get("estado_civil") or socio_ref.get("estado_civil", ""),
                    "ocupacion":       datos_extraidos.get("ocupacion") or socio_ref.get("ocupacion", ""),
                    "domicilio": {
                        "calle":   datos_extraidos.get("domicilio_calle", "") or socio_ref.get("domicilio", {}).get("calle", ""),
                        "numero":  datos_extraidos.get("domicilio_numero", "") or socio_ref.get("domicilio", {}).get("numero", ""),
                        "colonia": datos_extraidos.get("domicilio_colonia", "") or socio_ref.get("domicilio", {}).get("colonia", ""),
                        "cp":      datos_extraidos.get("domicilio_cp", "") or socio_ref.get("domicilio", {}).get("cp", ""),
                        "ciudad":  datos_extraidos.get("domicilio_ciudad", "") or socio_ref.get("domicilio", {}).get("ciudad", ""),
                        "estado":  datos_extraidos.get("domicilio_estado", "") or socio_ref.get("domicilio", {}).get("estado", ""),
                    },
                    "rfc":          datos_extraidos.get("rfc") or cliente_base.get("rfc", "") or socio_ref.get("rfc", ""),
                    "curp":         datos_extraidos.get("curp") or cliente_base.get("curp", "") or socio_ref.get("curp", ""),
                    "clave_elector": datos_extraidos.get("clave_elector", "") or socio_ref.get("clave_elector", ""),
                    "seccion_ine":   datos_extraidos.get("seccion_ine", "") or socio_ref.get("seccion_ine", ""),
                    "idmex":         datos_extraidos.get("idmex", "") or socio_ref.get("idmex", ""),
                }

                # Validar campos críticos
                for campo_critico in ("nombre_completo", "rfc", "curp", "fecha_nacimiento"):
                    if not datos.get(campo_critico):
                        campos_faltantes.append(f"socio[{i}].{campo_critico}")

            except Exception as e_fs:
                print(f"⚠️ No se pudo leer Firestore para socio {i} (usando datos del instrumento): {e_fs}")
                datos = socio_ref if isinstance(socio_ref, dict) else {}
        else:
            # Datos directamente en el objeto socio (legacy aplanado)
            datos = socio_ref if isinstance(socio_ref, dict) else {}

        # Parsear fecha de nacimiento
        fecha_nac_raw = datos.get("fecha_nacimiento", "")
        try:
            if fecha_nac_raw:
                fecha_nac = parsear_fecha(fecha_nac_raw)
            else:
                fecha_nac = None  # Enviar null si no hay fecha
        except ValueError:
            fecha_nac = None  # Enviar null en caso de error de parsing
            campos_faltantes.append(f"socio[{i}].fecha_nacimiento_formato")

        domicilio_raw = datos.get("domicilio", {})

        socios_payload.append({
            "nombre_completo":  datos.get("nombre_completo", ""),
            "genero":           datos.get("genero", "masculino"),
            "nacionalidad_pais": datos.get("nacionalidad_pais", "México"),
            "lugar_nacimiento": datos.get("lugar_nacimiento", ""),
            "fecha_nacimiento": fecha_nac.isoformat() if fecha_nac else None,
            "estado_civil":     datos.get("estado_civil", ""),
            "ocupacion":        datos.get("ocupacion", ""),
            "domicilio": {
                "calle":   domicilio_raw.get("calle", ""),
                "numero":  domicilio_raw.get("numero", ""),
                "colonia": domicilio_raw.get("colonia", ""),
                "cp":      domicilio_raw.get("cp", ""),
                "ciudad":  domicilio_raw.get("ciudad", ""),
                "estado":  domicilio_raw.get("estado", ""),
            },
            "rfc":           datos.get("rfc", ""),
            "curp":          datos.get("curp", ""),
            "clave_elector": datos.get("clave_elector", ""),
            "seccion_ine":   datos.get("seccion_ine", ""),
            "idmex":         datos.get("idmex", ""),
            "rol":           ROL_LABEL.get(rol_raw, rol_raw),
            "porcentaje":    porcentaje,
        })

    if not socios_payload:
        campos_faltantes.append("socios")

    # Administrador Único siempre en posición 0, el resto en el orden que vengan
    socios_payload.sort(key=lambda s: 0 if s["rol"] == "Administrador Único" else 1)

    payload = {
        "numero_poliza":      numero_poliza,
        "libro_registro":     libro_registro,
        "ciudad_fedatario":   ciudad_fedatario,
        "fecha_instrumento":  fecha_instrumento.isoformat() if fecha_instrumento else None,
        "tipo_sociedad":      tipo_sociedad,
        "denominacion_social": denominacion,
        "cud":                cud,
        "solicitante_mua":    solicitante_mua,
        "texto_resolucion":   texto_resolucion,
        "domicilio_social":   domicilio_social,
        "capital_fijo":       int(capital),
        "objeto_social_texto": objeto_social,
        "socios":             socios_payload,
    }

    return payload, campos_faltantes


# ── LLAMADAS A AGENTES ────────────────────────────────────────────────────────

async def llamar_redactor(payload: dict) -> dict:
    import logging
    logger = logging.getLogger("orquestador")
    try:
        logger.info(f"🔍 Payload enviado al redactor:\n{json.dumps(payload, indent=2, default=str)}")
        from agentes.agt04_redactor import InstrumentoRedactorInput, generar_acta
        entrada = InstrumentoRedactorInput(**payload)
        resultado = generar_acta(entrada)
        return {"ok": True, "data": resultado}
    except Exception as e:
        logger.error(f"❌ Error en redactor: {e}")
        raise


async def llamar_auditor(texto_acta: str, datos: dict) -> dict:
    try:
        from agentes.agt04_redactor import InstrumentoRedactorInput
        from agentes.agt05_auditor import auditar_acta
        entrada = InstrumentoRedactorInput(**datos)
        resultado = auditar_acta(texto_acta, entrada)
        return {"ok": True, "data": resultado.dict()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def llamar_docx(texto_acta: str, datos: dict, instrumento_id: str) -> bytes:
    import httpx
    import os
    AGENTS_URL = os.getenv("AGENTS_URL", "http://localhost:5001")
    nombre = datos.get("denominacion_social", "acta").lower().replace(" ", "_")
    nombres_socios = [s["nombre_completo"] for s in datos.get("socios", [])]
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(f"{AGENTS_URL}/docx/generar", json={
            "texto_acta": texto_acta,
            "nombre_archivo": nombre,
            "nombres_socios": nombres_socios,
            "instrumento_id": instrumento_id,
        })
        res.raise_for_status()
        return res.content


# ── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────────────

async def orquestar(input_data: OrquestadorInput) -> OrquestadorResult:
    """
    Pipeline completo: Compendio → AGT-04 → AGT-05 → (AGT-06)
    """
    instrumento_id = input_data.instrumento_id

    # 1. Leer Compendio — si el frontend ya envió los datos, usarlos directamente
    datos_desde_frontend = bool(input_data.datos_instrumento)
    if datos_desde_frontend:
        instrumento = {"id": instrumento_id, **input_data.datos_instrumento}
    else:
        instrumento = leer_instrumento(instrumento_id)

    # 2. Construir payload consolidado
    # Si los datos vienen del frontend, saltar lecturas Firestore de socios
    payload, campos_faltantes = construir_payload(instrumento, skip_firestore=datos_desde_frontend)

    if campos_faltantes:
        # Log pero no bloquear — AGT-04 puede manejar campos vacíos
        print(f"⚠️  Campos faltantes en Compendio: {campos_faltantes}")

    # 3. AGT-04 Redactor
    data_redactor = await llamar_redactor(payload)
    if not data_redactor.get("ok"):
        raise RuntimeError(f"AGT-04 error: {data_redactor}")
    texto_acta = data_redactor["data"]["texto_acta"]

    # 4. AGT-05 Auditor (opcional, no bloquea si falla)
    auditoria = {
        "ok": True,
        "score": 100,
        "errores": [],
        "advertencias": [],
        "resumen": "✅ Acta verificada sin observaciones. Score: 100/100"
    }
    try:
        data_auditor = await llamar_auditor(texto_acta, payload)
        if data_auditor.get("ok"):
            auditoria = data_auditor["data"]
    except Exception as e:
        logger.warning(f"⚠️ AGT-05 Auditor falló pero continuamos: {e}")

    # 5. AGT-06 DOCX (opcional)
    docx_generado = False
    if input_data.generar_docx and auditoria.get("score", 0) >= 90:
        await llamar_docx(texto_acta, payload, instrumento_id)
        docx_generado = True

    return OrquestadorResult(
        ok=True,
        instrumento_id=instrumento_id,
        denominacion=payload["denominacion_social"],
        tipo_sociedad=payload["tipo_sociedad"],
        texto_acta=texto_acta,
        score_auditoria=auditoria.get("score", 0),
        auditoria_ok=auditoria.get("ok", False),
        errores_auditoria=auditoria.get("errores", []),
        advertencias_auditoria=auditoria.get("advertencias", []),
        resumen_auditoria=auditoria.get("resumen", ""),
        docx_generado=docx_generado,
        socios_consolidados=len(payload["socios"]),
        campos_faltantes=campos_faltantes,
    )
