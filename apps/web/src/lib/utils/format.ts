import type { EstadoInstrumento, AgentePasoEstado } from '@fedatario/shared';

/**
 * Expande abreviaturas comunes en textos de domicilio y lugar de nacimiento.
 * Ej: "FRACC VALLE, TAMPS" → "FRACCIONAMIENTO VALLE, TAMAULIPAS"
 */
export function expandirAbreviaturas(texto: string): string {
  if (!texto) return texto;
  const reglas: [RegExp, string][] = [
    // Tipo de vialidad
    [/\bC\.\s*/gi,             'CALLE '],
    [/\bCALL\.\s*/gi,          'CALLE '],
    [/\bAV\.\s*/gi,            'AVENIDA '],
    [/\bAVE\.\s*/gi,           'AVENIDA '],
    [/\bBLVD\.\s*/gi,          'BOULEVARD '],
    [/\bBLVR\.\s*/gi,          'BOULEVARD '],
    [/\bCDA\.\s*/gi,           'CERRADA '],
    [/\bCERR\.\s*/gi,          'CERRADA '],
    [/\bCALZ\.\s*/gi,          'CALZADA '],
    [/\bPROL\.\s*/gi,          'PROLONGACIÓN '],
    [/\bCIRC\.\s*/gi,          'CIRCUITO '],
    [/\bPERIF\.\s*/gi,         'PERIFÉRICO '],
    [/\bAND\.\s*/gi,           'ANDADOR '],
    [/\bCAM\.\s*/gi,           'CAMINO '],
    [/\bRET\.\s*/gi,           'RETORNO '],
    [/\bDIAG\.\s*/gi,          'DIAGONAL '],
    // Tipo de asentamiento (punto opcional)
    [/\bFRACC\.?\s*/gi,        'FRACCIONAMIENTO '],
    [/\bCOL\.\s*/gi,           'COLONIA '],
    [/\bBARR\.?\s*/gi,         'BARRIO '],
    [/\bRES\.\s*/gi,           'RESIDENCIAL '],
    [/\bU\.?H\.\s*/gi,         'UNIDAD HABITACIONAL '],
    [/\bCTO\.\s*/gi,           'CONJUNTO '],
    [/\bRDO\.\s*/gi,           'RANCHO '],
    [/\bSEC\.\s*/gi,           'SECTOR '],
    [/\bAMP\.?\s*/gi,          'AMPLIACIÓN '],
    [/\bPOBL\.\s*/gi,          'POBLACIÓN '],
    [/\bCIUDAD\s+IND\.?\s*/gi, 'CIUDAD INDUSTRIAL '],
    // Estados (punto opcional)
    [/\bTAMPS\.?\b\s*/gi,      'TAMAULIPAS '],
    [/\bN\.?L\.?\s*/gi,        'NUEVO LEON '],
    [/\bCDMX\b\s*/gi,          'CIUDAD DE MEXICO '],
    [/\bD\.?F\.?\s*/gi,        'CIUDAD DE MEXICO '],
    [/\bJAL\.?\b\s*/gi,        'JALISCO '],
    [/\bVER\.?\b\s*/gi,        'VERACRUZ '],
    [/\bGTO\.?\b\s*/gi,        'GUANAJUATO '],
    [/\bPUE\.?\b\s*/gi,        'PUEBLA '],
    [/\bCOAH\.?\b\s*/gi,       'COAHUILA '],
    [/\bSON\.?\b\s*/gi,        'SONORA '],
    [/\bSIN\.?\b\s*/gi,        'SINALOA '],
    [/\bCHIH\.?\b\s*/gi,       'CHIHUAHUA '],
    [/\bMICH\.?\b\s*/gi,       'MICHOACAN '],
    [/\bOAX\.?\b\s*/gi,        'OAXACA '],
    [/\bGRO\.?\b\s*/gi,        'GUERRERO '],
    [/\bYUC\.?\b\s*/gi,        'YUCATAN '],
    [/\bHGO\.?\b\s*/gi,        'HIDALGO '],
    [/\bMOR\.?\b\s*/gi,        'MORELOS '],
    [/\bQRO\.?\b\s*/gi,        'QUERETARO '],
    [/\bQ\.?ROO\.?\s*/gi,      'QUINTANA ROO '],
    [/\bAGS\.?\b\s*/gi,        'AGUASCALIENTES '],
    [/\bBCN\.?\b\s*/gi,        'BAJA CALIFORNIA '],
    [/\bBCS\.?\b\s*/gi,        'BAJA CALIFORNIA SUR '],
    [/\bCAMP\.?\b\s*/gi,       'CAMPECHE '],
    [/\bCHIS\.?\b\s*/gi,       'CHIAPAS '],
    [/\bDGO\.?\b\s*/gi,        'DURANGO '],
    [/\bMEX\.?\b\s*/gi,        'ESTADO DE MEXICO '],
    [/\bNAY\.?\b\s*/gi,        'NAYARIT '],
    [/\bSLP\.?\b\s*/gi,        'SAN LUIS POTOSI '],
    [/\bTAB\.?\b\s*/gi,        'TABASCO '],
    [/\bTLAX\.?\b\s*/gi,       'TLAXCALA '],
    [/\bZAC\.?\b\s*/gi,        'ZACATECAS '],
    // Numeración
    [/\bNO\.\s*/gi,            'NÚMERO '],
  ];
  let resultado = texto.toUpperCase();
  for (const [patron, reemplazo] of reglas) {
    resultado = resultado.replace(patron, reemplazo);
  }
  return resultado.replace(/\s{2,}/g, ' ').trim();
}

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
