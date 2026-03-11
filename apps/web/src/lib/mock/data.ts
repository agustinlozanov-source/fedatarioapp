import type { Instrumento, Cliente } from '@fedatario/shared';

type LibroInstrumento = Instrumento;

export const mockClientes: Cliente[] = [
  {
    id: 'cli-001', tenantId: 'tenant-001', tipoPersona: 'fisica',
    nombre: 'Wei Zhang', nombre_completo: 'Wei Zhang',
    es_extranjero: true,
    rfc: 'ZHAW850412AB3', fecha_nacimiento: '1985-04-12',
    lugar_nacimiento: 'Beijing, China', ocupacion: 'Empresario',
    estado_civil: 'Casado', genero: 'masculino',
    domicilio: 'Av. Insurgentes Sur 1234, Col. Del Valle, CDMX',
    nacionalidad: 'China', migratorio: 'FM2', numero_fm: 'FM2-001',
    portalActivo: false,
    creadoEn: '2025-01-10T10:00:00Z', actualizadoEn: '2025-01-10T10:00:00Z',
  },
  {
    id: 'cli-002', tenantId: 'tenant-001', tipoPersona: 'fisica',
    nombre: 'Carlos Mendoza Ruiz', nombre_completo: 'Carlos Mendoza Ruiz',
    es_extranjero: false,
    rfc: 'MERC780901XY1', curp: 'MERC780901HMNNDRA', fecha_nacimiento: '1978-09-01',
    lugar_nacimiento: 'Monterrey, Nuevo León', ocupacion: 'Empresario',
    estado_civil: 'Casado', genero: 'masculino',
    domicilio: 'Calle Morelos 456, Col. Centro, Monterrey, NL',
    nacionalidad: 'México',
    portalActivo: false,
    creadoEn: '2025-01-15T09:00:00Z', actualizadoEn: '2025-01-15T09:00:00Z',
  },
  {
    id: 'cli-003', tenantId: 'tenant-001', tipoPersona: 'fisica',
    nombre: 'Li Ming', nombre_completo: 'Li Ming',
    es_extranjero: true,
    rfc: 'LIMC900214ZA8', fecha_nacimiento: '1990-02-14',
    lugar_nacimiento: 'Shanghai, China', ocupacion: 'Ingeniero',
    estado_civil: 'Soltero', genero: 'masculino',
    domicilio: 'Blvd. Manuel Ávila Camacho 789, Naucalpan, Estado de México',
    nacionalidad: 'China', migratorio: 'FM2', numero_fm: 'FM2-002',
    portalActivo: false,
    creadoEn: '2025-02-01T08:00:00Z', actualizadoEn: '2025-02-01T08:00:00Z',
  },
];

export const mockInstrumentos: Instrumento[] = [
  {
    id: 'inst-001', tenantId: 'tenant-001', numeroInstrumento: 1247,
    tipo: 'sa_de_cv', estado: 'paso_09_borrador_enviado',
    denominacion_social: 'Importadora Sino-México S.A. de C.V.',
    objeto_social_texto: 'Importación y distribución de productos electrónicos',
    capital_social: 50000,
    socios: [
      { clienteId: 'cli-001', porcentaje: 60, rol: 'administrador_unico', datosCompletos: true, documentosCompletos: true },
      { clienteId: 'cli-002', porcentaje: 40, rol: 'socio', datosCompletos: true, documentosCompletos: false },
    ],
    pipeline: [],
    linkPortalToken: 'tok-001', linkActivo: true, seccionesActivas: [],
    creadoEn: '2025-03-01T10:00:00Z', actualizadoEn: '2025-03-01T10:10:00Z',
  },
  {
    id: 'inst-002', tenantId: 'tenant-001', numeroInstrumento: 1248,
    tipo: 'sa_de_cv', estado: 'paso_02_tipo',
    denominacion_social: 'TechParts de México S. de R.L.',
    capital_social: 100000,
    socios: [
      { clienteId: 'cli-003', porcentaje: 100, rol: 'administrador_unico', datosCompletos: false, documentosCompletos: false },
    ],
    pipeline: [],
    linkPortalToken: 'tok-002', linkActivo: true, seccionesActivas: [],
    creadoEn: '2025-03-04T09:00:00Z', actualizadoEn: '2025-03-04T09:00:00Z',
  },
  {
    id: 'inst-003', tenantId: 'tenant-001', numeroInstrumento: 1249,
    tipo: 'sa_de_cv', estado: 'paso_01_identificacion',
    socios: [],
    pipeline: [],
    linkPortalToken: 'tok-003', linkActivo: false, seccionesActivas: [],
    creadoEn: '2025-03-05T08:00:00Z', actualizadoEn: '2025-03-05T08:00:00Z',
  },
];

export const mockLibro: LibroInstrumento[] = [
  {
    id: 'lib-001', tenantId: 'tenant-001', numeroInstrumento: 1244,
    tipo: 'sa_de_cv', estado: 'firmado',
    denominacion_social: 'Logística Norteña S.A.',
    partes: ['Juan Pérez', 'María García'], folioInicio: 120, folioFin: 134,
    fechaFirma: '2025-02-10', actaUrl: '#',
    socios: [], pipeline: [],
    linkPortalToken: 'tok-lib-001', linkActivo: false, seccionesActivas: [],
    creadoEn: '2025-02-10T10:00:00Z', actualizadoEn: '2025-02-10T10:00:00Z',
  },
  {
    id: 'lib-002', tenantId: 'tenant-001', numeroInstrumento: 1245,
    tipo: 'sa_de_cv', estado: 'firmado',
    denominacion_social: 'Distribuidora del Norte S. de R.L.',
    partes: ['Roberto Soto'], folioInicio: 135, folioFin: 147,
    fechaFirma: '2025-02-18', actaUrl: '#',
    socios: [], pipeline: [],
    linkPortalToken: 'tok-lib-002', linkActivo: false, seccionesActivas: [],
    creadoEn: '2025-02-18T10:00:00Z', actualizadoEn: '2025-02-18T10:00:00Z',
  },
  {
    id: 'lib-003', tenantId: 'tenant-001', numeroInstrumento: 1246,
    tipo: 'sa_de_cv', estado: 'firmado',
    denominacion_social: 'Manufactura GNR S.A. de C.V.',
    partes: ['Grupo NR Holdings'], folioInicio: 148, folioFin: 162,
    fechaFirma: '2025-02-28', actaUrl: '#',
    socios: [], pipeline: [],
    linkPortalToken: 'tok-lib-003', linkActivo: false, seccionesActivas: [],
    creadoEn: '2025-02-28T10:00:00Z', actualizadoEn: '2025-02-28T10:00:00Z',
  },
];
