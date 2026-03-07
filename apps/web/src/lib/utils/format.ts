import type { InstrumentoEstado, AgentePasoEstado } from '@fedatario/shared';

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat('es-MX').format(n);
}

export function formatMXN(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(n);
}

export const estadoLabels: Record<InstrumentoEstado, string> = {
  borrador:             'Borrador',
  extraccion:           'Extrayendo datos',
  validacion_juridica:  'Validación jurídica',
  redaccion:            'Redactando acta',
  auditoria:            'Auditoría',
  revision_corredor:    'Revisión del Corredor',
  firmado:              'Firmado',
  archivado:            'Archivado',
};

export const estadoBadge: Record<InstrumentoEstado, string> = {
  borrador:             'badge-gray',
  extraccion:           'badge-blue',
  validacion_juridica:  'badge-amber',
  redaccion:            'badge-teal',
  auditoria:            'badge-purple',
  revision_corredor:    'badge-orange',
  firmado:              'badge-green',
  archivado:            'badge-gray',
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

export function pipelineStep(estado: InstrumentoEstado): number {
  const order: InstrumentoEstado[] = [
    'borrador', 'extraccion', 'validacion_juridica',
    'redaccion', 'auditoria', 'revision_corredor', 'firmado',
  ];
  return order.indexOf(estado);
}
