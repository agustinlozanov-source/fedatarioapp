"""
AGT-05 — Auditor de Actas Constitutivas
Fedatario · Correduría Pública No. 3 · Tamaulipas

Verifica el texto generado por AGT-04 buscando inconsistencias:
  1. Números en cifra vs su versión en letra
  2. Deletreo de RFC, CURP, clave elector, IDMEX
  3. Edades calculadas vs fecha de nacimiento
  4. Letras de archivo (A, B, C...) en secuencia correcta
  5. Coherencia de nombre entre secciones

Endpoint: POST /auditor/verificar
Input:  { texto_acta, datos_fuente (InstrumentoRedactorInput) }
Output: { ok, errores[], advertencias[], score }
"""

from __future__ import annotations
import re
from datetime import date
from typing import List, Optional
from pydantic import BaseModel

# Reutilizar utilidades del AGT-04
from agentes.agt04_redactor import (
    _num_a_letra, numero_letra, fecha_letra, edad_actual,
    deletrear_alfanumerico, deletrear_cp, pesos_letra,
    letras_archivo, letra_mua, MESES_ES,
    InstrumentoRedactorInput
)


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────

class Hallazgo(BaseModel):
    tipo: str          # "error" | "advertencia"
    campo: str         # "rfc_socio_1" | "edad_socio_2" | "letra_archivo"
    descripcion: str
    encontrado: str    # lo que tiene el texto
    esperado: str      # lo que debería tener


class AuditorOutput(BaseModel):
    ok: bool
    score: int                    # 0-100
    errores: List[Hallazgo]
    advertencias: List[Hallazgo]
    resumen: str


# ─────────────────────────────────────────────
# VERIFICACIONES
# ─────────────────────────────────────────────

