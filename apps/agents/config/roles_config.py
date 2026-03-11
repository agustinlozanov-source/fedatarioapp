"""
Configuración de Roles y Reglas de Validación por Tipo de Sociedad
Basado en Derecho Comercial Ecuatoriano
"""

ROLES_CONFIG = {
    "sociedades": [
        {
            "tipo": "S.A.",
            "nombre_largo": "Sociedad Anónima",
            "roles_permitidos": [
                {"id": "sa_accionista", "nombre": "Accionista", "categoria": "Propiedad"},
                {"id": "sa_adm_unico", "nombre": "Administrador Único", "categoria": "Administración"},
                {"id": "sa_pres_consejo", "nombre": "Presidente del Consejo de Administración", "categoria": "Administración"},
                {"id": "sa_sec_consejo", "nombre": "Secretario del Consejo", "categoria": "Administración"},
                {"id": "sa_tes_consejo", "nombre": "Tesorero del Consejo", "categoria": "Administración"},
                {"id": "sa_comisario", "nombre": "Comisario", "categoria": "Vigilancia"}
            ],
            "reglas_validacion": {
                "obligatorios": ["sa_accionista", "sa_comisario"],
                "minimo_administracion": 1,
                "incompatibilidades": [
                    {
                        "rol_a": "sa_comisario",
                        "prohibidos": ["sa_adm_unico", "sa_pres_consejo", "sa_sec_consejo", "sa_tes_consejo"],
                        "motivo": "El órgano de vigilancia no puede ser administrador (Conflicto de interés)."
                    }
                ],
                "exclusividad": [
                    {
                        "opcion_a": "sa_adm_unico",
                        "opcion_b": "sa_pres_consejo",
                        "motivo": "O existe un administrador único o existe un consejo, no ambos."
                    }
                ]
            }
        },
        {
            "tipo": "S. de R.L.",
            "nombre_largo": "Sociedad de Responsabilidad Limitada",
            "roles_permitidos": [
                {"id": "srl_socio", "nombre": "Socio", "categoria": "Propiedad"},
                {"id": "srl_gerente_unico", "nombre": "Gerente Único", "categoria": "Administración"},
                {"id": "srl_cogerente", "nombre": "Cogerente", "categoria": "Administración"},
                {"id": "srl_pres_vigilancia", "nombre": "Presidente del Consejo de Vigilancia", "categoria": "Vigilancia"}
            ],
            "reglas_validacion": {
                "obligatorios": ["srl_socio"],
                "minimo_administracion": 1,
                "incompatibilidades": [
                    {
                        "rol_a": "srl_pres_vigilancia",
                        "prohibidos": ["srl_gerente_unico", "srl_cogerente"],
                        "motivo": "Los gerentes no pueden vigilar su propia gestión."
                    }
                ],
                "exclusividad": [
                    {
                        "opcion_a": "srl_gerente_unico",
                        "opcion_b": "srl_cogerente",
                        "motivo": "Si hay Gerente Único no puede haber Cogerentes simultáneamente."
                    }
                ]
            }
        }
    ]
}


def get_roles_por_tipo(tipo_sociedad: str):
    """Retorna la configuración de roles para un tipo de sociedad específico."""
    for sociedad in ROLES_CONFIG["sociedades"]:
        if sociedad["tipo"] == tipo_sociedad:
            return sociedad
    return None


def get_todos_los_tipos():
    """Retorna la lista de tipos de sociedad disponibles."""
    return [s["tipo"] for s in ROLES_CONFIG["sociedades"]]
