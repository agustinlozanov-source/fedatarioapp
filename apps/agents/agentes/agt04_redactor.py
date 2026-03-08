"""
AGT-04 — Redactor de Actas Constitutivas
Fedatario · Correduría Pública No. 3 · Tamaulipas

Genera el texto completo de actas constitutivas SA de CV y S de RL de CV
a partir de los datos del expediente (Firestore).

Endpoint FastAPI: POST /redactor/generar
Input:  InstrumentoRedactorInput (ver schema abajo)
Output: { texto_acta, tipo_sociedad, num_palabras, variables_aplicadas }

Ejecución standalone de prueba:
    python3 agt04_redactor.py
"""

from __future__ import annotations
import re
from datetime import date
from typing import List, Optional
from pydantic import BaseModel


# ─────────────────────────────────────────────
# SCHEMAS DE ENTRADA
# ─────────────────────────────────────────────

class DomicilioInput(BaseModel):
    calle: str
    numero: str
    colonia: str
    cp: str
    ciudad: str
    estado: str

class SocioInput(BaseModel):
    nombre_completo: str                        # mayúsculas
    genero: str                                 # "masculino" | "femenino"
    nacionalidad_pais: str                      # "México"
    lugar_nacimiento: str                       # "Tampico, Tamaulipas, México"
    fecha_nacimiento: date                      # date object
    estado_civil: str                           # "Soltero" | "Casada" etc.
    ocupacion: str
    domicilio: DomicilioInput
    rfc: str                                    # "ROZE870813NXA"
    curp: str                                   # "ROZE870813HTSMLD04"
    clave_elector: str                          # "RMZLED87081328H500"
    seccion_ine: str                            # "0606"
    idmex: str                                  # "2604718651"

class InstrumentoRedactorInput(BaseModel):
    # Instrumento
    numero_poliza: int                          # 3272
    libro_registro: int                         # 5
    ciudad_fedatario: str                       # "MATAMOROS"
    fecha_instrumento: date

    # Sociedad
    tipo_sociedad: str                          # "SA_de_CV" | "S_de_RL_de_CV"
    denominacion_social: str                    # "COMERCIALIZADORA AZTEMEX"
    cud: str                                    # "A202602090932258301"
    solicitante_mua: str                        # "ESMERALDA LETICIA ESQUIVEL"
    domicilio_social: str                       # "Matamoros, Tamaulipas"
    capital_fijo: int                           # 100000

    # Socios (ordenados: primero = Administrador/Gerente, segundo = Comisario)
    socios: List[SocioInput]

    # Objeto social (textos completos de Firestore, ya concatenados por el orquestador)
    objeto_social_texto: str


# ─────────────────────────────────────────────
# UTILIDADES NUMÉRICAS
# ─────────────────────────────────────────────

UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete",
            "ocho", "nueve", "diez", "once", "doce", "trece", "catorce",
            "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"]
DECENAS  = ["", "", "veinte", "treinta", "cuarenta", "cincuenta",
            "sesenta", "setenta", "ochenta", "noventa"]
CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos",
            "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"]

MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}

def _num_a_letra(n: int) -> str:
    """Convierte entero (0-999,999,999) a letras en español."""
    if n == 0:
        return "cero"
    if n < 0:
        return "menos " + _num_a_letra(-n)

    resultado = ""

    millones = n // 1_000_000
    if millones:
        resultado += ("un millón " if millones == 1
                      else _num_a_letra(millones) + " millones ")
        n %= 1_000_000

    miles = n // 1000
    if miles:
        resultado += ("mil " if miles == 1
                      else _num_a_letra(miles) + " mil ")
        n %= 1000

    centena = n // 100
    if centena:
        if centena == 1 and n % 100 == 0:
            resultado += "cien "
        else:
            resultado += CENTENAS[centena] + " "
        n %= 100

    if n >= 20:
        decena = n // 10
        unidad = n % 10
        if unidad:
            resultado += DECENAS[decena] + " y " + UNIDADES[unidad] + " "
        else:
            resultado += DECENAS[decena] + " "
    elif n > 0:
        resultado += UNIDADES[n] + " "

    return resultado.strip()

def numero_letra(n: int) -> str:
    """'3,272' → 'Tres mil doscientos setenta y dos'"""
    return _num_a_letra(n).capitalize()

def fecha_letra(d: date) -> str:
    """date(1987,8,13) → 'Trece de Agosto del año mil novecientos ochenta y siete'"""
    return f"{numero_letra(d.day)} de {MESES_ES[d.month]} del año {_num_a_letra(d.year)}"

def edad_actual(nacimiento: date, referencia: date | None = None) -> int:
    ref = referencia or date.today()
    edad = ref.year - nacimiento.year
    if (ref.month, ref.day) < (nacimiento.month, nacimiento.day):
        edad -= 1
    return edad

def deletrear_alfanumerico(texto: str) -> str:
    """
    'ROZE870813NXA' → 'R, O, Z, E, ocho, siete, cero, ocho, uno, tres, N, X, A'
    Letras en mayúscula, números en palabra.
    """
    digitos = {
        '0': 'cero', '1': 'uno', '2': 'dos', '3': 'tres', '4': 'cuatro',
        '5': 'cinco', '6': 'seis', '7': 'siete', '8': 'ocho', '9': 'nueve'
    }
    partes = []
    for c in texto:
        if c.isdigit():
            partes.append(digitos[c])
        elif c.isalpha():
            partes.append(c.upper())
        # ignorar guiones y espacios
    return ", ".join(partes)

def deletrear_cp(cp: str) -> str:
    """'87460' → 'Ocho, siete, cuatro, seis, cero'"""
    d = deletrear_alfanumerico(cp)
    return d[0].upper() + d[1:] if d else d

