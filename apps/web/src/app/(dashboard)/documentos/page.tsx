'use client';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Eye, Loader2, FileText } from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
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
    const aprobados = documentos.filter(d => d.estado === 'aprobado').length;
    const rechazados = documentos.filter(d => d.estado === 'rechazado').length;

    return (
        <>
            <Topbar breadcrumb="Fedatario /" title="Documentos" />

            <main className="flex-1 p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Documentos</h1>
                    <p className="text-gray-600 dark:text-gray-400">Revisión y aprobación de documentos del portal</p>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">Documentos Pendientes</p>
                        <p className="text-4xl font-bold text-gray-900 dark:text-white">{pendientes}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Requieren revisión</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">Aprobados</p>
                        <p className="text-4xl font-bold text-green-600 dark:text-green-400">{aprobados}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Esta semana</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">Rechazados</p>
                        <p className="text-4xl font-bold text-red-600 dark:text-red-400">{rechazados}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Requieren reenvío</p>
                    </div>
                </div>

                {cargando ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
                    </div>
                ) : documentos.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 shadow-sm text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileText size={32} className="text-gray-400" />
                        </div>
                        <p className="text-gray-900 font-semibold mb-2">Sin documentos pendientes</p>
                        <p className="text-gray-600 text-sm">Todos los documentos han sido procesados</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {documentos.map(doc => (
                            <div key={doc.id} className="bg-white rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-500 mb-1">Instrumento</p>
                                        <p className="text-lg font-bold text-gray-900">{doc.nombre || 'Sin descripción'}</p>
                                    </div>
                                    <span className={`px-4 py-2 rounded-full text-xs font-semibold ${
                                        doc.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                                        doc.estado === 'aprobado' ? 'bg-green-100 text-green-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {doc.estado.charAt(0).toUpperCase() + doc.estado.slice(1)}
                                    </span>
                                </div>

                                {doc.estado === 'pendiente' && (
                                    <div className="flex gap-3 mt-4">
                                        <button
                                            onClick={() => setVisorUrl(doc.url)}
                                            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors text-sm font-semibold"
                                        >
                                            <Eye size={16} /> Ver documento
                                        </button>
                                        <button
                                            onClick={() => aprobar(doc.id)}
                                            disabled={procesando === doc.id}
                                            className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition-colors disabled:opacity-50 text-sm font-semibold"
                                        >
                                            <CheckCircle size={16} /> Aprobar
                                        </button>
                                        <button
                                            onClick={() => setRechazandoId(doc.id)}
                                            className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors text-sm font-semibold"
                                        >
                                            <XCircle size={16} /> Rechazar
                                        </button>
                                    </div>
                                )}

                                {rechazandoId === doc.id && (
                                    <div className="mt-4 p-4 bg-red-50 rounded-2xl">
                                        <textarea
                                            value={notaRechazo}
                                            onChange={e => setNotaRechazo(e.target.value)}
                                            placeholder="Explica por qué rechazas este documento..."
                                            className="w-full p-3 border border-red-200 rounded-xl mb-3 text-sm focus:outline-none focus:border-red-400"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => rechazar(doc.id)}
                                                disabled={!notaRechazo.trim() || procesando === doc.id}
                                                className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700 disabled:opacity-50 text-sm font-semibold"
                                            >
                                                Confirmar rechazo
                                            </button>
                                            <button
                                                onClick={() => setRechazandoId(null)}
                                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 text-sm font-semibold"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {visorUrl && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-3xl max-w-4xl w-full max-h-96 overflow-auto">
                            <iframe src={visorUrl} className="w-full h-96" />
                        </div>
                        <button
                            onClick={() => setVisorUrl(null)}
                            className="absolute top-4 right-4 bg-white p-2 rounded-full hover:bg-gray-100 text-gray-600"
                        >
                            ✕
                        </button>
                    </div>
                )}
            </main>
        </>
    );
}
