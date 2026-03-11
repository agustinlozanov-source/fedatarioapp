'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Upload, Copy, Check, FileText,
    User, Building2, Loader2, CheckCircle,
    AlertCircle, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { getCliente, actualizarCliente } from '@/lib/db/clientes';
import { getDocumentosCliente, subirDocumento } from '@/lib/db/documentos';
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

function CampoCompendio({ label, valorCapturado, valorValidado, onCopiar }: {
    label: string;
    valorCapturado?: string;
    valorValidado?: string;
    onCopiar: (v: string) => void;
}) {
    const valor = valorValidado || valorCapturado || '';
    const [copiado, setCopiado] = useState(false);
    if (!valor) return null;
    const copiar = () => {
        navigator.clipboard.writeText(valor);
        setCopiado(true);
        onCopiar(valor);
        setTimeout(() => setCopiado(false), 2000);
    };
    return (
        <div className="flex items-center justify-between py-2 border-b border-black/[0.04] last:border-0">
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em]">{label}</div>
                <div className="text-[13px] font-semibold text-[#1D1D1F] mt-0.5">{valor}</div>
                {valorValidado && valorCapturado && valorValidado !== valorCapturado && (
                    <div className="text-[10px] text-[var(--orange)] mt-0.5">
                        ⚠ Capturado: {valorCapturado}
                    </div>
                )}
                {valorValidado && (
                    <div className="text-[10px] text-[var(--green)] mt-0.5">✓ Validado con documento oficial</div>
                )}
            </div>
            <button onClick={copiar}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold ml-3 shrink-0 transition-all"
                style={{ background: copiado ? 'var(--green-bg)' : 'var(--bg2)', color: copiado ? 'var(--green)' : 'var(--ink4)' }}>
                {copiado ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
            </button>
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

    const subirDoc = async (file: File) => {
        if (!cliente) return;
        setSubiendoTipo(tipoSeleccionado);
        try {
            // 1. Subir a Storage y guardar en Firestore
            const { url } = await subirDocumento(file, id, '', tipoSeleccionado, cliente.tenantId);
            const docs = await getDocumentosCliente(id);
            setDocumentos(docs);

            // 2. Llamar al extractor y actualizar perfil del cliente
            try {
                const res = await fetch('https://fedatario-production.up.railway.app/extractor/url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storage_url: url, tipo_documento: tipoSeleccionado, cliente_id: id }),
                });
                if (res.ok) {
                    const datos = await res.json();
                    const extraidos = datos.datos_extraidos || {};
                    // Mapear campos extraídos → campos del cliente (sobreescribe siempre)
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
                    // Si viene domicilio como objeto, armarlo como string
                    if (extraidos.domicilio_calle) {
                        actualizaciones.domicilio = [
                            extraidos.domicilio_calle, extraidos.domicilio_numero,
                            extraidos.domicilio_colonia, extraidos.domicilio_cp,
                            extraidos.domicilio_ciudad, extraidos.domicilio_estado,
                        ].filter(Boolean).join(', ');
                    }
                    if (Object.keys(actualizaciones).length > 0) {
                        await actualizarCliente(id, actualizaciones);
                        const clienteActualizado = await getCliente(id);
                        setCliente(clienteActualizado);
                    }
                }
            } catch (extErr) {
                // La extracción nunca bloquea — el documento ya quedó guardado
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
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-3">
                                Datos validados
                                <span className="ml-2 text-[10px] font-normal normal-case">Fuente: documentos oficiales</span>
                            </div>
                            <CampoCompendio label="Nombre completo"
                                valorCapturado={cliente.nombre}
                                valorValidado={(cliente as any).nombreValidado}
                                onCopiar={() => { }} />
                            <CampoCompendio label="RFC"
                                valorCapturado={cliente.rfc}
                                valorValidado={(cliente as any).rfcValidado}
                                onCopiar={() => { }} />
                            <CampoCompendio label="CURP"
                                valorCapturado={cliente.curp}
                                valorValidado={(cliente as any).curpValidado}
                                onCopiar={() => { }} />
                            <CampoCompendio label="Fecha de nacimiento"
                                valorCapturado={(cliente as any).fechaNacimiento}
                                valorValidado={(cliente as any).fechaNacimientoValidada}
                                onCopiar={() => { }} />
                            <CampoCompendio label="Lugar de nacimiento"
                                valorCapturado={(cliente as any).lugarNacimiento}
                                valorValidado={(cliente as any).lugarNacimientoValidado}
                                onCopiar={() => { }} />
                            <CampoCompendio label="Nacionalidad"
                                valorCapturado={cliente.nacionalidad}
                                onCopiar={() => { }} />
                        </div>

                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-3">Datos directos</div>
                            <CampoCompendio label="Estado civil" valorCapturado={(cliente as any).estadoCivil} onCopiar={() => { }} />
                            <CampoCompendio label="Ocupación" valorCapturado={(cliente as any).ocupacion} onCopiar={() => { }} />
                            <CampoCompendio label="Teléfono" valorCapturado={(cliente as any).telefono} onCopiar={() => { }} />
                            <CampoCompendio label="Celular" valorCapturado={(cliente as any).celular} onCopiar={() => { }} />
                            <CampoCompendio label="Correo electrónico" valorCapturado={(cliente as any).email} onCopiar={() => { }} />
                            {(cliente as any).domicilio && (
                                <CampoCompendio label="Domicilio"
                                    valorCapturado={[
                                        (cliente as any).domicilio?.calle,
                                        (cliente as any).domicilio?.noExt,
                                        (cliente as any).domicilio?.colonia,
                                        (cliente as any).domicilio?.municipio,
                                        (cliente as any).domicilio?.estado,
                                    ].filter(Boolean).join(', ')}
                                    onCopiar={() => { }} />
                            )}
                        </div>

                        {/* Capacidades */}
                        {(cliente as any).capacidades && (
                            <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                                <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-3">Capacidades</div>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Sabe leer', val: (cliente as any).capacidades?.sabeLeer },
                                        { label: 'Sabe escribir', val: (cliente as any).capacidades?.sabeEscribir },
                                        { label: 'Sabe firmar', val: (cliente as any).capacidades?.sabeFirmar },
                                    ].map(c => (
                                        <div key={c.label} className="text-center p-3 rounded-xl" style={{ background: 'var(--bg2)' }}>
                                            <div className="text-[18px] mb-1">{c.val ? '✓' : '✗'}</div>
                                            <div className="text-[11px] font-semibold text-[#86868B]">{c.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