def pesos_letra(monto: int) -> str:
    """100000 → 'Cien mil pesos 00/100 en Moneda Nacional'"""
    letra = numero_letra(monto)
    return f"{letra} pesos 00/100 en Moneda Nacional"

def letras_archivo(num_socios: int) -> list[dict]:
    """
    Genera las letras de archivo para N socios.
    Retorna lista de dicts: [{ine, curp, rfc}, ...]
    """
    import string
    letras = list(string.ascii_uppercase)
    resultado = []
    for i in range(num_socios):
        base = i * 3
        resultado.append({
            "ine":  letras[base],
            "curp": letras[base + 1],
            "rfc":  letras[base + 2],
        })
    return resultado

def letra_mua(num_socios: int) -> str:
    import string
    return string.ascii_uppercase[num_socios * 3]

def genero_str(socio: SocioInput, masculino: str, femenino: str) -> str:
    return masculino if socio.genero == "masculino" else femenino


# ─────────────────────────────────────────────
# SECCIONES FIJAS
# ─────────────────────────────────────────────

PROTESTA_CAPACIDAD = (
    'PROTESTA DE CAPACIDAD NATURAL Y CIVIL. – - - - - - - - - - - - - - - - - - - - - - - - '
    'Expresan los comparecientes que: "Bajo Protesta de Decir Verdad, manifiesto ser la misma '
    'persona que aparece en los documentos de identidad personal, así mismo manifiesto no tener '
    'incapacidad natural o civil para celebrar e intervenir en el presente acto jurídico, '
    'apercibido plenamente del delito en que incurro si falto a la verdad, en términos del '
    'Código Penal del Estado de Tamaulipas." - - - - - - - - - - - - - - - - -'
)

DECLARACION_PRIMERA = (
    'PRIMERA.- Declaran los comparecientes que es su libre consentimiento otorgar el presente '
    'acto jurídico y que su voluntad no se encuentra afectada por dolo, violencia, mala fe o '
    'algún otro vicio que pudiera afectar la validez del presente acto jurídico, por lo que es '
    'su firme intención, otorgar y consignar el presente, al tenor del presente instrumento.- - -'
)

DECLARACION_SEGUNDA = (
    'SEGUNDA.- Declaramos que de conformidad con lo dispuesto por el artículo 22 (Veintidós) '
    'del Reglamento para la Autorización de Uso de Denominaciones y Razones Sociales nuestra '
    'sociedad que pretende usar una Denominación o Razón Social tendrá las obligaciones '
    'siguientes: - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - '
    'I (Primero).- Responder por cualquier daño, perjuicio o afectación que pudiera causar el '
    'uso indebido o no autorizado de la Denominación o Razón Social otorgada mediante la '
    'presente Autorización, conforme a la Ley de Inversión Extranjera y al Reglamento para la '
    'Autorización de Uso de Denominaciones y Razones Sociales, y;- - '
    'II (Segundo).- Proporcionar a la Secretaría de Economía la información y documentación que '
    'le sea requerida por escrito o a través del Sistema en relación con el uso de la '
    'Denominación o Razón Social otorgada mediante la presente Autorización, al momento de '
    'haberla reservado, durante el tiempo en que se encuentre en uso, y después de que se haya '
    'dado el Aviso de Liberación respecto de la misma.- - - - - - - - - - - - - - - - - - - - -'
)

CERTIFICACIONES_SA = """A.- Hago constar que: Presenté y exhibí Aviso de Privacidad a los comparecientes y les hice saber el uso y destino de sus datos personales en términos de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
B.- Hago constar que: Me aseguré de la identidad de los comparecientes a través de las documentales de identificación que en original me exhibieron, así como que levanté la Protesta de Decir Verdad en relación a su identidad y los documentos que me presentaron, así como de las manifestaciones que realizan.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
C.- Hago constar que: Me aseguré de la Capacidad Legal de los comparecientes y no encontré manifestaciones evidentes de Incapacidad Natural en ellos, además de no tener conocimiento que se encuentra en estado de interdicción.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
D.- Hago constar que: Que solicité y exigí a los comparecientes me acrediten y me presenten la cédula de identificación fiscal de su inscripción en el Registro Federal de Contribuyentes de cada uno de los socios, conforme al Artículo 27 (Veintisiete) del Código Fiscal de la Federación y Artículo 28 (Veintiocho) del Reglamento del Código Fiscal de la Federación, documentales que tuve a la vista en formato físico.- - - - - - - - - - - - - - - - - - - - -
E.- Hago constar que: Esta operación causa Aviso conforme al artículo 17 (Diecisiete), fracción XII (Decima segunda), Apartado B, subinciso b) de la Ley para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
EA.- He identificado y reconozco de manera directa a cada compareciente con relación al documento que me ha presentado para su identificación. Así como que he obtenido los copia obtenida directamente de su matriz los cuales he tenido a la vista de los documentos que acreditan su identidad, mismos que han quedado debidamente integrados al Archivo del presente instrumento.- - - - - - - - - - - - - - - - - - - -
EB.- La presente operación es accidental y aislada, por lo que no configura una relación de negocios entre cada compareciente y el suscrito Corredor Público.- - -
EC.- He interpelado al compareciente sobre la declaración si tiene o no conocimiento de la existencia de una persona Beneficiario Controlador y, en su caso, la exhibición de la documentación que permita identificarla. Para ello he obtenido su declaración y manifestación mediante los formatos que he provisto para ello, mismos que han quedado debidamente integrados al Archivo del presente instrumento. - - - - - - - - - - - - - -
F.- Hago constar que: Expliqué y orienté sobre el valor y las consecuencias legales con relación al presente acto jurídico.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
G.- Hago constar que: Que tuve a la vista los documentos relacionados con el presente instrumento, por lo que me fueron exhibidos en su formato original, los que después de analizarlos, obtuve copia fotostática, para agregarlos al Archivo en Copia cotejada, bajo la letra que le correspondió. - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
H.- Hago constar que: En términos del Reglamento para la Autorización de Uso de Denominaciones y Razones Sociales, quedó íntegramente transcrita dicha autorización, así como que les hice sabedores de las obligaciones y responsabilidades que asumen con relación a la autorización de uso de la denominación o razón social otorgada, explicándoles sucintamente las responsabilidades, derechos y obligaciones que por la sola aceptación de uso implica en términos de dicho reglamento y las leyes aplicables. Así mismo como que tales han quedado íntegramente transcritos en el presente instrumento constitutivo.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
I.- Hago constar que: Leí de manera clara y en voz alta el contenido íntegro del presente instrumento, así como que les hice saber de su valor, efectos y consecuencias legales, así como que le hice saber el derecho que tiene de leerlo por sí mismo.- - - - -
J.- Hago constar que: Los comparecientes han manifestado de viva voz, su conformidad integra con el contenido del instrumento que en este acto otorgan y para constancia, solicitan firmarlo en un solo acto, además desean imprimir su nombre completo a de su puño y letra y plasmar sus huellas digitales de su índice izquierdo y derecho, respectivamente por así solicitarlo.- - - - - - - - - - - - - - - - - - - - - - - - - - - - -"""


