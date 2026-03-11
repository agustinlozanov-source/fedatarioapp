import type { Instrumento, Cliente } from '@fedatario/shared';

type LibroInstrumento = Instrumento;

export const mockClientes: Cliente[] = [
  {
    id: 'cli-001', tenantId: 'tenant-001', tipoPersona: 'fisica',
    nombre: 'Wei Zhang', rfc: 'ZHAW850412AB3', nacionalidad: 'China',
    migratorio: 'FM2', documentos: [], creadoEn: '2025-01-10T10:00:00Z', actualizadoEn: '2025-01-10T10:00:00Z',
  },
  {
    id: 'cli-002', tenantId: 'tenant-001', tipoPersona: 'fisica',
    nombre: 'Carlos Mendoza Ruiz', rfc: 'MERC780901XY1', curp: 'MERC780901HMNNDRA', nacionalidad: 'México',
    documentos: [], creadoEn: '2025-01-15T09:00:00Z', actualizadoEn: '2025-01-15T09:00:00Z',
  },
  {
    id: 'cli-003', tenantId: 'tenant-001', tipoPersona: 'fisica',
    nombre: 'Li Ming', rfc: 'LIMC900214ZA8', nacionalidad: 'China',
    migratorio: 'FM2', documentos: [], creadoEn: '2025-02-01T08:00:00Z', actualizadoEn: '2025-02-01T08:00:00Z',
  },
];

export const mockInstrumentos: Instrumento[] = [
  {
    id: 'inst-001', tenantId: 'tenant-001', numeroInstrumento: 1247,
    tipo: 'acta_constitutiva', estado: 'revision_corredor',
    puntoEntrada: 'whisper',
    clienteIds: ['cli-001', 'cli-002'],
    sociedadNombre: 'Importadora Sino-México S.A. de C.V.',
    tipoSociedad: 'SA de CV', objetoSocial: 'Importación y distribución de productos electrónicos',
    capitalSocial: 50000,
    socios: [
      { clienteId: 'cli-001', nombre: 'Wei Zhang', porcentajeParticipacion: 60, aportacion: 30000, rol: 'socio_administrador' },
      { clienteId: 'cli-002', nombre: 'Carlos Mendoza', porcentajeParticipacion: 40, aportacion: 20000, rol: 'socio' },
    ],
    pipeline: {
      agt00_orquestador: { estado: 'completado', confianza: 0.97, completadoEn: '2025-03-01T10:05:00Z', duracionMs: 1240 },
      agt01_extractor:   { estado: 'completado', confianza: 0.94, completadoEn: '2025-03-01T10:06:00Z', duracionMs: 3200 },
      agt02_juridico:    { estado: 'completado', confianza: 0.98, completadoEn: '2025-03-01T10:07:00Z', duracionMs: 2100 },
      agt03_redactor:    { estado: 'completado', confianza: 0.92, completadoEn: '2025-03-01T10:09:00Z', duracionMs: 4800 },
      agt04_auditor:     { estado: 'completado', confianza: 0.95, completadoEn: '2025-03-01T10:10:00Z', duracionMs: 1800 },
    },
    creadoEn: '2025-03-01T10:00:00Z', actualizadoEn: '2025-03-01T10:10:00Z',
  },
  {
    id: 'inst-002', tenantId: 'tenant-001', numeroInstrumento: 1248,
    tipo: 'acta_constitutiva', estado: 'extraccion',
    puntoEntrada: 'formulario',
    clienteIds: ['cli-003'],
    sociedadNombre: 'TechParts de México S. de R.L.',
    tipoSociedad: 'S de RL', capitalSocial: 100000,
    socios: [
      { clienteId: 'cli-003', nombre: 'Li Ming', porcentajeParticipacion: 100, aportacion: 100000, rol: 'socio_administrador' },
    ],
    pipeline: {
      agt00_orquestador: { estado: 'completado', confianza: 0.99 },
      agt01_extractor:   { estado: 'proceso' },
      agt02_juridico:    { estado: 'pendiente' },
      agt03_redactor:    { estado: 'pendiente' },
      agt04_auditor:     { estado: 'pendiente' },
    },
    creadoEn: '2025-03-04T09:00:00Z', actualizadoEn: '2025-03-04T09:00:00Z',
  },
  {
    id: 'inst-003', tenantId: 'tenant-001', numeroInstrumento: 1249,
    tipo: 'acta_constitutiva', estado: 'borrador',
    puntoEntrada: 'whisper',
    clienteIds: [],
    socios: [],
    pipeline: {
      agt00_orquestador: { estado: 'pendiente' },
      agt01_extractor:   { estado: 'pendiente' },
      agt02_juridico:    { estado: 'pendiente' },
      agt03_redactor:    { estado: 'pendiente' },
      agt04_auditor:     { estado: 'pendiente' },
    },
    creadoEn: '2025-03-05T08:00:00Z', actualizadoEn: '2025-03-05T08:00:00Z',
  },
];

export const mockLibro: LibroInstrumento[] = [
  { id: 'lib-001', tenantId: 'tenant-001', numeroInstrumento: 1244, tipo: 'acta_constitutiva', sociedadNombre: 'Logística Norteña S.A.', partes: ['Juan Pérez', 'María García'], folioInicio: 120, folioFin: 134, fechaFirma: '2025-02-10', actaUrl: '#' },
  { id: 'lib-002', tenantId: 'tenant-001', numeroInstrumento: 1245, tipo: 'acta_constitutiva', sociedadNombre: 'Distribuidora del Norte S. de R.L.', partes: ['Roberto Soto'], folioInicio: 135, folioFin: 147, fechaFirma: '2025-02-18', actaUrl: '#' },
  { id: 'lib-003', tenantId: 'tenant-001', numeroInstrumento: 1246, tipo: 'acta_constitutiva', sociedadNombre: 'Manufactura GNR S.A. de C.V.', partes: ['Grupo NR Holdings'], folioInicio: 148, folioFin: 162, fechaFirma: '2025-02-28', actaUrl: '#' },
];
