'use client';
import { useEffect, useState, useMemo } from 'react';
import {
    CheckCircle, XCircle, Eye, Loader2, FileText, Search,
    FolderOpen, FolderPlus, Trash2, ChevronUp, ChevronDown,
    X, Printer, User, ArrowRight,
} from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import {
    getAllDocumentos, aprobarDocumento, rechazarDocumento,
    agregarACarpeta, removerDeCarpeta, reordenarEnCarpeta,
} from '@/lib/db/documentos';
import { getClientes } from '@/lib/db/clientes';
import { getInstrumentos } from '@/lib/db/instrumentos';
import type { Documento, Cliente, Instrumento } from '@fedatario/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIPO_DOC_LABEL: Record<string, string> = {
    ine: 'INE / IFE', curp: 'CURP', rfc: 'RFC / SAT', pasaporte: 'Pasaporte',
    fm2: 'FM2', fm3: 'FM3', acta_nacimiento: 'Acta de nacimiento',
    comprobante_domicilio: 'Comprobante domicilio', carta_naturalizacion: 'Carta naturalización',
    poder_notarial: 'Poder notarial', acta_constitutiva_moral: 'Acta constitutiva',
    mua: 'MUA / CUD', otro: 'Otro',
};

const ESTADO_COLORS: Record<string, { color: string; bg: string; label: string }> = {
    pendiente:   { color: 'var(--orange)', bg: 'var(--orange-bg)', label: 'Pendiente' },
    en_revision: { color: 'var(--blue)',   bg: 'var(--blue-bg)',   label: 'En revisión' },
    aprobado:    { color: 'var(--green)',  bg: 'var(--green-bg)',  label: 'Aprobado' },
    rechazado:   { color: 'var(--red)',    bg: 'var(--red-bg)',    label: 'Rechazado' },
};