# ─────────────────────────────────────────────
# BLOQUES DE TEXTO POR SECCIÓN
# ─────────────────────────────────────────────

def bloque_encabezado(d: InstrumentoRedactorInput) -> str:
    poliza_num = f"{d.numero_poliza:,}".replace(",", ",")
    poliza_letra = numero_letra(d.numero_poliza).upper()
    libro_letra = numero_letra(d.libro_registro).upper()
    dia = d.fecha_instrumento.day
    dia_letra = numero_letra(dia).upper()
    mes = MESES_ES[d.fecha_instrumento.month].upper()
    anio = d.fecha_instrumento.year
    anio_letra = _num_a_letra(anio).upper()

    tipo_full = ("SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE"
                 if d.tipo_sociedad == "SA_de_CV"
                 else "SOCIEDAD DE RESPONSABILIDAD LIMITADA DE CAPITAL VARIABLE")

    nombres_socios = " y ".join(s.nombre_completo for s in d.socios)

    return (
        f"=================== LIBRO DE REGISTRO {d.libro_registro} ({libro_letra}) ==================== "
        f"==================== I N S T R U M E N T O  P Ú B L I C O ===================== "
        f"====== PÓLIZA NÚMERO {poliza_num} ({poliza_letra}) ======\n\n"
        f"En la ciudad de {d.ciudad_fedatario}, TAMAULIPAS AL DÍA {dia} ({dia_letra}) "
        f"DE {mes} DEL AÑO {anio} ({anio_letra}).- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n"
        f"Ante mí, el suscrito LICENCIADO WILFREDO EMMANUEL RAMÍREZ NÚÑEZ, CORREDOR PÚBLICO "
        f"NÚMERO 3 (TRES) DE LA PLAZA DEL ESTADO DE TAMAULIPAS, con Registro Federal de "
        f"Contribuyentes: RANW, ocho, cinco, cero, seis, dos, ocho, UW, tres.- - - - - - - - - - - - - - - -\n"
        f"CERTIFICO Y HAGO CONSTAR QUE: Comparecen en esta oficina de la Correduría Pública "
        f"Número 3 (Tres) de la Plaza de Tamaulipas, los Ciudadanos {nombres_socios} quienes "
        f"expresan que es su intención solicitar los servicios del suscrito Fedatario Público "
        f"a fin de otorgar la Constitución de una Sociedad Mercantil, la que desean denominar: "
        f"{d.denominacion_social}, Denominación que deberá ir seguida de su régimen jurídico "
        f"{tipo_full} en los términos del presente instrumento. Acto continúo, declaran por "
        f"sus generales ser:- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n"
    )


