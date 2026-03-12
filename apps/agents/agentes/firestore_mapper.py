"""
_firestore_to_redactor_input()
Mapea un documento de Firestore (instrumentos/{id}) al schema
InstrumentoRedactorInput de AGT-04.

Campos Firestore → InstrumentoRedactorInput:
  numero_poliza       → int
  libro_registro      → int
  ciudad_fedatario    → str (MAYÚSCULAS)
  fecha_instrumento   → "YYYY-MM-DD" → date
  tipo_sociedad       → "SA_de_CV" | "S_de_RL_de_CV"
  denominacion_social → str
  cud                 → str
  solicitante_mua     → str
  domicilio_social    → str
  capital_fijo        → int
  socios: [
    {
      nombre_completo     → str
      genero              → "masculino" | "femenino"
      nacionalidad_pais   → str
      lugar_nacimiento    → str
      fecha_nacimiento    → "YYYY-MM-DD" → date
      estado_civil        → str
      ocupacion           → str
      domicilio: {
        calle   → str
        numero  → str
        colonia → str
        cp      → str
        ciudad  → str
        estado  → str
      }
      rfc           → str
      curp          → str
      clave_elector → str
      seccion_ine   → str
      idmex         → str
    }
  ]
  objeto_social_texto → str
"""

from datetime import date, datetime
from typing import Any, Dict

from agentes.agt04_redactor import (
    InstrumentoRedactorInput,
    SocioInput,
    DomicilioInput,
)


def _parse_date(valor: Any) -> date:
    """
    Convierte distintos formatos de fecha a date:
      - str "YYYY-MM-DD"
      - datetime (Firestore Timestamp ya convertido por el SDK)
      - date nativo
    """
    if isinstance(valor, date):
        return valor
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, str):
        v = valor.strip()
        # Formato DD/MM/YYYY o DD-MM-YYYY
        if len(v) == 10 and v[2] in ('/', '-') and v[5] in ('/', '-'):
            sep = v[2]
            day, month, year = v.split(sep)
            return date(int(year), int(month), int(day))
        # Formato ISO YYYY-MM-DD
        return date.fromisoformat(v[:10])
    raise ValueError(f"Formato de fecha no reconocido: {type(valor)} → {valor!r}")


_EC_MASCULINO = {"soltera": "Soltero", "casada": "Casado", "divorciada": "Divorciado",
                 "viuda": "Viudo", "separada": "Separado"}
_EC_FEMENINO  = {"soltero": "Soltera", "casado": "Casada", "divorciado": "Divorciada",
                 "viudo": "Viuda", "separado": "Separada"}

def _concordar_estado_civil(ec: str, genero: str) -> str:
    """Asegura que el estado civil concuerde con el género del socio."""
    if not ec:
        return ec
    key = ec.strip().lower()
    if genero == "femenino":
        return _EC_FEMENINO.get(key, ec)
    else:
        return _EC_MASCULINO.get(key, ec)


