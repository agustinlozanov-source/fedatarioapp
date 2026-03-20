'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, getIdToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Topbar } from '@/components/layout/Shell';
import { Plus, Trash2, Building2, Users, ChevronDown, ChevronUp, Loader2, CheckCircle, XCircle } from 'lucide-react';

const SUPERADMIN_UID = process.env.NEXT_PUBLIC_SUPERADMIN_UID ?? '';

interface UsuarioForm {
    id: string;
    email: string;
    password: string;
    nombre: string;
    rol: string;
}

interface Organizacion {
    id: string;
    nombre: string;
    ownerUid: string;
    creadoEn: string;
    activo: boolean;
}

export default function SuperadminPage() {
    const router = useRouter();
    const [uid, setUid] = useState<string | null>(null);
    const [token, setToken] = useState<string>('');
    const [orgs, setOrgs] = useState<Organizacion[]>([]);
    const [cargando, setCargando] = useState(true);
    const [creando, setCreando] = useState(false);
    const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null);

    // Form
    const [nombreOrg, setNombreOrg] = useState('');
    const [usuarios, setUsuarios] = useState<UsuarioForm[]>([
        { id: '1', email: '', password: '', nombre: '', rol: 'admin' },
    ]);
    const [formAbierto, setFormAbierto] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async user => {
            if (!user || user.uid !== SUPERADMIN_UID) {
                router.push('/instrumentos');
                return;
            }
            setUid(user.uid);
            const t = await getIdToken(user);
            setToken(t);
            cargarOrgs();
        });
        return () => unsub();
    }, []);

    const cargarOrgs = async () => {
        setCargando(true);
        try {
            const snap = await getDocs(query(collection(db, 'organizaciones'), orderBy('creadoEn', 'desc')));
            setOrgs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Organizacion)));
        } finally {
            setCargando(false);
        }
    };

    const agregarUsuario = () => {
        setUsuarios(prev => [...prev, {
            id: String(Date.now()), email: '', password: '', nombre: '', rol: 'usuario',
        }]);
    };

    const actualizarUsuario = (id: string, campo: string, valor: string) => {
        setUsuarios(prev => prev.map(u => u.id === id ? { ...u, [campo]: valor } : u));
    };

    const eliminarUsuario = (id: string) => {
        if (usuarios.length === 1) return;
        setUsuarios(prev => prev.filter(u => u.id !== id));
    };

    const crearOrganizacion = async () => {
        if (!nombreOrg.trim() || !usuarios[0].email || !usuarios[0].password || !usuarios[0].nombre) {
            setResultado({ ok: false, msg: 'Completa al menos el nombre de la org y los datos del usuario principal.' });
            return;
        }
        setCreando(true);
        setResultado(null);
        try {
            const res = await fetch('/api/superadmin/crear-organizacion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ nombreOrg: nombreOrg.trim(), usuarios }),
            });
            const data = await res.json();
            if (!res.ok) {
                setResultado({ ok: false, msg: data.error ?? 'Error desconocido' });
            } else {
                setResultado({ ok: true, msg: `Organización "${nombreOrg}" creada. TenantID: ${data.tenantId}` });
                setNombreOrg('');
                setUsuarios([{ id: '1', email: '', password: '', nombre: '', rol: 'admin' }]);
                setFormAbierto(false);
                cargarOrgs();
            }
        } catch (e: any) {
            setResultado({ ok: false, msg: e.message });
        } finally {
            setCreando(false);
        }
    };

    if (!uid) return (
        <div className="h-screen flex items-center justify-center">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--ink4)' }} />
        </div>
    );

    return (
        <>
            <Topbar breadcrumb="Fedatario /" title="Superadmin" />
            <div className="p-6 max-w-4xl">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--blue)', color: 'white' }}>
                        <Building2 size={16} />
                    </div>
                    <div>
                        <h1 className="text-[22px] font-extrabold text-[#1D1D1F] tracking-tight">Superadmin</h1>
                        <p className="text-[12px] text-[#86868B]">Gestión de organizaciones · Acceso exclusivo</p>
                    </div>
                </div>

                <div className="h-px bg-black/[0.06] my-5" />

                {/* Nueva organización */}
                <div className="bg-white dark:bg-gray-800 border border-black/[0.07] dark:border-white/[0.07] rounded-2xl mb-5 overflow-hidden">
                    <button
                        onClick={() => setFormAbierto(!formAbierto)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left">
                        <div className="flex items-center gap-2.5">
                            <Plus size={15} style={{ color: 'var(--blue)' }} />
                            <span className="text-[14px] font-bold text-[#1D1D1F]">Nueva organización</span>
                        </div>
                        {formAbierto ? <ChevronUp size={16} style={{ color: 'var(--ink4)' }} /> : <ChevronDown size={16} style={{ color: 'var(--ink4)' }} />}
                    </button>

                    {formAbierto && (
                        <div className="border-t border-black/[0.06] px-5 pb-5 pt-4 space-y-4">
                            {/* Nombre org */}
                            <div>
                                <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                                    Nombre de la organización *
                                </label>
                                <input
                                    value={nombreOrg}
                                    onChange={e => setNombreOrg(e.target.value)}
                                    placeholder="Ej: Correduría López & Asociados"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none border border-black/[0.08]"
                                    style={{ background: 'var(--bg2)' }}
                                />
                            </div>

                            {/* Usuarios */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em]">
                                        Usuarios · El primero será el owner (tenantId)
                                    </label>
                                    <button onClick={agregarUsuario}
                                        className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg"
                                        style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                                        <Plus size={11} /> Agregar
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {usuarios.map((u, i) => (
                                        <div key={u.id} className="border border-black/[0.06] rounded-xl p-3.5" style={{ background: i === 0 ? 'var(--blue-bg)' : 'var(--bg2)' }}>
                                            <div className="flex items-center justify-between mb-2.5">
                                                <span className="text-[11px] font-bold" style={{ color: i === 0 ? 'var(--blue)' : 'var(--ink4)' }}>
                                                    {i === 0 ? '★ Owner / Admin principal' : `Usuario ${i + 1}`}
                                                </span>
                                                {i > 0 && (
                                                    <button onClick={() => eliminarUsuario(u.id)}>
                                                        <Trash2 size={13} style={{ color: 'var(--red)' }} />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {[
                                                    { campo: 'nombre', placeholder: 'Nombre completo', tipo: 'text' },
                                                    { campo: 'email', placeholder: 'correo@despacho.com', tipo: 'email' },
                                                    { campo: 'password', placeholder: 'Contraseña (mín. 6)', tipo: 'password' },
                                                ].map(f => (
                                                    <input key={f.campo}
                                                        type={f.tipo}
                                                        value={(u as any)[f.campo]}
                                                        onChange={e => actualizarUsuario(u.id, f.campo, e.target.value)}
                                                        placeholder={f.placeholder}
                                                        className="px-3 py-2 rounded-lg text-[12px] outline-none border border-black/[0.07] dark:border-white/[0.07] bg-white dark:bg-gray-700 dark:text-white"
                                                    />
                                                ))}
                                                <select
                                                    value={u.rol}
                                                    onChange={e => actualizarUsuario(u.id, 'rol', e.target.value)}
                                                    className="px-3 py-2 rounded-lg text-[12px] outline-none border border-black/[0.07] dark:border-white/[0.07] bg-white dark:bg-gray-700 dark:text-white">
                                                    <option value="admin">Admin</option>
                                                    <option value="corredor">Corredor</option>
                                                    <option value="asistente">Asistente</option>
                                                    <option value="usuario">Usuario</option>
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Resultado */}
                            {resultado && (
                                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[12px] font-semibold"
                                    style={{ background: resultado.ok ? 'var(--green-bg)' : 'var(--red-bg)', color: resultado.ok ? 'var(--green)' : 'var(--red)' }}>
                                    {resultado.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    {resultado.msg}
                                </div>
                            )}

                            <button
                                onClick={crearOrganizacion}
                                disabled={creando}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
                                style={{ background: 'var(--blue)', color: 'white' }}>
                                {creando ? <><Loader2 size={14} className="animate-spin" /> Creando...</> : <><Building2 size={14} /> Crear organización</>}
                            </button>
                        </div>
                    )}
                </div>

                {/* Lista de organizaciones */}
                <div>
                    <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-3 flex items-center gap-2">
                        <Building2 size={12} /> {orgs.length} organización{orgs.length !== 1 ? 'es' : ''} registradas
                    </div>
                    {cargando ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--ink4)' }} />
                        </div>
                    ) : orgs.length === 0 ? (
                        <div className="text-center py-10 text-[13px] text-[#86868B] border border-dashed border-black/[0.1] rounded-2xl">
                            No hay organizaciones todavía
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {orgs.map(org => (
                                <div key={org.id} className="bg-white dark:bg-gray-800 border border-black/[0.07] dark:border-white/[0.07] rounded-xl px-4 py-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: org.activo ? 'var(--green-bg)' : 'var(--bg3)' }}>
                                        <Building2 size={14} style={{ color: org.activo ? 'var(--green)' : 'var(--ink4)' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[13px] font-bold text-[#1D1D1F]">{org.nombre}</div>
                                        <div className="text-[11px] text-[#86868B] font-mono">tenant: {org.ownerUid}</div>
                                    </div>
                                    <div className="text-[11px] text-[#86868B]">
                                        {new Date(org.creadoEn).toLocaleDateString('es-MX')}
                                    </div>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                        style={{ background: org.activo ? 'var(--green-bg)' : 'var(--bg3)', color: org.activo ? 'var(--green)' : 'var(--ink4)' }}>
                                        {org.activo ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
