// ─────────────────────────────────────────────
// FEDATARIO — Shared Types v2
// Arquitectura definida: 06-Mar-2026
// ─────────────────────────────────────────────

// ── TENANT ────────────────────────────────────

export interface Tenant {
  id: string;
  nombre: string;
  corredor: {
    nombre: string;
    curp: string;
    efirmaVigente: boolean;
    efirmaVencimiento?: string;
  };
  protocolo: string;
  estado: string;
}

// ── CLIENTE ───────────────────────────────────

export type TipoPersona = 'fisica' | 'moral';
export type TipoMigratorio = 'FM2' | 'FM3' | 'residencia_permanente' | 'otro';

export interface Cliente {
  id: string;
  tenantId: string;
  tipoPersona: TipoPersona;
  nombre: string;
  nacionalidad?: string;
  rfc?: string;
  curp?: string;
  migratorio?: TipoMigratorio;
  portalActivo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

// ── INSTRUMENTO ───────────────────────────────

export type TipoInstrumento = 'sa_de_cv' | 's_de_rl';

export type EstadoInstrumento =
  | 'paso_01_identificacion'
  | 'paso_02_tipo'
  | 'paso_03_datos_basicos'
  | 'paso_04_clientes_creados'
  | 'paso_05_portal_en_progreso'
  | 'paso_06_mua'
  | 'paso_07_acopio_completo'
  | 'paso_08_redaccion'
  | 'paso_09_borrador_enviado'
  | 'paso_10_firma'
  | 'cerrado';

export type RolSocio =
  | 'socio'
  | 'administrador_unico'
  | 'representante_legal'
  | 'comisario'
  | 'consejo_administracion'
  | 'secretario_consejo'
  | 'apoderado';

export interface SocioInstrumento {
  clienteId: string;
  rol: RolSocio;
  porcentaje: number;
  datosCompletos: boolean;
  documentosCompletos: boolean;
}

export interface Instrumento {
  id: string;
  tenantId: string;
  tipo: TipoInstrumento;
  estado: EstadoInstrumento;
  numeroInstrumento?: number;
  sociedadNombre?: string;
  objetoSocial?: string;
  capitalSocial?: number;
  domicilioSocial?: string;
  duracion?: string;
  cudMUA?: string;
  linkPortalToken: string;
  linkActivo: boolean;
  socios: SocioInstrumento[];
  seccionesActivas: string[];
  pipeline: PipelineJob[];
  creadoEn: string;
  actualizadoEn: string;
}

// ── DOCUMENTO ─────────────────────────────────

export type TipoDocumento =
  | 'ine'
  | 'curp'
  | 'rfc'
  | 'pasaporte'
  | 'fm2'
  | 'fm3'
  | 'acta_nacimiento'
  | 'comprobante_domicilio'
  | 'carta_naturalizacion'
  | 'poder_notarial'
  | 'acta_constitutiva_moral'
  | 'mua'
  | 'otro';

export type EstadoDocumento =
  | 'pendiente'
  | 'en_revision'
  | 'aprobado'
  | 'rechazado';

export interface Documento {
  id: string;
  tenantId: string;
  clienteId: string;
  instrumentoId: string;
  tipo: TipoDocumento;
  nombre: string;
  storagePath: string;
  storageUrl: string;
  estado: EstadoDocumento;
  datosExtraidos?: Record<string, any>;
  notaRevision?: string;
  revisadoPor?: string;
  revisadoEn?: string;
  creadoEn: string;
}

// ── PLANTILLA ─────────────────────────────────

export type TipoCampo =
  | 'texto'
  | 'texto_largo'
  | 'numero'
  | 'moneda'
  | 'porcentaje'
  | 'fecha'
  | 'seleccion'
  | 'lista_socios';

export type FuenteDocumento =
  | 'ine'
  | 'curp'
  | 'rfc'
  | 'pasaporte'
  | 'fm2'
  | 'mua'
  | 'formulario'
  | 'sistema';

export interface CampoActa {
  id: string;
  seccion: string;
  nombre: string;
  etiqueta: string;
  tipo: TipoCampo;
  requerido: boolean;
  fuenteDocumento: FuenteDocumento;
  enCompendio: boolean;
  orden: number;
  valorDefault?: string;
}

export interface SeccionActa {
  id: string;
  nombre: string;
  orden: number;
  esBase: boolean;
  aplicaSA: boolean;
  aplicaSRL: boolean;
  campos: CampoActa[];
}

export interface Plantilla {
  tenantId: string;
  secciones: SeccionActa[];
  actualizadaEn: string;
}

// ── REGLAS ────────────────────────────────────

export type TipoRegla = 'campo' | 'documento' | 'seccion';
export type OperadorRegla = 'igual' | 'diferente' | 'contiene' | 'existe' | 'mayor' | 'menor';
export type TipoAccion = 'mostrar' | 'ocultar' | 'requerir' | 'activar' | 'desactivar';

export interface Regla {
  id: string;
  tenantId: string;
  nombre: string;
  tipo: TipoRegla;
  activa: boolean;
  condicion: {
    campo: string;
    operador: OperadorRegla;
    valor: string;
  };
  accion: {
    tipo: TipoAccion;
    objetivo: string;
  };
  creadoEn: string;
}

// ── PIPELINE JOB ──────────────────────────────

export type EtapaJob =
  | 'extraccion'
  | 'validacion'
  | 'redaccion'
  | 'auditoria';

export type EstadoJob =
  | 'queued'
  | 'running'
  | 'completado'
  | 'error'
  | 'pausado';

export interface PipelineJob {
  id: string;
  tenantId: string;
  instrumentoId: string;
  etapa: EtapaJob;
  estado: EstadoJob;
  resultado?: Record<string, any>;
  errorDetalle?: string;
  creadoEn: string;
}

// ── PORTAL ────────────────────────────────────

export interface EtapaPipelineCliente {
  id: string;
  orden: number;
  estadoInterno: EstadoInstrumento;
  nombreCliente: string;
  descripcionCliente: string;
  icono: string;
}

export interface MensajeChat {
  id: string;
  instrumentoId: string;
  rol: 'cliente' | 'agente';
  texto: string;
  creadoEn: string;
}