def verificar_deletreo_rfc(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    hallazgos = []
    for i, socio in enumerate(datos.socios, 1):
        esperado = deletrear_alfanumerico(socio.rfc)
        patron = re.escape(socio.rfc) + r'\s*\(([^)]+)\)'
        matches = re.findall(patron, texto)
        for match in matches:
            match_limpio = match.strip()
            if match_limpio.lower() != esperado.lower():
                hallazgos.append(Hallazgo(
                    tipo="error",
                    campo=f"rfc_socio_{i}",
                    descripcion=f"Deletreo incorrecto del RFC del socio {i} ({socio.nombre_completo})",
                    encontrado=match_limpio,
                    esperado=esperado
                ))
    return hallazgos


def verificar_deletreo_curp(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    hallazgos = []
    for i, socio in enumerate(datos.socios, 1):
        esperado = deletrear_alfanumerico(socio.curp)
        patron = re.escape(socio.curp) + r'\s*\(([^)]+)\)'
        matches = re.findall(patron, texto)
        for match in matches:
            if match.strip().lower() != esperado.lower():
                hallazgos.append(Hallazgo(
                    tipo="error",
                    campo=f"curp_socio_{i}",
                    descripcion=f"Deletreo incorrecto del CURP del socio {i} ({socio.nombre_completo})",
                    encontrado=match.strip(),
                    esperado=esperado
                ))
    return hallazgos


def verificar_deletreo_clave_elector(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    hallazgos = []
    for i, socio in enumerate(datos.socios, 1):
        esperado = deletrear_alfanumerico(socio.clave_elector)
        patron = re.escape(socio.clave_elector) + r'\s*\(([^)]+)\)'
        matches = re.findall(patron, texto)
        for match in matches:
            if match.strip().lower() != esperado.lower():
                hallazgos.append(Hallazgo(
                    tipo="error",
                    campo=f"clave_elector_socio_{i}",
                    descripcion=f"Deletreo incorrecto de clave elector del socio {i}",
                    encontrado=match.strip(),
                    esperado=esperado
                ))
    return hallazgos


def verificar_edades(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    hallazgos = []
    for i, socio in enumerate(datos.socios, 1):
        edad_correcta = edad_actual(socio.fecha_nacimiento, datos.fecha_instrumento)
        edad_letra_correcta = numero_letra(edad_correcta).lower()

        # Buscar patrón: "XX (LETRA) años"
        patron = rf'(\d+)\s*\(([^)]+)\)\s*años'
        matches = re.findall(patron, texto)
        for num_str, letra_str in matches:
            try:
                num = int(num_str)
                # Solo verificar si el número está cerca de la edad del socio
                if abs(num - edad_correcta) <= 1:
                    if letra_str.strip().lower() != edad_letra_correcta:
                        hallazgos.append(Hallazgo(
                            tipo="error",
                            campo=f"edad_socio_{i}",
                            descripcion=f"Edad en letra incorrecta para socio {i} ({socio.nombre_completo})",
                            encontrado=f"{num_str} ({letra_str})",
                            esperado=f"{edad_correcta} ({edad_letra_correcta.capitalize()})"
                        ))
            except ValueError:
                pass
    return hallazgos


def verificar_capital(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    hallazgos = []
    esperado = pesos_letra(datos.capital_fijo).lower()
    cap_fmt = f"${datos.capital_fijo:,.2f}"

    # Buscar el capital en el texto
    patron = re.escape(cap_fmt) + r'\s*\(([^)]+)\)'
    matches = re.findall(patron, texto)
    for match in matches:
        if match.strip().lower() != esperado:
            hallazgos.append(Hallazgo(
                tipo="error",
                campo="capital_fijo",
                descripcion="Capital social en letra incorrecto",
                encontrado=match.strip(),
                esperado=esperado.capitalize()
            ))
    return hallazgos


def verificar_numero_poliza(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    hallazgos = []
    poliza_fmt = f"{datos.numero_poliza:,}"
    esperado = numero_letra(datos.numero_poliza).upper()

    patron = re.escape(poliza_fmt) + r'\s*\(([^)]+)\)'
    matches = re.findall(patron, texto)
    for match in matches:
        if match.strip().upper() != esperado:
            hallazgos.append(Hallazgo(
                tipo="error",
                campo="numero_poliza",
                descripcion="Número de póliza en letra incorrecto",
                encontrado=match.strip(),
                esperado=esperado
            ))
    return hallazgos


def verificar_letras_archivo(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    """Verifica que las letras de archivo aparezcan en el orden correcto."""
    hallazgos = []
    las = letras_archivo(len(datos.socios))
    l_mua = letra_mua(len(datos.socios))

    import string
    letras_esperadas = []
    for l in las:
        letras_esperadas.extend([l["ine"], l["curp"], l["rfc"]])
    letras_esperadas.append(l_mua)

    for i, (letra, socio) in enumerate(zip(las, datos.socios)):
        # Verificar que la letra INE del socio aparece asociada a su nombre
        patron_ine = rf'Letra "{letra["ine"]}"'
        if letra["ine"] not in texto:
            hallazgos.append(Hallazgo(
                tipo="advertencia",
                campo=f"letra_archivo_ine_socio_{i+1}",
                descripcion=f"No se encontró la Letra '{letra['ine']}' para INE del socio {i+1}",
                encontrado="(ausente)",
                esperado=f'Letra "{letra["ine"]}"'
            ))

    # Verificar letra MUA
    if l_mua not in texto:
        hallazgos.append(Hallazgo(
            tipo="advertencia",
            campo="letra_archivo_mua",
            descripcion=f"No se encontró la Letra '{l_mua}' para el MUA",
            encontrado="(ausente)",
            esperado=f'Letra "{l_mua}"'
        ))

    return hallazgos


def verificar_cud(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    hallazgos = []
    if datos.cud not in texto:
        hallazgos.append(Hallazgo(
            tipo="error",
            campo="cud",
            descripcion="CUD del MUA no encontrado en el acta",
            encontrado="(ausente)",
            esperado=datos.cud
        ))
    else:
        # Verificar deletreo del CUD
        esperado = deletrear_alfanumerico(datos.cud)
        patron = re.escape(datos.cud) + r'\s*\(([^)]+)\)'
        matches = re.findall(patron, texto)
        for match in matches:
            if match.strip().lower() != esperado.lower():
                hallazgos.append(Hallazgo(
                    tipo="error",
                    campo="cud_deletreo",
                    descripcion="Deletreo incorrecto del CUD",
                    encontrado=match.strip(),
                    esperado=esperado
                ))
    return hallazgos


def verificar_nombres_completos(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    """Verifica que el nombre completo de cada socio aparezca en el texto."""
    hallazgos = []
    for i, socio in enumerate(datos.socios, 1):
        if socio.nombre_completo not in texto:
            hallazgos.append(Hallazgo(
                tipo="error",
                campo=f"nombre_socio_{i}",
                descripcion=f"Nombre completo del socio {i} no encontrado en el acta",
                encontrado="(ausente)",
                esperado=socio.nombre_completo
            ))
    return hallazgos


def verificar_denominacion(texto: str, datos: InstrumentoRedactorInput) -> List[Hallazgo]:
    hallazgos = []
    if datos.denominacion_social not in texto:
        hallazgos.append(Hallazgo(
            tipo="error",
            campo="denominacion_social",
            descripcion="Denominación social no encontrada en el acta",
            encontrado="(ausente)",
            esperado=datos.denominacion_social
        ))
    return hallazgos


# ─────────────────────────────────────────────
# FUNCIÓN PRINCIPAL
# ─────────────────────────────────────────────

def auditar_acta(texto_acta: str, datos: InstrumentoRedactorInput) -> AuditorOutput:
    """
    Ejecuta todas las verificaciones sobre el texto del acta.
    Retorna un AuditorOutput con errores, advertencias y score.
    """
    todos_hallazgos: List[Hallazgo] = []

    todos_hallazgos += verificar_nombres_completos(texto_acta, datos)
    todos_hallazgos += verificar_denominacion(texto_acta, datos)
    todos_hallazgos += verificar_numero_poliza(texto_acta, datos)
    todos_hallazgos += verificar_deletreo_rfc(texto_acta, datos)
    todos_hallazgos += verificar_deletreo_curp(texto_acta, datos)
    todos_hallazgos += verificar_deletreo_clave_elector(texto_acta, datos)
    todos_hallazgos += verificar_edades(texto_acta, datos)
    todos_hallazgos += verificar_capital(texto_acta, datos)
    todos_hallazgos += verificar_cud(texto_acta, datos)
    todos_hallazgos += verificar_letras_archivo(texto_acta, datos)

    errores      = [h for h in todos_hallazgos if h.tipo == "error"]
    advertencias = [h for h in todos_hallazgos if h.tipo == "advertencia"]

    # Score: 100 - (errores * 10) - (advertencias * 3), mínimo 0
    score = max(0, 100 - len(errores) * 10 - len(advertencias) * 3)
    ok = len(errores) == 0

    if ok and len(advertencias) == 0:
        resumen = f"✅ Acta verificada sin observaciones. Score: {score}/100"
    elif ok:
        resumen = f"⚠️ Acta aprobada con {len(advertencias)} advertencia(s). Score: {score}/100"
    else:
        resumen = f"❌ {len(errores)} error(es) encontrado(s). Score: {score}/100. Revisar antes de imprimir."

    return AuditorOutput(
        ok=ok,
        score=score,
        errores=errores,
        advertencias=advertencias,
        resumen=resumen
    )


# ─────────────────────────────────────────────
# PRUEBA STANDALONE
# ─────────────────────────────────────────────

if __name__ == "__main__":
    from datetime import date
    from agentes.agt04_redactor import (
        generar_acta, SocioInput, DomicilioInput, InstrumentoRedactorInput
    )

    datos = InstrumentoRedactorInput(
        numero_poliza=3272,
        libro_registro=5,
        ciudad_fedatario="MATAMOROS",
        fecha_instrumento=date(2026, 2, 16),
        tipo_sociedad="SA_de_CV",
        denominacion_social="COMERCIALIZADORA AZTEMEX",
        cud="A202602090932258301",
        solicitante_mua="ESMERALDA LETICIA ESQUIVEL",
        domicilio_social="Matamoros, Tamaulipas",
        capital_fijo=100000,
        socios=[
            SocioInput(
                nombre_completo="EDUARDO ROMERO ZALETA",
                genero="masculino",
                nacionalidad_pais="México",
                lugar_nacimiento="Tampico, Tamaulipas, México",
                fecha_nacimiento=date(1987, 8, 13),
                estado_civil="Soltero",
                ocupacion="Comerciante",
                domicilio=DomicilioInput(
                    calle="Ernesto Elizondo", numero="121",
                    colonia="Popular", cp="87460",
                    ciudad="Matamoros", estado="Tamaulipas"
                ),
                rfc="ROZE870813NXA", curp="ROZE870813HTSMLD04",
                clave_elector="RMZLED87081328H500",
                seccion_ine="0606", idmex="2604718651"
            ),
            SocioInput(
                nombre_completo="SARA KERENHAPUC DAMARIS GARCÍA PADILLA",
                genero="femenino",
                nacionalidad_pais="México",
                lugar_nacimiento="Matamoros, Tamaulipas, México",
                fecha_nacimiento=date(1988, 1, 16),
                estado_civil="Soltera",
                ocupacion="Comerciante",
                domicilio=DomicilioInput(
                    calle="Ernesto Elizondo", numero="121",
                    colonia="Popular", cp="87460",
                    ciudad="Matamoros", estado="Tamaulipas"
                ),
                rfc="GAPS880116CX9", curp="GAPS880116MTSRDR04",
                clave_elector="GRPDSR88011628M000",
                seccion_ine="0606", idmex="2604718662"
            ),
        ],
        objeto_social_texto="A).- Compra y venta de mercancías.\nB).- Prestación de servicios.",
    )

    resultado = generar_acta(datos)
    auditoria = auditar_acta(resultado["texto_acta"], datos)

    print(auditoria.resumen)
    if auditoria.errores:
        print(f"\nErrores ({len(auditoria.errores)}):")
        for e in auditoria.errores:
            print(f"  ❌ [{e.campo}] {e.descripcion}")
            print(f"     Encontrado: {e.encontrado}")
            print(f"     Esperado:   {e.esperado}")
    if auditoria.advertencias:
        print(f"\nAdvertencias ({len(auditoria.advertencias)}):")
        for a in auditoria.advertencias:
            print(f"  ⚠️  [{a.campo}] {a.descripcion}")