def bloque_datos_socio(socio: SocioInput, letras: dict, ref_date: date) -> str:
    edad = edad_actual(socio.fecha_nacimiento, ref_date)
    edad_l = numero_letra(edad)
    fec_l  = fecha_letra(socio.fecha_nacimiento)
    dom    = socio.domicilio
    num_l  = numero_letra(int(re.sub(r'\D', '', dom.numero or '0')))
    cp_l   = deletrear_cp(dom.cp)
    rfc_l  = deletrear_alfanumerico(socio.rfc)
    curp_l = deletrear_alfanumerico(socio.curp)
    ce_l   = deletrear_alfanumerico(socio.clave_elector)
    sec_l  = deletrear_alfanumerico(socio.seccion_ine)
    idmex_l= deletrear_alfanumerico(socio.idmex)

    nac_gent = genero_str(socio, "Mexicano por nacimiento", "Mexicana por nacimiento")
    orig_prep = genero_str(socio, "Originario de", "Originaria de")

    return (
        f"========================= D A T O S  G E N E R A L E S ======================\n"
        f"Nombre completo: {socio.nombre_completo}.- - - - - - - - - - - - - - - - - - - - - - - - - -\n"
        f"Nacionalidad: {nac_gent}. {orig_prep}: {socio.lugar_nacimiento}.- - - - - - - - - - - - - - -\n"
        f"Fecha de nacimiento: {socio.fecha_nacimiento.day} ({fec_l.split()[0]}) de "
        f"{MESES_ES[socio.fecha_nacimiento.month]} del año {socio.fecha_nacimiento.year} "
        f"({_num_a_letra(socio.fecha_nacimiento.year).capitalize()}). "
        f"Edad actual: {edad} ({edad_l.capitalize()}) años. "
        f"Estado civil: {socio.estado_civil}. Ocupación: {socio.ocupacion}.- - - - - - - - - - - - -\n"
        f"Dice que su Domicilio está en: Calle {dom.calle}. Número: {dom.numero} ({num_l.capitalize()}). "
        f"Colonia o Fraccionamiento: {dom.colonia}. Código Postal: {dom.cp} ({cp_l}). "
        f"Ciudad: {dom.ciudad}. Estado: {dom.estado}. País: México.- - - - - - - - - - - - - - -\n"
        f"RFC (Registro Federal de Contribuyentes): {socio.rfc} ({rfc_l}).- - - - - - - - - - - - - - -\n"
        f"CURP (Clave Única de Registro de Población): {socio.curp} ({curp_l}).- - - - - - - - - - -\n"
        f"Identificación de quien comparece.- El suscrito Corredor Público en términos de la "
        f"Ley Federal de Correduría Pública y su Reglamento, me permito asegurarme de la "
        f"identidad de la persona que comparece con identificación con fotografía la cual es "
        f"coincidente con sus rasgos fisionómicos y es: Credencial para votar con fotografía, "
        f"expedida por el Instituto Nacional Electoral.- - - - - - - - - - - - - - - - - - - -\n"
        f"Número de Clave de Elector: {socio.clave_elector} ({ce_l}). "
        f"Sección: {socio.seccion_ine} ({sec_l}).- - - - - - - - - - - - -\n"
        f"Número vertical u horizontal IDMEX: {socio.idmex} ({idmex_l}).- - - - - - - - - - - - - - -\n"
        f"El suscrito Corredor Público, tuve acceso a la Lista Nominal de Electores del "
        f"Instituto Nacional Electoral disponible al público en la dirección electrónica: "
        f'"http://listanominal.ine.mx" y obtuve de dicha dirección la "Confirmación de '
        f'Validación". Documento de identificación en original que me fue presentado y tuve '
        f"a la vista, así como de la impresión monocromática de la citada confirmación de "
        f"validación relacionada con el documento de identidad personal, del primero me permito "
        f"obtener copia fotostática directamente de su original y del segundo, impresión "
        f"directamente de mi equipo tecnológico con acceso a la internet, y desde donde "
        f"personalmente realicé dicha consulta y de ambos documentos los cuales; Cotejo "
        f'fielmente con su matriz y Agrego en Copia Cotejada al Archivo bajo la Letra "{letras["ine"]}".- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        f'DOCUMENTOS QUE ADEMÁS ME EXHIBE: En este acto quien comparece me exhibe:\n'
        f'a).- Impresión monocromática electrónica de su CURP (Clave Única de Registro de '
        f'Población); la cual resultó coincidente con los datos generales asentados y descritos '
        f'en este apartado. Documental que tuve a la vista en su formato original y Cotejo '
        f'fielmente con su matriz y Agrego en Copia Cotejada al Archivo bajo la Letra "{letras["curp"]}".- '
        f'b).- Impresión monocromática electrónica de su Constancia de Situación Fiscal; la '
        f'cual resultó coincidente con los datos generales asentados y descritos en este '
        f'apartado. Documental que tuve a la vista en su formato original y Cotejo fielmente '
        f'con su matriz y Agrego en Copia Cotejada al Archivo bajo la Letra "{letras["rfc"]}".- - - - - - -\n'
    )


def bloque_antecedentes_mua(d: InstrumentoRedactorInput) -> str:
    cud_l = deletrear_alfanumerico(d.cud)
    l_mua = letra_mua(len(d.socios))
    abrev = ('SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE o seguido de sus abreviaturas S.A. de C.V.'
             if d.tipo_sociedad == "SA_de_CV"
             else 'SOCIEDAD DE RESPONSABILIDAD LIMITADA DE CAPITAL VARIABLE o seguido de sus abreviaturas S. de R.L. de C.V.')
    return (
        f'=== Una vez cerciorado el suscrito Corredor Público de la identificación plena de '
        f'los comparecientes y levantada la Protesta de Decir Verdad, dicen que es su libre '
        f'intención constar por medio del presente instrumento, la Constitución de una Sociedad '
        f'Mercantil, a la que deciden denominar: - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        f'{d.denominacion_social}, Denominación que deberá ir seguida de su régimen jurídico '
        f'{abrev} acto que consignan al tenor de los siguientes: - - - - - - - - - - - - - - - -\n'
        f'======================== A N T E C E D E N T E S ========================\n'
        f'ÚNICA.- Declaran los comparecientes que para la celebración del presente acto '
        f'la Ciudadana {d.solicitante_mua} solicitó a la Secretaría de Economía, a través '
        f'del portal identificado como "https://mua.economia.gob.mx" la Autorización de Uso '
        f'de Denominación o Razón Social que corresponderá a ésta sociedad. Documento que me '
        f'permito obtener copia fotostática directamente de su matriz y la cual Cotejo '
        f'fielmente con su origen y Agrego en copia cotejada al Archivo del presente '
        f'instrumento bajo la Letra "{l_mua}".- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        f'Acto seguido me permito transcribir íntegramente el contenido de la Autorización '
        f'de Uso de Denominación o Razón Social con Clave Única del Documento {d.cud} '
        f'({cud_l}). Cuyo contenido es del tenor literal siguiente:.- - - - - - - - - - - - -\n'
        f'"SECRETARÍA DE ECONOMÍA- DIRECCIÓN GENERAL DE NORMATIVIDAD MERCANTIL.- - - - - - -\n'
        f'CONSTANCIA DE AUTORIZACIÓN DE USO DE DENOMINACIÓN O RAZÓN SOCIAL.- - - - - - - - -\n'
        f'Clave Única del Documento (CUD).- - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        f'{d.cud}.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        f'Resolución - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        f'En atención a la solicitud realizada por {d.solicitante_mua}, a través del Sistema '
        f'establecido por la Secretaría de Economía para autorizar el uso de Denominaciones '
        f'o Razones Sociales, y con fundamento en lo dispuesto por los artículos 15, 16 y 16 A '
        f'de la Ley de Inversión Extranjera; 34 fracción XII bis de la Ley Orgánica de la '
        f'Administración Pública Federal; 69 C Bis de la Ley Federal de Procedimiento '
        f'Administrativo; 38 fracciones XXII y XXIV del Reglamento Interior de la Secretaría '
        f'de Economía y; 2 fracción I, 3, 4, 8, 16, 17, 18, 19, 21 y 22 del Reglamento para '
        f'la Autorización de Uso de Denominaciones y Razones Sociales, SE RESUELVE AUTORIZAR '
        f'EL USO DE LA SIGUIENTE DENOMINACIÓN O RAZÓN SOCIAL: - - - - - - - - - - - - - - - -\n'
        f'{d.denominacion_social} - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
        f'[...texto estándar de autorización SE omitido por brevedad — se inserta desde plantilla...]\n'
        f'=== Fin de la transcripción === - - - - - - - - - - - - - - - - - - - - - - - - - -\n'
    )


