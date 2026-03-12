"""
AGT-04 Secciones — módulo de secciones estructuradas.
Importado por agt04_redactor.generar_acta() para emitir secciones tipadas.
AGT-06 consume estas secciones para construir el .docx.
"""
from __future__ import annotations
from typing import List, Tuple

# Importar utilidades de agt04_redactor (mismo paquete)
from agentes.agt04_redactor import (
    numero_letra, _num_a_letra, fecha_letra, edad_actual,
    deletrear_alfanumerico, deletrear_cp, pesos_letra,
    letras_archivo, letra_mua, genero_str, MESES_ES,
)

Seg = Tuple[str, bool]
LINE_WIDTH = 79

def _r(t: str) -> Seg: return (t, False)
def _b(t: str) -> Seg: return (t, True)

def _g(previo: str = "") -> Seg:
    usado = len(previo.rstrip())
    faltantes = max(LINE_WIDTH - usado - 3, 4)
    relleno = ("- " * (faltantes // 2 + 2))[:faltantes].rstrip()
    return (f".- {relleno}", False)

def _enc(titulo: str) -> Seg:
    t = titulo.strip()
    espacio = LINE_WIDTH - len(t) - 2
    izq = max(espacio // 2, 2)
    der = max(espacio - izq, 2)
    return (f"{'=' * izq} {t} {'=' * der}", True)


class Seccion:
    __slots__ = ("tipo", "runs", "data")
    def __init__(self, tipo: str, runs: List[Seg] = None, **data):
        self.tipo = tipo
        self.runs = runs or []
        self.data = data
    def __repr__(self):
        p = ''.join(t for t,_ in self.runs)[:50]
        return f"<{self.tipo}: {p!r}>"

def _p(*runs: Seg) -> Seccion: return Seccion("parrafo", list(runs))
def _e(titulo: str) -> Seccion: return Seccion("encabezado", [_enc(titulo)])
def _v() -> Seccion: return Seccion("vacio", [])


def secciones_encabezado(d) -> List[Seccion]:
    poliza_l   = numero_letra(d.numero_poliza).upper()
    libro_l    = numero_letra(d.libro_registro).upper()
    dia_l      = numero_letra(d.fecha_instrumento.day).upper()
    mes        = MESES_ES[d.fecha_instrumento.month].upper()
    anio_l     = _num_a_letra(d.fecha_instrumento.year).upper()
    tipo_full  = ("SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE"
                  if d.tipo_sociedad == "SA_de_CV"
                  else "SOCIEDAD DE RESPONSABILIDAD LIMITADA DE CAPITAL VARIABLE")
    nombres    = " y ".join(s.nombre_completo for s in d.socios)
    den        = d.denominacion_social

    # Género del grupo de comparecientes
    todos_masculinos  = all(s.genero == "masculino" for s in d.socios)
    todos_femeninos   = all(s.genero == "femenino"  for s in d.socios)
    ciudadanos_label  = ("las Ciudadanas" if todos_femeninos
                         else "los Ciudadanos")

    # Línea 1 — tres encabezados juntos en el mismo párrafo del original
    lib_txt  = f"LIBRO DE REGISTRO {d.libro_registro} ({libro_l})"
    inst_txt = "I N S T R U M E N T O  P Ú B L I C O"
    pol_txt  = f"PÓLIZA NÚMERO {d.numero_poliza:,} ({poliza_l})"

    return [
        _p(_enc(lib_txt)),
        _p(_enc(inst_txt)),
        _p(_enc(pol_txt)),
        _v(),
        _p(
            _r(f"En la ciudad de {d.ciudad_fedatario}, TAMAULIPAS AL DÍA "
               f"{d.fecha_instrumento.day} ({dia_l}) DE {mes} DEL AÑO "
               f"{d.fecha_instrumento.year} ({anio_l})."),
            _g(f"EN LA CIUDAD DE {d.ciudad_fedatario}, TAMAULIPAS AL DÍA "
               f"{d.fecha_instrumento.day} ({dia_l}) DE {mes} DEL AÑO "
               f"{d.fecha_instrumento.year} ({anio_l})."),
        ),
        _p(
            _b("CERTIFICO Y HAGO CONSTAR QUE: "),
            _r(f"Ante mí, el suscrito LICENCIADO WILFREDO EMMANUEL RAMÍREZ NÚÑEZ, "
               f"CORREDOR PÚBLICO NÚMERO 3 (TRES) DE LA PLAZA DEL ESTADO DE TAMAULIPAS, "
               f"con Registro Federal de Contribuyentes: RANW, ocho, cinco, cero, seis, "
               f"dos, ocho, UW, tres. Comparecen en esta oficina de la Correduría Pública "
               f"Número 3 (Tres) de la Plaza de Tamaulipas, {ciudadanos_label} {nombres} quienes "
               f"expresan que es su intención solicitar los servicios del suscrito Fedatario "
               f"Público a fin de otorgar la "),
            _b("Constitución de una Sociedad Mercantil, "),
            _r(f"la que desean denominar: "),
            _b(f"{den}, "),
            _r(f"Denominación que deberá ir seguida de su régimen jurídico "),
            _b(tipo_full),
            _r(f" en los términos del presente instrumento. Acto continúo, declaran por "
               f"sus generales ser:"),
            _g(f"sus generales ser:"),
        ),
    ]


def secciones_datos_socio(socio, letras: dict, ref_date) -> List[Seccion]:
    edad   = socio.edad if getattr(socio, 'edad', None) is not None else edad_actual(socio.fecha_nacimiento, ref_date)
    edad_l = numero_letra(edad)
    fec_l  = fecha_letra(socio.fecha_nacimiento)
    dom    = socio.domicilio
    num_l  = numero_letra(int(__import__('re').sub(r'\D','', dom.numero or '0')))
    cp_l   = deletrear_cp(dom.cp)
    rfc_l  = deletrear_alfanumerico(socio.rfc)
    curp_l = deletrear_alfanumerico(socio.curp)
    ce_l   = deletrear_alfanumerico(socio.clave_elector)
    sec_l  = deletrear_alfanumerico(socio.seccion_ine)
    idmex_l= deletrear_alfanumerico(socio.idmex)
    nat    = genero_str(socio, "Mexicano por nacimiento", "Mexicana por nacimiento")
    orig   = genero_str(socio, "Originario de", "Originaria de")
    mes_nac= MESES_ES[socio.fecha_nacimiento.month]

    fec_completa = (f"{socio.fecha_nacimiento.day} ({fec_l.split()[0]}) "
                    f"de {mes_nac} del año {socio.fecha_nacimiento.year} "
                    f"({_num_a_letra(socio.fecha_nacimiento.year).capitalize()})")

    domicilio_txt = (f"Calle {dom.calle}. ")
    num_txt       = (f"{dom.numero} ({num_l.capitalize()}). ")
    col_txt       = (f"{dom.colonia}. ")
    cp_txt        = (f"{dom.cp} ({cp_l}). ")
    ciudad_txt    = (f"{dom.ciudad}. ")
    edo_txt       = (f"{dom.estado}. ")

    letra_ine  = letras["ine"]
    letra_curp = letras["curp"]
    letra_rfc  = letras["rfc"]

    return [
        _e(f"D A T O S  G E N E R A L E S"),
        _p(
            _b("Nombre completo: "),
            _b(socio.nombre_completo),
            _g(f"Nombre completo: {socio.nombre_completo}"),
        ),
        _p(
            _b("Nacionalidad: "),
            _r(f"{nat}. "),
            _b(f"{orig}: "),
            _r(socio.lugar_nacimiento),
            _g(f"Nacionalidad: {nat}. {orig}: {socio.lugar_nacimiento}"),
        ),
        _p(
            _b("Fecha de nacimiento: "),
            _r(f"{fec_completa}. "),
            _b("Edad actual: "),
            _r(f"{edad} ({edad_l.capitalize()}) años. "),
            _b("Estado civil: "),
            _r(f"{socio.estado_civil}. "),
            _b("Ocupación: "),
            _r(socio.ocupacion),
            _g(f"Ocupación: {socio.ocupacion}"),
        ),
        _p(
            _b("Dice que su Domicilio está en: "),
            _r(f"Calle {dom.calle}. "),
            _b("Número: "),
            _r(num_txt),
            _b("Colonia o Fraccionamiento: "),
            _r(col_txt),
            _b("Código Postal: "),
            _r(cp_txt),
            _b("Ciudad: "),
            _r(ciudad_txt),
            _b("Estado: "),
            _r(edo_txt),
            _b("País: "),
            _r("México"),
            _g("País: México"),
        ),
        _p(
            _b("RFC (Registro Federal de Contribuyentes): "),
            _r(f"{socio.rfc} ({rfc_l})"),
            _g(f"RFC: {socio.rfc} ({rfc_l})"),
        ),
        _p(
            _b("CURP (Clave Única de Registro de Población): "),
            _r(f"{socio.curp} ({curp_l})"),
            _g(f"CURP: {socio.curp} ({curp_l})"),
        ),
        _p(
            _b("Identificación de quien comparece.- "),
            _r("El suscrito Corredor Público en términos de la Ley Federal de Correduría "
               "Pública y su Reglamento, me permito asegurarme de la identidad de la persona "
               "que comparece con identificación con fotografía la cual es coincidente con sus "
               "rasgos fisionómicos y es: "),
            _b("Credencial para votar con fotografía, "),
            _r("expedida por el Instituto Nacional Electoral"),
            _g("expedida por el Instituto Nacional Electoral"),
        ),
        _p(
            _b("Número de Clave de Elector: "),
            _r(f"{socio.clave_elector} ({ce_l}). "),
            _b("Sección: "),
            _r(f"{socio.seccion_ine} ({sec_l})"),
            _g(f"Sección: {socio.seccion_ine} ({sec_l})"),
        ),
        _p(
            _b("Número vertical u horizontal IDMEX: "),
            _r(f"{socio.idmex} ({idmex_l})"),
            _g(f"IDMEX: {socio.idmex} ({idmex_l})"),
        ),
        _p(
            _r("El suscrito Corredor Público, tuve acceso a la Lista Nominal de Electores del "
               "Instituto Nacional Electoral disponible al público en la dirección electrónica: "),
            _b('"http://listanominal.ine.mx"'),
            _r(' y obtuve de dicha dirección la '),
            _b('"Confirmación de Validación"'),
            _r(". Documento de identificación en original que me fue presentado y tuve a la "
               "vista, así como de la impresión monocromática de la citada confirmación de "
               "validación relacionada con el documento de identidad personal, del primero me "
               "permito obtener copia fotostática directamente de su original y del segundo, "
               "impresión directamente de mi equipo tecnológico con acceso a la internet, y "
               "desde donde personalmente realicé dicha consulta y de ambos documentos los cuales; "),
            _b(f'Cotejo fielmente con su matriz y Agrego en Copia Cotejada al Archivo bajo la Letra "{letra_ine}"'),
            _g(f'Archivo bajo la Letra "{letra_ine}"'),
        ),
        _p(
            _b("DOCUMENTOS QUE ADEMÁS ME EXHIBE: "),
            _r("En este acto quien comparece me exhibe:"),
        ),
        _p(
            _b("a).- "),
            _r("Impresión monocromática electrónica de su CURP (Clave Única de Registro de "
               "Población); la cual resultó coincidente con los datos generales asentados y "
               "descritos en este apartado. Documental que tuve a la vista en su formato "
               "original y "),
            _b(f'Cotejo fielmente con su matriz y Agrego en Copia Cotejada al Archivo bajo la Letra "{letra_curp}"'),
            _g(f'Letra "{letra_curp}"'),
        ),
        _p(
            _b("b).- "),
            _r("Impresión monocromática electrónica de su Constancia de Situación Fiscal; "
               "la cual resultó coincidente con los datos generales asentados y descritos en "
               "este apartado. Documental que tuve a la vista en su formato original y "),
            _b(f'Cotejo fielmente con su matriz y Agrego en Copia Cotejada al Archivo bajo la Letra "{letra_rfc}"'),
            _g(f'Letra "{letra_rfc}"'),
        ),
    ]


def secciones_protesta() -> List[Seccion]:
    return [
        _p(
            _b("PROTESTA DE CAPACIDAD NATURAL Y CIVIL. – "),
            _r('Expresan los comparecientes que: "Bajo Protesta de Decir Verdad, manifiesto '
               'ser la misma persona que aparece en los documentos de identidad personal, así '
               'mismo manifiesto no tener incapacidad natural o civil para celebrar e intervenir '
               'en el presente acto jurídico, apercibido plenamente del delito en que incurro si '
               'falto a la verdad, en términos del Código Penal del Estado de Tamaulipas."'),
            _g('"Código Penal del Estado de Tamaulipas."'),
        ),
    ]


def secciones_antecedentes(d) -> List[Seccion]:
    cud_l  = deletrear_alfanumerico(d.cud)
    l_mua  = letra_mua(len(d.socios))
    abrev  = ('SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE o seguido de sus abreviaturas S.A. de C.V.'
              if d.tipo_sociedad == "SA_de_CV"
              else 'SOCIEDAD DE RESPONSABILIDAD LIMITADA DE CAPITAL VARIABLE o seguido de sus abreviaturas S. de R.L. de C.V.')
    den        = d.denominacion_social
    # Normalizar nombre del solicitante (puede venir con saltos de línea del PDF)
    solicitante = ' '.join(d.solicitante_mua.split())

    secs_ant = [
        _p(
            _r("Una vez cerciorado el suscrito Corredor Público de la identificación plena "
               "de los comparecientes y levantada la Protesta de Decir Verdad, dicen que es "
               "su libre intención constar por medio del presente instrumento, la Constitución "
               "de una Sociedad Mercantil, a la que deciden denominar:"),
            _g("denominar:"),
        ),
        _p(
            _b(f"{den}, "),
            _r(f"Denominación que deberá ir seguida de su régimen jurídico {abrev} "
               f"acto que consignan al tenor de los siguientes:"),
            _g("siguientes:"),
        ),
        _e("A N T E C E D E N T E S"),
        _p(
            _b("ÚNICA.- "),
            _r(f"Declaran los comparecientes que para la celebración del presente acto "
               f"la persona {solicitante} solicitó a la Secretaría de Economía, a través "
               f'del portal identificado como "https://mua.economia.gob.mx" la Autorización de '
               f"Uso de Denominación o Razón Social que corresponderá a ésta sociedad. Documento "
               f"que me permito obtener copia fotostática directamente de su matriz y la cual "),
            _b(f'Cotejo fielmente con su origen y Agrego en copia cotejada al Archivo del presente instrumento bajo la Letra "{l_mua}"'),
            _g(f'Letra "{l_mua}"'),
        ),
        _p(
            _r(f"Acto seguido me permito transcribir íntegramente el contenido de la "
               f"Autorización de Uso de Denominación o Razón Social con "),
            _b(f"Clave Única del Documento {d.cud} ({cud_l})."),
            _r(" Cuyo contenido es del tenor literal siguiente:"),
            _g("tenor literal siguiente:"),
        ),
        # Transcripción SE
        _p(_b('"SECRETARÍA DE ECONOMÍA- DIRECCIÓN GENERAL DE NORMATIVIDAD MERCANTIL.'),
           _g('"SECRETARÍA DE ECONOMÍA- DIRECCIÓN GENERAL DE NORMATIVIDAD MERCANTIL.')),
        _p(_b("CONSTANCIA DE AUTORIZACIÓN DE USO DE DENOMINACIÓN O RAZÓN SOCIAL."),
           _g("CONSTANCIA DE AUTORIZACIÓN DE USO DE DENOMINACIÓN O RAZÓN SOCIAL.")),
        _p(_b("Clave Única del Documento (CUD)."), _g("Clave Única del Documento (CUD).")),
        _p(_b(f"{d.cud}."), _g(f"{d.cud}.")),
        _p(_b("Resolución"), _g("Resolución")),
        _p(
            _r(f"En atención a la solicitud realizada por {solicitante}, a través del "
               f"Sistema establecido por la Secretaría de Economía para autorizar el uso de "
               f"Denominaciones o Razones Sociales, y con fundamento en lo dispuesto por los "
               f"artículos 15, 16 y 16 A de la Ley de Inversión Extranjera; 34 fracción XII bis "
               f"de la Ley Orgánica de la Administración Pública Federal; 69 C Bis de la Ley "
               f"Federal de Procedimiento Administrativo; 38 fracciones XXII y XXIV del "
               f"Reglamento Interior de la Secretaría de Economía y; 2 fracción I, 3, 4, 8, 16, "
               f"17, 18, 19, 21 y 22 del Reglamento para la Autorización de Uso de "
               f"Denominaciones y Razones Sociales, SE RESUELVE AUTORIZAR EL USO DE LA "
               f"SIGUIENTE DENOMINACIÓN O RAZÓN SOCIAL:"),
            _g("DENOMINACIÓN O RAZÓN SOCIAL:"),
        ),
        _p(_b(f"{den}"), _g(den)),
    ]

    # Leyenda de resolución completa del CUD (extraída del PDF por extractor_cud.py)
    resolucion = getattr(d, 'texto_resolucion', '') or ''
    if resolucion.strip():
        resolucion_limpia = ' '.join(resolucion.split())
        secs_ant.append(_p(_r(resolucion_limpia), _g(resolucion_limpia[-50:])))

    secs_ant.append(_p(_b("=== Fin de la transcripción ==="), _g("===")))
    return secs_ant


def secciones_declaraciones() -> List[Seccion]:
    return [
        _e("D E C L A R A C I O N E S"),
        _p(
            _b("PRIMERA.- "),
            _r("Declaran los comparecientes que es su libre consentimiento otorgar el presente "
               "acto jurídico y que su voluntad no se encuentra afectada por dolo, violencia, "
               "mala fe o algún otro vicio que pudiera afectar la validez del presente acto "
               "jurídico, por lo que es su firme intención, otorgar y consignar el presente, "
               "al tenor del presente instrumento."),
            _g("instrumento."),
        ),
        _p(
            _b("SEGUNDA.- "),
            _r("Declaramos que de conformidad con lo dispuesto por el artículo 22 (Veintidós) "
               "del Reglamento para la Autorización de Uso de Denominaciones y Razones Sociales "
               "nuestra sociedad que pretende usar una Denominación o Razón Social tendrá las "
               "obligaciones siguientes:"),
            _g("siguientes:"),
        ),
        _p(
            _b("I (Primero).- "),
            _r("Responder por cualquier daño, perjuicio o afectación que pudiera causar el uso "
               "indebido o no autorizado de la Denominación o Razón Social otorgada mediante la "
               "presente Autorización, conforme a la Ley de Inversión Extranjera y al Reglamento "
               "para la Autorización de Uso de Denominaciones y Razones Sociales, y;"),
            _g("Razones Sociales, y;"),
        ),
        _p(
            _b("II (Segundo).- "),
            _r("Proporcionar a la Secretaría de Economía la información y documentación que le "
               "sea requerida por escrito o a través del Sistema en relación con el uso de la "
               "Denominación o Razón Social otorgada mediante la presente Autorización, al "
               "momento de haberla reservado, durante el tiempo en que se encuentre en uso, y "
               "después de que se haya dado el Aviso de Liberación respecto de la misma."),
            _g("de la misma."),
        ),
    ]


def secciones_accionistas_sa(d) -> List[Seccion]:
    secs = [
        _e("C L Á U S U L A S  D E  L O S  E S T A T U T O S  S O C I A L E S"),
        _e("C A P Í T U L O  P R I M E R O  D E  L O S  A T R I B U T O S"),
        _p(_b("PRIMERA. DE LOS ACCIONISTAS."), _g("PRIMERA. DE LOS ACCIONISTAS.")),
    ]
    for s in d.socios:
        rfc_l = deletrear_alfanumerico(s.rfc)
        txt = (f"de nacionalidad mexicana, con domicilio en la ciudad de "
               f"{s.domicilio.ciudad}, {s.domicilio.estado} y Registro Federal "
               f"de Contribuyentes: {s.rfc} ({rfc_l}).")
        secs.append(_p(_b(f"{s.nombre_completo}; "), _r(txt), _g(txt)))
    return secs


def secciones_objeto_social(d) -> List[Seccion]:
    secs = [
        _p(
            _b("SEGUNDA.- OBJETO. "),
            _r("La sociedad tiene por Objeto Social:"),
            _g("La sociedad tiene por Objeto Social:"),
        ),
    ]
    for linea in d.objeto_social_texto.strip().split('\n'):
        l = linea.strip()
        if not l:
            continue
        m = __import__('re').match(r'^([A-ZÁÉÍÓÚÑ]\)\.-?\s*)', l)
        if m:
            inciso = m.group(1)
            resto  = l[len(inciso):]
            secs.append(_p(_b(inciso), _r(resto), _g(resto)))
        else:
            secs.append(_p(_r(l), _g(l)))
    return secs


def secciones_clausulas_sa(d) -> List[Seccion]:
    den    = d.denominacion_social
    cap_l  = pesos_letra(d.capital_fijo)
    cap_fmt= f"${d.capital_fijo:,.2f}"

    return [
        _p(_b("TERCERA. DENOMINACIÓN.- "),
           _r(f"La denominación social de la persona moral mercantil que constituyen será: "),
           _b(den),
           _r(', Denominación que deberá ir seguida de su régimen jurídico '),
           _b('SOCIEDAD ANÓNIMA DE CAPITAL VARIABLE o seguido de sus abreviaturas "S.A. de C.V."'),
           _g('"S.A. de C.V."')),
        _p(_b("CUARTA.- NACIONALIDAD y CLÁUSULA DE EXCLUSIÓN DE EXTRANJEROS. "),
           _r('La Nacionalidad de la sociedad será: Mexicana, con Cláusula de Exclusión de '
              'Extranjeros, conforme los siguientes términos: "En este acto, ni en actos '
              'futuros, los miembros de la sociedad no admitirán directa, ni indirectamente '
              'como accionistas a inversionistas extranjeros, ni a sociedades extranjeras o '
              'aquellas sociedades de nacionalidad mexicana contengan cláusula de admisión de '
              'extranjeros. En términos del artículo 2 (Dos), fracción VII (Séptima) de la '
              'Ley de Inversión Extranjera." Esta cláusula solamente podrá ser modificada por '
              'unanimidad de los votos que representen el capital social.'),
           _g("capital social.")),
        _p(_b("QUINTA. DURACIÓN.- "),
           _r("La Duración de la sociedad mercantil será por tiempo indefinido."),
           _g("tiempo indefinido.")),
        _p(_b("SEXTA. DOMICILIO.- "),
           _r(f"El domicilio de la sociedad será en la ciudad de {d.ciudad_fedatario}, TAMAULIPAS. Con la libertad de "
              "establecer oficinas de representación, despacho, recepción, de archivo o "
              "albergue, agencias o franquicias en cualquier lugar de la República Mexicana "
              "y el Extranjero, así mismo señalar los domicilios convencionales para la "
              "ejecución de determinados actos."),
           _g("determinados actos.")),
        _p(_b("SÉPTIMA. CAPITAL SOCIAL.- "),
           _r(f"El Capital Social de la Sociedad estará integrado con un Capital mínimo fijo "
              f"de {cap_fmt} ({cap_l}); y un máximo ilimitado, dicho capital estará integrado "
              f'por Acciones tipo de "Serie A". Se reserva a la Asamblea General de Accionistas '
              f"la generación y emisión de nuevas Series Accionarias. El capital social podrá "
              f"ser aumentado por las aportaciones que suscriban y exhiban los accionistas en "
              f"numerario o en especie. El Capital Variable de la Sociedad es susceptible de "
              f"aumentos o disminuciones sin necesidad de reformar los Estatutos Sociales, con "
              f"la única formalidad que establece la Ley General de Sociedades Mercantiles y "
              f"estos estatutos."),
           _g("estos estatutos.")),
    ]



def secciones_clausulas_sa_cap2_7(d) -> List[Seccion]:
    """Capítulos 2 al 7 de los estatutos SA de CV (OCTAVA a CUADRAGÉSIMA SEGUNDA)."""
    n_acc = d.capital_fijo // 1000
    n_acc_l = numero_letra(int(n_acc)).capitalize()

    return [
        _e("C A P I T U L O  S E G U N D O"),
        _e("D E  L A S  A C C I O N E S"),

        _p(_b("OCTAVA. VALOR DE CADA ACCIÓN.- "),
           _r(f"Las Acciones del Capital Fijo serán nominativas y cada una con valor indivisible. Cada Acción tipo de Serie \"A\" representa un Valor Nominal de $1,000.00 (Un mil pesos 00/100 en Moneda Nacional). Resultando {n_acc} ({n_acc_l}) acciones nominativas. El Capital mínimo fijo no estará sujeto a retiro."),
           _g("minativas. El Capital mínimo fijo no estará sujeto a retiro.")),

        _p(_b("NOVENA. REPRESENTACIÓN DE LAS ACCIONES.- "),
           _r("Las acciones estarán representadas por Títulos nominativos los cuales podrán estar o no impresos. En caso de estar impresos, contendrán la Cláusula de Exclusión de Extranjeros, las firmas autógrafas del Administrador Único o del Presidente del Consejo de Administradores y del Comisario de la sociedad, además de contener las menciones a que se refiere el artículo 125 (Ciento veinticinco) de la Ley General de Sociedades Mercantiles e inserta la Cláusula de Exclusión de Extranjeros. Un título accionario podrá amparar una o varias acciones. Los títulos accionarios podrán ser firmados electrónicamente en los mismos términos de esta cláusula. No podrá existir un título de acciones firmado de manera autógrafa y otro igual de manera electrónica. Los accionistas pueden solicitar por canje la actualización de un título de acciones autógrafo por uno electrónico y viceversa, durante los últimos 4 (Cuatro) bimestres de cada año. En ningún caso, se expedirán títulos o certificados provisionales."),
           _g("gún caso, se expedirán títulos o certificados provisionales.")),

        _p(_b("DÉCIMA. ACCIONES DE SERIE Y CLASE DIVERSA.- "),
           _r("En el caso de que llegaren a emitirse Acciones de diversa Serie, por razón de preferencia o de diversas participaciones en los dividendos o por los conceptos que adopte legalmente la asamblea, todas las acciones dentro de su clase y especie, confieren a sus tenedores los mismos derechos e imponen las mismas obligaciones en lo que se refiere: A).- Participación de Utilidades; B).- Distribución de Pérdidas hasta por el importe del valor a la parte de cada Acción suscrita; C).- La participación en las Asambleas Generales de Accionistas Especiales a los de su Serie de clase y especie; D).- Derecho de Preferencia concurrente en caso de ventas y transmisiones accionarias de cualquier clase y especie; E).- Y otros derechos u obligaciones consignados en estos Estatutos a los de su clase y especie o por disposición de la Ley. Existen solamente 2 (Dos) clases de acciones; Clase I (Primera) y Clase II (Segunda), las cuales tienen las siguientes características: Clase I (Primera).- Representan el Capital Social Fijo y estarán integradas por una sola clase de Serie accionaria, la de Serie \"A\". Clase II (Segunda).- Representan el Capital Social Variable y estarán integradas por las Series accionarias que la Asamblea General de Accionistas constituya y emita para tales efectos."),
           _g("eneral de Accionistas constituya y emita para tales efectos.")),

        _p(_b("DÉCIMA PRIMERA. DE LA CALIDAD DE ACCIONISTA.- "),
           _r("Todo accionista, por el hecho de serlo, se somete y queda sujeto a las estipulaciones contenidas en este instrumento y a las resoluciones legalmente adoptadas por cualquier Asamblea General de Accionistas. La sociedad reconocerá como Accionista a quien este registrado con tal carácter en el Libro de Registro de Accionistas, salvo ordenamiento Judicial."),
           _g("bro de Registro de Accionistas, salvo ordenamiento Judicial.")),

        _p(_b("DÉCIMA SEGUNDA. DERECHO DE PREFERENCIA O DEL TANTO.- "),
           _r("Todos los Accionistas de cualquier Clase y Serie, concurren al Derecho de Preferencia y/o del Tanto para la compra o adquisición de acciones en los términos de esta cláusula. Las acciones que se deseen transmitir por medio de cualquier título legal deberán estar debidamente suscritas y pagadas, y los accionistas que deseen ejercer el derecho de preferencia y/o del tanto, deberán sus acciones propias estar debidamente suscritas y pagadas. El proceso para la ejecución de dicho ejercicio será el siguiente: A). El accionista transmisor enterará al Órgano de Administración mediante Notificación indubitable, preferentemente a través de Fedatario Público su intención de transmisión el cual contendrá las condiciones generales de venta y/o transmisión. B).- El Órgano de administración contará con un plazo de 5 (cinco) días hábiles para notificar por cualquier medio que estime conveniente a la totalidad de los Accionistas. C).- Los accionistas receptores, contarán con 15 (quince) días hábiles inmediatos posteriores o a fecha determinada conteniendo el mínimo de término en este punto que señale el Órgano de administración. D).- Los plazos y términos correrán en igualdad de circunstancias para todos los accionistas, y para tal efecto, los accionistas privilegiarán la notificación electrónica vía correo electrónico que tenga registrado en el Libro de Registro de Accionistas. En caso de que transcurran los días a que se refiere el párrafo anterior sin que se manifieste interés de algún accionista en la adquisición bajo las condiciones de transmisión, el accionista transmisor podrá ofrecer libremente las acciones en venta. Reglas de exclusión.- En el supuesto que dos o más accionistas desearen hacer uso del Derecho de Preferencia y/o del Tanto, sobre una o unas mismas acciones ofertadas a transmisión o adquisición por cualquier medio o título, se sujetarán a las siguientes reglas de exclusión: A).- Se reserva preferentemente el ejercicio de la oferta al accionista en proporción al mayor número de sus acciones, conforme el artículo 132 (Ciento treinta y dos) de la Ley General de Sociedades Mercantiles. B).- Se reserva preferentemente el ejercicio de la oferta al accionista que haya hecho plena y más anticipada notificación al ofertante transmisor de la o las acciones. C).- De manera excepcional los accionistas concurrentes al derecho de preferencia y/o del Tanto, podrán celebrar un sorteo, solo cuando los accionistas concurrentes lo decidan por unanimidad y establezcan las reglas especiales y específicas para dicho sorteo. El administrador único, secretario y tesorero serán testigos de asistencia y en cualquier caso, no podrán ser menos de dos testigos de asistencia. En caso de no existir convenio unánime sobre el sorteo de acciones, los puntos normativos anteriores se excluyen entre sí, de acuerdo al orden en que se encuentran enunciados."),
           _g("tre sí, de acuerdo al orden en que se encuentran enunciados.")),

        _p(_b("DÉCIMA TERCERA. FORMA DE TRANSMISIÓN DE ACCIONES.- "),
           _r("El traspaso, cesión, o compraventa de acciones se verificará por endoso y entrega del Título de Acciones correspondiente, sin perjuicio de que puedan transmitirse por cualquier otro medio legal y su tramitación surtirá efectos respecto del endosatario o cesionario, desde la fecha del endoso o de la transmisión por cualquier concepto y en respecto de la sociedad desde su inscripción en el Libro de Registro de Acciones. Cualquier transmisión de acciones, por cualquier título o medio legal, deberá previamente haber agotado el procedimiento del derecho de preferencia y/o del tanto. Cuando la sociedad a través de su Órgano de Administración reciba Aviso de Traspaso o Cesión de una o más acciones firmadas por el endosante o cedente, o cuando se le presente el título correspondiente en que se haga constar el endoso, cesión, compraventa o la transmisión, el Secretario del Consejo de Administradores o a falta de éste el Administrador Único, hará constancia de la transmisión en el Libro de Registro de Acciones. A petición del nuevo propietario accionista y a su costa se expedirán los nuevos títulos de acciones mediante canje, en su caso. En todo lo demás se estará conforme lo dispuesto en la Sección Segunda, Capitulo Uno, Titulo Primero de la Ley General de Títulos y Operaciones de Crédito vigente. Cualquier traspaso, cesión, compraventa o transmisión por cualquier título que se practique en contrario a lo dispuesto por estos estatutos, serán nulos."),
           _g("n contrario a lo dispuesto por estos estatutos, serán nulos.")),

        _p(_b("DÉCIMA CUARTA. AUMENTOS AL CAPITAL SOCIAL.- "),
           _r("Los Aumentos del Capital Social podrán ser fijados únicamente por resolución tomada por la Asamblea General Extraordinaria de Accionistas. Las acciones deberán estar íntegramente pagadas, incluso aquellas de clase y serie distinta. Al tomarse los acuerdos respectivos, la Asamblea General Extraordinaria de Accionistas que decrete el aumento o cualquier Asamblea Extraordinaria posterior, fijará los términos y condiciones en que deba llevarse a cabo dicho aumento. Los accionistas gozarán del derecho preferente para suscribir los nuevos aumentos de capital conforme estos estatutos en proporción al número de sus acciones, conforme al artículo 132 (Ciento treinta y dos) de la Ley General de Sociedades Mercantiles."),
           _g("treinta y dos) de la Ley General de Sociedades Mercantiles.")),

        _p(_b("DÉCIMA QUINTA. REDUCCIONES AL CAPITAL SOCIAL.- "),
           _r("Las Reducciones al Capital Social solo podrán llevarse a cabo por resolución tomada por la Asamblea General Extraordinaria de Accionistas, en términos de este instrumento. Para este caso los accionistas renuncian al derecho de retiro que les concede los artículos 220 (Doscientos veinte) de la Ley General de Sociedades Mercantiles y demás correlativos con estos estatutos y la propia ley de ídem. Reducciones al Capital Social como resultado de pérdidas o reembolsos, se realizarán sin más formalidades y se ajustarán a las siguientes reglas: A).- Aplicación general en forma proporcional al número de acciones que posea cada accionista. B).- Toda reducción se hará por acciones íntegras. C).- Tan pronto como se decrete una disminución, la resolución deberá notificarse a cada accionista, concediéndole el derecho a amortizar sus acciones en proporción a la reducción del capital decretado; dicho derecho deberá ejercitarse dentro de los 15 (Quince) días siguientes, contados a partir de la notificación. D).- Si dentro del plazo antes señalado el accionista solicitará el reembolso de un número de acciones igual al capital reducido individualmente, se reembolsará a este y surtirá efectos hasta el fin del ejercicio anual en curso, si fuere antes del último trimestre de dicho ejercicio, y si fuere después, la reducción surtirá efectos hasta el fin del ejercicio siguiente. E).- Si las solicitudes de reembolso excedieron al Capital Social mínimo, el monto de la reducción se distribuirá para su amortización por los accionistas sobrevivientes y se procederá al reembolso en la fecha que para tal fin se hubiere determinado. F).- En todos los casos No Podrá ejercitarse el derecho de separación cuando tenga como consecuencia reducir a menos del mínimo el Capital Social."),
           _g("o consecuencia reducir a menos del mínimo el Capital Social.")),

        _e("C A P I T U L O  T E R C E R O"),
        _e("M A N E R A  E N  Q U E  S E  A D M I N I S T R A R Á  L A  S O C I E D A D"),
        _e("Y  F A C U L T A D E S  D E  A D M I N I S T R A D O R E S  Y  F U N C I O N A R I O S"),

        _p(_b("DECIMA SEXTA. EL ÓRGANO SUPREMO DE LA SOCIEDAD.- "),
           _r("El Órgano Supremo de la Sociedad es la Asamblea General de Accionistas, las cuales podrán ser Ordinarias y Extraordinarias. En ambos casos se celebrarán en el Domicilio Social, salvo caso fortuito o causa de fuerza mayor. Las Asambleas Generales Ordinarias serán las que tengan por objeto tratar cualquier asunto enumerado en el Artículo 181 (Ciento ochenta y uno) de la Ley General de Sociedades Mercantiles, o para cualquier otro que no se encuentre en los enumerados en el artículo 182 (Ciento ochenta y dos), de dicho ordenamiento, las cuales podrán celebrarse en cualquier tiempo, pero por lo menos una vez al año. Y para que esta se considere legalmente reunida, será necesario que esté representado, por lo menos, el 75% (Setenta y cinco por ciento), de las acciones emitidas, y para que las resoluciones de dichas Asambleas Ordinarias se consideren válidas se necesitará el voto afirmativo de Acciones que representen cuando menos el 51% (Cincuenta y uno por ciento), del capital social. Las Asambleas Generales Extraordinarias serán las que tengan por objeto tratar cualquiera de los asuntos enumerados en el Artículo 182 (Ciento ochenta y dos) de la Ley General de Sociedades Mercantiles. A fin de que una Asamblea General Extraordinaria se considere legalmente reunida, será necesario que estén representadas por lo menos, la mitad más una de las acciones emitidas, y para que las resoluciones se consideren válidas se necesitará el voto afirmativo de la mayoría de las acciones representadas."),
           _g("voto afirmativo de la mayoría de las acciones representadas.")),

        _p(_b("DÉCIMA SÉPTIMA. DE LAS CONVOCATORIAS A LAS ASAMBLEAS.- "),
           _r("La Convocatoria a las Asambleas Generales de Accionistas, deberá hacerlas el Administrador único, y/o el Consejo de Administración por conducto del Presidente, y contener firma del Comisario, por medio de publicación en el portal electrónico denominado \"Publicaciones de Sociedades Mercantiles\" a través de la dirección electrónica http://www.psm.economica.gob.mx con por lo menos 5 (Cinco) días hábiles de anticipación. En todos los casos las Convocatorias de Asamblea contendrá: Denominación y/o razón social, fecha y hora de celebración, la ubicación exacta aun cuando sea el Domicilio social conocido, la Orden del día y firma de quien convoque."),
           _g("social conocido, la Orden del día y firma de quien convoque.")),

        _p(_b("DÉCIMA OCTAVA. CASOS EN QUE NO SE EMITIRÁ CONVOCATORIA.- "),
           _r("No será necesaria, la Convocatoria cuando los concurrentes a una Asamblea representen el total de las acciones emitidas, tampoco en el caso de que una asamblea se suspenda por cualquier causa para continuarse en hora y fecha diferente. Así mismo cuando en Asamblea previa se encuentre representado el total de las acciones emitidas y se convoque a una posterior, quedando claramente asentada en el Acta de la Asamblea en sesión. Los accionistas que se encuentren presentes en las asambleas que se celebren a través de medios electrónicos, ópticos o de cualquier otra tecnología surtirán los mismos efectos como si se encontrasen personal y físicamente presentes."),
           _g("tos como si se encontrasen personal y físicamente presentes.")),

        _p(_b("DÉCIMA NOVENA. REPRESENTACIÓN EN LAS ASAMBLEAS.- "),
           _r("Los Accionistas podrán recurrir a la Asamblea personalmente o por medio de apoderado especial, representándose por carta poder simple que contenga la mención de la convocatoria y la orden del día, podrá enunciativamente señalar la indicación de su voto, y cualquier limitación para su encargo. Los Accionistas podrán hacerse acompañar de terceros, siempre que solicite y exprese mediante misiva firmada, los motivos y razones por las cuales considera necesario acompañarse de terceros y notifique de manera indubitable previamente al órgano de administración con 3 (Tres) días de anticipación dicho razonamiento, el nombre completo del acompañante así como copia fotostática de una identificación con fotografía; los terceros acompañantes no participarán en ningún sentido en el desarrollo de la asamblea, ni tendrán derecho de voz, salvo que en la asamblea general de accionistas por unanimidad de los accionistas presentes, deseen concederla. En todos los casos los acompañantes no podrán realizar grabaciones de cualquier tipo durante, previo o posterior a la asamblea, alterar el orden, salir del recinto y volver a intentar ingresar una vez que haya iniciado la sesión, no podrá aconsejar, comentar, aleccionar, dictar o influir de manera alguna al accionista acompañado. El ingreso de Fedatarios Públicos a las asambleas, serán admitidos y se regirán bajo las mismas reglas y términos previstos para los acompañantes. La Representación de accionistas, no será admisible para aquellos accionistas que deseen darse por presentes en asambleas que se celebren a través de medios electrónicos, ópticos o de cualquier otra tecnología, salvo que dicha representación sea previamente autorizada a la celebración de la asamblea por el órgano de administración de la sociedad."),
           _g("la asamblea por el órgano de administración de la sociedad.")),

        _p(_b("VIGÉSIMA. INSTALACIÓN DE UNA ASAMBLEA.- "),
           _r("A la Instalación de la Asamblea, el funcionario que la presida nombrará uno o más escrutadores, quienes certificarán el número de acciones representadas y formarán Lista de Asistencia, con expresión del número de acciones que cada uno represente. Una vez lo anterior se hará constar la existencia de Quórum Legal, el o la Secretario certificará dicha actuación y con ésta, el Presidente declarará instalada la Asamblea, procediendo inmediatamente a desahogar la Orden del Día, presidiendo y moderando los debates. Se considera legalmente instalada la Asamblea General de Accionistas ya sea ordinaria o extraordinaria, por la asistencia y certificación del quórum cuando éste se encuentre representado por el 51% (Cincuenta y un por ciento) de las Acciones que representen el Capital Social de la sociedad. En caso de no encontrarse dicho quórum, el Presidente mandará convocar en segunda convocatoria en los términos previstos en estos estatutos y en lo no previsto conforme a la Ley General de Sociedades Mercantiles. El o la Secretario de la asamblea, tomará nota de las mociones, discusiones, aprobaciones y los términos de las mismas; en todo caso podrá practicar resumen de lo discutido anotándose lo estrictamente indispensable, salvo que durante la sesión la persona en uso de la voz, desee hacer una manifestación y solicite previamente a su expresión, que se haga la nota puntual y literal de su posición o argumento. Los accionistas podrán celebrar asambleas fuera del domicilio social, siempre que la totalidad de los accionistas lo aprueben. En cualquier caso se privilegiará la utilización de medios electrónicos, ópticos o de cualquier otra tecnología a fin de facilitar el acceso y participación de la totalidad de los accionistas."),
           _g("l acceso y participación de la totalidad de los accionistas.")),

        _p(_b("VIGÉSIMA PRIMERA. PRESIDENTE DE LA ASAMBLEA.- "),
           _r("Presidirá la Asamblea General de Accionistas; el Presidente del Consejo de Administración o el Administrador Único en su caso y a falta de estos, el Secretario o el primer o segundo Escrutador, nombrado y designado en el mismo acto. Él o la Secretario de la Asamblea será nombrado por el Presidente de la Asamblea en Sesión, o quien se designe mediante votación mayoritaria."),
           _g("en Sesión, o quien se designe mediante votación mayoritaria.")),

        _p(_b("VIGÉSIMA SEGUNDA. ACATAMIENTO DE LAS RESOLUCIONES.- "),
           _r("Las Resoluciones de la Asamblea General, tomadas en los términos de este instrumento legalmente, obligan a todos los accionistas, aún a los ausentes o disidentes, y serán definitivas y sin ulterior recurso."),
           _g("es o disidentes, y serán definitivas y sin ulterior recurso.")),

        _p(_b("VIGÉSIMA TERCERA. ASAMBLEAS POR SEGUNDA CONVOCATORIA.- "),
           _r("Si en una Asamblea General de Accionistas, debidamente convocada, no hubiere Quórum de instalación, se repetirá íntegramente la convocatoria fijándose como fecha de celebración en los 5 (Cinco) días hábiles siguientes a celebrarse en el mismo lugar y hora, debiéndose anotar la Leyenda Precautoria de: \"En Segunda Convocatoria\" la que se efectuará y celebrará sin demora alguna con el número de accionistas que en ella estuvieren, conforme a la Ley General de Sociedades Mercantiles. Dicho llamamiento en segunda convocatoria deberá publicarse en el portal electrónico de \"Publicaciones de Sociedades Mercantiles\" conforme al primer párrafo de la Cláusula Décima Séptima de los Estatutos Sociales."),
           _g("afo de la Cláusula Décima Séptima de los Estatutos Sociales.")),

        _p(_b("VIGÉSIMA CUARTA. DEL ÓRGANO DE ADMINISTRACIÓN.- "),
           _r("El Órgano de Administración de la Sociedad, estará a cargo de un Administrador Único o de un Consejo de Administración, que se compondrá del número de miembros titulares y suplentes que señale la propia Asamblea que los seleccione. El Administrador o los Consejeros durarán en sus cargos indefinidamente hasta que se convoque a asamblea para tal efecto. Si la administración se encomienda a un Consejo de Administración, se compondrá de un Presidente, un Secretario, y un Tesorero; en cualquier caso los miembros del Órgano de Administración podrán ser o no accionistas. Los miembros del Órgano de Administración, otorgarán caución para garantizar el debido cumplimiento de las facultades que se le encomiendan, dicha garantía será equivalente a una Acción nominativa tipo de Serie \"A\"; dicha caución deberá pagarse su equivalente a la Tesorería de la sociedad a través del Secretario de la Asamblea en que se designe."),
           _g("ad a través del Secretario de la Asamblea en que se designe.")),

        _p(_b("VIGÉSIMA QUINTA. ESTRUCTURA DE REPRESENTACIÓN ORGÁNICA.- "),
           _r("La Sociedad adopta una estructura orgánica, por la que la Asamblea General, su Administrador Único, Presidente del Consejo de Administradores o el propio Consejo de Administradores, podrán otorgar y conferir facultades generales y especiales, temporales y revocables a Gerentes, Directores y Funcionarios de la sociedad a fin de que realicen actividades generales, específicas y/o especiales concernientes al Objeto Social y Cumplimiento de la Administración Social. El otorgamiento de dichas facultades podrá ser general o especial, en términos del artículo 10 (Diez) de la Ley General de Sociedades Mercantiles; 2,554 (Dos mil quinientos cincuenta y cuatro) y 27 (Veintisiete) del Código Civil Federal; 1,890 (Mil ochocientos noventa) del Código Civil del Estado de Tamaulipas; y 6 (Seis) del Reglamento de la Ley Federal de Correduría Pública."),
           _g("eis) del Reglamento de la Ley Federal de Correduría Pública.")),

        _p(_b("VIGÉSIMA SEXTA. OTORGAMIENTO DE FACULTADES.- "),
           _r("Para la Administración de la sociedad y en todo a lo que ello se refiere, el Administrador Único, Presidente del Consejo de Administración o el Consejo de Administración en su caso, tendrá las más amplias facultades legales que le corresponden conforme a la Ley Civil, de Comercio, Títulos y Operaciones de Crédito, Mercantil, Laboral, Fiscal, Contencioso Administrativo, para Pleitos y Cobranzas, Actos de Administración y de Pleno Dominio, y tendrán el carácter de Representante Legal de la Sociedad, invistiéndole absolutamente de todas las facultades señaladas expresamente en el presente apartado y además de aquellas que les confieren las demás leyes federales y estatales a los de su clase, sin limitación, por lo que de manera enunciativa, más no limitativa, ejercerán: A).- Facultades Generales para PLEITOS Y COBRANZAS; con la amplitud del primer párrafo del Artículo 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal y su correlativo al Artículo 1,890 (Mil ochocientos noventa), del Código Civil vigente para el Estado de Tamaulipas. Con todas las facultades generales y con las especiales que requieren mención o cláusula especial conforme a la Ley, sin limitación alguna e inclusive con las facultades a que se refiere el Artículo 2,582 (Dos mil quinientos ochenta y dos), aun las enumeradas en el Artículo 2,587 (Dos mil quinientos ochenta y siete) del Código Civil Federal y sus correlativos de cualquier entidad de la República Mexicana mismos que se tienen aquí por mencionados y reproducidos como si se insertasen a la letra, facultades expuestas de manera enunciativa pero no limitativa. Expresamente, pero no limitativa, se le confiere las siguientes facultades: Desistirse del juicio de Amparo, otorgar y suscribir toda clase de documentos públicos y privados, hacer manifestaciones, renuncias, protestas, aun las establecidas por la Constitución Política de los Estados Unidos Mexicanos y para comparecer y ejercer sus facultades ante toda clase de personas, de autoridades o dependencias, judiciales y administrativas, civiles, penales, agrarias y del trabajo (especialmente para articular y absolver posiciones) federales o locales, en juicio o fuera del, con la mayor amplitud posible y expresamente: Presentar quejas, querellas, denuncias, ratificarlas y ampliarlas, desistirse de las mismas y constituirse en tercero coadyuvante del Ministerio Público, otorgar perdón judicial, en su caso, aportar pruebas, solicitar quiebras y en general, para iniciar proseguir y dar por término en cualquier forma a toda clase de recursos, arbitrajes y procedimientos de cualquier orden inclusive desistirse de instancias y procedimientos. B).- Facultades Generales para ejercer ACTOS DE ADMINISTRACIÓN; con la amplitud del segundo párrafo del Artículo 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal y su homólogo del segundo párrafo del Artículo 1,890 (Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas. Con todas las facultades generales y con las especiales que requieren mención o cláusula especial conforme a la Ley, sin limitación alguna, y conforme a sus correlativos de cualquier entidad de la República Mexicana mismos que se tienen aquí por mencionados y reproducidos como si se insertasen a la letra, facultades expuestas de manera enunciativa pero no limitativa. Expresamente, pero no limitativa, se le confiere las siguientes facultades: Para suscribir contratos, convenios y en general ejercer actos de administración en representación de su representado, sean gestiones o negocios locales, estatales o federales incluso de índole tributario ante la Secretaria de Hacienda y Crédito Público (SHCP) y sus departamentos adyacentes, centrales, dependientes, filiales y de cualquier jurisdicción, el Servicio de Administración Tributaria (SAT), ante el Instituto Mexicano Del Seguro Social (IMSS), Instituto del Fondo Nacional de la Vivienda para los Trabajadores (INFONAVIT) y sus correspondientes departamentos gubernamentales, personas físicas y morales, privadas y públicas de cualquier jerarquía jurisdiccional. Facultades para solicitar, tramitar, apersonarse, gestionar, obtener licencias, permisos, autorizaciones para el correcto funcionamiento y ejecución del objeto social de la empresa, esta facultad podrá ejercerla ante cualquier persona física o moral, pública o privada, nacional o extranjera, administrativa, jurisdiccional, militar y cualquier otra sin limitación de competencia territorial, material o jurisdiccional. C).- Facultades Generales para ADMINISTRAR BIENES; en los amplios términos del párrafo segundo del Artículo 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal y su correlativo del Artículo 1,890 (Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas. D).- Facultades Generales en MATERIA ADMINISTRATIVA para apersonarse ante el Servicio de Administración Tributaria y demás oficinas de gobierno, especialmente ante la Secretaria de Hacienda y Crédito Público, Servicio de Administración Tributaria, Instituto Mexicano del Seguro Social, Instituto del Fondo Nacional de la Vivienda para los Trabajadores, sus oficinas, dependencias, coordinaciones, subadministraciones, direcciones y demás a fin de cumplimentar los actos administrativos, legales y de defensa que correspondan, sea en la jurisdicción territorial del domicilio social y en cualquier otra de la República Mexicana. Especialmente se les confiere facultades respecto a los actos de cumplimiento conforme al Código Fiscal de la Federación y su Reglamento para solicitar y obtener la inscripción en el Registro Federal de Contribuyente, Firma electrónica avanzada, sellos digitales y cualquier otro procedimiento análogo y demás gestiones y trámites administrativos que ocurran y sean necesarios para el correcto funcionamiento y cumplimiento de la naturaleza de la presente persona moral mercantil. E).- Facultades Generales para Actos de ADMINISTRACIÓN HUMANA; en lo relativo a las relaciones Laborales, comparecer con Representación Legal de la Empresa ante las Autoridades del Trabajo, Juntas de Conciliación y Arbitraje, Federales como Locales y ante las Autoridades Administrativas del Trabajo, y de los juicios de amparo a que se refieren los conflictos laborales, a efecto de que, por lo que toca a la etapa de avenencia y conciliación con las facultades de administración necesarias para comprometer y concurrir representando a la empresa, llegando a su caso a los acuerdos, interviniendo en las pláticas directas con los funcionarios respectivos, con facultades especiales para transigir y convenir dentro del proceso o etapa del arbitraje, contestar la demanda, oponiendo excepciones y defensas en su caso, reconviniendo, ofreciendo y rindiendo pruebas y como mandatario especial, en representación de la empresa para absolver posiciones teniendo facultades que establecen los Artículos 2,554 (Dos mil quinientos cincuenta y cuatro), primero y segundo párrafo y 2,587 (Dos mil quinientos ochenta y siete) del Código Civil Federal, y su correlativo Artículo 1,890 (Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas; y en los Artículos 11 (Once), 692 (Seiscientos noventa y dos) fracciones II (Segunda) y III (Tercera), 788 (Setecientos ochenta y ocho), 879 (Ochocientos setenta y nueve) y demás relativos aplicables de la Ley Federal del Trabajo, bien entendido que como funcionario de la empresa, deberá rendir cuenta del ejercicio de este mandato a los órganos superiores de la empresa cuya política e instrucciones imperativamente deberá seguir. Lo que incluye celebrar toda clase de Contratos y Actos Jurídicos en nombre de la Empresa. a).- Para administrar la cartera de empleados, nómina, entero de cuotas al Instituto Mexicano del Seguro Social, Instituto del Nacional de la Vivienda para los Trabajadores, así como dar avisos informativos como cambio de domicilio social o fiscal, dar de alta en el Registro Federal de Contribuyentes y sus respectivos avisos, Firma Electrónica y demás trámites y gestiones que sean necesarios para el legal cumplimiento administrativo de la empresa. b).- Para administrar la cartera contable, fiscal y tributaria de la empresa. c).- Para la gestión de cualquier trámite administrativo ante cualquier autoridad judicial, jurisdiccional, administrativa de cualquiera de sus tres niveles de gobierno, federal, estatal o municipal, incluyendo las paraestatales, fondos públicos, institutos, etcétera. F).- Facultades Generales para ACTOS DE DOMINIO, con la amplitud del tercer párrafo del Artículo 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal y conforme su homólogo 1,890 (Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas, especialmente para disponer, vender, hipotecar, permutar y comprometer en todo o en parte bienes y derechos de la sociedad, rentar tomar en arrendamiento toda clase de bienes, así como otorgar y cancelar fianzas. En general celebrar toda clase de contratos y actos jurídicos relativos a los bienes y derechos de la empresa que incluye el comprar toda clase de bienes muebles e inmuebles a nombre de la empresa. Esta cláusula podrá ser limitada y condicional en cuanto a su cuantía, lo que deberá de expresarse y ordenarse en los otorgamientos de facultades, designaciones de nombramientos de funcionarios o apoderados; a falta de disposición limitativa se entenderá amplia y sin limitación alguna. G).- Facultades Generales para ACTOS CAMBIARIOS PARA SUSCRIBIR TÍTULOS DE CRÉDITO; en los términos del Artículo 9° (Noveno) de la Ley General de Títulos y Operaciones de Crédito, con las siguientes facultades: a).- Manejar Cuentas de cheques de la Sociedad. b).- Otorgar, suscribir, emitir, avalar, endosar, negociar y en cualquier forma operar títulos de crédito de toda clase, así como obligar cambiariamente a la Sociedad. Se confieren facultades para que, de manera enunciativa, más no limitativa actúe en la apertura de cuentas bancarias, autorizar, remover o revocar firmantes, solicitar productos y servicios financieros. H).- Facultades Generales para NOMBRAR Y REMOVER, gerentes, subgerentes, directores, agentes y demás empleados, factores y dependientes; señalándole sus facultades y enumeraciones, ejecutar los acuerdos de las Asambleas Generales y de socios, aunque no tengan facultad expresa y firmar por medio de las personas que al efecto designen toda clase de documentos relacionados directamente con los objetos de la sociedad. I).- Facultades Generales para Otorgar toda clase de comisiones, encomiendas, facultades para representar a la sociedad frente a terceros con cláusulas generales y especiales, así como revocar los mismos. Los Poderes, Mandatos, encomiendas o representaciones que otorgue la Asamblea General, el Administrador Único o el Consejo de Administración, no implicarán en ningún caso la Delegación de la Administración, a los Apoderados, Funcionarios facultados y/o Representantes Legales, amén que se señale específica y especialmente tal acto. J).- Facultades Generales para DELEGAR Y REVOCAR PODERES; sean generales o especiales, siempre que el Órgano de Administración que lo consigne tenga en función y vigencia tales facultades. K).- Facultades Generales para Establecer Sucursales, agencias, dependencias, u oficinas de negocios, en cualquier parte de la República Mexicana y en el extranjero. L).- Facultades Generales para Representar a la Sociedad cuando forme parte de otras sociedades, comprando o suscribiendo partes sociales o participaciones, o bien interviniendo como parte en su constitución. M).- Todas las Facultades que las leyes otorgan a los de su clase, sin limitación alguna, por lo que podrá el negocio y representar a la sociedad y llevar la firma social ante toda clase de personas y autoridades."),
           _g("r la firma social ante toda clase de personas y autoridades.")),

        _e("C A P I T U L O  C U A R T O"),
        _e("F U N C I O N A R I O S"),

        _p(_b("VIGÉSIMA SÉPTIMA.- FUNCIONARIOS.- "),
           _r("La Asamblea General de Accionistas o el Consejo de Administración en su caso, podrá designar Directores para las diversas áreas de la empresa, Gerentes, Apoderados, Factores o cualquier otro funcionario que consideren necesario para la representación de la firma social, ejecución de la administración y/o representación de la sociedad. A estos funcionarios se les podrá otorgar facultades de representación, generales o especiales, bastando para ello hacer referencia a los diversos incisos de la Cláusula Vigésima Sexta de estos Estatutos Sociales cuando se trate de facultades generales, o cuando se trate de facultades especiales, se deberán relacionar expresamente las facultades con sus subincisos e indicación de ser una facultad especial. En ambos casos podrán limitarse dichas facultades y en caso de no indicar expresión, se entenderá sin limitación. Para que surtan efectos las facultades que se otorguen a los funcionarios anteriores, se deberá protocolizar ante Fedatario Público el acta en que conste el acuerdo relativo. En el caso de nombramientos hechos por el Consejo de Administración se protocolizará el acta del nombramiento mediante la ratificación de la firma del Presidente del Consejo. Todos los cargos conferidos al amparo de los dos primeros párrafos de esta cláusula, podrán ser renunciados por las personas que las ostenten, pero su responsabilidad frente a la sociedad se extinguirá únicamente por las formas y en los plazos previstos en la ley, y comprenderá desde el momento de su aceptación al cargo y hasta el momento de su renuncia, que surtirá efectos a los 10 (Diez) días naturales posteriores de haberla presentado a cualquiera de los administradores o miembros del consejo de administración."),
           _g("os administradores o miembros del consejo de administración.")),

        _p(_b("VIGÉSIMA OCTAVA. DE LOS GERENTES ESPECIALES ADMINISTRATIVOS.- "),
           _r("La sociedad contará de forma ordinaria con uno o más GERENTES ESPECIALES ADMINISTRATIVOS, distintos en su naturaleza jurídica, los cuales durarán en su encargo de manera indefinida. Este cargo no es renunciable, mismo que deberá otorgar la caución que fije la Asamblea, el Administrador o el Consejo de Administración y al que se le fijará la remuneración que se crea conveniente. El nombramiento como GERENTE ESPECIAL ADMINISTRATIVO podrá realizarlo la Asamblea de Accionistas en asamblea ordinaria o el Consejo de Administración por mayoría de votos y no requerirá de protocolización por fedatario, por tratarse de un puesto de representación orgánica previsto en los estatutos sociales. Para su funcionamiento y el ejercicio de sus facultades no se requerirá protocolización del acta en la que conste su nombramiento, ni mayor formalidad que la requerida para la validez de las Asambleas Ordinarias o la validez de las reuniones del Consejo de Administración, pero la remoción de la persona que ostente dicho cargo deberá realizarse de la misma forma como se realizó el nombramiento. El GERENTE ESPECIAL ADMINISTRATIVO gozará de todas las facultades orgánicas de representación que la asamblea asigne. El nombramiento de GERENTE ESPECIAL ADMINISTRATIVO podrá ostentarse y ejercitarse junto con cualquier otro nombramiento de GERENTE ESPECIAL, así como con cualquier otro nombramiento de APODERADO o DIRECTOR."),
           _g("omo con cualquier otro nombramiento de APODERADO o DIRECTOR.")),

        _p(_b("VIGÉSIMA NOVENA. DE LOS GERENTES ESPECIALES JURÍDICOS.- "),
           _r("La sociedad contará de forma ordinaria con uno o más GERENTES ESPECIALES JURÍDICOS, distintos en su naturaleza jurídica, de los funcionarios previstos por los primeros tres párrafos de este artículo, de duración indefinida a partir de que se realice el nombramiento de la persona que ostentará el cargo y cuyo cargo no es renunciable, mismo que deberá otorgar la caución que fije la Asamblea, el Administrador o el Consejo de Administración y al que se le fijará la remuneración que se crea conveniente. El nombramiento como GERENTE ESPECIAL JURÍDICO podrá realizarlo la Asamblea de Accionistas en asamblea ordinaria o el Consejo de Administración mediante simple acuerdo que conste por escrito, o el Consejo de Administración por mayoría de votos y no requerirá de protocolización por fedatario, por tratarse de un puesto de representación orgánica previsto en los estatutos sociales. Para su funcionamiento y el ejercicio de sus facultades no se requerirá protocolización del acta en la que conste su nombramiento, ni mayor formalidad que la requerida para la validez de las Asambleas Ordinarias o la validez de las reuniones del Consejo de Administración, pero la remoción de la persona que ostente dicho cargo deberá realizarse de la misma forma como se realizó el nombramiento. El GERENTE ESPECIAL JURÍDICO deberá ser abogado o licenciado en derecho o hacerse acompañar por uno cuando no lo sea, y gozará de todas las facultades orgánicas de representación que se enuncian en el artículo vigésimo noveno, subincisos \"B\" Facultades para pleitos y cobranzas, y actos de administración en materia laboral, \"d) Facultades en materia fiscal\", \"h) Facultades de sustitución\" y \"N) Todas las facultades que las leyes otorgan a los de su clase\" de los Estatutos Sociales. El nombramiento de GERENTE ESPECIAL JURÍDICO podrá ostentarse y ejercitarse junto con cualquier otro nombramiento de GERENTE ESPECIAL, así como con cualquier otro nombramiento de APODERADO o DIRECTOR."),
           _g("omo con cualquier otro nombramiento de APODERADO o DIRECTOR.")),

        _p(_b("TRIGÉSIMA. DEL DIRECTOR GENERAL.- "),
           _r("El DIRECTOR GENERAL será designado por Asamblea General de Accionistas, Órgano de administración, Administrador Único o el Consejo de Administración y tendrá las funciones de gestión, conducción y ejecución de los negocios diarios de la Sociedad quién se sujetará a las estrategias, políticas y lineamientos aprobados por el Consejo de Administración. El Director General contará con las facultades para representar a la Sociedad que le otorgue el Consejo de Administración al momento de su designación, así como todas las facultades previstas en los incisos \"A\" a la \"H\" y \"L\" y \"N\" de la Cláusula Vigésima Sexta de los estatutos sociales, con la limitante de que el Director General no podrá ejercer las facultades previstas en el inciso \"F\" (Facultades generales de dominio) por sí, sino que deberá ejercerla de forma mancomunada y conjunta con cualquiera de los miembros del Consejo de Administración. El Director General tendrá las siguientes facultades: A).- Someter a la aprobación del Consejo de Administración, las estrategias de negocio de la Sociedad. B).- Asistir a las asambleas de Accionistas de la Sociedad y dar cumplimiento a los acuerdos de las Asambleas de Accionistas y del Consejo de Administración, conforme a las instrucciones que, en su caso, dicte la propia Asamblea o el Consejo de Administración. C).- Suscribir la información relevante de la Sociedad, junto con los Funcionarios encargados de su preparación. D).- Dar cumplimiento a las disposiciones relativas a la celebración de operaciones de adquisición y colocación de Acciones propias de la Sociedad. E).- Verificar que se realice el pago de las aportaciones o suscripciones de capital hechas por los Accionistas. F).- Dar cumplimiento a los requisitos legales y de estos Estatutos Sociales respecto de los dividendos que se paguen a los Accionistas. G).- Asegurar que se mantengan los sistemas de contabilidad, registro, archivo o información de la Sociedad. H).- Elaborar y presentar al Consejo de Administración el informe a que se refiere el artículo 172 (Ciento setenta y dos) de la Ley General de Sociedades Mercantiles, con excepción de lo previsto en el inciso b) de dicho precepto. I).- Establecer los mecanismos y controles internos que permitan verificar que los actos y operaciones de la Sociedad se hayan apegado a la normatividad aplicable, así como dar seguimiento a los resultados de esos mecanismos y controles internos. J).- Ejercer las acciones de responsabilidad referidas en la Ley del Mercado de Valores, en contra de personas relacionadas o terceros que presumiblemente hubieren ocasionado un daño a la Sociedad, salvo que por determinación del Consejo de Administración el daño causado no sea relevante. K).- Las demás establecidas en la Ley del Mercado de Valores, estos Estatutos Sociales y las que la Asamblea de Accionistas o el Consejo de Administración le otorguen."),
           _g("a de Accionistas o el Consejo de Administración le otorguen.")),

        _e("C A P I T U L O  Q U I N T O"),
        _e("C O N S E J O  D E  A D M I N I S T R A C I Ó N ,  V I G I L A N C I A  Y  C A U C I Ó N"),

        _p(_b("TRIGÉSIMA PRIMERA. SESIONES DEL CONSEJO DE ADMINISTRACIÓN.- "),
           _r("Las Sesiones del Consejo de Administración o las Asambleas Generales de Accionistas, se celebrarán en los términos generales que indica el apartado respectivo a las Asambleas Generales de Accionistas en este instrumento. Para el caso de las Sesiones del Consejo de Administración para constituir Quórum será necesario la mayoría de los miembros del Consejo, y las resoluciones se tomarán por el voto afirmativo de la mayoría de los miembros presentes; en caso de empate o discordancia, el Presidente del Consejo, tendrá Voto de Calidad. Si el número de consejeros presentes no constituyen Quórum, deberá aplazarse la sesión hasta que lo haya. De toda sesión del Consejo de Administración o de las Asambleas, se levantará un Acta la cual deberá asentarse en el Libro de Actas respectivo y firmado por el Presidente, quien haya fungido como Secretario de la Asamblea, o el Administrador Único y Secretario."),
           _g("tario de la Asamblea, o el Administrador Único y Secretario.")),

        _p(_b("TRIGÉSIMA SEGUNDA. DE LA VIGILANCIA DE LA SOCIEDAD.- "),
           _r("La vigilancia de la sociedad estará a cargo de uno o más Comisarios, quienes podrán ser o no accionistas. Los comisarios serán electos anualmente por la Asamblea Ordinaria Anual de Accionistas y tendrán los derechos y obligaciones que les confiere el Artículo 166 (Ciento sesenta y seis) y sus correlativos de la Ley General de Sociedades Mercantiles y durarán en su cargo un año o hasta que sus sucesores hayan sido electos y tomen posesión de sus puestos."),
           _g("ucesores hayan sido electos y tomen posesión de sus puestos.")),

        _p(_b("TRIGÉSIMA TERCERA. DE LAS CAUCIONES Y REMUNERACIONES.- "),
           _r("Tanto el Administrador Único, Presidente del Consejo de Administración y los miembros de dicho Consejo, así como los Gerentes, Directores y el Comisario, garantizarán su desempeño con el Depósito en la sociedad, el equivalente desde 1 (Una) hasta 50 (Cincuenta) acciones de tipo de \"Serie A\", en su equivalente en dinero en efectivo, según determine la Asamblea General, dependiendo del encargo y función de la actividad del funcionario, y en casos excepcionales podrá ordenar la Asamblea General se garantice paralelamente mediante fianza expedida por Institución Afianzadora autorizada. Las devoluciones de las Cauciones respecto a las depositadas en la Sociedad se refieren, le serán devueltas al funcionario una vez que hayan sido aprobadas las cuentas correspondientes al término de su encargo. A los funcionarios sujetos a Cauciones, tendrán salvado el derecho de recibir emolumentos, bonos y remuneraciones, los que serán determinados en algunos casos en el momento de su nombramiento o serán calculados y autorizados al momento de ser aprobadas las cuentas correspondientes por la Asamblea General de Accionistas. En cualquier caso, las cauciones y remuneraciones deberán estar autorizadas por la Asamblea General de Accionistas, que deba decidir específicamente sobre este punto en el Orden del Día."),
           _g("ecidir específicamente sobre este punto en el Orden del Día.")),

        _p(_b("TRIGÉSIMA CUARTA. INFORMACIÓN FINANCIERA.- "),
           _r("Al fin de cada ejercicio social, se preparará un Balance General que deberá incluir la documentación financiera que indica el Artículo 162 (Ciento sesenta y dos) de la Ley General de Sociedad Mercantiles, y Aprobarse en la Asamblea General Ordinaria de Accionistas. Los encargados de presentar el Balance General y el Comisario su Informe o Reporte, deberán poner a disposición del Órgano de Administración por duplicado y por lo menos 15 (Quince) días hábiles antes de la fecha de Celebración de la Asamblea que deba aprobarlos."),
           _g("la fecha de Celebración de la Asamblea que deba aprobarlos.")),

        _p(_b("TRIGÉSIMA QUINTA. CONSERVACIÓN DE DOCUMENTACIÓN Y DEMÁS ELEMENTOS DE LA SOCIEDAD.- "),
           _r("El Administrador Único o el Presidente del Consejo de Administradores, en sobre debidamente cerrado, resguardará los documentos que contengan contraseñas, sellos de autorizar, cheques, pagarés, dispositivos electrónicos de verificación bancaria y demás documentos provistos por autoridades hacendarias y bancarias para la identificación del cliente o contribuyente, debiendo hacer entrega de tal sobre en la Asamblea General Ordinaria al nuevo Administrador Único o Consejo de Administradores; y este se asegurará de recibir fielmente los documentos y dispositivos que el o los funcionarios salientes le señalen que contiene dicho sobre."),
           _g("funcionarios salientes le señalen que contiene dicho sobre.")),

        _e("C A P I T U L O  S E X T O"),
        _e("D E L  E J E R C I C I O  S O C I A L  E  I N F O R M A C I Ó N  F I N A N C I E R A"),

        _p(_b("TRIGÉSIMA SEXTA. DURACIÓN DEL EJERCICIO SOCIAL.- "),
           _r("Los Ejercicios Sociales serán de Doce meses, que se computarán del Primero de Enero al Treinta y uno de Diciembre de cada año; con excepción del primer año de ejercicio que será a partir de la fecha de este instrumento, al Treinta y uno de Diciembre del mismo año."),
           _g("te instrumento, al Treinta y uno de Diciembre del mismo año.")),

        _p(_b("TRIGÉSIMA SÉPTIMA. DEL BALANCE GENERAL y FONDO DE RESERVA.- "),
           _r("Dentro de los primeros Cuatro meses que sigan al cierre de cada ejercicio, se deberá preparar un Balance General junto con sus documentos comprobatorios. Dicho Balance General deberá ser presentado a la Asamblea General Ordinaria de Accionistas la que, después de haber examinado el Informe o Reporte del Comisario y el citado Balance General, lo aprobará o lo modificará según sea el caso. Si el Balance General refleja Utilidades, los accionistas las distribuirán tomando en cuenta las siguientes disposiciones: A.- Si por razón de haber habido pérdidas, el Capital se hubiere visto afectado, las Utilidades deberán utilizarse preferentemente para reconstituirlo, hasta igualarlo con el Capital suscrito pagado. B.- El Fondo de Reserva deberá ser restituido cuando disminuya por la misma causa anterior. C.- Se aparta el Cinco por ciento de las utilidades, con destino al Fondo de Reserva Legal, hasta que llegue al Veinte por ciento del Capital Social Suscrito y Pagado. La Asamblea deberá cumplir con las disposiciones legales sobre el Reparto de Utilidades a los Trabajadores. Del Fondo de Reserva.- Al término de cada ejercicio social se practicará un Balance General el cual se someterá a la Asamblea General para su estudio y aprobación. Aprobado dicho Balance General, se aplicará una reducción del 5% (Cinco por ciento) para la Constitución del Fondo de Reserva, hasta que éste alcance un 20% (Veinte por ciento) del Capital Social."),
           _g("éste alcance un 20% (Veinte por ciento) del Capital Social.")),

        _e("C A P I T U L O  S É P T I M O"),
        _e("D I S O L U C I Ó N ,  L I Q U I D A C I Ó N ,  R E S P O N S A B I L I D A D E S  Y  C L Á U S U L A  A R B I T R A L"),

        _p(_b("TRIGÉSIMA OCTAVA. CAUSAS DE DISOLUCIÓN.- "),
           _r("La Sociedad se Disolverá por las siguientes causas: a).- Al Concluir el plazo de Duración fijado en el presente instrumento. b).- Por la Pérdida de las dos terceras partes del Capital Social. c).- Por la Imposibilidad de realizar y llevar a cabo el Objeto Social. d).- Por Quiebra voluntaria o involuntaria legalmente declarada; y, e).- Por Acuerdo Unánime de la Asamblea General de Accionistas."),
           _g("- Por Acuerdo Unánime de la Asamblea General de Accionistas.")),

        _p(_b("TRIGÉSIMA NOVENA. REGLAS PARA LA LIQUIDACIÓN.- "),
           _r("Después de ser determinada la Disolución de la Sociedad por la Asamblea General de Accionistas, ésta nombrará uno o más Liquidadores, quienes procederán a la Liquidación de la misma y la distribución del remanente del haber social entre los accionistas, en proporción directa al número de accionistas y sus acciones que cada uno posea; si se nombraren dos o más liquidadores tendrán todas las facultades a que se refiere el Artículo Doscientos treinta y cuatro al Doscientos cuarenta y nueve de la Ley General de Sociedades Mercantiles. El Balance General de Liquidación y Reparto del haber social, deberán ser aprobados de plano por la Asamblea General Extraordinaria de Accionistas."),
           _g("plano por la Asamblea General Extraordinaria de Accionistas.")),

        _p(_b("CUADRAGÉSIMA. RESPONSABILIDAD DE LOS ACCIONISTAS.- "),
           _r("La responsabilidad de los Accionistas se entenderá limitada al pago del valor nominal de las acciones que hubieren suscrito y pagado y aun las no pagadas."),
           _g("cciones que hubieren suscrito y pagado y aun las no pagadas.")),

        _p(_b("CUADRAGÉSIMA PRIMERA. SUPLETORIEDAD.- "),
           _r("En todo lo no previsto en estos Estatutos Sociales, se aplicarán las disposiciones correspondientes de la Ley General de Sociedades Mercantiles."),
           _g("orrespondientes de la Ley General de Sociedades Mercantiles.")),

        _p(_b("CUADRAGÉSIMA SEGUNDA. CLÁUSULA ARBITRAL.- "),
           _r("En términos del Título IV (Cuarto) del Código de Comercio relativo al Arbitraje Comercial, los intervinientes en el presente instrumento otorgan Cláusula Arbitral en los siguientes términos: \"Todas las desavenencias, litigios, controversias o reclamación resultante del presente acto o relativo al mismo, se resolverá definitivamente mediante Arbitraje de conformidad con lo estipulado en el Título IV (Cuarto) del Código de Comercio, mediante un tribunal arbitral conformado de 1 (Un) árbitro integrante del Colegio de Corredores Públicos del Estado de Tamaulipas, Asociación Civil. El lugar del arbitraje será determinado por el Tribunal Arbitral, el idioma será el español y la decisión del tribunal arbitral será en amigable composición. Las reglas no previstas por esta cláusula se reservan expresamente para el Tribunal Arbitral.\" La presente cláusula deberá constar inserta y/o deberá formar parte integrante del documento que acepte por cualquier medio a nuevos accionistas, sean personas físicas o morales. La presente cláusula es parte integrante de los estatutos sociales de la sociedad; su modificación, alteración, extinción o cualquier modificación, deberá ser acordada por Asamblea General Extraordinaria de Accionistas."),
           _g("acordada por Asamblea General Extraordinaria de Accionistas.")),

    ]


def secciones_socios_srl(d) -> List[Seccion]:
    """PRIMERA. DE LOS SOCIOS para S de RL de CV (tabla solo nombre+RFC)."""
    secs = [
        _e("C L Á U S U L A S  D E  L O S  E S T A T U T O S  S O C I A L E S"),
        _p(_b("PRIMERA. DE LOS SOCIOS.- "), _g("PRIMERA. DE LOS SOCIOS.-")),
    ]
    for s in d.socios:
        rfc_l = deletrear_alfanumerico(s.rfc)
        txt = (f"de nacionalidad mexicana, con domicilio en la ciudad de "
               f"{s.domicilio.ciudad}, {s.domicilio.estado} y Registro Federal "
               f"de Contribuyentes: {s.rfc} ({rfc_l}).")
        secs.append(_p(_b(f"{s.nombre_completo}; "), _r(txt), _g(txt)))
    return secs


def secciones_clausulas_srl(d) -> List[Seccion]:
    """Cláusulas estatutarias de S de RL de CV: TERCERA a VIGÉSIMA TERCERA."""
    den    = d.denominacion_social
    cap_fmt = f"${d.capital_fijo:,.2f}"
    cap_l  = pesos_letra(d.capital_fijo)

    return [
        _p(_b("TERCERA. DENOMINACIÓN.- "),
           _r(f"La denominación social de la persona moral mercantil que constituyen será: {den}, Denominación que deberá ir seguida de su régimen jurídico SOCIEDAD DE RESPONSABILIDAD LIMITADA DE CAPITAL VARIABLE o seguido de sus abreviaturas \"S. DE R.L. de C.V.\""),
           _g("VARIABLE o seguido de sus abreviaturas \"S. DE R.L. de C.V.\"")),

        _p(_b("CUARTA.- NACIONALIDAD y CLÁUSULA DE EXCLUSIÓN DE EXTRANJEROS. "),
           _r("La Nacionalidad de la sociedad será: Mexicana, con Cláusula de Exclusión de Extranjeros, conforme los siguientes términos: \"En este acto, ni en actos futuros, los miembros de la sociedad no admitirán directa, ni indirectamente como accionistas a inversionistas extranjeros, ni a sociedades extranjeras o aquellas sociedades de nacionalidad mexicana contengan cláusula de admisión de extranjeros. En términos del artículo 2 (Dos), fracción VII (Séptima) de la Ley de Inversión Extranjera.\" Esta cláusula solamente podrá ser modificada por unanimidad de los votos que representen el capital social."),
           _g("r unanimidad de los votos que representen el capital social.")),

        _p(_b("QUINTA. DURACIÓN.- "),
           _r("La Duración de la sociedad mercantil será por tiempo indefinido."),
           _g("uración de la sociedad mercantil será por tiempo indefinido.")),

        _p(_b("SEXTA. DOMICILIO.- "),
           _r(f"El domicilio de la sociedad será en la ciudad de {d.ciudad_fedatario}, TAMAULIPAS. Con la libertad de establecer oficinas de representación, despacho, recepción, de archivo o albergue, agencias o franquicias en cualquier lugar de la República Mexicana y el Extranjero, así mismo señalar los domicilios convencionales para la ejecución de determinados actos."),
           _g("lios convencionales para la ejecución de determinados actos.")),

        _p(_b("SÉPTIMA.- CAPITAL SOCIAL.- "),
           _r(f"El Capital Social mínimo fijo será de: {cap_fmt} ({cap_l}), el cual estará representado por las Partes Sociales que integren al mismo en términos de los presentes Estatutos Sociales y en todo caso, no podrá ser en ningún caso inferior al mínimo fijo autorizado por esta cláusula. El Capital Variable será indeterminado, el cual se integrará y formará según conforme la asamblea que convoque para tal efecto decida."),
           _g("ún conforme la asamblea que convoque para tal efecto decida.")),

        _p(_b("OCTAVA.- APORTACIONES y PARTES SOCIALES.- "),
           _r("Las aportaciones serán en cantidad líquida o en especie; para los efectos de este acto constitutivo, se constituyen las siguientes Partes Sociales las cuales para este acto constitutivo deberán quedar íntegramente suscritas y exhibidas, las que representan proporcionalmente, iguales derechos y obligaciones con relación a la participación económica y patrimonial de la sociedad, que en todo caso serán de múltiplo de $1,000.00 (Un mil pesos 00/100 en Moneda Nacional). Aportaciones en especie: Serán siempre traslativas de dominio y deben estar libre de gravamen; se adoptan las reglas y obligaciones que para tal efecto establece el artículo 141 (Ciento cuarenta y uno) de la Ley General de Sociedades Mercantiles."),
           _g("cuarenta y uno) de la Ley General de Sociedades Mercantiles.")),

        _p(_b("NOVENA.- MODIFICACIONES AL CAPITAL SOCIAL.- "),
           _r("El aumento, disminución y la forma de representación de las Partes Sociales que integran el Capital Social mínimo fijo, genera la modificación a los Estatutos Sociales, respecto de su Cláusula respectiva. Dichas modificaciones deberán ser resueltas en Asamblea General de Socios y ser aprobadas por Unanimidad de votos que representen el Capital Social, en primera convocatoria. En segunda convocatoria se resolverá por el 75% (Setenta y cinco) por ciento de votos que se encuentren en dicha asamblea por segunda convocatoria. El socio que vote en contrario tendrá derecho a retiro, en términos de la Ley General de Sociedades Mercantiles. Las Modificaciones al Capital Variable, no requerirá mayor formalidad que la establecida en la Ley General de Sociedades Mercantiles y por lo dispuesto en los presentes estatutos; Los aumentos, reducciones, transmisiones y liquidaciones del Capital Variable se resolverán en Asamblea General. En la emisión y/o aumento del Capital Variable, los socios actuales tendrán Derecho de Preferencia en proporción a su participación social, y por sobre los nuevos socios; en caso de interés común, se resolverá mediante sorteo aplicándose las reglas análogas establecidas en los presentes estatutos o dictándose en el momento de la asamblea las nuevas reglas para el sorteo. El Capital Variable se registrará en el Libro de Registro de Socios. Cuando se anuncie el Capital Variable, deberá anunciarse el monto que integra el Capital Social mínimo fijo."),
           _g("unciarse el monto que integra el Capital Social mínimo fijo.")),

        _p(_b("DÉCIMA.- LIBRO DE SOCIOS.- "),
           _r("Las Aportaciones Sociales deberán aparecer registradas en el Libro de Registro de Socios; el cual se anotará lo siguiente: Nombre completo del socio; Nacionalidad; Domicilio; Registro Federal de Contribuyentes; Valor de su Parte Social; Tipo de Capital que representa; y en su caso las transmisiones practicadas. Las Partes Sociales serán Nominativas y No Negociables, estarán representadas en documentos denominados Certificados de Participación Social, los cuales sólo podrán ser Transferibles previo cumplimiento de los requisitos que establecen los presentes estatutos, y por la anotación correspondiente en el Libro de Registro de Socios que lleva la sociedad conforme el artículo 73 (Setenta y tres) y 128 (Ciento veintiocho) de la Ley General de Sociedades Mercantiles; además deberán ostentar de manera clara la Cláusula de Exclusión de Extranjeros que establece la Cláusula Cuarta de los presentes estatutos en términos del artículo 2 (Dos), fracción VII (Séptima) de la Ley de Inversión Extranjera con relación al artículo 27 (Veintisiete) de la Constitución Política de los Estados Unidos Mexicanos. Dicho Certificado de Participación Social deberá contener la firma autógrafa del Gerente General o Consejo de Gerentes de la sociedad."),
           _g("fa del Gerente General o Consejo de Gerentes de la sociedad.")),

        _p(_b("DÉCIMA PRIMERA.- TRANSMISIÓN DE PARTES SOCIALES y DERECHO DE PREFERENCIA.- "),
           _r("Para la transmisión de Partes Sociales, se sujetarán al procedimiento dispuesto en este apartado; Cualquier socio podrá transferir la totalidad o parte de su Participación Social, debiendo para ello emitir Misiva de intención al Gerente General o al Presidente del Consejo de Gerentes, informando su pretensión; dicha Carta de Intención tendrá efectos de notificación del Derecho del Tanto y/o Derecho de Preferencia respecto del resto de los socios y deberá contener por lo menos: Monto y porcentaje que pretende trasladar; Valor por el que pretende trasladar; y Condiciones de la operación. Recibida la misiva por el Gerente General o Presidente del Consejo de Gerentes, transmitirá y notificará al resto de los consocios la misiva de intención con efectos de notificación para el ejercicio del Derecho del Tanto y/o Preferencia en términos del 132 (Ciento treinta y dos) de la Ley General de Sociedades Mercantiles. La Asamblea que convoque para la aprobación de la transmisión de partes sociales, deberá ser publicada en términos de los presentes estatutos con por lo menos 15 (Quince) días naturales previos a su celebración. Dicha Asamblea resolverá lo siguiente: A).- La existencia de intereses de los consocios de suscribir y exhibir la parte social sujeta a transferencia, quienes tendrán derecho a la suscripción de la parte social en proporción a su participación social; y en caso de que intenten dos o más socios sobre la misma parte social, en su caso resolverán mediante sorteo, dictándose en ese momento las reglas que los regirán. B).- En caso de que ninguno de los consocios exprese su intención de suscripción sobre la parte social transferible, la Asamblea estudiará y resolverá sobre la aprobación de la aceptación del nuevo o nuevos socios mediante la suscripción de la parte social sujeta que se transfiere. Esta decisión deberá ser unánime respecto del Capital Social que integra la sociedad, deduciendo el monto que representa la parte social que se transfiere, la cual no se contabilizará para voto. En caso de que el Gerente General o Presidente del Consejo de Gerentes, no convoque para la celebración de la Asamblea en el término previsto, cualquier socio podrá solicitar vía judicial la referida convocatoria."),
           _g("socio podrá solicitar vía judicial la referida convocatoria.")),

        _p(_b("DÉCIMA SEGUNDA.- DE LOS SOCIOS.- "),
           _r("El Carácter de Socio se adquiere mediante la obtención de una parte social. Dos o más socios podrán ser titulares de una Parte Social, pero deberán señalar Representante Común quien tendrá para todos los efectos el goce y ejercicio de los derechos patrimoniales y corporativos. El voto queda reservado al socio que represente la Parte Social común. Cada socio tendrá derecho a un Voto por cada múltiplo de $1,000.00 (Un mil pesos 00/100 Moneda Nacional), que integre su Parte Social. Derechos y Obligaciones de los Socios: A).- Ejercer sus Derechos Patrimoniales y Corporativos sin limitación; cualquier convenio en contrario no surtirá efectos y se tendrán por no puestos, resultando nulos de derecho. B).- Ejercer su Derecho de Asistir por sí o a través de mandatario a las Asambleas Generales y/o Especiales con ejercicio de Voz y Voto en los términos concedidos por las partes sociales. C).- Participar de las utilidades y pérdidas en proporción a su aportación; cualquier convenio que establezca una pérdida mayor, limite o excluya a un socio particular de este derecho, será nulo. D).- Los Socios Fundadores no se limitan ningún derecho ni prerrogativa especial y prohíben por esta cláusula aquellas que otorguen y confieran calidades más allá de las que establecen estos estatutos y la Ley General de Sociedades Mercantiles. E).- Revisar, solicitar y registrar la anotación del Registro en el Libro de Registro de Socios de la Parte Social. F).- Los socios que suscriban partes sociales están obligados a exhibirla en un término no mayor de 3 (Tres) meses. La falta de exhibición faculta al Gerente General o Presidente del Consejo de Gerentes para exigir dicha exhibición en lo extrajudicial o en lo judicial, y a falta de la última acción, la asamblea después de haber practicado la primera, en lo extrajudicial, liberará dicha parte social, pudiendo ser adquirida por algún otro socio o nuevo socio, previos requisitos debidamente cumplimentados. G).- Cualquier socio podrá concurrir a la administración de la sociedad. H).- Todos los derechos y obligaciones previstos conforme a la Ley General de Sociedades Mercantiles, en lo que no se oponga expresamente con los presentes estatutos sociales."),
           _g("se oponga expresamente con los presentes estatutos sociales.")),

        _p(_b("DÉCIMA TERCERA.- ASAMBLEA GENERAL DE SOCIOS.- "),
           _r("La Asamblea General de Socios será el Órgano Supremo de la Sociedad, la cual tendrá las más amplias facultades para acordar, ratificar y rectificar todos los actos y operaciones sociales, sin limitación alguna; sus Acuerdos legalmente adoptados, obligarán a todos los socios presentes y aún a los ausentes o disidentes. a).- Tipos de Asambleas.- Serán siempre Asambleas Generales, sin distinción de modalidad entre ordinarias y extraordinarias, solamente entendiéndose para esta última modalidad podrán aplicarse como referencia aquellas Asambleas Generales que se reúnan para tratar algún asunto en su Orden del Día que requiera por su naturaleza un Quórum de Asistencia mayor en términos de los presentes estatutos o de la Ley General de Sociedades Mercantiles. b).- Convocatoria de las Asambleas.- Deberán practicarse por el Gerente General o por el Presidente del Consejo de Gerentes. Podrán solicitar se practique convocatoria cuando lo solicite por lo menos el 75% (Setenta y cinco por ciento) de los socios que representen el Capital Social mínimo fijo debidamente exhibido; y para el caso de Convocatoria para Aprobación del Balance General anual, podrá solicitarla cualquier socio sin importar el monto de su parte social. No será necesaria la emisión de Convocatoria cuando al momento de celebrarse la Asamblea General o Especial, se encuentre reunido el 100% (Cien por ciento) de los socios que representen íntegramente el Capital Social. c).- Las publicaciones de las Convocatorias.- Serán practicadas en el Sistema Electrónico provisto por la Secretaría de Economía a través de internet, identificado con el dominio https://psm.economia.gob.mx o en el portal que para tal efecto sea publicado en el Diario Oficial de la Federación. d).- Término para convocar.- Deberán convocarse con por lo menos 15 (Quince) días naturales antes de su celebración. Dicho término podrá ser cesado cuando se encuentre reunido el 100% (Cien por ciento) del Capital Social que integra el mínimo fijo debidamente exhibido y que así se haga constar en dicha asamblea. e).- Contenido de las Convocatorias.- Las convocatorias contendrán por lo menos: La denominación o razón social, el Registro Federal de Contribuyentes, la Orden del Día, domicilio donde habrá de practicarse la Asamblea, la fecha y hora exacta de su celebración, y firma de quien convoca. f).- Voto en las Asambleas.- Cada socio tendrá derecho a un Voto por cada múltiplo de $1,000.00 (Un mil pesos 00/100 Moneda Nacional), que integre su Parte Social. El Voto será económico y universal; queda prohibido fraccionar una Parte Social que contenga más de una intención de voto. Los Votos serán en sentido positivo, negativo o en abstención. La Parte Social deberá estar íntegramente exhibida y pagada para tener derecho a voto. g).- Quórum de Asistencia y Resolución.- Habrá Quórum de Asistencia cuando se encuentre representado por lo menos el 50% (Cincuenta por ciento) de socios que representen el Capital Social mínimo fijo. En la Asamblea General debidamente convocada, en la que no hubiere Quórum de Asistencia, se repetirá la Convocatoria fijándose la próxima celebración en los siguientes 10 (Diez) días naturales posteriores a la fecha fijada en la primera convocatoria, sin necesidad de nueva convocatoria, pero deberá anotarse la Leyenda Precautoria en el Acta de la Asamblea respectiva de: \"En Segunda Convocatoria\"; la que se instalará y celebrará con el número de socios que en ella estuvieren presentes y el Quórum de Resolución será con por lo menos el 50% (Cincuenta por ciento) de los socios presentes. Para el caso en que los estatutos sociales o la Ley General de Sociedades Mercantiles requieran un Quórum especial de resolución, este será del 75% (Setenta y cinco por ciento) del Capital Social debidamente exhibido y en los casos de \"En Segunda Convocatoria\" el Quórum de Resolución será del 75% (Setenta y cinco por ciento) de los socios que se encuentren presentes. Representación.- Para asistir a las Asambleas Generales los socios bastará con que la asamblea los reconozca como tales. Podrán hacerse representar en las Asambleas por medio de otras personas a través de mandatarios; los formatos que contengan los poderes que sirvan para estos efectos deberán ser provistos por el Órgano de Administración. Sesión de la Asamblea.- Las Asambleas serán Presididas por el Gerente General o por el Presidente del Consejo de Gerentes; en su ausencia, será designado por la mayoría de los socios que estuvieren presentes. Lista de Asistencia.- Por lo menos un escrutador, formará lista de los socios presentes la cual será firmada por cada uno de ellos, debiéndose agregar al Acta de Asamblea; podrá eximirse dicha lista cuando todos los socios que integren el capital social estuvieren presentes en la Asamblea y firmaren la misma. Instalación de la Asamblea.- Una vez certificado el Quórum legal por el o los escrutadores y el Secretario de la asamblea, el Secretario y/o el Presidente declarará debidamente instalada la asamblea. En caso de que no se alcanzara a resolver durante la reunión todos los puntos contenidos en la Orden del Día, se suspenderán los trabajos para reanudarlos en el día y hora que fije la presidencia con anuencia unánime de los socios presentes, sin necesidad de nueva convocatoria. Las Resoluciones.- El Acta de Asamblea General se insertarán o se transcribirán en un Libro especial autorizado por el órgano de administración, denominado Libro de Actas; al final de cada acta de asamblea será firmada por lo menos por el Presidente de la Asamblea, Secretario y Escrutadores. Delegado Especial.- Para la ejecución de las resoluciones adoptadas, la Asamblea designará a un Delegado Especial a quien se le conferirán las facultades orgánicas que consideren necesarias para su debida ejecución y cumplimiento. Formalización de Actas.- Podrán protocolizarse o formalizarse ante fedatario público las actas de asamblea que considere e instruya la Asamblea, pero en todo caso deberán aparecer siempre insertas en el Libro de Actas. La inscripción al Registro Público de Comercio será obligatoria cuando la Ley así lo establezca. Las Resoluciones tomadas en los términos de estos estatutos y la Ley, obligan a todos los accionistas presentes en la Asamblea y aún a los ausentes y disidentes, por lo que serán definitivas y sin ulterior recurso. Para el caso de las Sesiones del Consejo de Gerentes para constituir Quórum será necesario la mayoría de los miembros del Consejo, y las resoluciones se tomarán por el voto afirmativo de la mayoría de los miembros presentes; en caso de empate o discordancia, el Presidente del Consejo tendrá Voto de Calidad. De toda sesión del Consejo de Administración o de las Asambleas, se levantará un Acta la cual deberá asentarse en el Libro de Actas respectivo y firmado por el Presidente, quien haya fungido como Secretario de la Asamblea, o el Presidente del Consejo de Gerentes y Secretario."),
           _g("mblea, o el Presidente del Consejo de Gerentes y Secretario.")),

        _p(_b("DÉCIMA CUARTA.- DEL ÓRGANO DE ADMINISTRACIÓN.- "),
           _r("El Órgano de Administración de la Sociedad, estará a cargo de un Gerente General o de un Consejo de Gerentes; que se compondrá por el número de miembros titulares y suplentes que señale la propia Asamblea General que los designe y su nombramiento será revocable. El Gerente General o los miembros del Consejo de Gerentes durarán en sus cargos indefinidamente, hasta que se convoque a Asamblea con preciso Orden del Día. El Gerente General o el Presidente del Consejo de Gerentes, es quien llevará la representación de la firma social y representará a la sociedad con las facultades que se le confieran, conforme a la presente cláusula, la Ley y la naturaleza de su ejercicio. La administración de la sociedad que se encomiende a un Consejo de Gerentes deberá integrarse éste con por lo menos un Presidente, un Secretario, y un Tesorero con las facultades, comisiones y encomiendas que la propia Asamblea General, estos Estatutos Sociales y la Ley por su naturaleza les asigne y/o determine la Asamblea del Consejo de Gerentes. La Presente Sociedad Mercantil tiene Estructura Orgánica; por lo que podrán conferirse, una o varias facultades revocables y temporales a Gerentes, Subgerentes y Directores en su calidad de Funcionarios de la Sociedad y por lo tanto podrán actuar con el carácter de Representante Legal con las facultades generales o especiales que se le hayan encomendado."),
           _g("cultades generales o especiales que se le hayan encomendado.")),

        _p(_b("DÉCIMA QUINTA. DE LAS FACULTADES DEL ÓRGANO DE ADMINISTRACIÓN.- "),
           _r("Para la administración de la sociedad y en todo a lo que ello se refiere, el Gerente General o el Presidente del Consejo de Gerentes de manera individual, tendrá las más amplias facultades legales que le corresponden conforme a la Ley Civil, de Comercio, Mercantil, Fiscal, Laboral, Administrativa y demás necesarias para la representación de la firma social y su ejercicio se entenderá como Representante Legal de la Sociedad, invistiéndole absolutamente de todas las facultades señaladas expresamente en el presente apartado, y para que de manera enunciativa, más no limitativa, ejerza: A).- Facultades Generales para PLEITOS Y COBRANZAS; con la amplitud del primer párrafo del Artículo 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal y su correlativo al Artículo 1,890 (Mil ochocientos noventa), del Código Civil vigente para el Estado de Tamaulipas. Con todas las facultades generales y con las especiales que requieren mención o cláusula especial conforme a la Ley, sin limitación alguna e inclusive con las facultades a que se refiere el Artículo 2,582 (Dos mil quinientos ochenta y dos), aun las enumeradas en el Artículo 2,587 (Dos mil quinientos ochenta y siete) del Código Civil Federal y sus correlativos de cualquier entidad de la República Mexicana mismos que se tienen aquí por mencionados y reproducidos como si se insertasen a la letra, facultades expuestas de manera enunciativa pero no limitativa. Expresamente, pero no limitativa, se le confiere las siguientes facultades: Desistirse del juicio de Amparo, otorgar y suscribir toda clase de documentos públicos y privados, hacer manifestaciones, renuncias, protestas, aun las establecidas por la Constitución Política de los Estados Unidos Mexicanos y para comparecer y ejercer sus facultades ante toda clase de personas, de autoridades o dependencias, judiciales y administrativas, civiles, penales, agrarias y del trabajo (especialmente para articular y absolver posiciones) federales o locales, en juicio o fuera del, con la mayor amplitud posible y expresamente: Presentar quejas, querellas, denuncias, ratificarlas y ampliarlas, desistirse de las mismas y constituirse en tercero coadyuvante del Ministerio Público, otorgar perdón judicial, en su caso, aportar pruebas, solicitar quiebras y en general, para iniciar proseguir y dar por término en cualquier forma a toda clase de recursos, arbitrajes y procedimientos de cualquier orden inclusive desistirse de instancias y procedimientos. B).- Facultades Generales para ejercer ACTOS DE ADMINISTRACIÓN; con la amplitud del segundo párrafo del Artículo 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal y su homólogo del segundo párrafo del Artículo 1,890 (Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas. Con todas las facultades generales y con las especiales que requieren mención o cláusula especial conforme a la Ley, sin limitación alguna, y conforme a sus correlativos de cualquier entidad de la República Mexicana mismos que se tienen aquí por mencionados y reproducidos como si se insertasen a la letra, facultades expuestas de manera enunciativa pero no limitativa. Expresamente, pero no limitativa, se le confiere las siguientes facultades: Para suscribir contratos, convenios y en general ejercer actos de administración en representación de su representado, sean gestiones o negocios locales, estatales o federales incluso de índole tributario ante la Secretaria de Hacienda y Crédito Público (SHCP) y sus departamentos adyacentes, centrales, dependientes, filiales y de cualquier jurisdicción, el Servicio de Administración Tributaria (SAT), ante el Instituto Mexicano Del Seguro Social (IMSS), Instituto del Fondo Nacional de la Vivienda para los Trabajadores (INFONAVIT) y sus correspondientes departamentos gubernamentales, personas físicas y morales, privadas y públicas de cualquier jerarquía jurisdiccional. Facultades para solicitar, tramitar, apersonarse, gestionar, obtener licencias, permisos, autorizaciones para el correcto funcionamiento y ejecución del objeto social de la empresa, esta facultad podrá ejercerla ante cualquier persona física o moral, pública o privada, nacional o extranjera, administrativa, jurisdiccional, militar y cualquier otra sin limitación de competencia territorial, material o jurisdiccional. C).- Facultades Generales para ADMINISTRAR BIENES; en los amplios términos del párrafo segundo del Artículo 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal y su correlativo del Artículo 1,890 (Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas. D).- Facultades Generales en MATERIA ADMINISTRATIVA para apersonarse ante el Servicio de Administración Tributaria y demás oficinas de gobierno, especialmente ante la Secretaria de Hacienda y Crédito Público, Servicio de Administración Tributaria, Instituto Mexicano del Seguro Social, Instituto del Fondo Nacional de la Vivienda para los Trabajadores, sus oficinas, dependencias, coordinaciones, subadministraciones, direcciones y demás a fin de cumplimentar los actos administrativos, legales y de defensa que correspondan, sea en la jurisdicción territorial del domicilio social y en cualquier otra de la República Mexicana. Especialmente se les confiere facultades respecto a los actos de cumplimiento conforme al Código Fiscal de la Federación y su Reglamento para solicitar y obtener la inscripción en el Registro Federal de Contribuyente, Firma electrónica avanzada, sellos digitales y cualquier otro procedimiento análogo y demás gestiones y trámites administrativos que ocurran y sean necesarios para el correcto funcionamiento y cumplimiento de la naturaleza de la presente persona moral mercantil. E).- Facultades Generales para Actos de ADMINISTRACIÓN HUMANA; en lo relativo a las relaciones Laborales, comparecer con Representación Legal de la Empresa ante las Autoridades del Trabajo, Juntas de Conciliación y Arbitraje, Federales como Locales y ante las Autoridades Administrativas del Trabajo, y de los juicios de amparo a que se refieren los conflictos laborales, a efecto de que, por lo que toca a la etapa de avenencia y conciliación con las facultades de administración necesarias para comprometer y concurrir representando a la empresa, llegando a su caso a los acuerdos, interviniendo en las pláticas directas con los funcionarios respectivos, con facultades especiales para transigir y convenir dentro del proceso o etapa del arbitraje, contestar la demanda, oponiendo excepciones y defensas en su caso, reconviniendo, ofreciendo y rindiendo pruebas y como mandatario especial, en representación de la empresa para absolver posiciones teniendo facultades que establecen los Artículos 2,554 (Dos mil quinientos cincuenta y cuatro), primero y segundo párrafo y 2,587 (Dos mil quinientos ochenta y siete) del Código Civil Federal, y su correlativo Artículo 1,890 (Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas; y en los Artículos 11 (Once), 692 (Seiscientos noventa y dos) fracciones II (Segunda) y III (Tercera), 788 (Setecientos ochenta y ocho), 879 (Ochocientos setenta y nueve) y demás relativos aplicables de la Ley Federal del Trabajo, bien entendido que como funcionario de la empresa, deberá rendir cuenta del ejercicio de este mandato a los órganos superiores de la empresa cuya política e instrucciones imperativamente deberá seguir. Lo que incluye celebrar toda clase de Contratos y Actos Jurídicos en nombre de la Empresa. a).- Para administrar la cartera de empleados, nómina, entero de cuotas al Instituto Mexicano del Seguro Social, Instituto del Nacional de la Vivienda para los Trabajadores, así como dar avisos informativos como cambio de domicilio social o fiscal, dar de alta en el Registro Federal de Contribuyentes y sus respectivos avisos, Firma Electrónica y demás trámites y gestiones que sean necesarios para el legal cumplimiento administrativo de la empresa. b).- Para administrar la cartera contable, fiscal y tributaria de la empresa. c).- Para la gestión de cualquier trámite administrativo ante cualquier autoridad judicial, jurisdiccional, administrativa de cualquiera de sus tres niveles de gobierno, federal, estatal o municipal, incluyendo las paraestatales, fondos públicos, institutos, etcétera. F).- Facultades Generales para ACTOS DE DOMINIO, con la amplitud del tercer párrafo del Artículo 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal y conforme su homólogo 1,890 (Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas, especialmente para disponer, vender, hipotecar, permutar y comprometer en todo o en parte bienes y derechos de la sociedad, rentar tomar en arrendamiento toda clase de bienes, así como otorgar y cancelar fianzas. En general celebrar toda clase de contratos y actos jurídicos relativos a los bienes y derechos de la empresa que incluye el comprar toda clase de bienes muebles e inmuebles a nombre de la empresa. Esta cláusula podrá ser limitada y condicional en cuanto a su cuantía, lo que deberá de expresarse y ordenarse en los otorgamientos de facultades, designaciones de nombramientos de funcionarios o apoderados; a falta de disposición limitativa se entenderá amplia y sin limitación alguna. G).- Facultades Generales para ACTOS CAMBIARIOS PARA SUSCRIBIR TÍTULOS DE CRÉDITO; en los términos del Artículo 9° (Noveno) de la Ley General de Títulos y Operaciones de Crédito, con las siguientes facultades: a).- Manejar Cuentas de cheques de la Sociedad. b).- Otorgar, suscribir, emitir, avalar, endosar, negociar y en cualquier forma operar títulos de crédito de toda clase, así como obligar cambiariamente a la Sociedad. Se confieren facultades para que, de manera enunciativa, más no limitativa actúe en la apertura de cuentas bancarias, autorizar, remover o revocar firmantes, solicitar productos y servicios financieros. H).- Facultades Generales para NOMBRAR Y REMOVER, gerentes, subgerentes, directores, agentes y demás empleados, factores y dependientes; señalándole sus facultades y enumeraciones, ejecutar los acuerdos de las Asambleas Generales y de socios, aunque no tengan facultad expresa y firmar por medio de las personas que al efecto designen toda clase de documentos relacionados directamente con los objetos de la sociedad. I).- Facultades Generales para Otorgar toda clase de comisiones, encomiendas, facultades para representar a la sociedad frente a terceros con cláusulas generales y especiales, así como revocar los mismos. Los Gerentes Generales y el Consejo de Gerentes, podrán conferir a terceros sean socios o extraños, toda clase de comisiones, encomiendas, facultades para representar a la sociedad frente a terceros conforme a las cláusulas generales y especiales en los términos generales, especiales y específicos conforme al Artículo 1,890 (Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas y 2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal. Asimismo, podrán revocar o limitar los mismos. El otorgamiento de facultades de representación orgánica no limita, traslada o modifica las facultades del órgano otorgante. J).- Facultades Generales para DELEGAR Y REVOCAR PODERES; sean generales o especiales, siempre que el Órgano de Administración que lo consigne tenga en función y vigencia tales facultades. Los Poderes, Mandatos, encomiendas o representaciones que otorgue la Asamblea General, el Gerente General o el Consejo de Gerentes, no implicarán en ningún caso la Delegación de la Dirección General, la Gerencia General o la administración única, a los Apoderados, Funcionarios facultados y/o Representantes Legales, amén que se señale específica y especialmente tal acto. K).- Facultades Generales para Establecer Sucursales, agencias, dependencias, u oficinas de negocios, en cualquier parte de la República Mexicana y en el extranjero. L).- Facultades Generales para Representar a la Sociedad cuando forme parte de otras sociedades, comprando o suscribiendo partes sociales o participaciones, o bien interviniendo como parte en su constitución. M).- Todas las Facultades que las leyes otorgan a los de su clase, sin limitación alguna, por lo que podrá el negocio y representar a la sociedad y llevar la firma social ante toda clase de personas y autoridades."),
           _g("r la firma social ante toda clase de personas y autoridades.")),

        _p(_b("DÉCIMA SEXTA.- INFORMACIÓN FINANCIERA; DISTRIBUCIÓN DE UTILIDADES Y PÉRDIDAS.- "),
           _r("Al fin de cada ejercicio social, se preparará un Balance General que deberá incluir la documentación financiera y contable y Aprobarse en la Asamblea General de Socios. Los encargados de presentar el Balance General es el Órgano de Administración y deberá poner a disposición del resto de los socios un duplicado con por lo menos 15 (Quince) días naturales antes de la fecha de Celebración de la Asamblea que deba aprobarlos. Conservación de la información.- El Gerente General o el Secretario del Consejo de Gerentes, en sobre debidamente cerrado, resguardará los documentos que contengan contraseñas, sellos de autorizar, cheques, pagarés, dispositivos electrónicos de verificación bancaria, firmas electrónicas y demás documentos provistos por autoridades hacendarias, administrativas públicas, privadas y bancarias para la identificación del cliente o contribuyente, debiendo hacer entrega de tal sobre en la Asamblea General al nuevo Gerente General o Consejo de Gerentes. Ejercicio Social.- El ejercicio Social será de un año natural que se computará del Primero de enero, al Treinta y uno de Diciembre de cada año, con excepción del primer ejercicio, que se contará desde esta fecha hasta el Treinta y uno de Diciembre del año corriente. Utilidades y Pérdidas.- Dentro de los primeros 3 (Tres) meses que sigan al cierre de cada ejercicio, se deberá preparar un Balance General junto con sus documentos comprobatorios. Dicho Balance General deberá ser presentado a la Asamblea General de Socios la que, después de haber examinado el Informe o Balance General, lo aprobará o lo modificará según sea el caso. Si el Balance General refleja Utilidades, los socios las distribuirán tomando en cuenta las siguientes disposiciones: A).- Si por razón de haber habido pérdidas, el Capital se hubiere visto afectado, las Utilidades deberán utilizarse preferentemente para reconstituirlo, hasta igualarlo con el Capital suscrito pagado. B).- El Fondo de Reserva deberá ser restituido cuando disminuya por la misma causa anterior. C).- Se aparta el Cinco por ciento de las utilidades, con destino al Fondo de Reserva Legal, hasta que llegue al Veinte por ciento del Capital Social Suscrito y Pagado. D).- La Asamblea deberá cumplir preferentemente con las disposiciones legales sobre el Reparto de Utilidades a los Trabajadores. E).- Cuando existan partes sociales preferentes se pagarán en los términos acordados en la Asamblea de su creación. F).- La Utilidad Neta, será distribuida en proporción a la participación social de cada socio. Cauciones y Remuneraciones.- Tanto el Gerente General como los miembros del Consejo de Gerentes en su caso; Presidente, Directores, Subdirectores, Gerentes, Subgerentes, NO Garantizarán su desempeño por no resultar necesario, pudiendo existir en el futuro por creación de la Asamblea General de Socios que así convoque, debiendo modificar el presente punto de los estatutos sociales."),
           _g("iendo modificar el presente punto de los estatutos sociales.")),

        _p(_b("DÉCIMA SÉPTIMA.- FONDO DE RESERVA.- "),
           _r("Al término de cada ejercicio social se practicará un Balance General el cual se someterá su aprobación a la Asamblea General para su estudio y aprobación en términos de los presentes estatutos. Aprobado dicho Balance General, se aplicará una reducción del 5% (Cinco por ciento) para la Constitución del Fondo de Reserva, hasta que éste alcance un 20% (Veinte por ciento) del Capital Social mínimo fijo."),
           _g("e un 20% (Veinte por ciento) del Capital Social mínimo fijo.")),

        _p(_b("DÉCIMA OCTAVA.- VIGILANCIA DE LA SOCIEDAD.- "),
           _r("NO se establece un Órgano de Vigilancia, por lo que queda prescindido para esta sociedad, pudiendo existir en el futuro por creación de la Asamblea General de Socios que así convoque, debiendo modificar los estatutos sociales respecto a este apartado."),
           _g("o modificar los estatutos sociales respecto a este apartado.")),

        _p(_b("DÉCIMA NOVENA.- CAUSAS DE DISOLUCIÓN DE LA SOCIEDAD.- "),
           _r("La Sociedad se Disolverá por las siguientes causas: a).- Al Concluir el plazo de Duración fijado en el presente instrumento. b).- Por la Pérdida de las dos terceras partes del Capital Social. c).- Por la Imposibilidad de realizar y llevar a cabo el Objeto Social. d).- Por Quiebra voluntaria o involuntaria legalmente declarada; y e).- Por Acuerdo Unánime de la Asamblea General de socios."),
           _g("y e).- Por Acuerdo Unánime de la Asamblea General de socios.")),

        _p(_b("VIGÉSIMA.- LIQUIDACIÓN.- "),
           _r("Después de ser determinada la Disolución de la Sociedad por la Asamblea General de socios, ésta nombrará uno o más Liquidadores, quienes procederán a la Liquidación de la misma y la distribución del remanente del haber social entre los socios, en proporción directa al número de socios y sus partes sociales que cada uno posea; si se nombraren dos o más liquidadores tendrán todas las facultades a que se refiere el Artículo Doscientos treinta y cuatro al Doscientos cuarenta y nueve de la Ley General de Sociedades Mercantiles. El Balance General de Liquidación y Reparto del haber social, deberán ser aprobados de plano por la Asamblea General de Socios."),
           _g("án ser aprobados de plano por la Asamblea General de Socios.")),

        _p(_b("VIGÉSIMA PRIMERA.- DISPOSICIONES GENERALES.- "),
           _r("En todo lo no previsto en estos Estatutos Sociales, se aplicarán las disposiciones correspondientes de la Ley General de Sociedades Mercantiles; Código de Comercio; Ley General de Títulos y Operaciones de Crédito y supletoriamente por el Código Civil Federal y demás usos mercantiles aplicables al caso."),
           _g("o Civil Federal y demás usos mercantiles aplicables al caso.")),

        _p(_b("VIGÉSIMA SEGUNDA.- RESPONSABILIDAD DE LOS SOCIOS.- "),
           _r("La responsabilidad de los Socios se entenderá limitada al pago del valor de sus aportaciones, inclusive aún las suscritas y no pagadas."),
           _g("sus aportaciones, inclusive aún las suscritas y no pagadas.")),

        _p(_b("VIGÉSIMA TERCERA.- CLÁUSULA ARBITRAL.- "),
           _r("En términos del Título IV (Cuarto) del Código de Comercio relativo al Arbitraje Comercial, los intervinientes en el presente instrumento otorgan Cláusula Arbitral en los siguientes términos: \"Todas las desavenencias, litigios, controversias o reclamación resultante del presente acto o relativo al mismo, se resolverá definitivamente mediante Arbitraje de conformidad con lo estipulado en el Título IV (Cuarto) del Código de Comercio, mediante un tribunal arbitral conformado de 1 (Un) árbitro integrante del Colegio de Corredores Públicos del Estado de Tamaulipas, Asociación Civil. El lugar del arbitraje será determinado por el Tribunal Arbitral, el idioma será el español y la decisión del tribunal arbitral será en amigable composición. Las reglas no previstas por esta cláusula se reservan expresamente para el Tribunal Arbitral.\" La presente cláusula deberá constar inserta y/o deberá formar parte integrante del documento que acepte por cualquier medio a nuevos socios, sean personas físicas o morales. La presente cláusula es parte integrante de los estatutos sociales de la sociedad; su modificación, alteración, extinción o cualquier modificación, deberá ser acordada por Asamblea General Extraordinaria de Accionistas."),
           _g("acordada por Asamblea General Extraordinaria de Accionistas.")),

    ]



def secciones_transitorias_sa(d) -> List[Seccion]:
    cap_socio  = d.capital_fijo // len(d.socios)
    acc_socio  = cap_socio // 1000
    total_acc  = acc_socio * len(d.socios)
    cap_fmt    = f"${d.capital_fijo:,.2f}"
    cap_l      = pesos_letra(d.capital_fijo)
    acc_l      = numero_letra(acc_socio).capitalize()
    total_acc_l= numero_letra(total_acc).capitalize()

    secs = [
        _e("C L Á U S U L A S  T R A N S I T O R I A S"),
        _p(
            _b("PRIMERA.- "),
            _r("Los comparecientes suscriben y pagan en efectivo la totalidad de las "
               "partes sociales que constituyen el Capital Social mínimo fijo, constituyendo "
               "por este acto la tabla de participación societaria para quedar integrada como sigue:"),
            _g("sigue:"),
        ),
        # La tabla accionaria se construye en AGT-06
        Seccion("tabla_accionaria", [], socios=d.socios,
                capital_fijo=d.capital_fijo),
    ]

    # SEGUNDA — Administrador único
    admin          = d.socios[0]
    admin_edad     = edad_actual(admin.fecha_nacimiento, d.fecha_instrumento)
    admin_edad_l   = numero_letra(admin_edad)
    admin_rfc_l    = deletrear_alfanumerico(admin.rfc)
    admin_ciudadano = "la persona"
    admin_nac       = genero_str(admin, "mexicano", "mexicana")
    secs.append(_p(
        _b("SEGUNDA.- "),
        _r("La Administración de la Sociedad estará a cargo de "),
        _b("UN ADMINISTRADOR ÚNICO "),
        _r(f"designándose para tal efecto {admin_ciudadano} "),
        _b(admin.nombre_completo),
        _r(f", de generales; {admin_edad} ({admin_edad_l.capitalize()}) años de edad, "
           f"{admin_nac}, {admin.estado_civil}, ocupación {admin.ocupacion}, con domicilio "
           f"en Ciudad {admin.domicilio.ciudad}, {admin.domicilio.estado}, indicando su "
           f"Registro Federal de Causantes (RFC) {admin.rfc} ({admin_rfc_l}). "
           "Quien durará en su encargo indefinidamente hasta que la propia Asamblea "
           "General convoque con este motivo preciso Orden del día.- Por la naturaleza "
           "del encargo designado el "),
        _b(f"ADMINISTRADOR ÚNICO: {admin.nombre_completo}, "),
        _r("a quien se le confieren "),
        _b("TODAS LAS FACULTADES GENERALES Y AÚN LAS ESPECIALES "),
        _r("que conforme a la Ley requieran Cláusula Especial en términos del artículo "
           "2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal; 1,890 "
           "(Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas y sus "
           "demás correlativos con el resto de los Códigos Civiles de la República Mexicana, "
           "así conforme al artículo 10 (Diez) de la Ley General de Sociedades Mercantiles; "
           "9 (Nueve) de la Ley General de Títulos y Operaciones de Crédito; Cláusula "
           "Vigésima Sexta de los presentes estatutos sociales; y demás cláusulas análogas, "
           "relativas y correlativas que se le confieren de manera ilimitada para actuar en "
           "su Carácter de Representante Legal de la persona moral mercantil. Facultades sin "
           "limitación ni condición alguna y que se tienen por transcritas, como si se "
           "insertasen a la letra."),
        _g("insertasen a la letra."),
    ))

    # TERCERA — Comisario
    if len(d.socios) >= 2:
        com         = d.socios[1]
        com_edad    = edad_actual(com.fecha_nacimiento, d.fecha_instrumento)
        com_l       = numero_letra(com_edad)
        rfc_l       = deletrear_alfanumerico(com.rfc)
        com_ciudadano = "la persona"
        com_nac       = genero_str(com, "mexicano", "mexicana")
        secs.append(_p(
            _b("TERCERA.- "),
            _r("Se Designa como "),
            _b("COMISARIO DE LA SOCIEDAD, "),
            _r(f"{com_ciudadano} "),
            _b(com.nombre_completo),
            _r(f", de generales; {com_edad} "
               f"({com_l.capitalize()}) años de edad, {com_nac}, {com.estado_civil}, "
               f"ocupación {com.ocupacion}, con domicilio en Ciudad {com.domicilio.ciudad}, "
               f"{com.domicilio.estado}, indicando su Registro Federal de Causantes (RFC) "
               f"{com.rfc} ({rfc_l})."),
            _g(f"{com.rfc} ({rfc_l})."),
        ))

    secs += [
        _p(_b("CUARTA.- "), _r("Los encargos de Administrador Único y Comisario designados, han sido aceptados."), _g("han sido aceptados.")),
        _p(_b("QUINTA. "), _r("Por excepción y en razón a la reconocida solvencia moral y social de los comparecientes, se acuerda por unanimidad; No requerir Caución por el manejo de sus encargos a las personas que forman el Consejo de Administración o Administrador Único ni al Consejo de Vigilancia o Comisario social."), _g("Comisario social.")),
    ]
    return secs


def secciones_transitorias_srl(d) -> List[Seccion]:
    """Cláusulas transitorias para S de RL de CV con sus dos tablas de capital."""
    secs = [
        _e("C L Á U S U L A S  T R A N S I T O R I A S"),
        _p(
            _b("PRIMERA.- "),
            _r("Los comparecientes suscriben y pagan en efectivo la totalidad de las "
               "partes sociales que constituyen el Capital Social mínimo fijo, constituyendo "
               "por este acto la tabla de participación societaria para quedar integrada como sigue:"),
            _g("sigue:"),
        ),
        # Las dos tablas SRL (partes sociales + socios con RFC) se construyen en AGT-06
        Seccion("tabla_capital_srl", [], socios=d.socios, capital_fijo=d.capital_fijo),
    ]

    # SEGUNDA — Gerente General
    gerente       = d.socios[0]
    ger_rfc_l     = deletrear_alfanumerico(gerente.rfc)
    ger_ciudadano = "la persona"
    secs.append(_p(
        _b("SEGUNDA.- "),
        _r("La Administración de la Sociedad estará a cargo de un "),
        _b("GERENTE GENERAL "),
        _r(f"designándose para tal efecto {ger_ciudadano} "),
        _b(gerente.nombre_completo),
        _r(f", con Registro Federal de Causantes (RFC) {gerente.rfc} ({ger_rfc_l}). "
           "Quien durará en su encargo indefinidamente hasta que la propia Asamblea "
           "General convoque con este motivo preciso Orden del día.- Por la naturaleza "
           "del encargo designado el "),
        _b(f"GERENTE GENERAL: {gerente.nombre_completo}, "),
        _r("a quien se le confieren "),
        _b("TODAS LAS FACULTADES GENERALES Y AÚN LAS ESPECIALES "),
        _r("que conforme a la Ley requieran Cláusula Especial en términos del artículo "
           "2,554 (Dos mil quinientos cincuenta y cuatro) del Código Civil Federal; 1,890 "
           "(Mil ochocientos noventa) del Código Civil para el Estado de Tamaulipas y sus "
           "demás correlativos con el resto de los Códigos Civiles de la República Mexicana, "
           "así conforme al artículo 10 (Diez) de la Ley General de Sociedades Mercantiles; "
           "9 (Nueve) de la Ley General de Títulos y Operaciones de Crédito; Cláusula "
           "Décima Cuarta y Décima Quinta de los presentes estatutos sociales; y demás cláusulas análogas, "
           "relativas y correlativas que se le confieren de manera ilimitada para actuar en "
           "su Carácter de Representante Legal de la persona moral mercantil. Facultades sin "
           "limitación ni condición alguna y que se tienen por transcritas, como si se "
           "insertasen a la letra."),
        _g("insertasen a la letra."),
    ))

    secs += [
        _p(_b("TERCERA.- "), _r("Los encargos designados han sido aceptados."),
           _g("han sido aceptados.")),
        _p(_b("CUARTA.- "),
           _r("Por excepción y en razón a la reconocida solvencia moral y social de los "
              "comparecientes, se acuerda por unanimidad; No requerir Caución por el manejo "
              "de sus encargos a las personas que forman la Gerencia ni al Consejo de "
              "Vigilancia social."),
           _g("Vigilancia social.")),
    ]
    return secs


def secciones_documentos_cotejados(d) -> List[Seccion]:
    las   = letras_archivo(len(d.socios))
    l_mua = letra_mua(len(d.socios))
    secs  = [
        _e("D O C U M E N T O S  E N  C O P I A  C O T E J A D A"),
        _e("A G R E G A D O S  A L  A R C H I V O  D E L  P R E S E N T E  I N S T R U M E N T O"),
    ]
    for s, l in zip(d.socios, las):
        secs.append(_p(_b(f'Bajo la Letra "{l["ine"]}".- '), _r(f"Identificación con fotografía y Confirmación de Validación Electrónica a favor de {s.nombre_completo}."), _g(s.nombre_completo)))
        secs.append(_p(_b(f'Bajo la Letra "{l["curp"]}".- '), _r(f"Constancia de la Clave Única de Registro de Población relacionada con {s.nombre_completo}."), _g(s.nombre_completo)))
        secs.append(_p(_b(f'Bajo la Letra "{l["rfc"]}".- '), _r(f"Constancia de Situación Fiscal relacionada con {s.nombre_completo}."), _g(s.nombre_completo)))
    secs.append(_p(_b(f'Bajo la Letra "{l_mua}".- '), _r(f"Documento que contiene Autorización de uso de denominación o razón social relacionada con: {d.denominacion_social}."), _g(d.denominacion_social)))
    return secs


def secciones_certificaciones(d) -> List[Seccion]:
    dia_l  = numero_letra(d.fecha_instrumento.day).upper()
    mes    = MESES_ES[d.fecha_instrumento.month].upper()
    anio_l = _num_a_letra(d.fecha_instrumento.year).upper()
    ciudad = d.ciudad_fedatario.capitalize()

    certs_raw = [
        ("A.- ", "Hago constar que: Presenté y exhibí Aviso de Privacidad a los comparecientes y les hice saber el uso y destino de sus datos personales en términos de la Ley Federal de Protección de Datos Personales en Posesión de los Particulares."),
        ("B.- ", "Hago constar que: Me aseguré de la identidad de los comparecientes a través de las documentales de identificación que en original me exhibieron, así como que levanté la Protesta de Decir Verdad en relación a su identidad y los documentos que me presentaron, así como de las manifestaciones que realizan."),
        ("C.- ", "Hago constar que: Me aseguré de la Capacidad Legal de los comparecientes y no encontré manifestaciones evidentes de Incapacidad Natural en ellos, además de no tener conocimiento que se encuentra en estado de interdicción."),
        ("D.- ", "Hago constar que: Que solicité y exigí a los comparecientes me acrediten y me presenten la cédula de identificación fiscal de su inscripción en el Registro Federal de Contribuyentes de cada uno de los socios, conforme al Artículo 27 (Veintisiete) del Código Fiscal de la Federación."),
        ("E.- ", "Hago constar que: Esta operación causa Aviso conforme al artículo 17 (Diecisiete), fracción XII (Decima segunda), Apartado B, subinciso b) de la Ley para la Prevención e Identificación de Operaciones con Recursos de Procedencia Ilícita."),
        ("EA.- ", "He identificado y reconozco de manera directa a cada compareciente con relación al documento que me ha presentado para su identificación."),
        ("EB.- ", "La presente operación es accidental y aislada, por lo que no configura una relación de negocios entre cada compareciente y el suscrito Corredor Público."),
        ("EC.- ", "He interpelado al compareciente sobre la declaración si tiene o no conocimiento de la existencia de una persona Beneficiario Controlador y, en su caso, la exhibición de la documentación que permita identificarla."),
        ("F.- ", "Hago constar que: Expliqué y orienté sobre el valor y las consecuencias legales con relación al presente acto jurídico."),
        ("G.- ", "Hago constar que: Que tuve a la vista los documentos relacionados con el presente instrumento, por lo que me fueron exhibidos en su formato original."),
        ("H.- ", "Hago constar que: En términos del Reglamento para la Autorización de Uso de Denominaciones y Razones Sociales, quedó íntegramente transcrita dicha autorización."),
        ("I.- ", "Hago constar que: Leí de manera clara y en voz alta el contenido íntegro del presente instrumento, así como que les hice saber de su valor, efectos y consecuencias legales."),
        ("J.- ", "Hago constar que: Los comparecientes han manifestado de viva voz, su conformidad integra con el contenido del instrumento que en este acto otorgan y para constancia, solicitan firmarlo en un solo acto."),
    ]

    secs = [
        _e("C E R T I F I C A C I O N E S"),
        _e("Y O  E L  C O R R E D O R  P Ú B L I C O ,  D O Y  F E ,  C E R T I F I C O  Y :"),
    ]
    for letra, texto in certs_raw:
        secs.append(_p(_b(letra), _r(texto), _g(texto)))

    secs.append(_p(
        _b("K.- "),
        _r("Hago constar que: Autorizo al momento de la firma de los otorgantes el presente "
           "Instrumento Público, por quedar cumplimentados los requisitos de ley. Y expido "),
        _b("Primer Póliza Original, "),
        _r("para quedar en el Archivo a cargo del suscrito Corredor Público. "),
        _b(f"Firmada que fue el día {d.fecha_instrumento.day} ({dia_l}) DE {mes} DEL {d.fecha_instrumento.year} ({anio_l}) "),
        _r(f"en la ciudad de {ciudad}, Tamaulipas. Hago constar y Doy Fe."),
        _g("Hago constar y Doy Fe."),
    ))

    # Tablas de firma por socio
    for i, s in enumerate(d.socios):
        secs.append(Seccion("firma", [],
                            nombre=s.nombre_completo,
                            es_ultimo=(i == len(d.socios) - 1)))

    # Corredor
    secs.append(Seccion("corredor", []))

    return secs


def generar_secciones(d) -> List[Seccion]:
    """Ensambla todas las secciones del acta en orden."""
    out = []
    out += secciones_encabezado(d)
    las = letras_archivo(len(d.socios))
    for socio, letras in zip(d.socios, las):
        out += secciones_datos_socio(socio, letras, d.fecha_instrumento)
    out += secciones_protesta()
    out += secciones_antecedentes(d)
    out += secciones_declaraciones()
    if d.tipo_sociedad == "SA_de_CV":
        out += secciones_accionistas_sa(d)
        out += secciones_objeto_social(d)
        out += secciones_clausulas_sa(d)
        out += secciones_clausulas_sa_cap2_7(d)
        out += secciones_transitorias_sa(d)
    else:
        out += secciones_socios_srl(d)
        out += secciones_objeto_social(d)
        out += secciones_clausulas_srl(d)
        out += secciones_transitorias_srl(d)
    out += secciones_documentos_cotejados(d)
    out += secciones_certificaciones(d)
    return out
