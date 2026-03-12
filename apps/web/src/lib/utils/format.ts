import type { EstadoInstrumento, AgentePasoEstado } from '@fedatario/shared';

// ─── Normalización de domicilio ───────────────────────────────────────────────

const _ABREV_VIALIDAD: Record<string, string> = {
  BOULEVARD: 'BOULEVARD', CALZADA: 'CALZADA', CARRETERA: 'CARRETERA',
  PROLONGACIÓN: 'PROLONGACIÓN', PRIVADA: 'PRIVADA', CIRCUITO: 'CIRCUITO',
  AVENIDA: 'AVENIDA', ANDADOR: 'ANDADOR', CERRADA: 'CERRADA',
  RETORNO: 'RETORNO', FRACCIONAMIENTO: 'FRACCIONAMIENTO',
  'UNIDAD HABITACIONAL': 'UNIDAD HABITACIONAL', URBANIZACIÓN: 'URBANIZACIÓN',
  SECCIÓN: 'SECCIÓN', COLONIA: 'COLONIA', DEPARTAMENTO: 'DEPARTAMENTO',
  EDIFICIO: 'EDIFICIO', LOCAL: 'LOCAL', MANZANA: 'MANZANA',
  INTERIOR: 'INTERIOR', LOTE: 'LOTE', 'SIN NÚMERO': 'SIN NÚMERO', CALLE: 'CALLE',
  // Abreviaturas
  BLVD: 'BOULEVARD', CALZ: 'CALZADA', CARR: 'CARRETERA',
  PROL: 'PROLONGACIÓN', PRIV: 'PRIVADA', CIRC: 'CIRCUITO',
  AVE: 'AVENIDA', AV: 'AVENIDA', AND: 'ANDADOR',
  CDA: 'CERRADA', RET: 'RETORNO', FRACC: 'FRACCIONAMIENTO',
  UHAB: 'UNIDAD HABITACIONAL', URB: 'URBANIZACIÓN',
  SECC: 'SECCIÓN', COL: 'COLONIA', DEPTO: 'DEPARTAMENTO',
  EDIF: 'EDIFICIO', LOC: 'LOCAL', MZ: 'MANZANA',
  INT: 'INTERIOR', LT: 'LOTE', 'S/N': 'SIN NÚMERO', C: 'CALLE',
};

const _PATRON_VIALIDAD = new RegExp(
  `\\b(${Object.keys(_ABREV_VIALIDAD)
    .sort((a, b) => b.length - a.length)
    .map(k => k.replace(/[/\\^$*+?.()|[\]{}]/g, '\\$&'))
    .join('|')})\\b`,
  'g'
);

const _ABREV_ESTADOS: Record<string, string> = {
  AGS: 'AGUASCALIENTES', BC: 'BAJA CALIFORNIA', BCS: 'BAJA CALIFORNIA SUR',
  CAMP: 'CAMPECHE', CHIS: 'CHIAPAS', CHIH: 'CHIHUAHUA',
  CDMX: 'CIUDAD DE MEXICO', DF: 'CIUDAD DE MEXICO', COAH: 'COAHUILA',
  COL: 'COLIMA', DGO: 'DURANGO', GTO: 'GUANAJUATO', GRO: 'GUERRERO',
  HGO: 'HIDALGO', JAL: 'JALISCO', MEX: 'ESTADO DE MEXICO',
  EDOMEX: 'ESTADO DE MEXICO', MICH: 'MICHOACAN', MOR: 'MORELOS',
  NAY: 'NAYARIT', NL: 'NUEVO LEON', OAX: 'OAXACA', PUE: 'PUEBLA',
  QRO: 'QUERETARO', QROO: 'QUINTANA ROO', SLP: 'SAN LUIS POTOSI',
  SIN: 'SINALOA', SON: 'SONORA', TAB: 'TABASCO', TAMPS: 'TAMAULIPAS',
  TLAX: 'TLAXCALA', VER: 'VERACRUZ', YUC: 'YUCATAN', ZAC: 'ZACATECAS',
};

/** Normaliza el campo calle/colonia/domicilio: quita puntos de abreviaturas y expande. */
export function normalizarDomicilio(valor: string): string {
  if (!valor) return valor;
  return valor
    .toUpperCase()
    .replace(/\.(?=\s|$)/g, '')   // quita puntos al final de palabra
    .replace(_PATRON_VIALIDAD, m => _ABREV_VIALIDAD[m] ?? m)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Normaliza el campo estado: expande abreviatura de estado mexicano. */
export function normalizarEstado(valor: string): string {
  if (!valor) return valor;
  const clave = valor.toUpperCase().trim().replace(/\./g, '');
  return _ABREV_ESTADOS[clave] ?? valor.toUpperCase();
}

// ─── Mapa para lugar_nacimiento: estados + ciudades ──────────────────────────
const _ABREV_LUGAR: Record<string, string> = {
  // Ciudades frecuentes en INE
  MTY: 'MONTERREY', GDL: 'GUADALAJARA',
  CDMX: 'CIUDAD DE MEXICO', DF: 'CIUDAD DE MEXICO',
  // 32 entidades federativas
  AGS: 'AGUASCALIENTES', BC: 'BAJA CALIFORNIA', BCS: 'BAJA CALIFORNIA SUR',
  CAMP: 'CAMPECHE', CHIS: 'CHIAPAS', CHIH: 'CHIHUAHUA',
  COAH: 'COAHUILA', COL: 'COLIMA', DGO: 'DURANGO', GTO: 'GUANAJUATO',
  GRO: 'GUERRERO', HGO: 'HIDALGO', JAL: 'JALISCO', MEX: 'ESTADO DE MEXICO',
  EDOMEX: 'ESTADO DE MEXICO', MICH: 'MICHOACAN', MOR: 'MORELOS',
  NAY: 'NAYARIT', NL: 'NUEVO LEON', OAX: 'OAXACA', PUE: 'PUEBLA',
  QRO: 'QUERETARO', QROO: 'QUINTANA ROO', SLP: 'SAN LUIS POTOSI',
  SIN: 'SINALOA', SON: 'SONORA', TAB: 'TABASCO', TAMPS: 'TAMAULIPAS',
  TLAX: 'TLAXCALA', VER: 'VERACRUZ', YUC: 'YUCATAN', ZAC: 'ZACATECAS',
};

/**
 * Normaliza lugar_nacimiento: expansión de abreviaturas de ciudades y estados.
 * (No usa el mapa de vialidad para no convertir "COL." en "COLONIA".)
 */
export function normalizarLugar(valor: string): string {
  if (!valor) return valor;
  return valor
    .toUpperCase()
    .replace(/\.(?=\s|$)/g, '')   // quita puntos de abreviaturas
    .replace(/\b([A-Z]+)\b/g, m => _ABREV_LUGAR[m] ?? m)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Alias para uso en el backend (Python importa la versión Python, aquí para el frontend) */
export const expandirAbreviaturas = normalizarDomicilio;

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
