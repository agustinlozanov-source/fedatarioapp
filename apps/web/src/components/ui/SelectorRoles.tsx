'use client';

import { useEffect, useState } from 'react';
import { useRoles } from '@/lib/hooks/useRoles';
import { CheckCircle } from 'lucide-react';

interface SelectorRolesProps {
  tipoSociedad: string;
  rolesSeleccionados: string[];
  onChange: (rolesNuevos: string[]) => void;
  deshabilitado?: boolean;
  soloMostrar?: boolean; // Si true, solo muestra los roles sin permitir cambios
}

export function SelectorRoles({
  tipoSociedad,
  rolesSeleccionados,
  onChange,
  deshabilitado = false,
  soloMostrar = false,
}: SelectorRolesProps) {
  const { config, rolesAgrupados, loading, error, cargarRoles } = useRoles(tipoSociedad);

  useEffect(() => {
    cargarRoles();
  }, [cargarRoles]);

  const handleToggleRol = (rolId: string) => {
    if (deshabilitado || soloMostrar) return;

    const estaSeleccionado = rolesSeleccionados.includes(rolId);

    if (estaSeleccionado) {
      onChange(rolesSeleccionados.filter(r => r !== rolId));
    } else {
      // Permitir seleccionar sin validar en tiempo real
      onChange([...rolesSeleccionados, rolId]);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando roles...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
        <p className="text-red-700 dark:text-red-200">Error: {error}</p>
      </div>
    );
  }

  if (!config) {
    return <div className="text-center py-8">No hay configuración disponible</div>;
  }

  return (
    <div className="space-y-6">
      {/* Checkboxes por Categoría */}
      {Object.entries(rolesAgrupados).map(([categoria, roles]) => (
        <div key={categoria} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            {categoria}
          </h3>
          <div className="space-y-2">
            {roles.map(rol => (
              <label
                key={rol.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={rolesSeleccionados.includes(rol.id)}
                  onChange={() => handleToggleRol(rol.id)}
                  disabled={deshabilitado || soloMostrar}
                  className="mt-1 w-4 h-4 rounded border-gray-300 dark:border-gray-600 accent-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {rol.nombre}
                  </div>
                  {/* Mostrar ID para referencia */}
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ID: {rol.id}
                  </div>
                </div>
                {rolesSeleccionados.includes(rol.id) && (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      {/* Información de Reglas (Solo informativa, no valida) */}
      {config.reglas && !soloMostrar && (
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-2">Nota sobre validación:</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Puedes seleccionar roles libremente mientras completas el formulario</li>
              <li>Las reglas se validarán cuando intentes avanzar de paso o generar documento</li>
              {config.reglas.obligatorios.length > 0 && (
                <li>Roles obligatorios: {config.reglas.obligatorios.join(', ')}</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
