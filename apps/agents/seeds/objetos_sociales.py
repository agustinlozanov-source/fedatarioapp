"""
Semilla inicial — Objetos Sociales
Carga los 3 objetos especializados del despacho a Firestore
Ejecutar una sola vez: python3 seeds/objetos_sociales.py
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

cred = credentials.Certificate(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
firebase_admin.initialize_app(cred)
db = firestore.client()

TENANT_ID = "lcKqL0dVeAZGjE5VQMhfYsq4w663"

OBJETOS = [
    {
        "etiqueta": "Comercializadora",
        "descripcion": "Compra, venta, distribución, importación y exportación de mercancías",
        "giro": "comercio",
        "texto": """A).- Compra, venta, distribución, exportación e importación de todo tipo de mercancía nacional y extranjera así como la fabricación, ensamblaje, procesamiento, envasado y etiquetado de productos terminados o semielaborados, y la prestación de servicios relacionados con dichos productos; realizando actos de comercio en áreas de equipo de oficina; línea blanca; equipo de cómputo electrónico; refacciones automotrices, industriales, agrícolas y domésticas; acabados industriales y domésticos; equipos de clima artificial; ganado mayor y menor; aves así como alimentos y demás enseres para su cría y reproducción; congelación, procesado y empaque de toda clase de productos perecederos así como alimentos de mar y de la tierra como cangrejos, jaiba, langostas, langostino, crustáceos, etcétera; pollo en todas sus variantes, enteros o en piezas; carnes; productos del campo; semillas, insecticidas, herbicidas, fungicidas, fertilizantes y toda clase de productos químicos; así como artículos del hogar y cobro de honorarios por prestación de servicios profesionales; la adquisición, explotación, arrendamiento, enajenación y administración de bienes muebles e inmuebles, y en general los actos necesarios para el desarrollo de sus actividades comerciales.

B).- La prestación de servicios de asesoría, consultoría, capacitación y asistencia técnica en áreas industriales, comerciales, logísticas, administrativas y financieras, tanto para la propia sociedad como para terceros.

C).- La obtención, otorgamiento y explotación de derechos de propiedad intelectual, industrial y comercial, incluyendo marcas, patentes, diseños industriales, derechos de autor y franquicias.

D).- La celebración de contratos y actos jurídicos relacionados con su objeto social, incluyendo la constitución de garantías, avales, fianzas y la participación en otras sociedades mercantiles.

E).- La realización de actividades complementarias o accesorias que sean necesarias o convenientes para el cumplimiento de su objeto social.""",
    },
    {
        "etiqueta": "Transportes",
        "descripcion": "Autotransporte federal, estatal y local de carga general y especializada",
        "giro": "transporte",
        "texto": """A).- Del Objeto preponderante.- Operación y Explotación de los servicios de Autotransporte Federal, Estatal y Local, de Carga General y Carga Especializada de Materiales, Residuos, Remanentes y Desechos Peligrosos. Para transportar Objetos Indivisibles de Gran Peso y/o Volumen, así como el uso de combinaciones vehiculares normales, especiales y grúas industriales. Carga General y Especializada de Materiales, Residuos, Remanentes y Desechos Peligrosos en la Modalidad de Transporte o Arrastre de Remolques y Semirremolques en la Franja Fronteriza de 20 (Veinte) kilómetros paralela a la línea divisoria Internacional con los Estados Unidos de América.

B).- El establecimiento y explotación del Servicio Público de Autotransporte de carga especializada, en las rutas o tramos de jurisdicción federal o de jurisdicción local, como industrial, autorizados mediante las concesiones o permisos que para el efecto otorgue a la sociedad, la Secretaría de Comunicaciones y Transportes y/o el Gobierno Estatal o local correspondiente.

C).- La celebración, previa la autorización de la mencionada Secretaría de toda clase de contratos y convenios necesarios para la mejor realización de su objeto social.

D).- Prestación de toda clase de servicios a terceros.

E).- Adquisición, enajenación y administración de toda clase de acciones y partes sociales de Sociedades Mercantiles o Civiles.

F).- Otorgar garantías reales o personales por obligaciones propias o de terceros.

