'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Upload, Send, CheckCircle, FileText, Loader2, AlertCircle, ChevronDown, ChevronUp, Circle, Trash2 } from 'lucide-react';
import { collection, query, where, getDocs, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { subirDocumentoConExtraccion, getMensajes, guardarMensaje, ETAPAS_DEFAULT } from '@/lib/db/portal';
import type { MensajeChat, DocumentoPortal } from '@fedatario/shared';

interface SocioPortal {
    clienteId: string;
    rol: string;
    porcentaje: number;
    nombre: string;
    estado_civil?: string;
    nombre_conyuge?: string;
    regimen_matrimonial?: string;
    ocupacion?: string;
    domicilio_calle?: string;
    domicilio_numero?: string;
    domicilio_entre?: string;
    domicilio_colonia?: string;
    domicilio_cp?: string;
    domicilio_municipio?: string;
    domicilio_estado?: string;
    telefono?: string;
    celular?: string;
    email?: string;
    notas?: string;
}

interface InstrumentoPortal {
    id: string;
    tenantId: string;
    tipo: string;
    estado: string;
    sociedadNombre: string;
    socios: SocioPortal[];
}

const TIPOS_DOC = [
    { id: 'ine', label: 'INE / Credencial para votar' },
    { id: 'curp', label: 'CURP' },
    { id: 'rfc', label: 'RFC / Constancia de Situación Fiscal' },
    { id: 'pasaporte', label: 'Pasaporte' },
    { id: 'comprobante_domicilio', label: 'Comprobante de domicilio' },
    { id: 'acta_nacimiento', label: 'Acta de nacimiento' },
    { id: 'fm2', label: 'FM2 / FM3' },
];

const DOCS_REQUERIDOS = ['ine', 'curp', 'rfc'];

const ROL_LABEL: Record<string, string> = {
    administrador_unico: 'Administrador Único',
    comisario: 'Comisario',
    socio: 'Accionista',
    representante_legal: 'Representante Legal',
    consejo_administracion: 'Consejo de Administración',
    secretario_consejo: 'Secretario del Consejo',
    apoderado: 'Apoderado',
};

function estadoBadge(estado: DocumentoPortal['estado']) {
    const map = {
        pendiente: { label: 'En revisión', bg: '#FFF3E0', color: '#E65100' },
        en_revision: { label: 'Procesando', bg: '#E3F2FD', color: '#0071E3' },
        aprobado: { label: 'Aprobado', bg: '#E8F5E9', color: '#1A9640' },
        rechazado: { label: 'Rechazado', bg: '#FFEBEE', color: '#D32F2F' },
    };
    return map[estado] ?? map.pendiente;
}

function SeccionSocio({ socio, documentos, onSubir, onEliminar }: {
    socio: SocioPortal;
    documentos: DocumentoPortal[];
    onSubir: (clienteId: string, tipo: string, file: File) => Promise<void>;
    onEliminar: (documentoId: string) => Promise<void>;
}) {
    const [abierto, setAbierto] = useState(true);
    const [tipoDoc, setTipoDoc] = useState('ine');
    const [subiendo, setSubiendo] = useState(false);
    const [uploadOk, setUploadOk] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const docsAprobados = documentos.filter(d => d.estado === 'aprobado').map(d => d.tipo);
    const completado = DOCS_REQUERIDOS.every(t => docsAprobados.includes(t));

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSubiendo(true);
        setUploadOk('');
        try {
            await onSubir(socio.clienteId, tipoDoc, file);
            setUploadOk((TIPOS_DOC.find(t => t.id === tipoDoc)?.label ?? tipoDoc) + ' subido correctamente.');
            setTimeout(() => setUploadOk(''), 4000);
        } catch (err) {
            console.error(err);
        } finally {
            setSubiendo(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
            <button onClick={() => setAbierto(!abierto)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#1D1D1F] flex items-center justify-center text-white text-sm font-bold">
                        {socio.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                        <div className="text-[14px] font-bold text-[#1D1D1F]">{socio.nombre}</div>
                        <div className="text-[11px] text-[#86868B]">{ROL_LABEL[socio.rol] || socio.rol}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {completado && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: '#E8F5E9', color: '#1A9640' }}>
                            <CheckCircle size={11} /> Completo
                        </span>
                    )}
                    {abierto ? <ChevronUp size={16} color="#86868B" /> : <ChevronDown size={16} color="#86868B" />}
                </div>
            </button>

            {abierto && (
                <div className="border-t border-black/[0.06] px-5 py-4 space-y-4">
                    <div className="flex gap-2">
                        {DOCS_REQUERIDOS.map(tipo => {
                            const ok = docsAprobados.includes(tipo);
                            const label = ({ ine: 'INE', curp: 'CURP', rfc: 'RFC' } as any)[tipo];
                            return (
                                <span key={tipo} className="flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-full font-medium"
                                    style={{ background: ok ? '#E8F5E9' : '#F5F5F7', color: ok ? '#1A9640' : '#86868B' }}>
                                    {ok ? <CheckCircle size={12} /> : <Circle size={12} />} {label}
                                </span>
                            );
                        })}
                    </div>

                    <div>
                        <div className="flex gap-2 mb-2">
                            <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-xl text-[13px] outline-none"
                                style={{ border: '1px solid #E5E5EA', background: '#F5F5F7' }}>
                                {TIPOS_DOC.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                            </select>
                            <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-50 shrink-0"
                                style={{ background: '#1D1D1F', color: 'white' }}>
                                {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                {subiendo ? 'Procesando...' : 'Subir'}
                            </button>
                            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleFile} />
                        </div>
                        {uploadOk && (
                            <div className="flex items-center gap-2 text-[12px] px-3 py-2 rounded-lg"
                                style={{ background: '#E8F5E9', color: '#1A9640' }}>
                                <CheckCircle size={12} /> {uploadOk}
                            </div>
                        )}
                    </div>

                    {documentos.length > 0 && (
                        <div className="space-y-2">
                            {documentos.map(d => {
                                const badge = estadoBadge(d.estado);
                                return (
                                    <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#F5F5F7' }}>
                                        <FileText size={14} color="#86868B" className="shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-semibold text-[#1D1D1F] truncate">
                                                {TIPOS_DOC.find(t => t.id === d.tipo)?.label || d.tipo}
                                            </div>
                                            <div className="text-[11px] text-[#86868B] truncate">{d.nombre}</div>
                                        </div>
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                                            style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                                        <button onClick={() => onEliminar(d.id)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-red-600 hover:bg-red-50 shrink-0 transition-colors"
                                            title="Eliminar documento">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function PortalClientePage() {
    const { token } = useParams<{ token: string }>();
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [instrumento, setInstrumento] = useState<InstrumentoPortal | null>(null);
    const [documentosPorSocio, setDocumentosPorSocio] = useState<Record<string, DocumentoPortal[]>>({});
    const [tab, setTab] = useState<'documentos' | 'datos_generales' | 'estado' | 'chat'>('documentos');
    const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
    const [input, setInput] = useState('');
    const [enviando, setEnviando] = useState(false);
    const chatRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!token) return;
        const cargar = async () => {
            try {
                const q = query(collection(db, 'instrumentos'), where('linkPortalToken', '==', token), where('linkActivo', '==', true));
                const snap = await getDocs(q);
                if (snap.empty) { setError('Link no válido o expirado.'); return; }

                const docSnap = snap.docs[0];
                const data = docSnap.data();
                const sociosRaw: any[] = data.socios || [];

                const socios: SocioPortal[] = await Promise.all(sociosRaw.map(async (s: any) => {
                    let nombre = s.nombre_completo || '';
                    if (!nombre && s.clienteId) {
                        try {
                            const cSnap = await getDoc(doc(db, 'clientes', s.clienteId));
                            if (cSnap.exists()) nombre = cSnap.data().nombre_completo || '';
                        } catch {}
                    }
                    return {
                        clienteId: s.clienteId || '',
                        rol: s.rol || 'socio',
                        porcentaje: s.porcentaje || 0,
                        nombre: nombre || 'Sin nombre',
                        estado_civil: s.estado_civil || '',
                        nombre_conyuge: s.nombre_conyuge || '',
                        regimen_matrimonial: s.regimen_matrimonial || '',
                        ocupacion: s.ocupacion || '',
                        domicilio_calle: s.domicilio_calle || '',
                        domicilio_numero: s.domicilio_numero || '',
                        domicilio_entre: s.domicilio_entre || '',
                        domicilio_colonia: s.domicilio_colonia || '',
                        domicilio_cp: s.domicilio_cp || '',
                        domicilio_municipio: s.domicilio_municipio || '',
                        domicilio_estado: s.domicilio_estado || '',
                        telefono: s.telefono || '',
                        celular: s.celular || '',
                        email: s.email || '',
                        notas: s.notas || '',
                    };
                }));

                const inst: InstrumentoPortal = {
                    id: docSnap.id, tenantId: data.tenantId, tipo: data.tipo, estado: data.estado,
                    sociedadNombre: data.sociedadNombre || data.denominacion_social || 'Tu sociedad', socios,
                };
                setInstrumento(inst);

                const clienteIds = socios.map(s => s.clienteId).filter(Boolean);
                if (clienteIds.length > 0) {
                    const docsQ = query(collection(db, 'documentos_portal'), where('instrumentoId', '==', docSnap.id), where('clienteId', 'in', clienteIds));
                    const docsSnap = await getDocs(docsQ);
                    const porSocio: Record<string, DocumentoPortal[]> = {};
                    docsSnap.docs.forEach(d => {
                        const dd = d.data();
                        const cid = dd.clienteId;
                        if (!porSocio[cid]) porSocio[cid] = [];
                        porSocio[cid].push({ id: d.id, ...dd } as DocumentoPortal);
                    });
                    setDocumentosPorSocio(porSocio);
                }

                const msgs = await getMensajes(docSnap.id);
                setMensajes(msgs.length === 0 ? [{
                    id: '0', instrumentoId: docSnap.id, rol: 'agente',
                    texto: `Hola, soy el asistente de Fedatario. Estoy aquí para ayudarte con tu acta constitutiva de ${inst.sociedadNombre}. ¿En qué te puedo ayudar?`,
                    creadoEn: new Date().toISOString(),
                }] : msgs);
            } catch (e: any) {
                setError(e.message || 'Error al cargar el portal.');
            } finally {
                setCargando(false);
            }
        };
        cargar();
    }, [token]);

    useEffect(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, [mensajes]);

    const handleSubir = async (clienteId: string, tipo: string, file: File) => {
        if (!instrumento) return;
        await subirDocumentoConExtraccion(file, instrumento.id, clienteId, tipo, instrumento.tenantId);
        const docsQ = query(collection(db, 'documentos_portal'), where('instrumentoId', '==', instrumento.id), where('clienteId', '==', clienteId));
        const docsSnap = await getDocs(docsQ);
        const docs = docsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentoPortal));
        setDocumentosPorSocio(prev => ({ ...prev, [clienteId]: docs }));
    };

    const handleEliminar = async (documentoId: string) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar este documento?')) return;
        try {
            await deleteDoc(doc(db, 'documentos_portal', documentoId));
            setDocumentosPorSocio(prev => {
                const newDocs = { ...prev };
                Object.keys(newDocs).forEach(key => {
                    newDocs[key] = newDocs[key].filter(d => d.id !== documentoId);
                });
                return newDocs;
            });
        } catch (err) {
            console.error('Error al eliminar documento:', err);
            alert('Error al eliminar el documento. Por favor intenta de nuevo.');
        }
    };

    const enviarMensaje = async () => {
        if (!input.trim() || enviando || !instrumento) return;
        const texto = input.trim();
        setInput('');
        const msgCliente: MensajeChat = { id: Date.now().toString(), instrumentoId: instrumento.id, rol: 'cliente', texto, creadoEn: new Date().toISOString() };
        setMensajes(prev => [...prev, msgCliente]);
        setEnviando(true);
        try {
            await guardarMensaje({ instrumentoId: instrumento.id, rol: 'cliente', texto });
            const res = await fetch('/api/portal/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mensaje: texto, instrumentoId: instrumento.id, estado: instrumento.estado }) });
            const data = await res.json();
            const respuesta = data.respuesta || 'Un momento, déjame consultar eso con el equipo.';
            const msgAgente: MensajeChat = { id: (Date.now() + 1).toString(), instrumentoId: instrumento.id, rol: 'agente', texto: respuesta, creadoEn: new Date().toISOString() };
            setMensajes(prev => [...prev, msgAgente]);
            await guardarMensaje({ instrumentoId: instrumento.id, rol: 'agente', texto: respuesta });
        } catch {
            setMensajes(prev => [...prev, { id: (Date.now() + 1).toString(), instrumentoId: instrumento!.id, rol: 'agente', texto: 'En este momento no puedo responder. Por favor intenta más tarde.', creadoEn: new Date().toISOString() }]);
        } finally { setEnviando(false); }
    };

    const etapaIndex = ETAPAS_DEFAULT.findIndex(e => e.nombreInterno === instrumento?.estado);
    const totalSocios = instrumento?.socios.length ?? 0;
    const sociosCompletos = instrumento?.socios.filter(s => {
        const docs = documentosPorSocio[s.clienteId] ?? [];
        const aprobados = docs.filter(d => d.estado === 'aprobado').map(d => d.tipo);
        return DOCS_REQUERIDOS.every(t => aprobados.includes(t));
    }).length ?? 0;

    if (cargando) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F7' }}>
            <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
    );

    if (error || !instrumento) return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F7' }}>
            <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
                <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
                <p className="text-[15px] font-bold mb-1">Link no válido</p>
                <p className="text-[13px] text-gray-500">{error || 'Este link no existe o ya expiró.'}</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen" style={{ background: '#F5F5F7' }}>
            <header className="bg-white border-b border-black/[0.07] px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
                <div className="w-8 h-8 rounded-lg bg-[#1D1D1F] flex items-center justify-center text-white text-xs font-extrabold shrink-0">FD</div>
                <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[#1D1D1F] truncate">{instrumento.sociedadNombre}</div>
                    <div className="text-[11px] text-[#86868B]">Portal de documentación</div>
                </div>
                {sociosCompletos === totalSocios && totalSocios > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-1 rounded-full shrink-0" style={{ background: '#E8F5E9', color: '#1A9640' }}>✓ Todos completos</span>
                )}
            </header>

            <div className="bg-white border-b border-black/[0.07] px-4 flex gap-1 sticky top-[57px] z-40">
                {[{ key: 'documentos', label: `Documentos (${sociosCompletos}/${totalSocios})` }, { key: 'datos_generales', label: 'Datos Generales' }, { key: 'estado', label: 'Estado' }, { key: 'chat', label: 'Asistente' }].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key as any)}
                        className={`px-4 py-3 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-[#1D1D1F] text-[#1D1D1F]' : 'border-transparent text-[#86868B]'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="max-w-lg mx-auto px-4 py-5 space-y-3">

                {tab === 'documentos' && (
                    <div className="space-y-3">
                        <p className="text-[12px] text-[#86868B] px-1">Sube los documentos de cada socio. Se requieren INE, CURP y RFC de cada uno.</p>
                        {instrumento.socios.map(socio => (
                            <SeccionSocio key={socio.clienteId} socio={socio} documentos={documentosPorSocio[socio.clienteId] ?? []} onSubir={handleSubir} onEliminar={handleEliminar} />
                        ))}
                    </div>
                )}

                {tab === 'datos_generales' && (
                    <div className="space-y-3">
                        <p className="text-[12px] text-[#86868B] px-1">Completa tus datos personales y de contacto.</p>
                        {instrumento.socios.map(socio => (
                            <div key={socio.clienteId} className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                                <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-[#1D1D1F] flex items-center justify-center text-white text-sm font-bold">
                                            {(socio.nombre || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-[14px] font-bold text-[#1D1D1F]">{socio.nombre}</div>
                                            <div className="text-[11px] text-[#86868B]">{ROL_LABEL[socio.rol] || socio.rol}</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-5 py-4 space-y-4">
                                    {/* Estado civil */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-semibold text-[#86868B] block mb-1">Estado civil</label>
                                            <input type="text" placeholder="Soltero, Casado..." defaultValue={socio.estado_civil} 
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-[#86868B] block mb-1">Nombre del cónyuge</label>
                                            <input type="text" placeholder="" defaultValue={socio.nombre_conyuge} 
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                                        </div>
                                    </div>
                                    
                                    {/* Régimen y ocupación */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[11px] font-semibold text-[#86868B] block mb-1">Régimen matrimonial</label>
                                            <input type="text" placeholder="Sociedad conyugal..." defaultValue={socio.regimen_matrimonial} 
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-semibold text-[#86868B] block mb-1">Ocupación/Profesión</label>
                                            <input type="text" placeholder="" defaultValue={socio.ocupacion} 
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                                        </div>
                                    </div>
                                    
                                    {/* Domicilio */}
                                    <div>
                                        <label className="text-[11px] font-semibold text-[#86868B] block mb-2">Domicilio</label>
                                        <div className="grid grid-cols-3 gap-2 mb-2">
                                            <input type="text" placeholder="Calle" defaultValue={socio.domicilio_calle} 
                                                className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px]" />
                                            <input type="text" placeholder="No. ext." defaultValue={socio.domicilio_numero} 
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-[12px]" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mb-2">
                                            <input type="text" placeholder="Entre calles" defaultValue={socio.domicilio_entre} 
                                                className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px]" />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <input type="text" placeholder="Colonia" defaultValue={socio.domicilio_colonia} 
                                                className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-[12px]" />
                                            <input type="text" placeholder="C.P." defaultValue={socio.domicilio_cp} 
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-[12px]" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <input type="text" placeholder="Municipio/Ciudad" defaultValue={socio.domicilio_municipio} 
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-[12px]" />
                                            <input type="text" placeholder="Estado" defaultValue={socio.domicilio_estado} 
                                                className="px-3 py-2 border border-gray-200 rounded-lg text-[12px]" />
                                        </div>
                                    </div>
                                    
                                    {/* Datos de contacto */}
                                    <div>
                                        <label className="text-[11px] font-semibold text-[#86868B] block mb-2">Datos de contacto</label>
                                        <div className="space-y-2">
                                            <input type="tel" placeholder="Teléfono" defaultValue={socio.telefono} 
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                                            <input type="tel" placeholder="Celular" defaultValue={socio.celular} 
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                                            <input type="email" placeholder="Correo electrónico" defaultValue={socio.email} 
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                                        </div>
                                    </div>
                                    
                                    {/* Notas */}
                                    <div>
                                        <label className="text-[11px] font-semibold text-[#86868B] block mb-1">Notas</label>
                                        <textarea placeholder="Observaciones adicionales..." defaultValue={socio.notas} 
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] resize-none" rows={3} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {tab === 'estado' && (
                    <div className="space-y-4">
                        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                            <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-2">Tu acta constitutiva</div>
                            <div className="text-[18px] font-extrabold text-[#1D1D1F] mb-1">{instrumento.sociedadNombre}</div>
                            <div className="flex gap-2 mt-4">
                                <div className="flex-1 bg-[#F5F5F7] rounded-xl p-3 text-center">
                                    <div className="text-[18px] font-extrabold text-[#1A9640]">{sociosCompletos}</div>
                                    <div className="text-[11px] text-[#86868B]">Completos</div>
                                </div>
                                <div className="flex-1 bg-[#F5F5F7] rounded-xl p-3 text-center">
                                    <div className="text-[18px] font-extrabold text-[#E65100]">{totalSocios - sociosCompletos}</div>
                                    <div className="text-[11px] text-[#86868B]">Pendientes</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
                            <div className="px-5 py-4 border-b border-black/[0.07]"><div className="text-[13px] font-bold text-[#1D1D1F]">Proceso</div></div>
                            <div className="px-5 py-2">
                                {ETAPAS_DEFAULT.map((etapa, i) => {
                                    const completada = i < etapaIndex;
                                    const activa = i === etapaIndex;
                                    return (
                                        <div key={etapa.id} className="flex items-start gap-3 py-3 border-b border-black/[0.04] last:border-0">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                                style={{ background: completada ? '#E8F5E9' : activa ? '#E3F2FD' : '#F5F5F7' }}>
                                                {completada ? <CheckCircle size={14} color="#1A9640" /> : <span className="text-[12px]">{etapa.icono}</span>}
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-[13px] font-semibold" style={{ color: completada ? '#1A9640' : activa ? '#0071E3' : '#86868B' }}>
                                                    {etapa.nombreCliente}
                                                    {activa && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#E3F2FD', color: '#0071E3' }}>Ahora</span>}
                                                </div>
                                                {activa && <div className="text-[12px] text-[#86868B] mt-0.5">{etapa.descripcionCliente}</div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'chat' && (
                    <div className="bg-white rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.06)] flex flex-col" style={{ height: 'calc(100vh - 180px)' }}>
                        <div className="px-5 py-4 border-b border-black/[0.07]">
                            <div className="text-[15px] font-bold text-[#1D1D1F]">Asistente Fedatario</div>
                            <div className="text-[12px] text-[#86868B]">Responde dudas sobre tu acta</div>
                        </div>
                        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {mensajes.map(msg => (
                                <div key={msg.id} className={`flex ${msg.rol === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                                    <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed"
                                        style={{ background: msg.rol === 'cliente' ? '#1D1D1F' : '#F5F5F7', color: msg.rol === 'cliente' ? 'white' : '#1D1D1F', borderBottomRightRadius: msg.rol === 'cliente' ? 4 : undefined, borderBottomLeftRadius: msg.rol === 'agente' ? 4 : undefined }}>
                                        {msg.texto}
                                    </div>
                                </div>
                            ))}
                            {enviando && (
                                <div className="flex justify-start">
                                    <div className="px-4 py-3 rounded-2xl" style={{ background: '#F5F5F7', borderBottomLeftRadius: 4 }}>
                                        <Loader2 size={14} className="animate-spin text-gray-400" />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="px-4 py-3 border-t border-black/[0.07] flex gap-2">
                            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarMensaje()}
                                placeholder="Escribe tu pregunta..."
                                className="flex-1 px-4 py-2.5 rounded-full text-[13px] outline-none"
                                style={{ border: '1px solid #E5E5EA', background: '#F5F5F7' }} />
                            <button onClick={enviarMensaje} disabled={!input.trim() || enviando}
                                className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40"
                                style={{ background: '#1D1D1F', color: 'white' }}>
                                <Send size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
