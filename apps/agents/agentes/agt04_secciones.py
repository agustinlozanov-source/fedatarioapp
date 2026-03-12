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
               f"Número 3 (Tres) de la Plaza de Tamaulipas, los Ciudadanos {nombres} quienes "
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
    edad   = edad_actual(socio.fecha_nacimiento, ref_date)
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
    den    = d.denominacion_social

    return [
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
               f"la Ciudadana {d.solicitante_mua} solicitó a la Secretaría de Economía, a través "
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
            _r(f"En atención a la solicitud realizada por {d.solicitante_mua}, a través del "
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
        _p(_b("=== Fin de la transcripción ==="), _g("===")),
    ]


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
    dom    = d.domicilio_social

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
           _r(f"El domicilio de la sociedad será en la ciudad de {dom}. Con la libertad de "
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
    admin   = d.socios[0]
    secs.append(_p(
        _b("SEGUNDA.- "),
        _r("La Administración de la Sociedad estará a cargo de "),
        _b("UN ADMINISTRADOR ÚNICO "),
        _r(f"designándose para tal efecto al ciudadano "),
        _b(admin.nombre_completo),
        _r(". Quien durará en su encargo indefinidamente hasta que la propia Asamblea "
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
        com    = d.socios[1]
        com_l  = numero_letra(edad_actual(com.fecha_nacimiento, d.fecha_instrumento))
        rfc_l  = deletrear_alfanumerico(com.rfc)
        secs.append(_p(
            _b("TERCERA.- "),
            _r("Se Designa como "),
            _b("COMISARIO DE LA SOCIEDAD, "),
            _r(f"a la Ciudadana "),
            _b(com.nombre_completo),
            _r(f", de generales; {edad_actual(com.fecha_nacimiento, d.fecha_instrumento)} "
               f"({com_l.capitalize()}) años de edad, mexicana, {com.estado_civil}, "
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
    gerente   = d.socios[0]
    ger_rfc_l = deletrear_alfanumerico(gerente.rfc)
    secs.append(_p(
        _b("SEGUNDA.- "),
        _r("La Administración de la Sociedad estará a cargo de un "),
        _b("GERENTE GENERAL "),
        _r("designándose para tal efecto al ciudadano "),
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
           "Vigésima Sexta de los presentes estatutos sociales; y demás cláusulas análogas, "
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
    if d.tipo_sociedad == "SA_de_CV":
        out += secciones_clausulas_sa(d)
    if d.tipo_sociedad == "SA_de_CV":
        out += secciones_transitorias_sa(d)
    else:
        out += secciones_transitorias_srl(d)
    out += secciones_documentos_cotejados(d)
    out += secciones_certificaciones(d)
    return out
