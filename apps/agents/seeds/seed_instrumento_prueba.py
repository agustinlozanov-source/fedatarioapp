"""
Seed — Instrumento de prueba para testing de AGT-04 + AGT-05
Ejecutar: python3 seeds/seed_instrumento_prueba.py
"""
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

load_dotenv()

cred = credentials.Certificate(os.getenv("GOOGLE_APPLICATION_CREDENTIALS"))
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()

TENANT_ID = "lcKqL0dVeAZGjE5VQMhfYsq4w663"  # mismo que usaste en objetos_sociales.py

instrumento = {
    "tenantId": TENANT_ID,
    "tipo_sociedad": "SA_de_CV",
    "denominacion_social": "COMERCIALIZADORA AZTEMEX",
    "numero_poliza": 3272,
    "libro_registro": 5,
    "ciudad_fedatario": "MATAMOROS",
    "fecha_instrumento": "2026-02-16",
    "cud": "A202602090932258301",
    "solicitante_mua": "ESMERALDA LETICIA ESQUIVEL",
    "domicilio_social": "Matamoros, Tamaulipas",
    "capital_fijo": 100000,
    "objeto_social_texto": "A).- Compra, venta, distribución, exportación e importación de todo tipo de mercancía nacional y extranjera.\nB).- La prestación de servicios de asesoría, consultoría y asistencia técnica.\nC).- La realización de actividades complementarias o accesorias.",
    "estado": "borrador",
    "creadoEn": firestore.SERVER_TIMESTAMP,
    "socios": [
        {
            "nombre_completo": "EDUARDO ROMERO ZALETA",
            "genero": "masculino",
            "nacionalidad_pais": "México",
            "lugar_nacimiento": "Tampico, Tamaulipas, México",
            "fecha_nacimiento": "1987-08-13",
            "estado_civil": "Soltero",
            "ocupacion": "Comerciante",
            "domicilio": {
                "calle": "Ernesto Elizondo",
                "numero": "121",
                "colonia": "Popular",
                "cp": "87460",
                "ciudad": "Matamoros",
                "estado": "Tamaulipas"
            },
            "rfc": "ROZE870813NXA",
            "curp": "ROZE870813HTSMLD04",
            "clave_elector": "RMZLED87081328H500",
            "seccion_ine": "0606",
            "idmex": "2604718651"
        },
        {
            "nombre_completo": "SARA KERENHAPUC DAMARIS GARCIA PADILLA",
            "genero": "femenino",
            "nacionalidad_pais": "México",
            "lugar_nacimiento": "Matamoros, Tamaulipas, México",
            "fecha_nacimiento": "1988-01-16",
            "estado_civil": "Soltera",
            "ocupacion": "Comerciante",
            "domicilio": {
                "calle": "Ernesto Elizondo",
                "numero": "121",
                "colonia": "Popular",
                "cp": "87460",
                "ciudad": "Matamoros",
                "estado": "Tamaulipas"
            },
            "rfc": "GAPS880116CX9",
            "curp": "GAPS880116MTSRDR04",
            "clave_elector": "GRPDSR88011628M000",
            "seccion_ine": "0606",
            "idmex": "2604718662"
        }
    ]
}

ref = db.collection("instrumentos").add(instrumento)
print(f"✅ Instrumento creado → ID: {ref[1].id}")
print(f"   URL: http://localhost:3000/instrumentos/{ref[1].id}")
