"""
extractor_cud.py
----------------
Habilidad del AGT-02 Extractor para procesar el PDF del CUD
(Constancia de Autorización de Uso de Denominación o Razón Social)
emitido por la Secretaría de Economía a través del MUA.

Entrada  : PDF del CUD (ruta local o bytes)
Salida   : CUDData con todos los campos necesarios para el acta constitutiva
"""

import re
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import Optional
from pdfminer.high_level import extract_text
from pdfminer.layout import LAParams


# ──────────────────────────────────────────────────────────────────────────────
# Modelo de datos
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class CUDData:
    """
    Todos los campos que el acta constitutiva necesita del CUD.
    Cada campo tiene su fuente declarada para trazabilidad del AGT-02.
    """
    # Identificadores principales
    cud: str                          # "A202602090932258301"
    denominacion: str                  # "COMERCIALIZADORA AZTEMEX"

    # Datos del solicitante (quien tramitó el CUD ante el MUA)
    folio_solicitante: str             # "10933825"
    rfc_solicitante: str               # "EUES020410878"
    nombre_solicitante: str            # "ESMERALDA LETICIA ESQUIVEL"

    # Datos del funcionario que emite el dictamen
    rfc_funcionario: str               # "GAMC940619I87"
    nombre_funcionario: str            # "CYNTHIA VERONICA GARRIDO MORA"
    cargo_funcionario: str             # "JEFA DE DEPARTAMENTO DE AUTORIZACIONES..."

    # Fechas y vigencia
    fecha_emision: str                 # "05-02-2026"  (DD-MM-YYYY)
    vigencia_dias: int                 # 180
    fecha_vencimiento: str             # "04-08-2026"  (calculada)

    # Texto completo de la Resolución (para transcripción literal en el acta)
    texto_resolucion: str

    # Control de calidad
    confianza: float                   # 0.0 – 1.0
    errores: list                      # campos que no se pudieron extraer


# ──────────────────────────────────────────────────────────────────────────────
# Extractor principal
# ──────────────────────────────────────────────────────────────────────────────

