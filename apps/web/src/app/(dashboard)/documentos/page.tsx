'use client';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Eye, Loader2, FileText } from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { Card, CardHeader, KpiCard } from '@/components/ui';
import { getDocumentosPendientes, aprobarDocumento, rechazarDocumento } from '@/lib/db/portal';
import type { DocumentoPortal } from '@fedatario/shared';

export default function DocumentosPage() {
    const [documentos, setDocumentos] = useState<DocumentoPortal[]>([]);
    const [cargando, setCargando] = useState(true);
    const [visorUrl, setVisorUrl] = useState<string | null>(null);
    const [notaRechazo, setNotaRechazo] = useState('');
    const [rechazandoId, setRechazandoId] = useState<string | null>(null);
    const [procesando, setProcesando] = useState<string | null>(null);

    useEffect(() => {
        cargar();
    }, []);

    const cargar = () => {
        setCargando(true);
        getDocumentosPendientes()
            .then(setDocumentos)
            .finally(() => setCargando(false));
    };

    const aprobar = async (id: string) => {
        setProcesando(id);
        await aprobarDocumento(id, 'corredor');
        await cargar();
        setProcesando(null);
    };

    const rechazar = async (id: string) => {
        if (!notaRechazo.trim()) return;
        setProcesando(id);
        await rechazarDocumento(id, notaRechazo, 'corredor');
        setRechazandoId(null);
        setNotaRechazo('');
        await cargar();
        setProcesando(null);
    };

    const pendientes = documentos.filter(d => d.estado === 'pendiente').length;

    return (
        <>
            <Topbar breadcrumb="Fedatario /" title="Documentos" />

            {/* Visor de documento — overlay */}
            {visorUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                    <div className="bg-white rounded-2xl overflow-hidden w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.07]">
                            <span className="text-[14px] font-bold text-[#1D1D1F]">Visor de documento</span>
                            <button onClick={() => setVisorUrl(null)} className="p-2 rounded-lg hover:bg-[#F5F5F7] transition-colors">
                                <XCircle size={18} style={{ color: 'var(--ink4)' }} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            {visorUrl.match(/\.(jpg|jpeg|png)$/i) ? (
                                <img src={visorUrl} alt="Documento" className="w-full h-full object-contain p-4" />
                            ) : (
                                <iframe src={visorUrl} className="w-full h-full border-0" title="Documento" />
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="p-6">
                <h1 className="text-[24px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Documentos</h1>
                <p className="text-[14px] text-[#6E6E73] mb-6">Revisión de documentos subidos por clientes</p>

                <div className="grid grid-cols-3 gap-3 mb-6">
                    <KpiCard num={String(pendientes)} label="Pendientes de revisión" delta={pendientes > 0 ? '↑ Requieren atención' : 'Al día'} deltaColor={pendientes > 0 ? 'var(--orange)' : 'var(--green)'} />
                    <KpiCard num={String(documentos.length)} label="Total recibidos" />
                    <KpiCard num={String(documentos.filter(d => d.estado === 'aprobado').length)} label="Aprobados" deltaColor="var(--green)" />
                </div>

                <Card>
                    <CardHeader title="Documentos pendientes de revisión" subtitle="El cliente no puede ver su documento como aprobado hasta que lo confirmes" />

                    {cargando ? (
                        <div className="flex items-center justify-center py-12 gap-3">
                            <Loader2 size={18} style={{ color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />
                            <span className="text-[13px] text-[#86868B]">Cargando...</span>
                        </div>
                    ) : documentos.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle size={32} style={{ color: 'var(--green)', margin: '0 auto 8px' }} />
                            <div className="text-[14px] font-semibold text-[#1D1D1F]">Todo al día</div>
                            <div className="text-[12px] text-[#86868B] mt-1">No hay documentos pendientes de revisión</div>
                        </div>
                    ) : (
                        <div className="divide-y divide-black/[0.04]">
                            {documentos.map(docItem => (
                                <div key={docItem.id} className="px-4 py-4">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--bg2)' }}>
                                            <FileText size={18} style={{ color: 'var(--ink4)' }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[13px] font-semibold text-[#1D1D1F] truncate">{docItem.nombre}</div>
                                            <div className="text-[11px] text-[#86868B] mt-0.5">
                                                Tipo: {docItem.tipo} · Instrumento: {docItem.instrumentoId}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* Ver documento — sin descargar */}
                                            <button
                                                onClick={() => setVisorUrl(docItem.storageUrl)}
                                                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                                style={{ color: 'var(--blue)', background: 'var(--blue-bg)' }}>
                                                <Eye size={13} /> Ver
                                            </button>

                                            {/* Aprobar */}
                                            {rechazandoId !== docItem.id && (
                                                <button
                                                    onClick={() => aprobar(docItem.id)}
                                                    disabled={procesando === docItem.id}
                                                    className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                                    style={{ color: 'var(--green)', background: 'var(--green-bg)' }}>
                                                    {procesando === docItem.id
                                                        ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                                                        : <CheckCircle size={13} />}
                                                    Aprobar
                                                </button>
                                            )}

                                            {/* Rechazar */}
                                            {rechazandoId !== docItem.id ? (
                                                <button
                                                    onClick={() => setRechazandoId(docItem.id)}
                                                    className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                                    style={{ color: 'var(--red)', background: 'var(--red-bg)' }}>
                                                    <XCircle size={13} /> Rechazar
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        autoFocus
                                                        value={notaRechazo}
                                                        onChange={e => setNotaRechazo(e.target.value)}
                                                        placeholder="Motivo del rechazo..."
                                                        className="px-3 py-1.5 rounded-lg text-[12px] outline-none w-48"
                                                        style={{ border: '1px solid var(--red)', background: 'white' }}
                                                        onKeyDown={e => { if (e.key === 'Enter') rechazar(docItem.id); if (e.key === 'Escape') setRechazandoId(null); }}
                                                    />
                                                    <button onClick={() => rechazar(docItem.id)} disabled={!notaRechazo.trim()}
                                                        className="text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                                                        style={{ background: 'var(--red)', color: 'white' }}>
                                                        Confirmar
                                                    </button>
                                                    <button onClick={() => setRechazandoId(null)}
                                                        className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                                                        style={{ background: 'var(--bg2)', color: 'var(--ink3)' }}>
                                                        Cancelar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
            <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}