# Abreviaturas → texto completo (orden importa: más específicas primero)
_ABREVIATURAS = [
    # Tipo de vialidad
    (r'\bC\.\s*',         "CALLE "),
    (r'\bCALL\.\s*',      "CALLE "),
    (r'\bAV\.\s*',        "AVENIDA "),
    (r'\bAVE\.\s*',       "AVENIDA "),
    (r'\bBLVD\.\s*',      "BOULEVARD "),
    (r'\bBLVR\.\s*',      "BOULEVARD "),
    (r'\bCDA\.\s*',       "CERRADA "),
    (r'\bCERR\.\s*',      "CERRADA "),
    (r'\bCALZ\.\s*',      "CALZADA "),
    (r'\bPROL\.\s*',      "PROLONGACIÓN "),
    (r'\bCIRC\.\s*',      "CIRCUITO "),
    (r'\bPERIF\.\s*',     "PERIFÉRICO "),
    (r'\bAND\.\s*',       "ANDADOR "),
    (r'\bPASAJE\s*',      "PASAJE "),
    (r'\bCAM\.\s*',       "CAMINO "),
    (r'\bRET\.\s*',       "RETORNO "),
    (r'\bDIAG\.\s*',      "DIAGONAL "),
    # Tipo de asentamiento (punto opcional)
    (r'\bFRACC\.?\s*',    "FRACCIONAMIENTO "),
    (r'\bCOL\.\s*',       "COLONIA "),
    (r'\bBARR\.?\s*',     "BARRIO "),
    (r'\bRES\.\s*',       "RESIDENCIAL "),
    (r'\bU\.?H\.\s*',     "UNIDAD HABITACIONAL "),
    (r'\bCTO\.\s*',       "CONJUNTO "),
    (r'\bRDO\.\s*',       "RANCHO "),
    (r'\bEJIDO\s+',       "EJIDO "),
    (r'\bSEC\.\s*',       "SECTOR "),
    (r'\bAMP\.?\s*',      "AMPLIACIÓN "),
    (r'\bPOBL\.\s*',      "POBLACIÓN "),
    (r'\bCIUDAD\s+IND\.?\s*', "CIUDAD INDUSTRIAL "),
    # Estados comunes abreviados (punto opcional)
    (r'\bTAMPS\.?\b\s*',  "TAMAULIPAS"),
    (r'\bN\.?L\.?\s*',    "NUEVO LEON"),
    (r'\bCDMX\b\s*',       "CIUDAD DE MEXICO"),
    (r'\bD\.?F\.?\s*',    "CIUDAD DE MEXICO"),
    (r'\bJAL\.?\b\s*',    "JALISCO"),
    (r'\bVER\.?\b\s*',    "VERACRUZ"),
    (r'\bGTO\.?\b\s*',    "GUANAJUATO"),
    (r'\bPUE\.?\b\s*',    "PUEBLA"),
    (r'\bCOAH\.?\b\s*',   "COAHUILA"),
    (r'\bSON\.?\b\s*',    "SONORA"),
    (r'\bSIN\.?\b\s*',    "SINALOA"),
    (r'\bCHIH\.?\b\s*',   "CHIHUAHUA"),
    (r'\bMICH\.?\b\s*',   "MICHOACAN"),
    (r'\bOAX\.?\b\s*',    "OAXACA"),
    (r'\bGRO\.?\b\s*',    "GUERRERO"),
    (r'\bYUC\.?\b\s*',    "YUCATAN"),
    (r'\bHGO\.?\b\s*',    "HIDALGO"),
    (r'\bMOR\.?\b\s*',    "MORELOS"),
    (r'\bQRO\.?\b\s*',    "QUERETARO"),
    (r'\bQ\.?ROO\.?\s*',  "QUINTANA ROO"),
    (r'\bAGS\.?\b\s*',    "AGUASCALIENTES"),
    (r'\bBCN\.?\b\s*',    "BAJA CALIFORNIA"),
    (r'\bBCS\.?\b\s*',    "BAJA CALIFORNIA SUR"),
    (r'\bCAMP\.?\b\s*',   "CAMPECHE"),
    (r'\bCHIS\.?\b\s*',   "CHIAPAS"),
    (r'\bDGO\.?\b\s*',    "DURANGO"),
    (r'\bMEX\.?\b\s*',    "ESTADO DE MEXICO"),
    (r'\bNAY\.?\b\s*',    "NAYARIT"),
    (r'\bSLP\.?\b\s*',    "SAN LUIS POTOSI"),
    (r'\bTAB\.?\b\s*',    "TABASCO"),
    (r'\bTLAX\.?\b\s*',   "TLAXCALA"),
    (r'\bZAC\.?\b\s*',    "ZACATECAS"),
    # Números ordinales
    (r'\bNO\.\s*',        "NÚMERO "),
    (r'\bNÚM\.\s*',       "NÚMERO "),
    (r'\bNUM\.\s*',       "NÚMERO "),
    (r'\bINT\.\s*',       "INTERIOR "),
    (r'\bDEPTO\.\s*',     "DEPARTAMENTO "),
    (r'\bPISO\s+',        "PISO "),
    (r'\bLOC\.\s*',       "LOCAL "),
    (r'\bOF\.\s*',        "OFICINA "),
]

