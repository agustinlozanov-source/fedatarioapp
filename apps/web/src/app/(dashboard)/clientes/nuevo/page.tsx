'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { crearCliente } from '@/lib/db/clientes';
import { auth } from '@/lib/firebase';

export default function NuevoClientePage() {
    const router = useRouter();
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    const [form, setForm] = useState({
        tipoPersona: 'fisica' as 'fisica' | 'moral',
        nombre: '',
        rfc: '',
        curp: '',
        nacionalidad: 'Mexicana',
        email: '',
        telefono: '',
        celular: '',
        ocupacion: '',
        estadoCivil: '',
    });

    const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

    const guardar = async () => {
        if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
        setGuardando(true);
        setError('');
        try {
            const tenantId = auth.currentUser!.uid;
            const id = await crearCliente({
                tenantId,
                tipoPersona: form.tipoPersona,
                nombre: form.nombre,
                ...(form.rfc ? { rfc: form.rfc } : {}),
                ...(form.curp ? { curp: form.curp } : {}),
                ...(form.nacionalidad ? { nacionalidad: form.nacionalidad } : {}),
                ...(form.email ? { email: form.email } : {}),
                ...(form.telefono ? { telefono: form.telefono } : {}),
                ...(form.celular ? { celular: form.celular } : {}),
                ...(form.ocupacion ? { ocupacion: form.ocupacion } : {}),
                ...(form.estadoCivil ? { estadoCivil: form.estadoCivil } : {}),
                portalActivo: true,
            } as any);
            router.push(`/clientes/${id}`);
        } catch (e: any) {
            setError(e.message || 'Error al guardar');
            setGuardando(false);
        }
    };

    return (
        <>
            <Topbar breadcrumb="Clientes /" title="Nuevo cliente" />
            <div className="p-6 max-w-xl mx-auto">
                <button onClick={() => router.push('/clientes')}
                    className="flex items-center gap-1.5 text-[13px] font-semibold mb-4"
                    style={{ color: 'var(--ink4)' }}>
                    <ArrowLeft size={14} /> Clientes
                </button>

                <h1 className="text-[24px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Nuevo cliente</h1>
                <p className="text-[14px] text-[#6E6E73] mb-6">Registro individual</p>

                <div className="space-y-4">
                    {/* Tipo */}
                    <div>
                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Tipo de persona</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['fisica', 'moral'] as const).map(t => (
                                <button key={t} onClick={() => set('tipoPersona', t)}
                                    className="py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                                    style={{
                                        border: form.tipoPersona === t ? '2px solid var(--blue)' : '2px solid var(--border)',
                                        background: form.tipoPersona === t ? 'var(--blue-bg)' : 'white',
                                        color: form.tipoPersona === t ? 'var(--blue)' : 'var(--ink3)',
                                    }}>
                                    {t === 'fisica' ? 'Persona física' : 'Persona moral'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Nombre */}
                    <div>
                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                            Nombre completo <span style={{ color: 'var(--red)' }}>*</span>
                        </label>
                        <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                            placeholder={form.tipoPersona === 'fisica' ? 'Nombre(s) Apellido Paterno Apellido Materno' : 'Razón social'}
                            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                            style={{ border: '1px solid var(--border)', background: 'white' }} />
                    </div>

                    {/* RFC y CURP */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">RFC</label>
                            <input value={form.rfc} onChange={e => set('rfc', e.target.value.toUpperCase())}
                                placeholder="XAXX010101000"
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono outline-none"
                                style={{ border: '1px solid var(--border)', background: 'white' }} />
                        </div>
                        {form.tipoPersona === 'fisica' && (
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">CURP</label>
                                <input value={form.curp} onChange={e => set('curp', e.target.value.toUpperCase())}
                                    placeholder="XAXX010101HXXXXXX00"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }} />
                            </div>
                        )}
                    </div>

                    {/* Nacionalidad */}
                    <div>
                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Nacionalidad</label>
                        <input value={form.nacionalidad} onChange={e => set('nacionalidad', e.target.value)}
                            placeholder="Mexicana"
                            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                            style={{ border: '1px solid var(--border)', background: 'white' }} />
                    </div>

                    {/* Contacto */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Email</label>
                            <input value={form.email} onChange={e => set('email', e.target.value)}
                                type="email" placeholder="correo@ejemplo.com"
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                style={{ border: '1px solid var(--border)', background: 'white' }} />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Celular</label>
                            <input value={form.celular} onChange={e => set('celular', e.target.value)}
                                placeholder="8681234567"
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                style={{ border: '1px solid var(--border)', background: 'white' }} />
                        </div>
                    </div>

                    {form.tipoPersona === 'fisica' && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Ocupación</label>
                                <input value={form.ocupacion} onChange={e => set('ocupacion', e.target.value)}
                                    placeholder="Empresario"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }} />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Estado civil</label>
                                <select value={form.estadoCivil} onChange={e => set('estadoCivil', e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                                    style={{ border: '1px solid var(--border)', background: 'white' }}>
                                    <option value="">Sin especificar</option>
                                    <option value="soltero">Soltero(a)</option>
                                    <option value="casado">Casado(a)</option>
                                    <option value="divorciado">Divorciado(a)</option>
                                    <option value="viudo">Viudo(a)</option>
                                    <option value="union_libre">Unión libre</option>
                                </select>
                            </div>
                        </div>
                    )}

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
                        <button onClick={guardar} disabled={guardando || !form.nombre.trim()}
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