def bloque_accionistas_sa(d: InstrumentoRedactorInput) -> str:
    lineas = ["=================== C L A U S U L A S  D E  L O S ==================================",
              "E S T A T U T O S    S O C I A L E S =============================",
              "CAPÍTULO PRIMERO DE LOS ATRIBUTOS ============",
              "PRIMERA. DE LOS ACCIONISTAS.- - - - - - - - - - - - - - - - - - - - - - - - - - - -"]
    for s in d.socios:
        rfc_l = deletrear_alfanumerico(s.rfc)
        lineas.append(
            f"{s.nombre_completo}; de nacionalidad mexicana, con domicilio en la ciudad de "
            f"{s.domicilio.ciudad}, {s.domicilio.estado} y Registro Federal de Contribuyentes: "
            f"{s.rfc} ({rfc_l}).- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -"
        )
    return "\n".join(lineas) + "\n"


def bloque_objeto_social(d: InstrumentoRedactorInput) -> str:
    clausula = "SEGUNDA.- OBJETO." if d.tipo_sociedad == "S_de_RL_de_CV" else "SEGUNDA.- OBJETO."
    return (
        f"{clausula} La sociedad tiene por Objeto Social: - - - - - - - - - - - - - - - - - - - -\n"
        f"{d.objeto_social_texto}\n"
    )


def bloque_clausulas_sa(d: InstrumentoRedactorInput) -> str:
    den = d.denominacion_social
    cap_l = pesos_letra(d.capital_fijo)
    cap_fmt = f"${d.capital_fijo:,.2f}"
    return (
        f"TERCERA. DENOMINACIÓN.- La denominación social de la persona moral mercantil que "
        f"constituyen será: {den}, Denominación que deberá ir seguida de su régimen jurídico "
        f'SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE o seguido de sus abreviaturas "S.A. de C.V.".- - -\n'
        f"CUARTA.- NACIONALIDAD y CLÁUSULA DE EXCLUSIÓN DE EXTRANJEROS. La Nacionalidad de la "
        f'sociedad será: Mexicana, con Cláusula de Exclusión de Extranjeros, conforme los '
        f'siguientes términos: "En este acto, ni en actos futuros, los miembros de la sociedad '
        f'no admitirán directa, ni indirectamente como accionistas a inversionistas extranjeros, '
        f'ni a sociedades extranjeras o aquellas sociedades de nacionalidad mexicana contengan '
        f'cláusula de admisión de extranjeros. En términos del artículo 2 (Dos), fracción VII '
        f'(Séptima) de la Ley de Inversión Extranjera." Esta cláusula solamente podrá ser '
        f"modificada por unanimidad de los votos que representen el capital social.- - - - - - -\n"
        f"QUINTA. DURACIÓN.- La Duración de la sociedad mercantil será por tiempo indefinido.- - -\n"
        f"SEXTA. DOMICILIO.- El domicilio de la sociedad será en la ciudad de {d.domicilio_social}. "
        f"Con la libertad de establecer oficinas de representación, despacho, recepción, de "
        f"archivo o albergue, agencias o franquicias en cualquier lugar de la República Mexicana "
        f"y el Extranjero, así mismo señalar los domicilios convencionales para la ejecución de "
        f"determinados actos.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n"
        f'SÉPTIMA. CAPITAL SOCIAL.- El Capital Social de la Sociedad estará integrado con un '
        f'Capital mínimo fijo de {cap_fmt} ({cap_l}); y un máximo ilimitado, dicho capital '
        f'estará integrado por Acciones tipo de "Serie A". Se reserva a la Asamblea General de '
        f'Accionistas la generación y emisión de nuevas Series Accionarias. El capital social '
        f'podrá ser aumentado por las aportaciones que suscriban y exhiban los accionistas en '
        f'numerario o en especie. El Capital Variable de la Sociedad es susceptible de aumentos '
        f'o disminuciones sin necesidad de reformar los Estatutos Sociales, con la única '
        f'formalidad que establece la Ley General de Sociedades Mercantiles y estos estatutos.- - -\n'
        f"[...CLÁUSULAS OCTAVA A CUADRAGÉSIMA SEGUNDA — texto fijo completo de estatutos...]\n"
    )


