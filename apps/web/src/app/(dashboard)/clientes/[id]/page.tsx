'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Upload, Copy, Check, FileText,
    User, Building2, Loader2, CheckCircle,
    AlertCircle, Clock, ChevronDown, ChevronUp,
    Pencil, X
} from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { getCliente, actualizarCliente } from '@/lib/db/clientes';
import { getDocumentosCliente, subirDocumento, guardarDatosExtraidos } from '@/lib/db/documentos';
import { getInstrumentos } from '@/lib/db/instrumentos';
import { auth } from '@/lib/firebase';
import type { Cliente, Documento, Instrumento, TipoDocumento } from '@fedatario/shared';

const TIPOS_DOCUMENTO: { id: TipoDocumento; label: string; esencial: boolean }[] = [
    { id: 'ine', label: 'INE / IFE', esencial: true },
    { id: 'curp', label: 'CURP', esencial: true },
    { id: 'rfc', label: 'Constancia de Situación Fiscal (RFC)', esencial: true },
    { id: 'pasaporte', label: 'Pasaporte', esencial: false },
    { id: 'fm2', label: 'FM2', esencial: false },
    { id: 'fm3', label: 'FM3', esencial: false },
    { id: 'acta_nacimiento', label: 'Acta de nacimiento', esencial: false },
    { id: 'comprobante_domicilio', label: 'Comprobante de domicilio', esencial: false },
    { id: 'carta_naturalizacion', label: 'Carta de naturalización', esencial: false },
    { id: 'poder_notarial', label: 'Poder notarial', esencial: false },
    { id: 'otro', label: 'Otro documento', esencial: false },
];

const ESTADO_DOC = {
    pendiente: { label: 'Pendiente', color: 'var(--orange)', bg: 'var(--orange-bg)', icon: Clock },
    en_revision: { label: 'En revisión', color: 'var(--blue)', bg: 'var(--blue-bg)', icon: Clock },
    aprobado: { label: 'Aprobado', color: 'var(--green)', bg: 'var(--green-bg)', icon: CheckCircle },
    rechazado: { label: 'Rechazado', color: 'var(--red)', bg: 'var(--red-bg)', icon: AlertCircle },
};

