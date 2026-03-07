import json, urllib.request, os

# Usar la API REST pública de Firestore (no requiere credenciales de servicio)
PROJECT_ID = "fedatarioapp"
TENANT_ID = "lcKqL0dVeAZGjE5VQMhfYsq4w663"

url = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/instrumentos"

socios = [
    {
        "nombre_completo": "EDUARDO ROMERO ZALETA",
        "genero": "masculino",
        "nacionalidad_pais": "México",
        "lugar_nacimiento": "Tampico, Tamaulipas, México",
        "fecha_nacimiento": "1987-08-13",
        "estado_civil": "Soltero",
        "ocupacion": "Comerciante",
        "domicilio": {"calle": "Ernesto Elizondo", "numero": "121", "colonia": "Popular", "cp": "87460", "ciudad": "Matamoros", "estado": "Tamaulipas"},
        "rfc": "ROZE870813NXA", "curp": "ROZE870813HTSMLD04",
        "clave_elector": "RMZLED87081328H500", "seccion_ine": "0606", "idmex": "2604718651"
    },
    {
        "nombre_completo": "SARA KERENHAPUC DAMARIS GARCIA PADILLA",
        "genero": "femenino",
        "nacionalidad_pais": "México",
        "lugar_nacimiento": "Matamoros, Tamaulipas, México",
        "fecha_nacimiento": "1988-01-16",
        "estado_civil": "Soltera",
        "ocupacion": "Comerciante",
        "domicilio": {"calle": "Ernesto Elizondo", "numero": "121", "colonia": "Popular", "cp": "87460", "ciudad": "Matamoros", "estado": "Tamaulipas"},
        "rfc": "GAPS880116CX9", "curp": "GAPS880116MTSRDR04",
        "clave_elector": "GRPDSR88011628M000", "seccion_ine": "0606", "idmex": "2604718662"
    }
]

# Convertir a formato Firestore REST
def to_firestore(val):
    if isinstance(val, str):   return {"stringValue": val}
    if isinstance(val, int):   return {"integerValue": str(val)}
    if isinstance(val, bool):  return {"booleanValue": val}
    if isinstance(val, dict):  return {"mapValue": {"fields": {k: to_firestore(v) for k, v in val.items()}}}
    if isinstance(val, list):  return {"arrayValue": {"values": [to_firestore(i) for i in val]}}
    return {"stringValue": str(val)}

body = json.dumps({
    "fields": {
        "tenantId": to_firestore(TENANT_ID),
        "tipo_sociedad": to_firestore("SA_de_CV"),
        "denominacion_social": to_firestore("COMERCIALIZADORA AZTEMEX"),
        "numero_poliza": to_firestore(3272),
        "libro_registro": to_firestore(5),
        "ciudad_fedatario": to_firestore("MATAMOROS"),
        "fecha_instrumento": to_firestore("2026-02-16"),
        "cud": to_firestore("A202602090932258301"),
        "solicitante_mua": to_firestore("ESMERALDA LETICIA ESQUIVEL"),
        "domicilio_social": to_firestore("Matamoros, Tamaulipas"),
        "capital_fijo": to_firestore(100000),
        "objeto_social_texto": to_firestore("A).- Compra, venta, distribución, exportación e importación de todo tipo de mercancía nacional y extranjera.\nB).- La prestación de servicios de asesoría, consultoría y asistencia técnica.\nC).- La realización de actividades complementarias o accesorias."),
        "estado": to_firestore("borrador"),
        "socios": to_firestore(socios)
    }
}).encode()

req = urllib.request.Request(url, data=body, method="POST",
    headers={"Content-Type": "application/json"})

try:
    with urllib.request.urlopen(req) as r:
        resp = json.loads(r.read().decode())
        doc_path = resp.get("name", "")
        doc_id = doc_path.split("/")[-1]
        print(f"✅ Instrumento creado correctamente. ID: {doc_id}")
        print(f"   Revisa en: http://localhost:3000/instrumentos/{doc_id}")
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print(f"❌ Error HTTP {e.code}: {err_body}")
except Exception as e:
    print(f"❌ Error: {e}")