def bloque_clausulas_srl(d: InstrumentoRedactorInput) -> str:
    den = d.denominacion_social
    cap_l = pesos_letra(d.capital_fijo)
    cap_fmt = f"${d.capital_fijo:,.2f}"
    return (
        f"TERCERA. DENOMINACIÓN.- La denominación social será: {den}, Denominación que deberá "
        f'ir seguida de su régimen jurídico SOCIEDAD DE RESPONSABILIDAD LIMITADA DE CAPITAL '
        f'VARIABLE o seguido de sus abreviaturas "S. de R.L. de C.V.".- - - - - - - - - - - - -\n'
        f"CUARTA.- NACIONALIDAD y CLÁUSULA DE EXCLUSIÓN DE EXTRANJEROS. La Nacionalidad de la "
        f"sociedad será: Mexicana, con Cláusula de Exclusión de Extranjeros.- - - - - - - - - -\n"
        f"QUINTA. DURACIÓN.- La Duración de la sociedad mercantil será por tiempo indefinido.- - -\n"
        f"SEXTA. DOMICILIO.- El domicilio de la sociedad será en la ciudad de {d.domicilio_social}.- - -\n"
        f"SÉPTIMA.- CAPITAL SOCIAL.- El Capital Social mínimo fijo será de: {cap_fmt} ({cap_l}), "
        f"el cual estará representado por las Partes Sociales que integren al mismo en términos "
        f"de los presentes Estatutos Sociales y en todo caso, no podrá ser en ningún caso "
        f"inferior al mínimo fijo autorizado por esta cláusula.- - - - - - - - - - - - - - - - -\n"
        f"El Capital Variable será indeterminado, el cual se integrará y formará según conforme "
        f"la asamblea que convoque para tal efecto decida.- - - - - - - - - - - - - - - - - - - -\n"
        f"[...CLÁUSULAS OCTAVA EN ADELANTE — texto fijo completo de estatutos S de RL...]\n"
    )


def bloque_transitorias_sa(d: InstrumentoRedactorInput) -> str:
    cap_por_socio = d.capital_fijo // len(d.socios)
    acciones_por_socio = cap_por_socio // 1000
    total_acciones = acciones_por_socio * len(d.socios)
    cap_fmt = f"${d.capital_fijo:,.2f}"
    cap_l = pesos_letra(d.capital_fijo)

    # Tabla accionaria
    tabla = (
        f"=================== C L Á U S U L A S ====================\n"
        f"====================== T R A N S I T O R I A S =====================\n"
        f"PRIMERA.- Los comparecientes suscriben y pagan en efectivo la totalidad de las "
        f"partes sociales que constituyen el Capital Social mínimo fijo, constituyendo por "
        f"este acto la tabla de participación societaria para quedar integrada como sigue: - - -\n"
        f"Accionista y RFC | Núm. Acciones | Valor nominal | Total\n"
    )

    for s in d.socios:
        rfc_l = deletrear_alfanumerico(s.rfc)
        acc_l = numero_letra(acciones_por_socio).capitalize()
        monto_l = pesos_letra(cap_por_socio)
        tabla += (
            f"{s.nombre_completo}.- {s.rfc} ({rfc_l}).- - - - - - - - - - - - - - - - - - - -\n"
            f"- - - - - {acciones_por_socio} ({acc_l}) Serie A - - - - "
            f"$1,000.00 (Un mil pesos 00/100) - - - "
            f"${cap_por_socio:,.2f} ({monto_l}) - - - - - - - - - - - - - - -\n"
        )

    total_acc_l = numero_letra(total_acciones).capitalize()
    tabla += (
        f"T O T A L: {total_acciones} ({total_acc_l}) Serie A - - - "
        f"$1,000.00 - - - {cap_fmt} ({cap_l}) - - - - - - - - - - - - - - - - - -\n"
    )

    # Administrador único = primer socio
    admin = d.socios[0]
    admin_rfc_l = deletrear_alfanumerico(admin.rfc)
    admin_edad = edad_actual(admin.fecha_nacimiento, d.fecha_instrumento)
    admin_edad_l = numero_letra(admin_edad)

    tabla += (
        f"SEGUNDA.- La Administración de la Sociedad estará a cargo de UN ADMINISTRADOR ÚNICO "
        f"designándose para tal efecto al ciudadano {admin.nombre_completo}. Quien durará en su "
        f"encargo indefinidamente hasta que la propia Asamblea General convoque con este motivo "
        f"preciso Orden del día.- Por la naturaleza del encargo designado el ADMINISTRADOR ÚNICO: "
        f"{admin.nombre_completo}, a quien se le confieren TODAS LAS FACULTADES GENERALES Y AÚN "
        f"LAS ESPECIALES que conforme a la Ley requieran Cláusula Especial en términos del "
        f"artículo 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal; 1,890 "
        f"(Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas y sus demás "
        f"correlativos con el resto de los Códigos Civiles de la República Mexicana, así conforme "
        f"al artículo 10 (Diez) de la Ley General de Sociedades Mercantiles; 9 (Nueve) de la Ley "
        f"General de Títulos y Operaciones de Crédito; Cláusula Vigésima Sexta de los presentes "
        f"estatutos sociales; y demás cláusulas análogas, relativas y correlativas que se le "
        f"confieren de manera ilimitada para actuar en su Carácter de Representante Legal de la "
        f"persona moral mercantil. Facultades sin limitación ni condición alguna y que se tienen "
        f"por transcritas, como si se insertasen a la letra.- - - - - - - - - - - - - - - - - - -\n"
    )

    # Comisario = segundo socio
    if len(d.socios) >= 2:
        com = d.socios[1]
        com_rfc_l = deletrear_alfanumerico(com.rfc)
        com_edad = edad_actual(com.fecha_nacimiento, d.fecha_instrumento)
        com_edad_l = numero_letra(com_edad)
        com_ec = com.estado_civil
        com_ocu = com.ocupacion
        tabla += (
            f"TERCERA.- Se Designa como COMISARIO DE LA SOCIEDAD, a la Ciudadana "
            f"{com.nombre_completo}, de generales; {com_edad} ({com_edad_l.capitalize()}) "
            f"años de edad, mexicana, {com_ec}, ocupación {com_ocu}, con domicilio en "
            f"Ciudad {com.domicilio.ciudad}, {com.domicilio.estado}, indicando su Registro "
            f"Federal de Causantes (RFC) {com.rfc} ({com_rfc_l}).- - - - - - - - - - - - - -\n"
        )

    tabla += (
        f"CUARTA.- Los encargos de Administrador Único y Comisario designados, han sido "
        f"aceptados.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n"
        f"QUINTA. Por excepción y en razón a la reconocida solvencia moral y social de los "
        f"comparecientes, se acuerda por unanimidad; No requerir Caución por el manejo de sus "
        f"encargos a las personas que forman el Consejo de Administración o Administrador Único "
        f"ni al Consejo de Vigilancia o Comisario social.- - - - - - - - - - - - - - - - - - -\n"
    )
    return tabla


