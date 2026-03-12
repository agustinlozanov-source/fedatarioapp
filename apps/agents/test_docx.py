"""Prueba de generación de DOCX para SA de CV y S de RL de CV."""
import sys
sys.path.insert(0, '.')
from datetime import date
from agentes.agt04_redactor import InstrumentoRedactorInput, SocioInput, DomicilioInput
from agentes.agt04_secciones import generar_secciones
from agentes.agt06_docx import generar_docx

dom = DomicilioInput(
    calle='Ernesto Elizondo', numero='121', colonia='Popular',
    cp='87460', ciudad='Matamoros', estado='Tamaulipas'
)

# ── SA de CV ──────────────────────────────────────────────────────────────────
datos_sa = InstrumentoRedactorInput(
    numero_poliza=3272, libro_registro=5, ciudad_fedatario='MATAMOROS',
    fecha_instrumento=date(2026, 2, 16), tipo_sociedad='SA_de_CV',
    denominacion_social='COMERCIALIZADORA AZTEMEX', cud='A202602090932258301',
    solicitante_mua='ESMERALDA LETICIA ESQUIVEL', capital_fijo=100000,
    socios=[
        SocioInput(
            nombre_completo='EDUARDO ROMERO ZALETA', genero='masculino',
            lugar_nacimiento='Tampico, Tamaulipas', fecha_nacimiento=date(1987, 8, 13),
            estado_civil='Soltero', ocupacion='Comerciante', domicilio=dom,
            rfc='ROZE870813NXA', curp='ROZE870813HTSMLD04',
            clave_elector='RMZLED87081328H500', seccion_ine='0606', idmex='2604718651',
        ),
        SocioInput(
            nombre_completo='SARA GARCIA PADILLA', genero='femenino',
            lugar_nacimiento='Matamoros, Tamaulipas', fecha_nacimiento=date(1988, 1, 16),
            estado_civil='Soltera', ocupacion='Comerciante', domicilio=dom,
            rfc='GAPS880116CX9', curp='GAPS880116MTSRDR04',
            clave_elector='GRPDSR88011628M000', seccion_ine='0606', idmex='2604718662',
        ),
    ],
    objeto_social_texto='A).- Compraventa de mercancias.',
)

secs = generar_secciones(datos_sa)
tipos = [s.tipo for s in secs]
assert 'tabla_accionaria' in tipos,    'SA debe tener tabla_accionaria'
assert 'tabla_capital_srl' not in tipos, 'SA NO debe tener tabla_capital_srl'
docx_sa = generar_docx('', secciones=secs)
with open('/tmp/test_sa.docx', 'wb') as f:
    f.write(docx_sa)
print('SA de CV OK, bytes:', len(docx_sa))

# ── S de RL de CV ─────────────────────────────────────────────────────────────
datos_srl = InstrumentoRedactorInput(
    numero_poliza=3300, libro_registro=5, ciudad_fedatario='MATAMOROS',
    fecha_instrumento=date(2026, 2, 16), tipo_sociedad='S_de_RL_de_CV',
    denominacion_social='SERVICIOS INTEGRALES JMG', cud='A202602090932258302',
    solicitante_mua='JORGE ALVAREZ LONGORIA', capital_fijo=100000,
    socios=[
        SocioInput(
            nombre_completo='JORGE ALVAREZ LONGORIA', genero='masculino',
            lugar_nacimiento='Matamoros, Tamaulipas', fecha_nacimiento=date(1975, 5, 10),
            estado_civil='Casado', ocupacion='Empresario', domicilio=dom,
            rfc='AALJ750510AB1', curp='AALJ750510HTSRVR05',
            clave_elector='ALVLGR75051028H500', seccion_ine='0607', idmex='1234567890',
        ),
        SocioInput(
            nombre_completo='SONIA GONZALEZ BARRAGAN', genero='femenino',
            lugar_nacimiento='Matamoros, Tamaulipas', fecha_nacimiento=date(1980, 3, 15),
            estado_civil='Casada', ocupacion='Empresaria', domicilio=dom,
            rfc='GOBS800315CD2', curp='GOBS800315MTSRNN09',
            clave_elector='GNZBRS80031528M000', seccion_ine='0607', idmex='0987654321',
        ),
    ],
    objeto_social_texto='A).- Prestacion de servicios.',
)

secs_srl = generar_secciones(datos_srl)
tipos_srl = [s.tipo for s in secs_srl]
assert 'tabla_capital_srl' in tipos_srl,   'SRL debe tener tabla_capital_srl'
assert 'tabla_accionaria' not in tipos_srl, 'SRL NO debe tener tabla_accionaria'
docx_srl = generar_docx('', secciones=secs_srl)
with open('/tmp/test_srl.docx', 'wb') as f:
    f.write(docx_srl)
print('S de RL de CV OK, bytes:', len(docx_srl))
print('Tipos especiales en SRL:', [t for t in tipos_srl if t not in ('parrafo', 'vacio', 'encabezado')])
print()
print('Archivos generados: /tmp/test_sa.docx y /tmp/test_srl.docx')
