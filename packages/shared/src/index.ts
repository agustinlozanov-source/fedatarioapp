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

export interface ClienteDomicilio {
  calle?: string;
  numero?: string;
  noExt?: string;
  entre?: string;
  colonia?: string;
  cp?: string;
  municipio?: string;
  ciudad?: string;
  estado?: string;
  pais?: string;
}

export interface ClienteCapacidades {
  sabeLeer?: boolean;
  sabeEscribir?: boolean;
  sabeFirmar?: boolean;
}

export interface Cliente {
  id: string;
  tenantId: string;
  tipoPersona: TipoPersona;
  nombre: string;
  
  // ─ PROFILE ────────────────────────────────
  es_extranjero: boolean;  // false = Mexicano, true = Extranjero
  
  // ─ DATOS OBLIGATORIOS (TODOS) ─────────────
  nombre_completo: string;  // Requerido
  rfc: string;              // Requerido (incluso extranjeros)
  fecha_nacimiento: string; // Requerido (ISO date: "1987-08-13")
  lugar_nacimiento: string; // Requerido
  ocupacion: string;        // Requerido
  estado_civil: string;     // Requerido ("Soltero", "Casado", etc.)
  genero: string;           // Requerido ("masculino", "femenino")
  domicilio: string;        // Requerido (una línea: "Calle X 123, CP 28001, Madrid")
  
  // ─ DATOS MEXICANO ──────────────────────────
  curp?: string;            // Mexicano: obligatorio
  clave_elector?: string;   // Mexicano: opcional
  seccion_ine?: string;     // Mexicano: opcional
  idmex?: string;           // Mexicano: opcional
  vigencia_ine?: string;    // Mexicano: opcional
  
  // ─ DATOS EXTRANJERO ────────────────────────
  numero_pasaporte?: string; // Extranjero: requerido
  numero_fm?: string;       // Extranjero: requerido (FM2, FM3, o residencia permanente)
  vigencia_fm?: string;     // Extranjero: opcional
  migratorio?: TipoMigratorio; // Extranjero: tipo de documento migratorio
  
  // ─ INFORMACIÓN COMPLEMENTARIA ──────────────
  nacionalidad?: string;    // País de nacimiento
  regimen_fiscal?: string;  // Régimen fiscal (si aplica)
  
  // ─ CONTACTO ───────────────────────────────
  email?: string;
  telefono?: string;
  celular?: string;
  
  // ─ CAPACIDADES ────────────────────────────
  capacidades?: ClienteCapacidades;
  
  // ─ DATOS VALIDADOS ────────────────────────
  nombreValidado?: boolean;
  rfcValidado?: boolean;
  curpValidado?: boolean;
  fechaNacimientoValidada?: boolean;
  lugarNacimientoValidado?: boolean;
  
  // ─ SISTEMA ────────────────────────────────
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
  
  // ─ DATOS COPIADOS DEL CLIENTE (Para compendio) ─
  // Cuando se carga un Cliente, copiar TODOS estos datos aquí
  nombre_completo?: string;
  rfc?: string;
  curp?: string;
  fecha_nacimiento?: string;
  lugar_nacimiento?: string;
  ocupacion?: string;
  estado_civil?: string;
  genero?: string;
  domicilio?: string;
  es_extranjero?: boolean;
  
  // Mexicano
  clave_elector?: string;
  seccion_ine?: string;
  idmex?: string;
  
  // Extranjero
  numero_pasaporte?: string;
  numero_fm?: string;
}

export interface Instrumento {
  id: string;
  tenantId: string;
  tipo: TipoInstrumento;
  estado: EstadoInstrumento;
  numeroInstrumento?: number;
  numero_poliza?: number;
  denominacion_social?: string;
  sociedadNombre?: string;
  objetoSocial?: string;
  objeto_social_texto?: string;
  capitalSocial?: number;
  capital_social?: number;
  capital_fijo?: number;
  domicilioSocial?: string;
  domicilio_social?: string;
  duracion?: string;
  cud?: string;
  cudMUA?: string;
  solicitante_mua?: string;
  cudPdfUrl?: string;
  fecha_instrumento?: string;
  ciudad_fedatario?: string;
  tipo_sociedad?: string;
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

// ── ALIAS PARA COMPATIBILIDAD ──────────────────

export type DocumentoPortal = Documento;