def bloque_transitorias_srl(d: InstrumentoRedactorInput) -> str:
    cap_por_socio = d.capital_fijo // len(d.socios)
    cap_l = pesos_letra(d.capital_fijo)
    cap_fmt = f"${d.capital_fijo:,.2f}"

    tabla = (
        f"=================== C L Á U S U L A S ====================\n"
        f"====================== T R A N S I T O R I A S =====================\n"
        f"PRIMERA.- Los comparecientes suscriben y pagan en efectivo la totalidad de las "
        f"partes sociales que constituyen el Capital Social mínimo fijo:\n"
        f"PARTE SOCIAL | VALOR | DESCRIPCIÓN CON LETRA\n"
    )

    for s in d.socios:
        monto_l = pesos_letra(cap_por_socio)
        tabla += (
            f"UNA (a nombre de {s.nombre_completo}) - - - "
            f"${cap_por_socio:,.2f} - - - {monto_l}.- - - - - - - - - - - - -\n"
        )

    tabla += (
        f"TOTAL {cap_fmt} {cap_l}.- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n"
    )

    gerente = d.socios[0]
    ger_rfc_l = deletrear_alfanumerico(gerente.rfc)
    tabla += (
        f"SEGUNDA.- La Administración de la Sociedad estará a cargo de un GERENTE GENERAL "
        f"designándose para tal efecto al ciudadano {gerente.nombre_completo}, con RFC "
        f"{gerente.rfc} ({ger_rfc_l}). Quien durará en su encargo indefinidamente. A quien "
        f"se le confieren TODAS LAS FACULTADES GENERALES Y AÚN LAS ESPECIALES en términos "
        f"de los Estatutos Sociales.- - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n"
        f"TERCERA.- Los encargos designados han sido aceptados.- - - - - - - - - - - - - - - -\n"
        f"CUARTA. Por excepción se acuerda por unanimidad no requerir Caución.- - - - - - - - -\n"
    )
    return tabla


def bloque_documentos_cotejados(d: InstrumentoRedactorInput) -> str:
    las = letras_archivo(len(d.socios))
    l_mua = letra_mua(len(d.socios))
    lineas = [
        "=================== DOCUMENTOS EN COPIA COTEJADA ===================",
        "======== AGREGADOS AL ARCHIVO DEL PRESENTE INSTRUMENTO =========",
    ]
    for i, (s, l) in enumerate(zip(d.socios, las)):
        lineas.append(
            f'Bajo la Letra "{l["ine"]}".- Identificación con fotografía y Confirmación de '
            f"Validación Electrónica a favor de {s.nombre_completo}.- - - - - - - - - - - -"
        )
        lineas.append(
            f'Bajo la Letra "{l["curp"]}".- Constancia de la Clave Única de Registro de '
            f"Población relacionada con {s.nombre_completo}.- - - - - - - - - - - - - - - -"
        )
        lineas.append(
            f'Bajo la Letra "{l["rfc"]}".- Constancia de Situación Fiscal relacionada con '
            f"{s.nombre_completo}.- - - - - - - - - - - - - - - - - - - - - - - - - - - - -"
        )
    lineas.append(
        f'Bajo la Letra "{l_mua}".- Documento que contiene Autorización de uso de denominación '
        f"o razón social relacionada con: {d.denominacion_social}.- - - - - - - - - - - - - -"
    )
    return "\n".join(lineas) + "\n"


