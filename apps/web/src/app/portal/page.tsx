'use client';
import { useEffect, useState, useRef } from 'react';
import { Upload, Send, CheckCircle, Clock, AlertCircle, X, FileText, Loader2, LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { getEtapasPipeline, getMensajes, guardarMensaje, subirDocumento, getDocumentosInstrumento, ETAPAS_DEFAULT } from '@/lib/db/portal';
import type { EtapaPipeline, MensajeChat, DocumentoPortal } from '@fedatario/shared';

const INSTRUMENTO_MOCK = {
    id: 'inst-001',
    sociedadNombre: 'Importadora Sino-México S.A. de C.V.',
    estado: 'validacion_juridica',
    clienteId: 'cli-001',
    tenantId: 'tenant-001',
};

const TIPOS_DOC = [
    { id: 'ine', label: 'INE / IFE' },
    { id: 'curp', label: 'CURP' },
    { id: 'rfc', label: 'RFC' },
    { id: 'pasaporte', label: 'Pasaporte' },
    { id: 'fm2', label: 'FM2 / FM3' },
    { id: 'acta_nacimiento', label: 'Acta de nacimiento' },
    { id: 'comprobante_domicilio', label: 'Comprobante de domicilio' },
];

function estadoDocBadge(estado: DocumentoPortal['estado']) {
    const map = {
        pendiente: { label: 'Pendiente', bg: 'var(--orange-bg)', color: 'var(--orange)' },
        en_revision: { label: 'En revisión', bg: 'var(--blue-bg)', color: 'var(--blue)' },
        aprobado: { label: 'Aprobado', bg: 'var(--green-bg)', color: 'var(--green)' },
        rechazado: { label: 'Rechazado', bg: 'var(--red-bg)', color: 'var(--red)' },
    };
    return map[estado] || map.pendiente;
}

export default function PortalPage() {
    const router = useRouter();
    const [tab, setTab] = useState<'pipeline' | 'documentos' | 'chat'>('pipeline');
    const [etapas, setEtapas] = useState<EtapaPipeline[]>(ETAPAS_DEFAULT);
    const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
    const [documentos, setDocumentos] = useState<DocumentoPortal[]>([]);
    const [input, setInput] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [subiendo, setSubiendo] = useState(false);
    const [tipoDoc, setTipoDoc] = useState('ine');
    const chatRef = useRef<HTMLDivElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const instrumento = INSTRUMENTO_MOCK;
    const etapaActual = etapas.findIndex(e => e.nombreInterno === instrumento.estado);

    useEffect(() => {
        getEtapasPipeline(instrumento.tenantId).then(setEtapas);
        getMensajes(instrumento.id).then(msgs => {
            if (msgs.length === 0) {
                setMensajes([{
                    id: '0', instrumentoId: instrumento.id, rol: 'agente',
                    texto: `Hola, soy el asistente de Fedatario. Estoy aquí para ayudarte con cualquier duda sobre tu acta constitutiva de **${instrumento.sociedadNombre}**. ¿En qué te puedo ayudar?`,
                    creadoEn: new Date().toISOString(),
                }]);
            } else {
                setMensajes(msgs);
            }
        });
        getDocumentosInstrumento(instrumento.id).then(setDocumentos);
    }, []);

    useEffect(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }, [mensajes]);

    const enviarMensaje = async () => {
        if (!input.trim() || enviando) return;
        const texto = input.trim();
        setInput('');

        const msgCliente: MensajeChat = {
            id: Date.now().toString(), instrumentoId: instrumento.id,
            rol: 'cliente', texto, creadoEn: new Date().toISOString(),
        };
        setMensajes(prev => [...prev, msgCliente]);
        setEnviando(true);

        try {
            await guardarMensaje({ instrumentoId: instrumento.id, rol: 'cliente', texto });

            // Llamar al agente IA
            const res = await fetch('/api/portal/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mensaje: texto, instrumentoId: instrumento.id, estado: instrumento.estado }),
            });
            const data = await res.json();
            const respuesta = data.respuesta || 'Un momento, déjame consultar eso con el equipo.';

            const msgAgente: MensajeChat = {
                id: (Date.now() + 1).toString(), instrumentoId: instrumento.id,
                rol: 'agente', texto: respuesta, creadoEn: new Date().toISOString(),
            };
            setMensajes(prev => [...prev, msgAgente]);
            await guardarMensaje({ instrumentoId: instrumento.id, rol: 'agente', texto: respuesta });
        } catch {
            const msgError: MensajeChat = {
                id: (Date.now() + 1).toString(), instrumentoId: instrumento.id,
                rol: 'agente', texto: 'En este momento no puedo responder. Por favor intenta más tarde o contacta directamente al despacho.',
                creadoEn: new Date().toISOString(),
            };
            setMensajes(prev => [...prev, msgError]);
        } finally {
            setEnviando(false);
        }
    };

    const handleSubirDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSubiendo(true);
        try {
            await subirDocumento(file, instrumento.id, instrumento.clienteId, tipoDoc, instrumento.tenantId);
            const docs = await getDocumentosInstrumento(instrumento.id);
            setDocumentos(docs);
        } catch (err) {
            console.error(err);
        } finally {
            setSubiendo(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg2)' }}>
            {/* Header */}
            <header className="bg-white border-b border-black/[0.07] px-4 py-3 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#1D1D1F] flex items-center justify-center text-white text-xs font-extrabold">FD</div>
                    <div>
                        <div className="text-[13px] font-bold text-[#1D1D1F]">Mi acta constitutiva</div>
                        <div className="text-[11px] text-[#86868B]">{instrumento.sociedadNombre}</div>
                    </div>
                </div>
                <button onClick={async () => { await signOut(auth); router.push('/portal/login'); }}
                    className="flex items-center gap-1.5 text-[12px] text-[#86868B] hover:text-[#1D1D1F] transition-colors">
                    <LogOut size={14} /> Salir
                </button>
            </header>

            <div className="max-w-2xl mx-auto px-4 py-6">
                {/* Tabs */}
                <div className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: 'var(--bg3)' }}>
                    {[
                        { id: 'pipeline', label: 'Mi proceso' },
                        { id: 'documentos', label: 'Documentos' },
                        { id: 'chat', label: 'Preguntas' },
                    ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id as any)}
                            className="flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all"
                            style={{
                                background: tab === t.id ? 'white' : 'transparent',
                                color: tab === t.id ? 'var(--ink)' : 'var(--ink4)',
                                boxShadow: tab === t.id ? 'var(--shadow-xs)' : 'none',
                            }}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── PIPELINE ── */}
                {tab === 'pipeline' && (
                    <div className="bg-white rounded-2xl p-6 shadow-[var(--shadow-xs)]">
                        <div className="text-[18px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Estado de tu acta</div>
                        <div className="text-[13px] text-[#86868B] mb-8">{instrumento.sociedadNombre}</div>

                        <div className="space-y-0">
                            {etapas.map((etapa, idx) => {
                                const completada = idx < etapaActual;
                                const activa = idx === etapaActual;
                                const pendiente = idx > etapaActual;

                                return (
                                    <div key={etapa.id} className="flex gap-4">
                                        {/* Línea vertical */}
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 transition-all"
                                                style={{
                                                    background: completada ? 'var(--green-bg)' : activa ? 'var(--blue-bg)' : 'var(--bg3)',
                                                    border: activa ? '2px solid var(--blue)' : completada ? '2px solid var(--green)' : '2px solid var(--bg4)',
                                                }}>
                                                {completada
                                                    ? <CheckCircle size={18} style={{ color: 'var(--green)' }} />
                                                    : activa
                                                        ? <div className="w-3 h-3 rounded-full" style={{ background: 'var(--blue)' }} />
                                                        : <div className="w-3 h-3 rounded-full" style={{ background: 'var(--bg4)' }} />
                                                }
                                            </div>
                                            {idx < etapas.length - 1 && (
                                                <div className="w-0.5 flex-1 my-1 min-h-[24px]" style={{ background: completada ? 'var(--green)' : 'var(--bg3)' }} />
                                            )}
                                        </div>

                                        {/* Contenido */}
                                        <div className="pb-6 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[15px]">{etapa.icono}</span>
                                                <span className="text-[14px] font-bold" style={{ color: pendiente ? 'var(--ink4)' : 'var(--ink)' }}>
                                                    {etapa.nombreCliente}
                                                </span>
                                                {activa && <span className="badge badge-blue text-[10px]">En proceso</span>}
                                                {completada && <span className="badge badge-green text-[10px]">Completado</span>}
                                            </div>
                                            {(activa || completada) && (
                                                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink3)' }}>
                                                    {etapa.descripcionCliente}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── DOCUMENTOS ── */}
                {tab === 'documentos' && (
                    <div className="space-y-4">
                        {/* Subir documento */}
                        <div className="bg-white rounded-2xl p-5 shadow-[var(--shadow-xs)]">
                            <div className="text-[15px] font-bold text-[#1D1D1F] mb-4">Subir documento</div>
                            <div className="flex gap-2 mb-3">
                                <select value={tipoDoc} onChange={e => setTipoDoc(e.target.value)}
                                    className="flex-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'var(--bg2)' }}>
                                    {TIPOS_DOC.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                </select>
                                <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-50"
                                    style={{ background: 'var(--blue)', color: 'white' }}>
                                    {subiendo ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={15} />}
                                    {subiendo ? 'Subiendo...' : 'Seleccionar archivo'}
                                </button>
                                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleSubirDoc} />
                            </div>
                            <p className="text-[11px] text-[#86868B]">PDF, JPG o PNG · Máximo 10MB · El equipo revisará tu documento antes de confirmarlo</p>
                        </div>

                        {/* Lista de documentos */}
                        <div className="bg-white rounded-2xl shadow-[var(--shadow-xs)] overflow-hidden">
                            <div className="px-5 py-4 border-b border-black/[0.07]">
                                <div className="text-[15px] font-bold text-[#1D1D1F]">Mis documentos</div>
                            </div>
                            {documentos.length === 0 ? (
                                <div className="text-center py-10 text-[13px] text-[#86868B]">
                                    No has subido documentos aún
                                </div>
                            ) : (
                                <div className="divide-y divide-black/[0.04]">
                                    {documentos.map(doc => {
                                        const badge = estadoDocBadge(doc.estado);
                                        return (
                                            <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                                                <FileText size={18} style={{ color: 'var(--ink4)', flexShrink: 0 }} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[13px] font-semibold text-[#1D1D1F] truncate">{doc.nombre}</div>
                                                    <div className="text-[11px] text-[#86868B]">{TIPOS_DOC.find(t => t.id === doc.tipo)?.label}</div>
                                                </div>
                                                <span className="badge text-[11px] shrink-0" style={{ background: badge.bg, color: badge.color }}>
                                                    {badge.label}
                                                </span>
                                                {doc.notaRevision && (
                                                    <div className="text-[11px] text-[#86868B] max-w-[120px] truncate" title={doc.notaRevision}>
                                                        {doc.notaRevision}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── CHAT ── */}
                {tab === 'chat' && (
                    <div className="bg-white rounded-2xl shadow-[var(--shadow-xs)] flex flex-col" style={{ height: '60vh' }}>
                        <div className="px-5 py-4 border-b border-black/[0.07]">
                            <div className="text-[15px] font-bold text-[#1D1D1F]">Asistente Fedatario</div>
                            <div className="text-[12px] text-[#86868B]">Responde dudas sobre tu acta constitutiva</div>
                        </div>

                        {/* Mensajes */}
                        <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                            {mensajes.map(msg => (
                                <div key={msg.id} className={`flex ${msg.rol === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                                    <div className="max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed"
                                        style={{
                                            background: msg.rol === 'cliente' ? 'var(--blue)' : 'var(--bg2)',
                                            color: msg.rol === 'cliente' ? 'white' : 'var(--ink)',
                                            borderBottomRightRadius: msg.rol === 'cliente' ? 4 : undefined,
                                            borderBottomLeftRadius: msg.rol === 'agente' ? 4 : undefined,
                                        }}>
                                        {msg.texto}
                                    </div>
                                </div>
                            ))}
                            {enviando && (
                                <div className="flex justify-start">
                                    <div className="px-4 py-2.5 rounded-2xl" style={{ background: 'var(--bg2)', borderBottomLeftRadius: 4 }}>
                                        <Loader2 size={14} style={{ color: 'var(--ink4)', animation: 'spin 1s linear infinite' }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="px-4 py-3 border-t border-black/[0.07] flex gap-2">
                            <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarMensaje()}
                                placeholder="Escribe tu pregunta..."
                                className="flex-1 px-4 py-2.5 rounded-full text-[13px] outline-none"
                                style={{ border: '1px solid var(--border)', background: 'var(--bg2)' }}
                            />
                            <button onClick={enviarMensaje} disabled={!input.trim() || enviando}
                                className="w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 transition-all"
                                style={{ background: 'var(--blue)', color: 'white' }}>
                                <Send size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