function fuzzyMatch(texto: string, q: string): boolean {
    if (!q) return true;
    texto = texto.toLowerCase(); q = q.toLowerCase();
    if (texto.includes(q)) return true;
    let qi = 0;
    for (let i = 0; i < texto.length && qi < q.length; i++) {
        if (texto[i] === q[qi]) qi++;
    }
    return qi === q.length;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentosPage() {
    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
    const [cargando, setCargando] = useState(true);

    const [busqueda, setBusqueda] = useState('');
    const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
    const [filtroEstado, setFiltroEstado] = useState<string>('todos');
    const [instrumentoCarpeta, setInstrumentoCarpeta] = useState<Instrumento | null>(null);
    const [procesando, setProcesando] = useState<string | null>(null);
    const [rechazandoId, setRechazandoId] = useState<string | null>(null);
    const [notaRechazo, setNotaRechazo] = useState('');
    const [visorUrl, setVisorUrl] = useState<string | null>(null);
    const [tab, setTab] = useState<'bandeja' | 'carpeta'>('bandeja');

    useEffect(() => {
        Promise.all([getAllDocumentos(), getClientes(), getInstrumentos()])
            .then(([docs, cls, insts]) => {
                setDocumentos(docs);
                setClientes(cls);
                setInstrumentos(insts);
            })
            .finally(() => setCargando(false));
    }, []);

    const clienteMap = useMemo(() => Object.fromEntries(clientes.map(c => [c.id, c])), [clientes]);

    const clientesFiltrados = useMemo(() => {
        if (!busqueda) return clientes;
        return clientes.filter(c =>
            fuzzyMatch(c.nombre, busqueda) ||
            fuzzyMatch(c.rfc ?? '', busqueda) ||
            fuzzyMatch(c.curp ?? '', busqueda)
        );
    }, [clientes, busqueda]);

    const docsCliente = useMemo(() => {
        if (!clienteSeleccionado) return [];
        return documentos.filter(d => {
            if (d.clienteId !== clienteSeleccionado.id) return false;
            if (filtroEstado !== 'todos' && d.estado !== filtroEstado) return false;
            return true;
        });
    }, [documentos, clienteSeleccionado, filtroEstado]);

    const docsCarpeta = useMemo(() => {
        if (!instrumentoCarpeta) return [];
        return documentos
            .filter(d => d.carpetaInstrumentoId === instrumentoCarpeta.id)
            .sort((a, b) => (a.carpetaOrden ?? 0) - (b.carpetaOrden ?? 0));
    }, [documentos, instrumentoCarpeta]);

    const pendientes = documentos.filter(d => d.estado === 'pendiente').length;
    const aprobados = documentos.filter(d => d.estado === 'aprobado').length;
    const enCarpetas = documentos.filter(d => !!d.carpetaInstrumentoId).length;

    // ─── Acciones ─────────────────────────────────────────────────────────────

    const aprobar = async (id: string) => {
        setProcesando(id);
        await aprobarDocumento(id, 'corredor');
        setDocumentos(prev => prev.map(d => d.id === id ? { ...d, estado: 'aprobado' as any } : d));
        setProcesando(null);
    };

    const rechazar = async (id: string) => {
        if (!notaRechazo.trim()) return;
        setProcesando(id);
        await rechazarDocumento(id, notaRechazo, 'corredor');
        setDocumentos(prev => prev.map(d => d.id === id ? { ...d, estado: 'rechazado' as any, notaRevision: notaRechazo } : d));
        setRechazandoId(null); setNotaRechazo(''); setProcesando(null);
    };

    const agregarCarpeta = async (docId: string) => {
        if (!instrumentoCarpeta) return;
        const maxOrden = docsCarpeta.length > 0 ? Math.max(...docsCarpeta.map(d => d.carpetaOrden ?? 0)) + 1 : 1;
        setProcesando(docId);
        await agregarACarpeta(docId, instrumentoCarpeta.id!, maxOrden);
        setDocumentos(prev => prev.map(d =>
            d.id === docId ? { ...d, carpetaInstrumentoId: instrumentoCarpeta.id, carpetaOrden: maxOrden } : d
        ));
        setProcesando(null);
    };

    const removerCarpeta = async (docId: string) => {
        setProcesando(docId);
        await removerDeCarpeta(docId);
        setDocumentos(prev => prev.map(d =>
            d.id === docId ? { ...d, carpetaInstrumentoId: undefined, carpetaOrden: undefined } : d
        ));
        setProcesando(null);
    };

    const moverEnCarpeta = async (docId: string, dir: 'arriba' | 'abajo') => {
        const idx = docsCarpeta.findIndex(d => d.id === docId);
        if (idx < 0) return;
        const swapIdx = dir === 'arriba' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= docsCarpeta.length) return;
        const d1 = docsCarpeta[idx], d2 = docsCarpeta[swapIdx];
        const o1 = d1.carpetaOrden ?? idx, o2 = d2.carpetaOrden ?? swapIdx;
        await Promise.all([reordenarEnCarpeta(d1.id, o2), reordenarEnCarpeta(d2.id, o1)]);
        setDocumentos(prev => prev.map(d => {
            if (d.id === d1.id) return { ...d, carpetaOrden: o2 };
            if (d.id === d2.id) return { ...d, carpetaOrden: o1 };
            return d;
        }));
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            <Topbar breadcrumb="Fedatario /" title="Documentos" />
            <div className="p-6">
                <h1 className="text-[24px] font-extrabold text-[#1D1D1F] dark:text-white tracking-tight mb-1">Documentos</h1>
                <p className="text-[14px] text-[#6E6E73] dark:text-gray-400 mb-6">Gestión de expedientes y carpetas de integración</p>

                {/* KPIs */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[
                        { label: 'Pendientes', val: pendientes, color: pendientes > 0 ? 'var(--orange)' : 'var(--ink)' },
                        { label: 'Aprobados',  val: aprobados,  color: 'var(--green)' },
                        { label: 'En carpetas',val: enCarpetas, color: 'var(--blue)' },
                    ].map(k => (
                        <div key={k.label} className="bg-white dark:bg-gray-800 border border-black/[0.07] dark:border-white/[0.07] rounded-2xl p-4">
                            <div className="text-[11px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] mb-1">{k.label}</div>
                            <div className="text-[28px] font-extrabold" style={{ color: k.color }}>{k.val}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-xl mb-5 w-fit" style={{ background: 'var(--bg2)' }}>
                    {([
                        { id: 'bandeja', label: `Bandeja (${documentos.length})` },
                        { id: 'carpeta', label: 'Carpeta de integración' },
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

                {cargando ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={24} style={{ color: 'var(--ink4)', animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : (
                    <>
                        {/* ══ BANDEJA ══════════════════════════════════════════════ */}
                        {tab === 'bandeja' && (
                            <div className="grid grid-cols-[280px_1fr] gap-4">
                                {/* Lista clientes */}
                                <div className="space-y-2">
                                    <div className="text-[11px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] mb-1">Buscar cliente</div>
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-black/[0.08] dark:border-white/[0.08]">
                                        <Search size={13} style={{ color: 'var(--ink4)' }} />
                                        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                                            placeholder="Nombre, RFC, CURP..."
                                            className="flex-1 text-[12px] outline-none bg-transparent" style={{ color: 'var(--ink)' }} />
                                        {busqueda && (
                                            <button onClick={() => { setBusqueda(''); setClienteSeleccionado(null); }}>
                                                <X size={12} style={{ color: 'var(--ink4)' }} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 border border-black/[0.07] dark:border-white/[0.07] rounded-xl overflow-hidden max-h-[calc(100vh-360px)] overflow-y-auto">
                                        {clientesFiltrados.length === 0 ? (
                                            <div className="text-[12px] text-[#86868B] dark:text-gray-400 text-center py-6">Sin resultados</div>
                                        ) : clientesFiltrados.map((c, i) => {
                                            const docsCount = documentos.filter(d => d.clienteId === c.id).length;
                                            const sel = clienteSeleccionado?.id === c.id;
                                            return (
                                                <button key={c.id}
                                                    onClick={() => setClienteSeleccionado(sel ? null : c)}
                                                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${i > 0 ? 'border-t border-black/[0.04]' : ''}`}
                                                    style={{ background: sel ? 'var(--blue-bg)' : 'transparent' }}>
                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                                                        style={{ background: sel ? 'var(--blue)' : 'var(--bg2)', color: sel ? 'white' : 'var(--ink4)' }}>
                                                        {c.nombre.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-[12px] font-semibold truncate" style={{ color: sel ? 'var(--blue)' : 'var(--ink)' }}>
                                                            {c.nombre}
                                                        </div>
                                                        <div className="text-[10px] text-[#86868B] dark:text-gray-400">
                                                            {docsCount} doc{docsCount !== 1 ? 's' : ''}{c.rfc ? ` · ${c.rfc}` : ''}
                                                        </div>
                                                    </div>
                                                    {sel && <ArrowRight size={12} style={{ color: 'var(--blue)' }} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Documentos del cliente */}
                                <div>
                                    {!clienteSeleccionado ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-black/[0.1] rounded-2xl">
                                            <User size={32} style={{ color: 'var(--ink4)' }} className="mb-3" />
                                            <div className="text-[14px] font-bold text-[#1D1D1F] dark:text-white mb-1">Selecciona un cliente</div>
                                            <div className="text-[13px] text-[#86868B] dark:text-gray-400">Busca por nombre y haz clic para ver sus documentos</div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                                                        style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                                                        {clienteSeleccionado.nombre.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="text-[14px] font-bold text-[#1D1D1F] dark:text-white">{clienteSeleccionado.nombre}</div>
                                                        <div className="text-[11px] text-[#86868B] dark:text-gray-400">{docsCliente.length} documento{docsCliente.length !== 1 ? 's' : ''}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
                                                        className="text-[12px] px-2.5 py-1.5 rounded-lg border border-black/[0.08] outline-none"
                                                        style={{ background: 'var(--bg2)' }}>
                                                        <option value="todos">Todos</option>
                                                        <option value="pendiente">Pendientes</option>
                                                        <option value="aprobado">Aprobados</option>
                                                        <option value="rechazado">Rechazados</option>
                                                    </select>
                                                    <select value={instrumentoCarpeta?.id ?? ''}
                                                        onChange={e => setInstrumentoCarpeta(instrumentos.find(i => i.id === e.target.value) ?? null)}
                                                        className="text-[12px] px-2.5 py-1.5 rounded-lg border border-black/[0.08] outline-none"
                                                        style={{ background: instrumentoCarpeta ? 'var(--blue-bg)' : 'var(--bg2)', color: instrumentoCarpeta ? 'var(--blue)' : 'var(--ink)' }}>
                                                        <option value="">📁 Carpeta...</option>
                                                        {instrumentos.map(i => (
                                                            <option key={i.id} value={i.id}>
                                                                {i.denominacion_social ?? 'Sin nombre'}{i.numero_poliza ? ` · ${i.numero_poliza}` : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {instrumentoCarpeta && (
                                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3 text-[12px] font-semibold"
                                                    style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                                                    <FolderOpen size={13} /> Carpeta activa: {instrumentoCarpeta.denominacion_social ?? 'Sin nombre'}
                                                    <button onClick={() => setInstrumentoCarpeta(null)} className="ml-auto"><X size={12} /></button>
                                                </div>
                                            )}

                                            {docsCliente.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-black/[0.1] rounded-2xl">
                                                    <FileText size={24} style={{ color: 'var(--ink4)' }} className="mb-2" />
                                                    <div className="text-[13px] font-bold text-[#1D1D1F] dark:text-white mb-1">Sin documentos</div>
                                                    <div className="text-[12px] text-[#86868B] dark:text-gray-400">Este cliente no tiene documentos registrados{filtroEstado !== 'todos' ? ` en estado "${filtroEstado}"` : ''}</div>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {docsCliente.map(doc => {
                                                        const estadoInfo = ESTADO_COLORS[doc.estado] ?? ESTADO_COLORS.pendiente;
                                                        const yaEnCarpeta = doc.carpetaInstrumentoId === instrumentoCarpeta?.id;
                                                        const enOtraCarpeta = doc.carpetaInstrumentoId && doc.carpetaInstrumentoId !== instrumentoCarpeta?.id;
                                                        return (
                                                            <div key={doc.id} className="bg-white dark:bg-gray-800 border border-black/[0.06] dark:border-white/[0.06] rounded-xl p-3.5 space-y-2">
                                                                <div className="flex items-start gap-2.5">
                                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--bg2)' }}>
                                                                        <FileText size={14} style={{ color: 'var(--ink4)' }} />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-[13px] font-bold text-[#1D1D1F] dark:text-white truncate">{TIPO_DOC_LABEL[doc.tipo] ?? doc.tipo}</div>
                                                                        <div className="text-[11px] text-[#86868B] dark:text-gray-400 truncate">{doc.nombre}</div>
                                                                    </div>
                                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                                                                        style={{ background: estadoInfo.bg, color: estadoInfo.color }}>{estadoInfo.label}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <button onClick={() => setVisorUrl(doc.storageUrl)}
                                                                        className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                                                                        style={{ background: 'var(--bg2)', color: 'var(--ink4)' }}>
                                                                        <Eye size={11} /> Ver
                                                                    </button>
                                                                    {doc.estado === 'pendiente' && (
                                                                        <>
                                                                            <button onClick={() => aprobar(doc.id!)} disabled={procesando === doc.id}
                                                                                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                                                                                style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
                                                                                {procesando === doc.id ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />} Aprobar
                                                                            </button>
                                                                            <button onClick={() => setRechazandoId(doc.id!)}
                                                                                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                                                                                style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                                                                                <XCircle size={11} /> Rechazar
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {instrumentoCarpeta && (
                                                                        yaEnCarpeta ? (
                                                                            <span className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-lg"
                                                                                style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
                                                                                <FolderOpen size={11} /> En carpeta
                                                                            </span>
                                                                        ) : (
                                                                            <button onClick={() => agregarCarpeta(doc.id!)}
                                                                                disabled={procesando === doc.id || !!enOtraCarpeta}
                                                                                title={enOtraCarpeta ? 'Ya en carpeta de otro instrumento' : 'Añadir a carpeta'}
                                                                                className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg disabled:opacity-40"
                                                                                style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                                                                                {procesando === doc.id ? <Loader2 size={11} className="animate-spin" /> : <FolderPlus size={11} />}
                                                                                {enOtraCarpeta ? 'Otro instr.' : 'Añadir'}
                                                                            </button>
                                                                        )
                                                                    )}
                                                                </div>
                                                                {rechazandoId === doc.id && (
                                                                    <div className="border-t border-black/[0.04] pt-2 space-y-2">
                                                                        <textarea value={notaRechazo} onChange={e => setNotaRechazo(e.target.value)}
                                                                            placeholder="Motivo del rechazo..." rows={2}
                                                                            className="w-full text-[12px] rounded-lg p-2 border border-red-200 outline-none resize-none" />
                                                                        <div className="flex gap-2">
                                                                            <button onClick={() => rechazar(doc.id!)} disabled={!notaRechazo.trim() || procesando === doc.id}
                                                                                className="text-[11px] font-bold px-2 py-1 rounded-lg disabled:opacity-40"
                                                                                style={{ background: 'var(--red)', color: 'white' }}>Confirmar</button>
                                                                            <button onClick={() => { setRechazandoId(null); setNotaRechazo(''); }}
                                                                                className="text-[11px] font-bold px-2 py-1 rounded-lg"
                                                                                style={{ background: 'var(--bg3)', color: 'var(--ink4)' }}>Cancelar</button>
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
                                </div>
                            </div>
                        )}

                        {/* ══ CARPETA DE INTEGRACIÓN ═══════════════════════════════ */}
                        {tab === 'carpeta' && (
                            <div>
                                <div className="bg-white dark:bg-gray-800 border border-black/[0.07] dark:border-white/[0.07] rounded-2xl p-4 mb-4">
                                    <div className="text-[11px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] mb-2">Instrumento</div>
                                    <select value={instrumentoCarpeta?.id ?? ''}
                                        onChange={e => setInstrumentoCarpeta(instrumentos.find(i => i.id === e.target.value) ?? null)}
                                        className="w-full text-[14px] font-semibold px-3 py-2.5 rounded-xl border border-black/[0.08] outline-none"
                                        style={{ background: 'var(--bg2)' }}>
                                        <option value="">— Seleccionar instrumento —</option>
                                        {instrumentos.map(i => (
                                            <option key={i.id} value={i.id}>
                                                {i.denominacion_social ?? 'Sin nombre'}{i.numero_poliza ? ` · Póliza ${i.numero_poliza}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {!instrumentoCarpeta ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-black/[0.1] rounded-2xl">
                                        <FolderOpen size={36} style={{ color: 'var(--ink4)' }} className="mb-3" />
                                        <div className="text-[14px] font-bold text-[#1D1D1F] dark:text-white mb-1">Selecciona un instrumento</div>
                                        <div className="text-[13px] text-[#86868B] dark:text-gray-400">La carpeta contiene los documentos organizados para impresión y anexo al acta</div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-[1fr_300px] gap-4">
                                        {/* Carpeta ordenada */}
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <div className="text-[13px] font-bold text-[#1D1D1F] dark:text-white">
                                                        {instrumentoCarpeta.denominacion_social ?? 'Sin nombre'}
                                                    </div>
                                                    <div className="text-[11px] text-[#86868B] dark:text-gray-400">
                                                        {docsCarpeta.length} documento{docsCarpeta.length !== 1 ? 's' : ''} · Orden de impresión
                                                    </div>
                                                </div>
                                                {docsCarpeta.length > 0 && (
                                                    <button onClick={() => docsCarpeta.forEach(d => window.open(d.storageUrl, '_blank'))}
                                                        className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-xl"
                                                        style={{ background: 'var(--blue)', color: 'white' }}>
                                                        <Printer size={13} /> Ver todos
                                                    </button>
                                                )}
                                            </div>
                                            {docsCarpeta.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-black/[0.1] rounded-2xl">
                                                    <FolderPlus size={28} style={{ color: 'var(--ink4)' }} className="mb-2" />
                                                    <div className="text-[13px] font-bold text-[#1D1D1F] dark:text-white mb-1">Carpeta vacía</div>
                                                    <div className="text-[12px] text-[#86868B] dark:text-gray-400">Busca un cliente en la columna derecha y añade sus documentos</div>
                                                </div>
                                            ) : (
                                                <div className="bg-white dark:bg-gray-800 border border-black/[0.07] dark:border-white/[0.07] rounded-2xl overflow-hidden">
                                                    {docsCarpeta.map((doc, i) => {
                                                        const clienteDoc = clienteMap[doc.clienteId];
                                                        const estadoInfo = ESTADO_COLORS[doc.estado] ?? ESTADO_COLORS.pendiente;
                                                        return (
                                                            <div key={doc.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-black/[0.04]' : ''}`}>
                                                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0"
                                                                    style={{ background: 'var(--bg2)', color: 'var(--ink4)' }}>{i + 1}</div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white truncate">{TIPO_DOC_LABEL[doc.tipo] ?? doc.tipo}</div>
                                                                    <div className="text-[11px] text-[#86868B] dark:text-gray-400 flex items-center gap-1">
                                                                        <User size={10} /> {clienteDoc?.nombre ?? '—'}
                                                                    </div>
                                                                </div>
                                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                                                                    style={{ background: estadoInfo.bg, color: estadoInfo.color }}>{estadoInfo.label}</span>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <button onClick={() => setVisorUrl(doc.storageUrl)} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700" title="Ver">
                                                                        <Eye size={12} style={{ color: 'var(--ink4)' }} />
                                                                    </button>
                                                                    <button onClick={() => moverEnCarpeta(doc.id!, 'arriba')} disabled={i === 0}
                                                                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30">
                                                                        <ChevronUp size={12} style={{ color: 'var(--ink4)' }} />
                                                                    </button>
                                                                    <button onClick={() => moverEnCarpeta(doc.id!, 'abajo')} disabled={i === docsCarpeta.length - 1}
                                                                        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30">
                                                                        <ChevronDown size={12} style={{ color: 'var(--ink4)' }} />
                                                                    </button>
                                                                    <button onClick={() => removerCarpeta(doc.id!)} disabled={procesando === doc.id}
                                                                        className="p-1 rounded-lg hover:bg-red-50">
                                                                        <Trash2 size={12} style={{ color: 'var(--red)' }} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Panel derecho: añadir por cliente */}
                                        <div>
                                            <div className="text-[11px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] mb-2">Añadir documentos</div>
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-black/[0.08] dark:border-white/[0.08] mb-2">
                                                <Search size={13} style={{ color: 'var(--ink4)' }} />
                                                <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                                                    placeholder="Buscar cliente..."
                                                    className="flex-1 text-[12px] outline-none bg-transparent" style={{ color: 'var(--ink)' }} />
                                            </div>
                                            {/* Socios del instrumento primero */}
                                            {(() => {
                                                const socioIds = new Set((instrumentoCarpeta.socios ?? []).map(s => s.clienteId));
                                                const grupos = [
                                                    { label: 'Socios del instrumento', items: clientes.filter(c => socioIds.has(c.id!)) },
                                                    ...(busqueda ? [{ label: 'Otros clientes', items: clientesFiltrados.filter(c => !socioIds.has(c.id!)) }] : []),
                                                ];
                                                return grupos.map(grupo => (
                                                    grupo.items.length === 0 ? null :
                                                    <div key={grupo.label} className="mb-3">
                                                        <div className="text-[10px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.05em] mb-1.5 px-1">{grupo.label}</div>
                                                        <div className="bg-white dark:bg-gray-800 border border-black/[0.07] dark:border-white/[0.07] rounded-xl overflow-hidden">
                                                            {grupo.items.map((c, ci) => {
                                                                const docsC = documentos.filter(d => d.clienteId === c.id);
                                                                const sel = clienteSeleccionado?.id === c.id;
                                                                return (
                                                                    <div key={c.id} className={ci > 0 ? 'border-t border-black/[0.04]' : ''}>
                                                                        <button onClick={() => setClienteSeleccionado(sel ? null : c)}
                                                                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#F5F5F7] dark:bg-gray-700 transition-colors">
                                                                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                                                                                style={{ background: sel ? 'var(--blue)' : 'var(--bg2)', color: sel ? 'white' : 'var(--ink4)' }}>
                                                                                {c.nombre.charAt(0)}
                                                                            </div>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="text-[12px] font-semibold truncate" style={{ color: sel ? 'var(--blue)' : 'var(--ink)' }}>{c.nombre}</div>
                                                                                <div className="text-[10px] text-[#86868B] dark:text-gray-400">{docsC.length} docs</div>
                                                                            </div>
                                                                        </button>
                                                                        {sel && docsC.length > 0 && (
                                                                            <div className="px-2 pb-2 space-y-1">
                                                                                {docsC.map(doc => {
                                                                                    const yaEn = doc.carpetaInstrumentoId === instrumentoCarpeta.id;
                                                                                    const estadoInfo = ESTADO_COLORS[doc.estado] ?? ESTADO_COLORS.pendiente;
                                                                                    return (
                                                                                        <div key={doc.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                                                                                            style={{ background: yaEn ? 'var(--green-bg)' : 'var(--bg2)' }}>
                                                                                            <FileText size={11} style={{ color: 'var(--ink4)' }} />
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <div className="text-[11px] font-semibold truncate">{TIPO_DOC_LABEL[doc.tipo] ?? doc.tipo}</div>
                                                                                            </div>
                                                                                            <span className="text-[10px]" style={{ color: estadoInfo.color }}>{estadoInfo.label}</span>
                                                                                            {yaEn
                                                                                                ? <CheckCircle size={13} style={{ color: 'var(--green)' }} />
                                                                                                : <button onClick={() => agregarCarpeta(doc.id!)}
                                                                                                    disabled={procesando === doc.id || !!doc.carpetaInstrumentoId}
                                                                                                    title={doc.carpetaInstrumentoId ? 'Ya en otra carpeta' : 'Añadir a carpeta'}
                                                                                                    className="p-0.5 rounded hover:bg-blue-100 disabled:opacity-30">
                                                                                                    <FolderPlus size={13} style={{ color: 'var(--blue)' }} />
                                                                                                </button>
                                                                                            }
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Visor */}
            {visorUrl && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07]">
                            <span className="text-[13px] font-bold text-[#1D1D1F] dark:text-white">Visor de documento</span>
                            <div className="flex items-center gap-2">
                                <a href={visorUrl} target="_blank" rel="noopener noreferrer"
                                    className="text-[12px] font-semibold no-underline px-3 py-1 rounded-lg"
                                    style={{ background: 'var(--blue)', color: 'white' }}>
                                    Abrir en pestaña
                                </a>
                                <button onClick={() => setVisorUrl(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-gray-700">
                                    <X size={16} style={{ color: 'var(--ink4)' }} />
                                </button>
                            </div>
                        </div>
                        <iframe src={visorUrl} className="flex-1 w-full" />
                    </div>
                </div>
            )}
            <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}