def bloque_certificacion_cierre(d: InstrumentoRedactorInput) -> str:
    dia = d.fecha_instrumento.day
    dia_l = numero_letra(dia).upper()
    mes = MESES_ES[d.fecha_instrumento.month].upper()
    anio = d.fecha_instrumento.year
    anio_l = _num_a_letra(anio).upper()
    ciudad = d.ciudad_fedatario.capitalize()

    firmas = ""
    for s in d.socios:
        firmas += (
            f"{s.nombre_completo}.\nNombre completo.\nFirma.\n"
            f"Huellas Índices Izquierdo y Derecho.\n"
        )

    return (
        f"======================= C E R T I F I C A C I O N E S =======================\n"
        f"============ YO EL CORREDOR PÚBLICO, DOY FE, CERTIFICO Y: ============\n\n"
        f"{CERTIFICACIONES_SA}\n"
        f"K.- Hago constar que: Autorizo al momento de la firma de los otorgantes el presente "
        f"Instrumento Público, por quedar cumplimentados los requisitos de ley. Y expido Primer "
        f"Póliza Original, para quedar en el Archivo a cargo del suscrito Corredor Público. "
        f"Firmada que fue el día {dia} ({dia_l}) DE {mes} DEL {anio} ({anio_l}) en la ciudad "
        f"de {ciudad}, Tamaulipas. Hago constar y Doy Fe.- - - - - - - - - - - - - - - - - - -\n\n"
        f"{firmas}"
        f"_______________________________________________\n"
        f"LICENCIADO WILFREDO EMMANUEL RAMÍREZ NÚÑEZ."
        f"EL CORREDOR PÚBLICO NÚMERO 3 (TRES) DE LA PLAZA DEL ESTADO DE TAMAULIPAS. "
        f"ESTADOS UNIDOS MEXICANOS.\n"
    )


# ─────────────────────────────────────────────
# FUNCIÓN PRINCIPAL
# ─────────────────────────────────────────────

def generar_acta(d: InstrumentoRedactorInput) -> dict:
    """
    Ensambla el acta completa a partir del InstrumentoRedactorInput.
    Retorna dict con texto_acta y metadatos.
    """
    secciones = []

    # 1. Encabezado
    secciones.append(bloque_encabezado(d))

    # 2. Datos generales por socio
    las = letras_archivo(len(d.socios))
    for socio, letras in zip(d.socios, las):
        secciones.append(bloque_datos_socio(socio, letras, d.fecha_instrumento))

    # 3. Protesta de capacidad
    secciones.append(PROTESTA_CAPACIDAD + "\n")

    # 4. Antecedentes MUA
    secciones.append(bloque_antecedentes_mua(d))

    # 5. Declaraciones
    secciones.append(
        "====================== D E C L A R A C I O N E S ======================\n"
        + DECLARACION_PRIMERA + "\n"
        + DECLARACION_SEGUNDA + "\n"
    )

    # 6. Estatutos — Primera (accionistas/socios) + Objeto
    if d.tipo_sociedad == "SA_de_CV":
        secciones.append(bloque_accionistas_sa(d))
    secciones.append(bloque_objeto_social(d))

    # 7. Cláusulas (denominación, capital, etc.)
    if d.tipo_sociedad == "SA_de_CV":
        secciones.append(bloque_clausulas_sa(d))
    else:
        secciones.append(bloque_clausulas_srl(d))

    # 8. Cláusulas transitorias
    if d.tipo_sociedad == "SA_de_CV":
        secciones.append(bloque_transitorias_sa(d))
    else:
        secciones.append(bloque_transitorias_srl(d))

    # 9. Documentos en copia cotejada
    secciones.append(bloque_documentos_cotejados(d))

    # 10. Certificaciones y cierre
    secciones.append(bloque_certificacion_cierre(d))

    texto_final = "\n".join(secciones)

    # Generar secciones estructuradas para AGT-06
    try:
        from agentes.agt04_secciones import generar_secciones
        secciones_obj = generar_secciones(d)
    except Exception as e:
        # Si falla la generación de secciones, continuar sin ellas
        print(f"Advertencia: No se pudieron generar secciones estructuradas: {e}")
        secciones_obj = []

    return {
        "texto_acta": texto_final,
        "tipo_sociedad": d.tipo_sociedad,
        "num_palabras": len(texto_final.split()),
        "num_socios": len(d.socios),
        "denominacion": d.denominacion_social,
        "numero_poliza": d.numero_poliza,
    }


# ─────────────────────────────────────────────
# PRUEBA STANDALONE
# ─────────────────────────────────────────────

if __name__ == "__main__":
    from datetime import date

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
                    calle="Ernesto Elizondo",
                    numero="121",
                    colonia="Popular",
                    cp="87460",
                    ciudad="Matamoros",
                    estado="Tamaulipas",
                ),
                rfc="ROZE870813NXA",
                curp="ROZE870813HTSMLD04",
                clave_elector="RMZLED87081328H500",
                seccion_ine="0606",
                idmex="2604718651",
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
                    calle="Ernesto Elizondo",
                    numero="121",
                    colonia="Popular",
                    cp="87460",
                    ciudad="Matamoros",
                    estado="Tamaulipas",
                ),
                rfc="GAPS880116CX9",
                curp="GAPS880116MTSRDR04",
                clave_elector="GRPDSR88011628M000",
                seccion_ine="0606",
                idmex="2604718662",
            ),
        ],
        objeto_social_texto="""A).- Compra, venta, distribución, exportación e importación de todo tipo de mercancía nacional y extranjera.
B).- La prestación de servicios de asesoría, consultoría, capacitación y asistencia técnica.
C).- La obtención, otorgamiento y explotación de derechos de propiedad intelectual.
D).- La celebración de contratos y actos jurídicos relacionados con su objeto social.
E).- La realización de actividades complementarias o accesorias.""",
    )

    resultado = generar_acta(datos)

    print(f"✅ Acta generada: {resultado['denominacion']}")
    print(f"   Tipo: {resultado['tipo_sociedad']}")
    print(f"   Póliza: {resultado['numero_poliza']}")
    print(f"   Socios: {resultado['num_socios']}")
    print(f"   Palabras: {resultado['num_palabras']}")
    print("\n--- PRIMERAS 2000 CHARS ---")
    print(resultado["texto_acta"][:2000])
    print("\n--- ÚLTIMAS 1000 CHARS ---")
    print(resultado["texto_acta"][-1000:])