class ExtractorCUD:
    """
    Extrae los datos del PDF del CUD usando pdfminer para obtener el texto
    y regex precisos sobre la estructura conocida del documento de la SE.

    La Cadena Original del servidor público contiene los datos clave
    en formato pipe-separated:
        folio | rfc_solicitante | nombre_solicitante | resolucion | rfc_funcionario | nombre_funcionario | cargo | fecha
    """

    VIGENCIA_DIAS = 180  # Art. 3 del Reglamento para la Autorización de Uso de D. y R.S.

    def procesar(self, pdf_path: str) -> CUDData:
        """Procesa el PDF y retorna CUDData con todos los campos."""
        texto = self._extraer_texto(pdf_path)
        return self._parsear(texto)

    def procesar_bytes(self, pdf_bytes: bytes) -> CUDData:
        """Versión para cuando el PDF llega como bytes (upload desde la API)."""
        import io
        texto = extract_text(io.BytesIO(pdf_bytes), laparams=LAParams())
        return self._parsear(texto)

    # ── Extracción de texto ───────────────────────────────────────────────────

    def _extraer_texto(self, pdf_path: str) -> str:
        return extract_text(pdf_path, laparams=LAParams())

    # ── Parseo ────────────────────────────────────────────────────────────────

    def _parsear(self, texto: str) -> CUDData:
        errores = []

        # 1. CUD — aparece dos veces en el documento, tomamos la primera
        cud = self._extraer_cud(texto, errores)

        # 2. Denominación — en la sección "SE RESUELVE AUTORIZAR"
        denominacion = self._extraer_denominacion(texto, errores)

        # 3. Cadena Original — contiene el resto de los datos en formato pipe
        campos_cadena = self._extraer_cadena_original(texto, errores)

        folio_solicitante  = campos_cadena.get("folio", "")
        rfc_solicitante    = campos_cadena.get("rfc_solicitante", "")
        nombre_solicitante = campos_cadena.get("nombre_solicitante", "")
        rfc_funcionario    = campos_cadena.get("rfc_funcionario", "")
        nombre_funcionario = campos_cadena.get("nombre_funcionario", "")
        cargo_funcionario  = campos_cadena.get("cargo", "")
        fecha_emision      = campos_cadena.get("fecha", "")

        # 4. Fecha de vencimiento — calculada desde fecha_emision + 180 días
        fecha_vencimiento = self._calcular_vencimiento(fecha_emision, errores)

        # 5. Texto de la Resolución completa — para transcripción literal en el acta
        texto_resolucion = self._extraer_resolucion(texto, errores)

        # 6. Score de confianza
        campos_criticos = [cud, denominacion, folio_solicitante, rfc_solicitante,
                           nombre_solicitante, rfc_funcionario, nombre_funcionario,
                           cargo_funcionario, fecha_emision]
        campos_encontrados = sum(1 for c in campos_criticos if c)
        confianza = round(campos_encontrados / len(campos_criticos), 2)

        return CUDData(
            cud=cud,
            denominacion=denominacion,
            folio_solicitante=folio_solicitante,
            rfc_solicitante=rfc_solicitante,
            nombre_solicitante=nombre_solicitante,
            rfc_funcionario=rfc_funcionario,
            nombre_funcionario=nombre_funcionario,
            cargo_funcionario=cargo_funcionario,
            fecha_emision=fecha_emision,
            vigencia_dias=self.VIGENCIA_DIAS,
            fecha_vencimiento=fecha_vencimiento,
            texto_resolucion=texto_resolucion,
            confianza=confianza,
            errores=errores,
        )

    # ── Métodos de extracción individuales ────────────────────────────────────

    def _extraer_cud(self, texto: str, errores: list) -> str:
        """
        El CUD tiene formato A + 18 dígitos.
        Ejemplo: A202602090932258301
        Aparece justo después de "Clave Única del Documento (CUD)"
        """
        patron = r'Clave\s+[ÚU]nica\s+del\s+Documento\s*\(CUD\)\s*\n?\s*(A\d{18})'
        match = re.search(patron, texto, re.IGNORECASE)
        if match:
            return match.group(1).strip()

        # Fallback: buscar cualquier token con formato del CUD
        match = re.search(r'\b(A\d{18})\b', texto)
        if match:
            return match.group(1).strip()

        errores.append("cud: no encontrado")
        return ""

    def _extraer_denominacion(self, texto: str, errores: list) -> str:
        """
        La denominación aparece en mayúsculas justo después de
        "SE RESUELVE AUTORIZAR EL USO DE LA SIGUIENTE DENOMINACIÓN O RAZÓN SOCIAL:"
        """
        patron = (
            r'SE\s+RESUELVE\s+AUTORIZAR\s+EL\s+USO\s+DE\s+LA\s+SIGUIENTE\s+'
            r'DENOMINACI[OÓ]N\s+O\s+RAZ[OÓ]N\s+SOCIAL:\s*\n?\s*([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ\s\d,\.]+?)(?:\n|Lo anterior)'
        )
        match = re.search(patron, texto, re.IGNORECASE | re.DOTALL)
        if match:
            return match.group(1).strip()

        errores.append("denominacion: no encontrada")
        return ""

    def _extraer_cadena_original(self, texto: str, errores: list) -> dict:
        """
        La Cadena Original del servidor público tiene formato:
            folio | rfc_solicitante | nombre_solicitante | resolucion_texto | rfc_funcionario | nombre_funcionario | cargo | fecha |

        Ejemplo real:
            10933825 | EUES020410878 | ESMERALDA LETICIA ESQUIVEL | SE RESUELVE... | GAMC940619I87 | CYNTHIA VERONICA GARRIDO MORA | JEFA DE DEPARTAMENTO... | 05-02-2026 |
        """
        patron = r'Cadena\s+Original\s+del\s+servidor\s+p[úu]blico\s+que\s+emite\s+el\s+dictamen:\s*([\d]+)\s*\|\s*([A-Z0-9]+)\s*\|\s*([A-ZÁÉÍÓÚÜÑ\s]+?)\s*\|\s*SE\s+RESUELVE.*?"([^"]+)"\s*\|\s*([A-Z0-9]+)\s*\|\s*([A-ZÁÉÍÓÚÜÑ\s]+?)\s*\|\s*([A-ZÁÉÍÓÚÜÑ\s\dY]+?)\s*\|\s*(\d{2}-\d{2}-\d{4})'

        match = re.search(patron, texto, re.IGNORECASE | re.DOTALL)
        if match:
            return {
                "folio":             match.group(1).strip(),
                "rfc_solicitante":   match.group(2).strip(),
                "nombre_solicitante":match.group(3).strip(),
                "rfc_funcionario":   match.group(5).strip(),
                "nombre_funcionario":match.group(6).strip(),
                "cargo":             match.group(7).strip(),
                "fecha":             match.group(8).strip(),
            }

        # Fallback — la estructura de la Cadena Original es siempre:
        # [0] "...dictamen: FOLIO"  [1] RFC_SOL  [2] NOMBRE_SOL  [3] "SE RESUELVE...'DENOM'"
        # [4] RFC_FUNC  [5] NOMBRE_FUNC  [6] CARGO  [7] FECHA
        resultado = {}

        idx = texto.find("Cadena Original del servidor")
        if idx == -1:
            errores.append("cadena_original: bloque no encontrado")
            return resultado

        bloque = texto[idx:idx + 1500]
        # Normalizar fecha partida antes de splitear ("16-02-\n2026" → "16-02-2026")
        bloque_norm = re.sub(r'(\d{2}-\d{2}-)\s*\n\s*(\d{4})', r'\1\2', bloque)
        partes = [re.sub(r'\s+', ' ', p).strip() for p in bloque_norm.split("|")]

        def parte(i): return partes[i] if len(partes) > i else ""

        folio_match = re.search(r'dictamen:\s*(\d+)', parte(0))
        if folio_match:
            resultado["folio"] = folio_match.group(1)

        resultado["rfc_solicitante"]    = parte(1)
        resultado["nombre_solicitante"] = parte(2)
        resultado["rfc_funcionario"]    = parte(4)
        resultado["nombre_funcionario"] = parte(5)
        resultado["cargo"]              = parte(6)

        fecha_match = re.search(r'\b(\d{2}-\d{2}-\d{4})\b', parte(7))
        if fecha_match:
            resultado["fecha"] = fecha_match.group(1)
        else:
            errores.append("fecha_emision: no encontrada")

        return resultado

    def _calcular_vencimiento(self, fecha_emision: str, errores: list) -> str:
        """Calcula fecha_emision + 180 días."""
        if not fecha_emision:
            return ""
        try:
            dt = datetime.strptime(fecha_emision, "%d-%m-%Y")
            vencimiento = dt + timedelta(days=self.VIGENCIA_DIAS)
            return vencimiento.strftime("%d-%m-%Y")
        except ValueError:
            errores.append(f"fecha_vencimiento: no se pudo calcular desde '{fecha_emision}'")
            return ""

    def _extraer_resolucion(self, texto: str, errores: list) -> str:
        """
        Extrae el bloque completo de la Resolución para que el AGT-04 Redactor
        pueda transcribirlo literalmente en la sección ANTECEDENTES del acta.
        """
        inicio = texto.find("Resolución")
        fin = texto.find("AVISO DE USO NECESARIO")
        if inicio != -1 and fin != -1:
            return texto[inicio:fin].strip()
        errores.append("texto_resolucion: no se pudo delimitar el bloque")
        return ""

    def a_dict(self, data: CUDData) -> dict:
        """Convierte CUDData a dict para serialización JSON en el pipeline."""
        return asdict(data)


# ──────────────────────────────────────────────────────────────────────────────
# Punto de entrada para prueba directa
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys
    import json

    if len(sys.argv) < 2:
        print("Uso: python extractor_cud.py <ruta_pdf>")
        sys.exit(1)

    extractor = ExtractorCUD()
    resultado = extractor.procesar(sys.argv[1])
    print(json.dumps(extractor.a_dict(resultado), ensure_ascii=False, indent=2))
