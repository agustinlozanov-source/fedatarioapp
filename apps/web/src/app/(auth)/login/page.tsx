'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const handleLogin = async () => {
        setError('');
        setCargando(true);
        try {
            await login(email, password);
            router.push('/instrumentos');
        } catch (e: any) {
            setError(e.message || e.code || 'Error desconocido');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg2)' }}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                <div className="flex items-center gap-2.5 mb-8">
                    <div className="w-9 h-9 rounded-xl bg-[#1D1D1F] flex items-center justify-center text-white text-sm font-extrabold">FD</div>
                    <div>
                        <div className="text-[16px] font-bold text-[#1D1D1F]">Fedatario</div>
                        <div className="text-[11px] text-[#86868B]">Correduría Ramírez</div>
                    </div>
                </div>

                <div className="text-[20px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Iniciar sesión</div>
                <div className="text-[13px] text-[#86868B] mb-6">Acceso restringido al despacho</div>

                <div className="space-y-3 mb-4">
                    <div>
                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Correo electrónico</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="correo@despacho.com"
                            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                            style={{ border: '1px solid var(--border)', background: 'var(--bg2)' }}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                            style={{ border: '1px solid var(--border)', background: 'var(--bg2)' }}
                        />
                    </div>
                </div>

                {error && (
                    <div className="text-[12px] font-semibold mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                        {error}
                    </div>
                )}

                <button
                    onClick={handleLogin}
                    disabled={cargando || !email || !password}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-bold transition-all disabled:opacity-50"
                    style={{ background: 'var(--blue)', color: 'white' }}
                >
                    {cargando ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Entrando...</> : 'Entrar'}
                </button>
            </div>
            <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
