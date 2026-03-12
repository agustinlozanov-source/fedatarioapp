'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, CheckCircle, Upload, FileText, Trash2 } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Topbar } from '@/components/layout/Shell';
import { crearCliente } from '@/lib/db/clientes';
import { storage, auth } from '@/lib/firebase';
import { expandirAbreviaturas } from '@/lib/utils/format';
import type { TipoDocumento } from '@fedatario/shared';

const TIPOS_DOCUMENTO: { id: TipoDocumento; label: string; esencial: boolean }[] = [
    { id: 'ine', label: 'INE / IFE', esencial: true },
    { id: 'curp', label: 'CURP', esencial: true },
    { id: 'rfc', label: 'RFC / Constancia de Situación Fiscal', esencial: true },
    { id: 'pasaporte', label: 'Pasaporte', esencial: false },
    { id: 'comprobante_domicilio', label: 'Comprobante de domicilio', esencial: false },
    { id: 'acta_nacimiento', label: 'Acta de nacimiento', esencial: false },
    { id: 'fm2', label: 'FM2 / FM3', esencial: false },
];

interface DocumentoSubido {
    id: string;
    tipo: TipoDocumento;
    nombre: string;
}

export default function NuevoClientePage() {
    const router = useRouter();
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [subiendoDoc, setSubiendoDoc] = useState(false);
    const [tipoDocSeleccionado, setTipoDocSeleccionado] = useState<TipoDocumento>('ine');
    const [documentosSubidos, setDocumentosSubidos] = useState<DocumentoSubido[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // ─ FORMULARIO ─────────────────────────────────────────
    const [es_extranjero, setEsExtranjero] = useState(false);
    const [form, setForm] = useState({
        nombre_completo: '',
        rfc: '',
        curp: '',
        fecha_nacimiento: '',
        lugar_nacimiento: '',
        ocupacion: '',
        estado_civil: '',
        genero: '',
        domicilio: '',
        
        // Mexicano
        clave_elector: '',
        seccion_ine: '',
        idmex: '',
        
        // Extranjero
        numero_pasaporte: '',
        numero_fm: '',
    });

    const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const subirDocumento = async (file: File) => {
        if (!file) return;
        setSubiendoDoc(true);
        setError('');
        try {
            const tenantId = auth.currentUser!.uid;
            const path = `temp-documentos/${tenantId}/${Date.now()}_${file.name}`;
            
            const storageRef = ref(storage, path);
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);

            const response = await fetch('https://fedatario-production.up.railway.app/extractor/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storage_url: url,
                    tipo_documento: tipoDocSeleccionado,
                })
            });

            if (!response.ok) throw new Error('Error al extraer datos del documento');

            const datos = await response.json();
            const datosExtraidos = datos.datos_extraidos || {};

            const mapeoExtraccion: Record<string, string> = {
                'nombre_completo': 'nombre_completo',
                'rfc': 'rfc',
                'curp': 'curp',
                'fecha_nacimiento': 'fecha_nacimiento',
                'lugar_nacimiento': 'lugar_nacimiento',
                'ocupacion': 'ocupacion',
                'estado_civil': 'estado_civil',
                'genero': 'genero',
                'domicilio': 'domicilio',
                'clave_elector': 'clave_elector',
                'seccion_ine': 'seccion_ine',
                'idmex': 'idmex',
                'numero_pasaporte': 'numero_pasaporte',
                'numero_fm': 'numero_fm',
                'numero_fm2': 'numero_fm',
                'numero_fm3': 'numero_fm',
                'nacionalidad': 'nacionalidad',
                'nacionalidad_pais': 'nacionalidad',
            };

            Object.entries(datosExtraidos).forEach(([campoExtraido, valor]) => {
                const campoFormulario = mapeoExtraccion[campoExtraido];
                if (campoFormulario && valor && !form[campoFormulario as keyof typeof form]) {
                    set(campoFormulario, String(valor));
                }
            });

            const docId = Math.random().toString(36).slice(2, 9);
            setDocumentosSubidos(prev => [...prev, {
                id: docId,
                tipo: tipoDocSeleccionado,
                nombre: file.name
            }]);

        } catch (e: any) {
            setError(e.message || 'Error al procesar documento');
        } finally {
            setSubiendoDoc(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const eliminarDocumento = (docId: string) => {
        setDocumentosSubidos(prev => prev.filter(d => d.id !== docId));
    };

    const guardar = async () => {
        // Solo el nombre es obligatorio
        if (!form.nombre_completo.trim()) {
            setError('El nombre del cliente es obligatorio');
            return;
        }

        setGuardando(true);
        setError('');
        try {
            const tenantId = auth.currentUser!.uid;
            const clienteData: any = {
                tenantId,
                tipoPersona: 'fisica',
                nombre: form.nombre_completo,
                es_extranjero,
                nombre_completo: form.nombre_completo,
                rfc: form.rfc,
                fecha_nacimiento: form.fecha_nacimiento,
                lugar_nacimiento: expandirAbreviaturas(form.lugar_nacimiento),
                ocupacion: form.ocupacion,
                estado_civil: form.estado_civil,
                genero: form.genero,
                domicilio: expandirAbreviaturas(form.domicilio),
                portalActivo: true,
            };

            if (es_extranjero) {
                clienteData.numero_pasaporte = form.numero_pasaporte;
                clienteData.numero_fm = form.numero_fm;
            } else {
                clienteData.curp = form.curp;
                if (form.clave_elector) clienteData.clave_elector = form.clave_elector;
                if (form.seccion_ine) clienteData.seccion_ine = form.seccion_ine;
                if (form.idmex) clienteData.idmex = form.idmex;
            }

            const id = await crearCliente(clienteData);
            router.push(`/clientes/${id}`);
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
            setGuardando(false);
        }
    };

    return (
        <>
            <Topbar breadcrumb="Clientes /" title="Nuevo cliente" />
            <div className="p-6 max-w-2xl mx-auto">
                <button onClick={() => router.push('/clientes')}
                    className="flex items-center gap-1.5 text-[13px] font-semibold mb-4"
                    style={{ color: 'var(--ink4)' }}>
                    <ArrowLeft size={14} /> Clientes
                </button>

                <h1 className="text-[24px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Nuevo cliente</h1>
                <p className="text-[14px] text-[#6E6E73] mb-6">Solo el nombre es obligatorio, el resto puedes completarlo después</p>

                <div className="space-y-6">
                    {/* ─ TOGGLE: ¿ES EXTRANJERO? ─ */}
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={es_extranjero} onChange={e => setEsExtranjero(e.target.checked)}
                                className="w-4 h-4" />
                            <span className="text-[13px] font-semibold text-blue-900">¿Es cliente extranjero?</span>
                        </label>
                        <p className="text-[12px] text-blue-800 mt-2 ml-7">
                            {es_extranjero 
                                ? 'Mostrar campos para pasaporte y FM'
                                : 'Mostrar campos para CURP e INE'}
                        </p>
                    </div>

                    {/* ─ DATOS OBLIGATORIOS (TODOS) ─ */}
                    <div className="space-y-4">
                        <h2 className="text-[14px] font-bold text-[#1D1D1F]">Información básica</h2>

                        <div>
                            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                Nombre completo <span style={{ color: 'var(--red)' }}>*</span>
                            </label>
                            <input value={form.nombre_completo} onChange={e => set('nombre_completo', e.target.value)}
                                placeholder="Nombre(s) Apellido Paterno Apellido Materno"
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                style={{ border: '1px solid var(--border)', background: 'white' }} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                    RFC
                                </label>
                                <input value={form.rfc} onChange={e => set('rfc', e.target.value.toUpperCase())}
                                    placeholder="XAXX010101000"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }} />
                            </div>
                            {!es_extranjero ? (
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                        CURP
                                    </label>
                                    <input value={form.curp} onChange={e => set('curp', e.target.value.toUpperCase())}
                                        placeholder="XAXX010101HXXXXXX00"
                                        className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono outline-none"
                                        style={{ border: '1px solid var(--border)', background: 'white' }} />
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                            Número de pasaporte
                                        </label>
                                        <input value={form.numero_pasaporte} onChange={e => set('numero_pasaporte', e.target.value.toUpperCase())}
                                            placeholder="Ej: ABC123456"
                                            className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono outline-none"
                                            style={{ border: '1px solid var(--border)', background: 'white' }} />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                            CURP <span className="text-[10px] font-normal normal-case" style={{ color: 'var(--ink4)' }}>(si cuenta con uno)</span>
                                        </label>
                                        <input value={form.curp} onChange={e => set('curp', e.target.value.toUpperCase())}
                                            placeholder="XAXX010101HXXXXXX00"
                                            className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono outline-none"
                                            style={{ border: '1px solid var(--border)', background: 'white' }} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                    Fecha de nacimiento
                                </label>
                                <input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }} />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                    Género
                                </label>
                                <select value={form.genero} onChange={e => set('genero', e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }}>
                                    <option value="">Seleccionar...</option>
                                    <option value="masculino">Masculino</option>
                                    <option value="femenino">Femenino</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                Lugar de nacimiento
                            </label>
                            <input value={form.lugar_nacimiento} onChange={e => set('lugar_nacimiento', e.target.value)}
                                placeholder="Ej: Tampico, Tamaulipas, México"
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                style={{ border: '1px solid var(--border)', background: 'white' }} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                    Ocupación
                                </label>
                                <input value={form.ocupacion} onChange={e => set('ocupacion', e.target.value)}
                                    placeholder="Empresario, Abogado, etc."
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }} />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                    Estado civil
                                </label>
                                <select value={form.estado_civil} onChange={e => set('estado_civil', e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }}>
                                    <option value="">Seleccionar...</option>
                                    <option value="Soltero">Soltero(a)</option>
                                    <option value="Casado">Casado(a)</option>
                                    <option value="Divorciado">Divorciado(a)</option>
                                    <option value="Viudo">Viudo(a)</option>
                                    <option value="Unión libre">Unión libre</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                Domicilio
                            </label>
                            <input value={form.domicilio} onChange={e => set('domicilio', e.target.value)}
                                placeholder="Calle y número, CP, Ciudad, Estado, País"
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                style={{ border: '1px solid var(--border)', background: 'white' }} />
                        </div>
                    </div>

                    {/* ─ CAMPOS POR TIPO ─ */}
                    {!es_extranjero ? (
                        <div className="space-y-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                            <h2 className="text-[14px] font-bold text-[#1D1D1F]">Información de INE (Opcional)</h2>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                        Clave de elector
                                    </label>
                                    <input value={form.clave_elector} onChange={e => set('clave_elector', e.target.value.toUpperCase())}
                                        placeholder="RMZLED87081328H500"
                                        className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono outline-none"
                                        style={{ border: '1px solid var(--border)', background: 'white' }} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                        Sección INE
                                    </label>
                                    <input value={form.seccion_ine} onChange={e => set('seccion_ine', e.target.value)}
                                        placeholder="0606"
                                        className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                        style={{ border: '1px solid var(--border)', background: 'white' }} />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                        IDMEX
                                    </label>
                                    <input value={form.idmex} onChange={e => set('idmex', e.target.value)}
                                        placeholder="2604718651"
                                        className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                        style={{ border: '1px solid var(--border)', background: 'white' }} />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
                            <h2 className="text-[14px] font-bold text-[#1D1D1F]">Información migratoria</h2>
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                    Número FM
                                </label>
                                <input value={form.numero_fm} onChange={e => set('numero_fm', e.target.value.toUpperCase())}
                                    placeholder="Número de FM2, FM3 o residencia permanente"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }} />
                            </div>
                        </div>
                    )}

                    {/* ─ DOCUMENTOS ─ */}
                    <div className="border-t pt-6">
                        <div className="text-[14px] font-bold text-[#1D1D1F] mb-4">Documentos opcionales</div>
                        <p className="text-[12px] text-[#86868B] mb-4">Sube documentos para rellenar automáticamente los campos de información</p>
                        
                        <div className="bg-white border border-black/[0.07] rounded-2xl p-5 mb-4">
                            <div className="flex items-center gap-3">
                                <select value={tipoDocSeleccionado}
                                    onChange={e => setTipoDocSeleccionado(e.target.value as TipoDocumento)}
                                    className="flex-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }}>
                                    {TIPOS_DOCUMENTO.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}{t.esencial ? ' *' : ''}</option>
                                    ))}
                                </select>
                                <button onClick={() => fileRef.current?.click()}
                                    disabled={subiendoDoc}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50 shrink-0"
                                    style={{ background: 'var(--blue)', color: 'white' }}>
                                    {subiendoDoc
                                        ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</>
                                        : <><Upload size={14} /> Subir</>
                                    }
                                </button>
                                <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                                    onChange={e => { if (e.target.files?.[0]) subirDocumento(e.target.files[0]); }} />
                            </div>
                        </div>

                        {documentosSubidos.length > 0 && (
                            <div className="space-y-2 mb-4">
                                {documentosSubidos.map(doc => (
                                    <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                                        style={{ background: 'var(--bg2)' }}>
                                        <FileText size={14} style={{ color: 'var(--ink4)' }} className="shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[12px] font-semibold text-[#1D1D1F]">
                                                {TIPOS_DOCUMENTO.find(t => t.id === doc.tipo)?.label}
                                            </div>
                                            <div className="text-[11px] text-[#86868B] truncate">{doc.nombre}</div>
                                        </div>
                                        <button onClick={() => eliminarDocumento(doc.id)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-red-600 hover:bg-red-50 shrink-0 transition-colors">
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl text-[12px]" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
                        <button onClick={() => router.push('/clientes')}
                            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold"
                            style={{ background: 'var(--bg2)', color: 'var(--ink3)' }}>
                            Cancelar
                        </button>
                        <button onClick={guardar} disabled={guardando}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
                            style={{ background: 'var(--blue)', color: 'white' }}>
                            {guardando
                                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
                                : <><CheckCircle size={14} /> Guardar cliente</>
                            }
                        </button>
                    </div>
                </div>
            </div>
            <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
}
