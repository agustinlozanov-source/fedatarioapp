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


def _parse_socio(s: Dict[str, Any]) -> SocioInput:
    dom = s.get("domicilio", {})
    return SocioInput(
        nombre_completo   = s["nombre_completo"].upper().strip(),
        genero            = s.get("genero", "masculino").lower(),
        nacionalidad_pais = s.get("nacionalidad_pais", "México"),
        lugar_nacimiento  = s.get("lugar_nacimiento", ""),
        fecha_nacimiento  = _parse_date(s["fecha_nacimiento"]),
        estado_civil      = s.get("estado_civil", ""),
        ocupacion         = s.get("ocupacion", ""),
        domicilio         = DomicilioInput(
            calle   = dom.get("calle", ""),
            numero  = str(dom.get("numero", "")),
            colonia = dom.get("colonia", ""),
            cp      = str(dom.get("cp", "")),
            ciudad  = dom.get("ciudad", ""),
            estado  = dom.get("estado", ""),
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
        ciudad_fedatario    = data.get("ciudad_fedatario", "").upper().strip(),
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
        objeto_social_texto = data.get("objeto_social_texto", "").strip(),
    )
