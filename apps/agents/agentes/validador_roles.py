"""
Validador de Roles y Reglas
Verifica que los roles seleccionados cumplan con las reglas de la sociedad
"""

from typing import List, Dict, Any
from config.roles_config import get_roles_por_tipo


class ErrorValidacion:
    """Representa un error de validación"""
    def __init__(self, tipo: str, mensaje: str, roles_conflictivos: List[str] = None):
        self.tipo = tipo
        self.mensaje = mensaje
        self.roles_conflictivos = roles_conflictivos or []

    def to_dict(self):
        return {
            "tipo": self.tipo,
            "mensaje": self.mensaje,
            "roles_conflictivos": self.roles_conflictivos
        }


class ValidadorRoles:
    """Valida que los roles seleccionados cumplan con las reglas de validación"""
    
    def __init__(self, tipo_sociedad: str):
        self.tipo_sociedad = tipo_sociedad
        self.config = get_roles_por_tipo(tipo_sociedad)
        if not self.config:
            raise ValueError(f"Tipo de sociedad no válido: {tipo_sociedad}")
        
        self.roles_permitidos = {r["id"]: r for r in self.config["roles_permitidos"]}
        self.reglas = self.config["reglas_validacion"]
    
    def validar(self, roles_seleccionados: List[str]) -> Dict[str, Any]:
        """
        Valida un conjunto de roles.
        Retorna: {
            "valido": bool,
            "errores": List[ErrorValidacion],
            "advertencias": List[str]
        }
        """
        errores = []
        advertencias = []
        
        # 1. Validar que todos los roles existan
        for rol_id in roles_seleccionados:
            if rol_id not in self.roles_permitidos:
                errores.append(ErrorValidacion(
                    "rol_no_existe",
                    f"El rol '{rol_id}' no existe para {self.tipo_sociedad}"
                ))
        
        # 2. Validar roles obligatorios
        obligatorios = self.reglas.get("obligatorios", [])
        faltantes = [r for r in obligatorios if r not in roles_seleccionados]
        if faltantes:
            nombres_faltantes = [self.roles_permitidos[r]["nombre"] for r in faltantes]
            errores.append(ErrorValidacion(
                "roles_obligatorios_faltantes",
                f"Roles obligatorios faltantes: {', '.join(nombres_faltantes)}",
                faltantes
            ))
        
        # 3. Validar mínimo de administración
        minimo_adm = self.reglas.get("minimo_administracion", 1)
        roles_admin = [r for r in roles_seleccionados 
                      if self.roles_permitidos[r]["categoria"] == "Administración"]
        if len(roles_admin) < minimo_adm:
            errores.append(ErrorValidacion(
                "minimo_administracion",
                f"Se requiere al menos {minimo_adm} rol de administración"
            ))
        
        # 4. Validar incompatibilidades
        incompatibilidades = self.reglas.get("incompatibilidades", [])
        for incompat in incompatibilidades:
            rol_a = incompat["rol_a"]
            if rol_a in roles_seleccionados:
                prohibidos = incompat["prohibidos"]
                conflictivos = [r for r in prohibidos if r in roles_seleccionados]
                if conflictivos:
                    nombres_conflictivos = [self.roles_permitidos[r]["nombre"] for r in conflictivos]
                    errores.append(ErrorValidacion(
                        "incompatibilidad",
                        f"{self.roles_permitidos[rol_a]['nombre']} no puede coexistir con: {', '.join(nombres_conflictivos)}. "
                        f"Motivo: {incompat['motivo']}",
                        [rol_a] + conflictivos
                    ))
        
        # 5. Validar exclusividad
        exclusividades = self.reglas.get("exclusividad", [])
        for excl in exclusividades:
            opcion_a = excl["opcion_a"]
            opcion_b = excl["opcion_b"]
            tiene_a = opcion_a in roles_seleccionados
            tiene_b = opcion_b in roles_seleccionados
            
            if tiene_a and tiene_b:
                errores.append(ErrorValidacion(
                    "exclusividad",
                    f"{self.roles_permitidos[opcion_a]['nombre']} y {self.roles_permitidos[opcion_b]['nombre']} "
                    f"son excluyentes. Motivo: {excl['motivo']}",
                    [opcion_a, opcion_b]
                ))
        
        return {
            "valido": len(errores) == 0,
            "errores": [e.to_dict() for e in errores],
            "advertencias": advertencias
        }
    
    def validar_seleccionar_rol(self, rol_id: str, roles_actuales: List[str]) -> Dict[str, Any]:
        """
        Valida si se puede añadir un rol a los actuales.
        Útil para validación en tiempo real en el frontend.
        """
        if rol_id not in self.roles_permitidos:
            return {
                "puede_agregar": False,
                "motivo": f"Rol no válido: {rol_id}"
            }
        
        roles_nuevos = roles_actuales + [rol_id]
        resultado_validacion = self.validar(roles_nuevos)
        
        return {
            "puede_agregar": resultado_validacion["valido"],
            "motivo": resultado_validacion["errores"][0]["mensaje"] if resultado_validacion["errores"] else None
        }
    
    def validar_remover_rol(self, rol_id: str, roles_actuales: List[str]) -> Dict[str, Any]:
        """
        Valida si se puede remover un rol de los actuales.
        """
        if rol_id not in roles_actuales:
            return {
                "puede_remover": False,
                "motivo": "El rol no está seleccionado"
            }
        
        roles_nuevos = [r for r in roles_actuales if r != rol_id]
        resultado_validacion = self.validar(roles_nuevos)
        
        return {
            "puede_remover": resultado_validacion["valido"],
            "motivo": resultado_validacion["errores"][0]["mensaje"] if resultado_validacion["errores"] else None
        }
