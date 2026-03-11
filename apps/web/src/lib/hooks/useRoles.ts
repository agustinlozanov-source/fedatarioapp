import { useState, useCallback } from 'react';

interface Rol {
  id: string;
  nombre: string;
  categoria: string;
}

interface Reglas {
  obligatorios: string[];
  minimo_administracion: number;
  incompatibilidades: Array<{
    rol_a: string;
    prohibidos: string[];
    motivo: string;
  }>;
  exclusividad: Array<{
    opcion_a: string;
    opcion_b: string;
    motivo: string;
  }>;
}

interface RolesConfig {
  tipo: string;
  nombre_largo: string;
  roles: Rol[];
  reglas: Reglas;
}

interface ErrorValidacion {
  tipo: string;
  mensaje: string;
  roles_conflictivos: string[];
}

interface ResultadoValidacion {
  ok: boolean;
  valido: boolean;
  errores: ErrorValidacion[];
  advertencias: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_AGENTS_URL || 'https://fedatario-production.up.railway.app';

export const useRoles = (tipoSociedad: string) => {
  const [config, setConfig] = useState<RolesConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar configuración de roles
  const cargarRoles = useCallback(async () => {
    if (!tipoSociedad) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE}/roles/${tipoSociedad}`);
      if (!res.ok) throw new Error('Error al cargar roles');
      
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : 'Error desconocido';
      setError(mensaje);
    } finally {
      setLoading(false);
    }
  }, [tipoSociedad]);

  // Validar roles seleccionados
  const validarRoles = useCallback(async (rolesSeleccionados: string[]): Promise<ResultadoValidacion> => {
    try {
      const res = await fetch(`${API_BASE}/roles/validar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: rolesSeleccionados,
          tipo_sociedad: tipoSociedad,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al validar roles');
      }

      return await res.json();
    } catch (err) {
      return {
        ok: false,
        valido: false,
        errores: [{
          tipo: 'error_api',
          mensaje: err instanceof Error ? err.message : 'Error desconocido',
          roles_conflictivos: [],
        }],
        advertencias: [],
      };
    }
  }, [tipoSociedad]);

  // Validar si se puede agregar un rol (tiempo real)
  const puedeAgregarRol = useCallback(async (rolId: string, rolesActuales: string[]): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/roles/validar-agregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol_id: rolId,
          roles_actuales: rolesActuales,
          tipo_sociedad: tipoSociedad,
        }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      return data.puede_agregar;
    } catch {
      return false;
    }
  }, [tipoSociedad]);

  // Validar si se puede remover un rol (tiempo real)
  const puedeRemoverRol = useCallback(async (rolId: string, rolesActuales: string[]): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/roles/validar-remover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol_id: rolId,
          roles_actuales: rolesActuales,
          tipo_sociedad: tipoSociedad,
        }),
      });

      if (!res.ok) return false;

      const data = await res.json();
      return data.puede_remover;
    } catch {
      return false;
    }
  }, [tipoSociedad]);

  // Agrupar roles por categoría
  const rolesAgrupados = config?.roles.reduce((acc, rol) => {
    if (!acc[rol.categoria]) {
      acc[rol.categoria] = [];
    }
    acc[rol.categoria].push(rol);
    return acc;
  }, {} as Record<string, Rol[]>) || {};

  return {
    config,
    rolesAgrupados,
    loading,
    error,
    cargarRoles,
    validarRoles,
    puedeAgregarRol,
    puedeRemoverRol,
  };
};
