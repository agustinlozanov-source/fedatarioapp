import type { EstadoInstrumento, AgentePasoEstado } from '@fedatario/shared';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat('es-MX').format(n);
}

export function formatMXN(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
}

export const estadoLabels: Record<EstadoInstrumento, string> = {
  paso_01_identificacion:  'Identificación',
  paso_02_tipo:            'Tipo de Sociedad',
  paso_03_datos_basicos:   'Datos Básicos',
  paso_04_clientes_creados: 'Clientes',
  paso_05_portal_en_progreso: 'Portal',
  paso_06_mua:             'MUA',
  paso_07_acopio_completo: 'Acopio',
  paso_08_redaccion:       'Redactando acta',
  paso_09_borrador_enviado: 'Borrador',
  paso_10_firma:           'Firma',
  firmado:                 'Firmado',
  cerrado:                 'Cerrado',
};

export const estadoBadge: Record<EstadoInstrumento, string> = {
  paso_01_identificacion:  'badge-gray',
  paso_02_tipo:            'badge-gray',
  paso_03_datos_basicos:   'badge-blue',
  paso_04_clientes_creados: 'badge-blue',
  paso_05_portal_en_progreso: 'badge-amber',
  paso_06_mua:             'badge-amber',
  paso_07_acopio_completo: 'badge-teal',
  paso_08_redaccion:       'badge-purple',
  paso_09_borrador_enviado: 'badge-orange',
  paso_10_firma:           'badge-orange',
  firmado:                 'badge-green',
  cerrado:                 'badge-gray',
};

export const agenteLabels: Record<string, string> = {
  agt00_orquestador: 'Orquestador',
  agt01_extractor:   'Extractor',
  agt02_juridico:    'Jurídico',
  agt03_redactor:    'Redactor',
  agt04_auditor:     'Auditor',
};

export const agentePasoColor: Record<AgentePasoEstado, string> = {
  pendiente:        'var(--bg3)',
  proceso:          'var(--blue)',
  completado:       'var(--green)',
  error:            'var(--red)',
  esperando_input:  'var(--orange)',
};

export function pipelineStep(estado: EstadoInstrumento): number {
  const order: EstadoInstrumento[] = [
    'paso_01_identificacion', 'paso_02_tipo', 'paso_03_datos_basicos',
    'paso_04_clientes_creados', 'paso_05_portal_en_progreso', 'paso_06_mua',
    'paso_07_acopio_completo', 'paso_08_redaccion', 'paso_09_borrador_enviado',
    'paso_10_firma', 'firmado', 'cerrado',
  ];
  return order.indexOf(estado);
}
