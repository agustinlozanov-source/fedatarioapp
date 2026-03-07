'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Upload, Download, CheckCircle,
    AlertCircle, Loader2, X, Plus, Trash2
} from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { cargaMasivaClientes } from '@/lib/db/clientes';
import { auth } from '@/lib/firebase';

interface ClienteRow {
    uid: string;
    nombre: string;
    rfc: string;
    curp: string;
    email: string;
    celular: string;
    nacionalidad: string;
    tipoPersona: 'fisica' | 'moral';
    error?: string;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function validarRow(row: ClienteRow): string {
    if (!row.nombre.trim()) return 'Nombre requerido';
    if (row.rfc && !/^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/i.test(row.rfc.trim())) return 'RFC inválido';
    if (row.curp && row.curp.trim().length !== 18) return 'CURP debe tener 18 caracteres';
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'Email inválido';
    return '';
}

function parsearCSV(texto: string): ClienteRow[] {
    const lineas = texto.trim().split('\n');
    if (lineas.length < 2) return [];
    // Saltar header
    return lineas.slice(1).map(linea => {
        const cols = linea.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        return {
            uid: uid(),
            nombre: cols[0] || '',
            rfc: cols[1] || '',
            curp: cols[2] || '',
            email: cols[3] || '',
            celular: cols[4] || '',
            nacionalidad: cols[5] || 'Mexicana',
            tipoPersona: (cols[6] === 'moral' ? 'moral' : 'fisica') as 'fisica' | 'moral',
        };
    }).filter(r => r.nombre.trim());
}

const PLANTILLA_CSV = `nombre,rfc,curp,email,celular,nacionalidad,tipo_persona
Juan Pérez García,PEGJ800101ABC,PEGJ800101HDFRRN09,juan@email.com,8681234567,Mexicana,fisica
Empresa Ejemplo SA,EEJ800101ABC,,,,,moral`;

export default function CargaMasivaPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);
    const [modo, setModo] = useState<'csv' | 'manual'>('csv');
    const [rows, setRows] = useState<ClienteRow[]>([]);
    const [cargando, setCargando] = useState(false);
    const [resultado, setResultado] = useState<{ creados: number } | null>(null);
    const [error, setError] = useState('');

    // ── CSV ──────────────────────────────────────

    const descargarPlantilla = () => {
        const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_clientes_fedatario.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const leerCSV = (file: File) => {
        const reader = new FileReader();
        reader.onload = e => {
            const texto = e.target?.result as string;
            const parsed = parsearCSV(texto);
            const validados = parsed.map(r => ({ ...r, error: validarRow(r) }));
            setRows(validados);
        };
        reader.readAsText(file, 'UTF-8');
    };

    // ── MANUAL ───────────────────────────────────

    const agregarRow = () => setRows(prev => [...prev, {
        uid: uid(), nombre: '', rfc: '', curp: '',
        email: '', celular: '', nacionalidad: 'Mexicana',
        tipoPersona: 'fisica',
    }]);

    const actualizarRow = (uid: string, key: keyof ClienteRow, val: string) => {
        setRows(prev => prev.map(r => {
            if (r.uid !== uid) return r;
            const updated = { ...r, [key]: val };
            return { ...updated, error: validarRow(updated) };
        }));
    };

    const eliminarRow = (uid: string) => setRows(prev => prev.filter(r => r.uid !== uid));

    // ── CREAR ─────────────────────────────────────

    const confirmar = async () => {
        const validos = rows.filter(r => !r.error && r.nombre.trim());
        if (validos.length === 0) { setError('No hay clientes válidos para crear'); return; }
        setCargando(true);
        setError('');
        try {
            const tenantId = auth.currentUser!.uid;
            const creados = await cargaMasivaClientes(
                validos.map(r => ({
                    tenantId,
                    tipoPersona: r.tipoPersona,
                    nombre: r.nombre.trim(),
                    ...(r.rfc ? { rfc: r.rfc.trim().toUpperCase() } : {}),
                    ...(r.curp ? { curp: r.curp.trim().toUpperCase() } : {}),
                    ...(r.email ? { email: r.email.trim() } : {}),
                    ...(r.celular ? { celular: r.celular.trim() } : {}),
                    ...(r.nacionalidad ? { nacionalidad: r.nacionalidad.trim() } : {}),
                    portalActivo: true,
                }))
            );
            setResultado({ creados });
        } catch (e: any) {
            setError(e.message || 'Error al crear clientes');
        } finally {
            setCargando(false);
        }
    };

    const rowsValidos = rows.filter(r => !r.error && r.nombre.trim()).length;
    const rowsConError = rows.filter(r => r.error).length;

    // ── ÉXITO ─────────────────────────────────────

    if (resultado) return (
        <>
            <Topbar breadcrumb="Clientes /" title="Carga masiva" />
            <div className="p-6 max-w-xl mx-auto text-center pt-20">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'var(--green-bg)' }}>
                    <CheckCircle size={32} style={{ color: 'var(--green)' }} />
                </div>
                <h2 className="text-[22px] font-extrabold text-[#1D1D1F] mb-1">Carga completada</h2>
                <p className="text-[14px] text-[#86868B] mb-8">
                    Se crearon <strong>{resultado.creados}</strong> clientes correctamente
                </p>
                <div className="flex gap-3 justify-center">
                    <button onClick={() => router.push('/clientes')}
                        className="px-5 py-2.5 rounded-xl text-[13px] font-bold"
                        style={{ background: 'var(--blue)', color: 'white' }}>
                        Ver clientes
                    </button>
                    <button onClick={() => { setResultado(null); setRows([]); }}
                        className="px-5 py-2.5 rounded-xl text-[13px] font-bold"
                        style={{ background: 'var(--bg2)', color: 'var(--ink3)' }}>
                        Nueva carga
                    </button>
                </div>
            </div>
        </>
    );

    return (
        <>
            <Topbar breadcrumb="Clientes /" title="Carga masiva" />
            <div className="p-6 max-w-5xl mx-auto">
                <button onClick={() => router.push('/clientes')}
                    className="flex items-center gap-1.5 text-[13px] font-semibold mb-4"
                    style={{ color: 'var(--ink4)' }}>
                    <ArrowLeft size={14} /> Clientes
                </button>

                <h1 className="text-[24px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Carga masiva</h1>
                <p className="text-[14px] text-[#6E6E73] mb-6">Importa múltiples clientes a la vez</p>

                {/* Selector de modo */}
                <div className="flex items-center gap-1 p-1 rounded-xl mb-6 w-fit"
                    style={{ background: 'var(--bg2)' }}>
                    {(['csv', 'manual'] as const).map(m => (
                        <button key={m} onClick={() => { setModo(m); setRows([]); }}
                            className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
                            style={{
                                background: modo === m ? 'white' : 'transparent',
                                color: modo === m ? 'var(--ink)' : 'var(--ink4)',
                                boxShadow: modo === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}>
                            {m === 'csv' ? 'Importar CSV / Excel' : 'Captura en lote'}
                        </button>
                    ))}
                </div>

                {/* ── MODO CSV ── */}
                {modo === 'csv' && rows.length === 0 && (
                    <div className="space-y-4">
                        {/* Paso 1 — Descargar plantilla */}
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="text-[13px] font-bold text-[#1D1D1F] mb-0.5">Paso 1 — Descarga la plantilla</div>
                                    <div className="text-[12px] text-[#86868B] mb-4">Llena los datos de tus clientes en el archivo CSV</div>
                                </div>
                                <button onClick={descargarPlantilla}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold"
                                    style={{ background: 'var(--bg2)', color: 'var(--ink3)', border: '1px solid var(--border)' }}>
                                    <Download size={14} /> Descargar plantilla
                                </button>
                            </div>
                            <div className="mt-3 p-3 rounded-xl text-[11px] font-mono"
                                style={{ background: 'var(--bg2)', color: 'var(--ink4)' }}>
                                nombre, rfc, curp, email, celular, nacionalidad, tipo_persona
                            </div>
                        </div>

                        {/* Paso 2 — Subir archivo */}
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5">
                            <div className="text-[13px] font-bold text-[#1D1D1F] mb-0.5">Paso 2 — Sube el archivo</div>
                            <div className="text-[12px] text-[#86868B] mb-4">Formatos aceptados: CSV, TXT</div>
                            <button onClick={() => fileRef.current?.click()}
                                className="w-full flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed transition-colors hover:border-[var(--blue)]"
                                style={{ borderColor: 'var(--border)', background: 'var(--bg2)' }}>
                                <Upload size={24} style={{ color: 'var(--ink4)' }} />
                                <span className="text-[13px] font-semibold text-[#86868B]">Click para seleccionar archivo</span>
                                <span className="text-[11px] text-[#86868B]">CSV o TXT con separación por comas</span>
                            </button>
                            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden"
                                onChange={e => { if (e.target.files?.[0]) leerCSV(e.target.files[0]); }} />
                        </div>
                    </div>
                )}

                {/* ── MODO MANUAL — formulario vacío inicial ── */}
                {modo === 'manual' && rows.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="text-[14px] font-bold text-[#1D1D1F] mb-1">Captura en lote</div>
                        <div className="text-[13px] text-[#86868B] mb-4">
                            Agrega clientes uno por uno de forma rápida
                        </div>
                        <button onClick={agregarRow}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold"
                            style={{ background: 'var(--blue)', color: 'white' }}>
                            <Plus size={14} /> Agregar primer cliente
                        </button>
                    </div>
                )}

                {/* ── TABLA DE PREVIEW / EDICIÓN ── */}
                {rows.length > 0 && (
                    <div>
                        {/* Resumen */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                                style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
                                <CheckCircle size={12} /> {rowsValidos} válidos
                            </div>
                            {rowsConError > 0 && (
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold"
                                    style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                                    <AlertCircle size={12} /> {rowsConError} con error
                                </div>
                            )}
                            <div className="ml-auto flex items-center gap-2">
                                {/* ── Botones adicionales solo si hay algún cambio o error? ── */}
                                <div className="flex items-center justify-between">
                                    <button onClick={() => setRows([])}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold"
                                        style={{ background: 'var(--bg2)', color: 'var(--ink3)' }}>
                                        Limpiar lista
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Tabla */}
                        <div className="bg-white border border-black/[0.07] rounded-2xl overflow-hidden mb-4">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                                            {['Nombre *', 'RFC', 'CURP', 'Email', 'Celular', 'Nacionalidad', 'Tipo', ''].map(h => (
                                                <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] whitespace-nowrap">
                                                    {h}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, idx) => (
                                            <tr key={row.uid}
                                                className="border-b border-black/[0.04] last:border-0"
                                                style={{ background: row.error ? 'var(--red-bg)' : 'white' }}>
                                                <td className="px-3 py-2">
                                                    <input value={row.nombre}
                                                        onChange={e => actualizarRow(row.uid, 'nombre', e.target.value)}
                                                        placeholder="Nombre completo"
                                                        className="w-full text-[13px] outline-none bg-transparent min-w-[160px]" />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input value={row.rfc}
                                                        onChange={e => actualizarRow(row.uid, 'rfc', e.target.value)}
                                                        placeholder="RFC"
                                                        className="w-full text-[13px] font-mono outline-none bg-transparent min-w-[120px]" />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input value={row.curp}
                                                        onChange={e => actualizarRow(row.uid, 'curp', e.target.value)}
                                                        placeholder="CURP"
                                                        className="w-full text-[13px] font-mono outline-none bg-transparent min-w-[140px]" />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input value={row.email}
                                                        onChange={e => actualizarRow(row.uid, 'email', e.target.value)}
                                                        placeholder="email@ejemplo.com"
                                                        className="w-full text-[13px] outline-none bg-transparent min-w-[160px]" />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input value={row.celular}
                                                        onChange={e => actualizarRow(row.uid, 'celular', e.target.value)}
                                                        placeholder="8681234567"
                                                        className="w-full text-[13px] outline-none bg-transparent min-w-[100px]" />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input value={row.nacionalidad}
                                                        onChange={e => actualizarRow(row.uid, 'nacionalidad', e.target.value)}
                                                        placeholder="Mexicana"
                                                        className="w-full text-[13px] outline-none bg-transparent min-w-[100px]" />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <select value={row.tipoPersona}
                                                        onChange={e => actualizarRow(row.uid, 'tipoPersona', e.target.value)}
                                                        className="text-[12px] outline-none bg-transparent">
                                                        <option value="fisica">Física</option>
                                                        <option value="moral">Moral</option>
                                                    </select>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        {row.error
                                                            ? (
                                                                <div className="flex items-center gap-1">
                                                                    <AlertCircle size={14} style={{ color: 'var(--red)' }} />
                                                                    <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: 'var(--red)' }}>
                                                                        {row.error}
                                                                    </span>
                                                                </div>
                                                            )
                                                            : <CheckCircle size={14} style={{ color: 'var(--green)' }} />
                                                        }
                                                        <button onClick={() => eliminarRow(row.uid)}>
                                                            <Trash2 size={13} style={{ color: 'var(--ink4)' }} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl text-[12px] mb-4" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                            {modo === 'manual' && (
                                <button onClick={agregarRow}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold"
                                    style={{ background: 'var(--bg2)', color: 'var(--ink3)' }}>
                                    <Plus size={14} /> Agregar otra fila
                                </button>
                            )}
                            {modo === 'csv' && <div></div>}

                            <button onClick={confirmar}
                                disabled={cargando || rowsValidos === 0}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
                                style={{ background: 'var(--green)', color: 'white' }}>
                                {cargando
                                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creando...</>
                                    : <><CheckCircle size={14} /> Crear {rowsValidos} cliente{rowsValidos !== 1 ? 's' : ''}</>
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
            <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}