import re as _re

def _expandir_abreviaturas(texto: str) -> str:
    """Expande abreviaturas del domicilio al texto completo."""
    if not texto:
        return texto
    t = texto.upper().strip()
    for patron, reemplazo in _ABREVIATURAS:
        t = _re.sub(patron, reemplazo, t, flags=_re.IGNORECASE)
    # Limpiar espacios dobles
    t = _re.sub(r'  +', ' ', t).strip()
    return t


def _parse_socio(s: Dict[str, Any]) -> SocioInput:
    dom = s.get("domicilio", {})
    genero = s.get("genero", "masculino").lower()
    return SocioInput(
        nombre_completo   = s["nombre_completo"].upper().strip(),
        genero            = genero,
        nacionalidad_pais = s.get("nacionalidad_pais", "México"),
        lugar_nacimiento  = _expandir_abreviaturas(s.get("lugar_nacimiento", "")),
        fecha_nacimiento  = _parse_date(s["fecha_nacimiento"]),
        estado_civil      = _concordar_estado_civil(s.get("estado_civil", ""), genero),
        ocupacion         = s.get("ocupacion", ""),
        domicilio         = DomicilioInput(
            calle   = _expandir_abreviaturas(dom.get("calle", "")),
            numero  = str(dom.get("numero", "")),
            colonia = _expandir_abreviaturas(dom.get("colonia", "")),
            cp      = str(dom.get("cp", "")),
            ciudad  = _expandir_abreviaturas(dom.get("ciudad", "")),
            estado  = _expandir_abreviaturas(dom.get("estado", "")),
        ),
        rfc           = s.get("rfc", "").upper().strip(),
        curp          = s.get("curp", "").upper().strip(),
        clave_elector = s.get("clave_elector", "").upper().strip(),
        seccion_ine   = str(s.get("seccion_ine", "")).strip(),
        idmex         = str(s.get("idmex", "")).strip(),
    )


def firestore_to_redactor_input(data: Dict[str, Any]) -> InstrumentoRedactorInput:
    """
    Convierte un dict de Firestore a InstrumentoRedactorInput.

    Uso en main.py:
        doc = db.collection("instrumentos").document(instrumento_id).get()
        if doc.exists:
            instrumento = firestore_to_redactor_input(doc.to_dict())
            resultado   = generar_acta(instrumento)
            secciones   = resultado["secciones"]
    """
    socios_raw = data.get("socios", [])
    socios = [_parse_socio(s) for s in socios_raw]

    return InstrumentoRedactorInput(
        numero_poliza       = int(data.get("numero_poliza", 0)),
        libro_registro      = int(data.get("libro_registro", 5)),
        ciudad_fedatario    = (data.get("ciudad_fedatario") or data.get("ciudadFedatario") or data.get("ciudad_corredor") or "").upper().strip(),
        fecha_instrumento   = _parse_date(data.get("fecha_instrumento", date.today())),
        tipo_sociedad       = data.get("tipo_sociedad", "SA_de_CV"),
        # Denominación: prioriza CUD > manual (jerarquía del origen)
        denominacion_social = data.get("mua_datos", {}).get("denominacion") or data.get("denominacion_social", ""),
        cud                 = data.get("cud", "").strip(),
        solicitante_mua     = data.get("solicitante_mua", "").upper().strip(),
        texto_resolucion    = data.get("mua_datos", {}).get("texto_resolucion", ""),
        domicilio_social    = data.get("domicilio_social", "").strip(),
        capital_fijo        = int(data.get("capital_fijo", 100000)),
        socios              = socios,
        objeto_social_texto = (data.get("objeto_social_texto") or data.get("objetoSocial") or "").strip(),
    )