function CampoEditable({ label, value, onSave, tipo = 'text', opciones }: {
    label: string;
    value?: string;
    onSave: (val: string) => Promise<void>;
    tipo?: 'text' | 'date' | 'select';
    opciones?: string[];
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value ?? ''));
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    const save = async () => {
        setSaving(true);
        await onSave(draft);
        setSaving(false);
        setEditing(false);
    };

    const copiar = () => {
        if (!value) return;
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="flex items-start py-2.5 gap-4 group border-b border-black/[0.04] last:border-0">
            <div className="w-44 flex-shrink-0 pt-0.5">
                <span className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em]">{label}</span>
            </div>
            {editing ? (
                <div className="flex gap-2 flex-1">
                    {tipo === 'select' && opciones ? (
                        <select value={draft} onChange={e => setDraft(e.target.value)} autoFocus
                            className="flex-1 text-[13px] text-[#1D1D1F] font-semibold border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-black bg-white">
                            <option value="">Sin datos</option>
                            {opciones.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : (
                        <input type={tipo} value={draft} onChange={e => setDraft(e.target.value)}
                            className="flex-1 text-[13px] text-[#1D1D1F] font-semibold border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-black" autoFocus />
                    )}
                    <button onClick={save} disabled={saving} className="p-1 rounded-md hover:bg-green-50 text-green-600 disabled:opacity-40">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </button>
                    <button onClick={() => { setDraft(String(value ?? '')); setEditing(false); }} className="p-1 rounded-md hover:bg-red-50 text-red-400">
                        <X size={13} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-[#1D1D1F] flex-1 truncate">
                        {value ? value : <span className="text-gray-300 italic text-[12px]">Sin datos</span>}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {value && (
                            <button onClick={copiar} className="p-1 rounded-md hover:bg-gray-100 text-gray-500" title="Copiar">
                                {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                            </button>
                        )}
                        <button onClick={() => { setDraft(String(value ?? '')); setEditing(true); }}
                            className="p-1 rounded-md hover:bg-gray-100 text-gray-500">
                            <Pencil size={11} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function ClientePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [cliente, setCliente] = useState<Cliente | null>(null);
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
    const [cargando, setCargando] = useState(true);
    const [tab, setTab] = useState<'compendio' | 'documentos' | 'instrumentos'>('compendio');
    const [subiendoTipo, setSubiendoTipo] = useState<TipoDocumento | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const [tipoSeleccionado, setTipoSeleccionado] = useState<TipoDocumento>('ine');

    useEffect(() => {
        Promise.all([
            getCliente(id),
            getDocumentosCliente(id),
            getInstrumentos(),
        ]).then(([c, docs, insts]) => {
            setCliente(c);
            setDocumentos(docs);
            setInstrumentos(insts.filter(i => i.socios.some(s => s.clienteId === id)));
        }).finally(() => setCargando(false));
    }, [id]);

    const actualizarCampo = async (campo: string, valor: string) => {
        await actualizarCliente(id, { [campo]: valor } as any);
        setCliente(prev => prev ? { ...prev, [campo]: valor } as any : prev);
    };

    const actualizarDomicilio = async (subcampo: string, valor: string) => {
        const domActual = typeof (cliente as any)?.domicilio === 'object' ? (cliente as any).domicilio : {};
        const nuevoDom = { ...domActual, [subcampo]: valor };
        await actualizarCliente(id, { domicilio: nuevoDom } as any);
        setCliente(prev => prev ? { ...prev, domicilio: nuevoDom } as any : prev);
    };

    const actualizarCapacidad = async (key: string, val: boolean) => {
        const capActual = (cliente as any)?.capacidades || {};
        const nuevaCap = { ...capActual, [key]: val };
        await actualizarCliente(id, { capacidades: nuevaCap } as any);
        setCliente(prev => prev ? { ...prev, capacidades: nuevaCap } as any : prev);
    };

    const subirDoc = async (file: File) => {
        if (!cliente) return;
        setSubiendoTipo(tipoSeleccionado);
        try {
            // 1. Subir a Storage y guardar en Firestore
            const { id: docId, url } = await subirDocumento(file, id, '', tipoSeleccionado, cliente.tenantId);
            const docs = await getDocumentosCliente(id);
            setDocumentos(docs);

            // 2. Llamar al extractor, aprobar documento y actualizar perfil del cliente
            try {
                const res = await fetch('https://fedatario-production.up.railway.app/extractor/url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storage_url: url, tipo_documento: tipoSeleccionado, cliente_id: id }),
                });
                if (res.ok) {
                    const datos = await res.json();
                    const extraidos = datos.data?.datos_extraidos || datos.datos_extraidos || {};

                    // Aprobar el documento y guardar datos extraídos
                    await guardarDatosExtraidos(docId, extraidos);

                    // Mapear campos extraídos → campos del cliente
                    const mapeo: Record<string, string> = {
                        nombre_completo: 'nombre_completo', rfc: 'rfc', curp: 'curp',
                        fecha_nacimiento: 'fecha_nacimiento', lugar_nacimiento: 'lugar_nacimiento',
                        ocupacion: 'ocupacion', estado_civil: 'estado_civil', genero: 'genero',
                        clave_elector: 'clave_elector', seccion_ine: 'seccion_ine', idmex: 'idmex',
                        numero_pasaporte: 'numero_pasaporte',
                        numero_fm: 'numero_fm', numero_fm2: 'numero_fm', numero_fm3: 'numero_fm',
                        nacionalidad: 'nacionalidad', nacionalidad_pais: 'nacionalidad',
                        domicilio_calle: 'domicilio_calle', domicilio_numero: 'domicilio_numero',
                        domicilio_colonia: 'domicilio_colonia', domicilio_cp: 'domicilio_cp',
                        domicilio_ciudad: 'domicilio_ciudad', domicilio_estado: 'domicilio_estado',
                    };
                    const actualizaciones: Record<string, any> = {};
                    Object.entries(extraidos).forEach(([k, v]) => {
                        if (mapeo[k] && v) actualizaciones[mapeo[k]] = v;
                    });
                    if (extraidos.domicilio_calle) {
                        actualizaciones.domicilio = {
                            calle:   extraidos.domicilio_calle   || '',
                            numero:  extraidos.domicilio_numero  || '',
                            colonia: extraidos.domicilio_colonia || '',
                            cp:      extraidos.domicilio_cp      || '',
                            ciudad:  extraidos.domicilio_ciudad  || '',
                            estado:  extraidos.domicilio_estado  || '',
                            pais:    'México',
                        };
                    }
                    if (Object.keys(actualizaciones).length > 0) {
                        await actualizarCliente(id, actualizaciones);
                        const clienteActualizado = await getCliente(id);
                        setCliente(clienteActualizado);
                    }
                    // Refrescar docs para mostrar estado aprobado
                    const docsActualizados = await getDocumentosCliente(id);
                    setDocumentos(docsActualizados);
                }
            } catch (extErr) {
                console.warn('Extracción automática falló:', extErr);
            }
        } finally {
            setSubiendoTipo(null);
        }
    };

    if (cargando) return (
        <div className="h-screen flex items-center justify-center">
            <Loader2 size={24} style={{ color: 'var(--ink4)', animation: 'spin 1s linear infinite' }} />
        </div>
    );

    if (!cliente) return (
        <div className="h-screen flex items-center justify-center">
            <div className="text-[14px] text-[#86868B]">Cliente no encontrado</div>
        </div>
    );

    const docsEsenciales = TIPOS_DOCUMENTO.filter(t => t.esencial);
    const completitud = docsEsenciales.filter(t =>
        documentos.some(d => d.tipo === t.id && d.estado === 'aprobado')
    ).length;
    const pct = Math.round((completitud / docsEsenciales.length) * 100);

    return (
        <>
            <Topbar breadcrumb="Clientes /" title={cliente.nombre} />

            <div className="p-6 max-w-4xl mx-auto">
                {/* Header */}
                <button onClick={() => router.push('/clientes')}
                    className="flex items-center gap-1.5 text-[13px] font-semibold mb-4"
                    style={{ color: 'var(--ink4)' }}>
                    <ArrowLeft size={14} /> Clientes
                </button>

                <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[20px] font-bold shrink-0"
                        style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                        {cliente.tipoPersona === 'moral'
                            ? <Building2 size={24} style={{ color: 'var(--blue)' }} />
                            : cliente.nombre.charAt(0).toUpperCase()
                        }
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <h1 className="text-[22px] font-extrabold text-[#1D1D1F] tracking-tight">{cliente.nombre}</h1>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: 'var(--bg3)', color: 'var(--ink4)' }}>
                                {cliente.tipoPersona === 'fisica' ? 'Persona física' : 'Persona moral'}
                            </span>
                        </div>
                        <div className="text-[13px] text-[#86868B]">
                            {[cliente.rfc, cliente.curp].filter(Boolean).join(' · ') || 'Sin RFC/CURP registrado'}
                        </div>
                    </div>

                    {/* Completitud */}
                    <div className="text-right shrink-0">
                        <div className="text-[22px] font-extrabold"
                            style={{ color: pct === 100 ? 'var(--green)' : 'var(--orange)' }}>
                            {pct}%
                        </div>
                        <div className="text-[11px] text-[#86868B]">Documentos esenciales</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit"
                    style={{ background: 'var(--bg2)' }}>
                    {([
                        { id: 'compendio', label: 'Compendio' },
                        { id: 'documentos', label: `Documentos (${documentos.length})` },
                        { id: 'instrumentos', label: `Instrumentos (${instrumentos.length})` },
                    ] as const).map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
                            style={{
                                background: tab === t.id ? 'white' : 'transparent',
                                color: tab === t.id ? 'var(--ink)' : 'var(--ink4)',
                                boxShadow: tab === t.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── COMPENDIO ── */}
                {tab === 'compendio' && (
                    <div className="space-y-4">

                        {/* Identificación */}
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-1">Identificación</div>
                            <CampoEditable label="Nombre completo" value={(cliente as any).nombre_completo || cliente.nombre} onSave={v => actualizarCampo('nombre_completo', v)} />
                            <CampoEditable label="RFC" value={cliente.rfc} onSave={v => actualizarCampo('rfc', v)} />
                            <CampoEditable label="CURP" value={cliente.curp} onSave={v => actualizarCampo('curp', v)} />
                            <CampoEditable label="Género" value={(cliente as any).genero} onSave={v => actualizarCampo('genero', v)} tipo="select" opciones={['Masculino', 'Femenino', 'Otro']} />
                            <CampoEditable label="Fecha de nacimiento" value={(cliente as any).fecha_nacimiento} onSave={v => actualizarCampo('fecha_nacimiento', v)} tipo="date" />
                            <CampoEditable label="Lugar de nacimiento" value={(cliente as any).lugar_nacimiento} onSave={v => actualizarCampo('lugar_nacimiento', v)} />
                            <CampoEditable label="Nacionalidad" value={(cliente as any).nacionalidad} onSave={v => actualizarCampo('nacionalidad', v)} />
                        </div>

                        {/* Datos personales */}
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-1">Datos personales</div>
                            <CampoEditable label="Estado civil" value={(cliente as any).estado_civil} onSave={v => actualizarCampo('estado_civil', v)} tipo="select" opciones={['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre', 'Separado/a']} />
                            <CampoEditable label="Ocupación" value={(cliente as any).ocupacion} onSave={v => actualizarCampo('ocupacion', v)} />
                            <CampoEditable label="Régimen fiscal" value={(cliente as any).regimen_fiscal} onSave={v => actualizarCampo('regimen_fiscal', v)} />
                        </div>

                        {/* Contacto */}
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-1">Contacto</div>
                            <CampoEditable label="Correo electrónico" value={(cliente as any).email} onSave={v => actualizarCampo('email', v)} />
                            <CampoEditable label="Teléfono" value={(cliente as any).telefono} onSave={v => actualizarCampo('telefono', v)} />
                            <CampoEditable label="Celular" value={(cliente as any).celular} onSave={v => actualizarCampo('celular', v)} />
                        </div>

                        {/* Documentos de identidad */}
                        {!(cliente as any).es_extranjero ? (
                            <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                                <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-1">Documentos de identidad</div>
                                <CampoEditable label="Clave de elector" value={(cliente as any).clave_elector} onSave={v => actualizarCampo('clave_elector', v)} />
                                <CampoEditable label="Sección INE" value={(cliente as any).seccion_ine} onSave={v => actualizarCampo('seccion_ine', v)} />
                                <CampoEditable label="IDMEX" value={(cliente as any).idmex} onSave={v => actualizarCampo('idmex', v)} />
                                <CampoEditable label="Vigencia INE" value={(cliente as any).vigencia_ine} onSave={v => actualizarCampo('vigencia_ine', v)} tipo="date" />
                            </div>
                        ) : (
                            <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                                <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-1">Documentos de identidad (extranjero)</div>
                                <CampoEditable label="N° Pasaporte" value={(cliente as any).numero_pasaporte} onSave={v => actualizarCampo('numero_pasaporte', v)} />
                                <CampoEditable label="Vigencia pasaporte" value={(cliente as any).vigencia_pasaporte} onSave={v => actualizarCampo('vigencia_pasaporte', v)} tipo="date" />
                                <CampoEditable label="N° FM (FM2/FM3)" value={(cliente as any).numero_fm} onSave={v => actualizarCampo('numero_fm', v)} />
                                <CampoEditable label="Tipo migratorio" value={(cliente as any).tipo_migratorio} onSave={v => actualizarCampo('tipo_migratorio', v)} />
                                <CampoEditable label="Vigencia FM" value={(cliente as any).vigencia_fm} onSave={v => actualizarCampo('vigencia_fm', v)} tipo="date" />
                            </div>
                        )}

                        {/* Domicilio */}
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-1">Domicilio</div>
                            {typeof (cliente as any).domicilio === 'string' || !(cliente as any).domicilio ? (
                                <CampoEditable label="Domicilio completo" value={(cliente as any).domicilio || ''} onSave={v => actualizarCampo('domicilio', v)} />
                            ) : (
                                <>
                                    <CampoEditable label="Calle" value={(cliente as any).domicilio?.calle} onSave={v => actualizarDomicilio('calle', v)} />
                                    <CampoEditable label="N° exterior" value={(cliente as any).domicilio?.numero || (cliente as any).domicilio?.noExt} onSave={v => actualizarDomicilio('numero', v)} />
                                    <CampoEditable label="Colonia" value={(cliente as any).domicilio?.colonia} onSave={v => actualizarDomicilio('colonia', v)} />
                                    <CampoEditable label="CP" value={(cliente as any).domicilio?.cp} onSave={v => actualizarDomicilio('cp', v)} />
                                    <CampoEditable label="Ciudad / Municipio" value={(cliente as any).domicilio?.ciudad || (cliente as any).domicilio?.municipio} onSave={v => actualizarDomicilio('ciudad', v)} />
                                    <CampoEditable label="Estado" value={(cliente as any).domicilio?.estado} onSave={v => actualizarDomicilio('estado', v)} />
                                    <CampoEditable label="País" value={(cliente as any).domicilio?.pais} onSave={v => actualizarDomicilio('pais', v)} />
                                </>
                            )}
                        </div>

                        {/* Capacidades */}
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-3">Capacidades</div>
                            <div className="grid grid-cols-3 gap-3">
                                {([
                                    { key: 'sabeLeer', label: 'Sabe leer' },
                                    { key: 'sabeEscribir', label: 'Sabe escribir' },
                                    { key: 'sabeFirmar', label: 'Sabe firmar' },
                                ] as const).map(c => {
                                    const val = (cliente as any).capacidades?.[c.key] ?? (cliente as any)[c.key];
                                    return (
                                        <button key={c.key}
                                            onClick={() => actualizarCapacidad(c.key, !val)}
                                            className="text-center p-3 rounded-xl transition-all border"
                                            style={{
                                                background: val ? 'var(--green-bg)' : 'var(--bg2)',
                                                borderColor: val ? 'var(--green)' : 'transparent',
                                            }}>
                                            <div className="text-[18px] mb-1">{val ? '✓' : '✗'}</div>
                                            <div className="text-[11px] font-semibold" style={{ color: val ? 'var(--green)' : 'var(--ink4)' }}>{c.label}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                    </div>
                )}

                {/* ── DOCUMENTOS ── */}
                {tab === 'documentos' && (
                    <div className="space-y-4">
                        {/* Subir documento */}
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="text-[13px] font-bold text-[#1D1D1F] mb-3">Subir documento</div>
                            <div className="flex items-center gap-3">
                                <select value={tipoSeleccionado}
                                    onChange={e => setTipoSeleccionado(e.target.value as TipoDocumento)}
                                    className="flex-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'var(--bg2)' }}>
                                    {TIPOS_DOCUMENTO.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}{t.esencial ? ' *' : ''}</option>
                                    ))}
                                </select>
                                <button onClick={() => fileRef.current?.click()}
                                    disabled={!!subiendoTipo}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
                                    style={{ background: 'var(--blue)', color: 'white' }}>
                                    {subiendoTipo
                                        ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analizando...</>
                                        : <><Upload size={14} /> Subir</>
                                    }
                                </button>
                                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                    onChange={e => { if (e.target.files?.[0]) subirDoc(e.target.files[0]); }} />
                            </div>
                            <p className="text-[11px] text-[#86868B] mt-2">* Documentos esenciales para el acta</p>
                        </div>

                        {/* Lista de documentos */}
                        {documentos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <FileText size={24} style={{ color: 'var(--ink4)' }} className="mb-2" />
                                <div className="text-[14px] font-bold text-[#1D1D1F] mb-1">Sin documentos</div>
                                <div className="text-[13px] text-[#86868B]">Sube el primer documento del cliente</div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {documentos.map(doc => {
                                    const estado = ESTADO_DOC[doc.estado] || ESTADO_DOC.pendiente;
                                    const IconoEstado = estado.icon;
                                    const tipoInfo = TIPOS_DOCUMENTO.find(t => t.id === doc.tipo);
                                    return (
                                        <div key={doc.id} className="bg-white border border-black/[0.07] rounded-xl p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                                    style={{ background: 'var(--bg2)' }}>
                                                    <FileText size={16} style={{ color: 'var(--ink4)' }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[13px] font-semibold text-[#1D1D1F]">
                                                        {tipoInfo?.label || doc.tipo}
                                                    </div>
                                                    <div className="text-[11px] text-[#86868B] truncate">{doc.nombre}</div>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0"
                                                    style={{ background: estado.bg, color: estado.color }}>
                                                    <IconoEstado size={11} /> {estado.label}
                                                </div>
                                                <a href={doc.storageUrl} target="_blank" rel="noopener noreferrer"
                                                    className="text-[12px] font-semibold no-underline shrink-0"
                                                    style={{ color: 'var(--blue)' }}>
                                                    Ver
                                                </a>
                                            </div>
                                            {/* Datos extraídos */}
                                            {doc.datosExtraidos && Object.keys(doc.datosExtraidos).length > 0 && (
                                                <div className="mt-3 pt-3 border-t border-black/[0.04]">
                                                    <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-2">
                                                        Datos extraídos por AGT-02
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {Object.entries(doc.datosExtraidos).map(([k, v]) => (
                                                            <div key={k}>
                                                                <div className="text-[10px] text-[#86868B]">{k}</div>
                                                                <div className="text-[12px] font-semibold text-[#1D1D1F]">{String(v)}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── INSTRUMENTOS ── */}
                {tab === 'instrumentos' && (
                    <div className="space-y-2">
                        {instrumentos.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <FileText size={24} style={{ color: 'var(--ink4)' }} className="mb-2" />
                                <div className="text-[14px] font-bold text-[#1D1D1F] mb-1">Sin instrumentos</div>
                                <div className="text-[13px] text-[#86868B]">Este cliente no participa en ningún instrumento aún</div>
                            </div>
                        ) : (
                            instrumentos.map(inst => {
                                const socio = inst.socios.find(s => s.clienteId === id);
                                return (
                                    <div key={inst.id} className="bg-white border border-black/[0.07] rounded-xl p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="text-[14px] font-bold text-[#1D1D1F]">
                                                    {inst.denominacion_social || 'Sin nombre'}
                                                </div>
                                                <div className="text-[12px] text-[#86868B] mt-0.5">
                                                    {inst.tipo === 'sa_de_cv' ? 'SA de CV' : 'S de RL'}
                                                    {socio && ` · ${socio.rol.replace(/_/g, ' ')} · ${socio.porcentaje}%`}
                                                </div>
                                            </div>
                                            <a href={`/instrumentos/${inst.id}`}
                                                className="text-[12px] font-semibold no-underline"
                                                style={{ color: 'var(--blue)' }}>
                                                Ver →
                                            </a>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                )}
            </div>
            <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}