G).- Celebrar operaciones de crédito activas o pasivas, siempre y cuando su realización no requiera de concesión especial o se encuentre reservada a alguna sociedad en particular.

H).- Firmar, emitir, suscribir, girar, endosar, avalar y aceptar títulos valores y en general celebrar sobre los mismos cualesquiera de las operaciones que regula la Ley de la materia.

I).- Adquirir, enajenar, ceder o traspasar, marcas, patentes y derechos de autor, autorizaciones, concesiones, permisos y franquicias.

J).- Celebrar y ejecutar toda clase de actos jurídicos, contratos y convenios civiles y mercantiles necesarios o convenientes, anexos y conexos del objeto social.

K).- Manejo y disposición de residuos peligrosos.

L).- La explotación del Servicio de Autotransporte Federal de Carga, Servicio Auxiliar de Arrastre, Salvamento, Privado Terrestre por caminos de Jurisdicción Federal, Estatal o Municipal.

M).- La compra, venta, importación, exportación, renta y subarrendamiento de vehículos, así como sus accesorios, incluyendo la prevención, mantenimiento y reparación de vehículos y cualquier refacción necesaria en los vehículos.""",
    },
]

OBJETO_GENERICO = """F).- La adquisición de toda clase de bienes muebles e inmuebles necesarios para el objeto social.

G).- La intermediación, gestoría y asesoramiento en toda clase de operaciones mercantiles así como el cobro de las comisiones correspondientes.

H).- La ejecución de todos los actos, la celebración de todos los contratos y la realización de todas las operaciones de naturaleza civil, mercantil, industrial y cualquier otra que se relacione con el objeto social.

I).- Actos generales: Adquirir, enajenar, tomar, y otorgar el uso y/o goce por cualquier título, permitido por la Ley de toda clase de bienes muebles o inmuebles en el país o en el extranjero sean propios o ajenos.

J).- La aceptación, tramitación y otorgamiento en su caso de concesiones y franquicias. Así como la obtención, uso, traspaso, cesión y autorización de patentes, marcas de fabricación o comerciales, marcas nominativas, innominadas, nombres y avisos comerciales, derechos de autor en cualquiera de sus rubros, concesiones, permisos y licencias para todo tipo de actividades, en la República Mexicana o en el extranjero.

K).- Solicitar y obtener préstamos de cualquier tipo otorgando o recibiendo garantías específicas, emitir obligaciones, aceptar, girar, endosar o avalar toda clase de títulos de crédito y otorgar fianzas o garantías de cualquier clase respecto de obligaciones contraídas o de los títulos emitidos o aceptados por terceros.

L).- La adquisición, enajenación y en general la negociación con todo tipo de acciones, partes sociales y de cualquier título valor permitido por la ley.

M).- Asesorar y administrar a personas físicas o morales, públicas o privadas, en manejo contable fiscal administrativo.

N).- Participar en licitaciones y concursos públicos que convoque el gobierno federal, estatal o municipal.

Ñ).- En general, ejecutar los actos a que pueda dedicarse legítimamente, celebrar contratos y llevar a cabo todas las operaciones directa o indirectamente relacionados con el desarrollo de las actividades de la Sociedad."""


def seed():
    print("Cargando objetos sociales a Firestore...")
    col = db.collection("objetos_sociales")

    for obj in OBJETOS:
        doc = {
            **obj,
            "tenantId": TENANT_ID,
            "esGenerico": False,
            "usosCount": 0,
            "creadoEn": firestore.SERVER_TIMESTAMP,
        }
        ref = col.add(doc)
        print(f"✅ {obj['etiqueta']} → {ref[1].id}")

    doc_generico = {
        "etiqueta": "Cláusulas generales",
        "descripcion": "Facultades generales — siempre se agrega al final del objeto social",
        "giro": "generico",
        "texto": OBJETO_GENERICO,
        "tenantId": TENANT_ID,
        "esGenerico": True,
        "siempreIncluir": True,
        "usosCount": 0,
        "creadoEn": firestore.SERVER_TIMESTAMP,
    }
    ref = col.add(doc_generico)
    print(f"✅ Cláusulas generales → {ref[1].id}")

    print(f"\n✅ Listo. {len(OBJETOS) + 1} objetos cargados.")


if __name__ == "__main__":
    seed()
