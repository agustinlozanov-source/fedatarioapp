'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

export default function PortalLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    const handleLogin = async () => {
        setError('');
        setCargando(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push('/portal');
        } catch {
            setError('Correo o contraseña incorrectos');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg2)' }}>
            <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                <div className="w-10 h-10 rounded-xl bg-[#1D1D1F] flex items-center justify-center text-white text-sm font-extrabold mb-6">FD</div>
                <div className="text-[20px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Portal del cliente</div>
                <div className="text-[13px] text-[#86868B] mb-6">Consulta el estatus de tu acta constitutiva</div>

                <div className="space-y-3 mb-4">
                    <div>
                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Correo electrónico</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="tu@correo.com"
                            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                            style={{ border: '1px solid var(--border)', background: 'var(--bg2)' }} />
                    </div>
                    <div>
                        <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">Contraseña</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none"
                            style={{ border: '1px solid var(--border)', background: 'var(--bg2)' }} />
                    </div>
                </div>

                {error && (
                    <div className="text-[12px] font-semibold mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                        {error}
                    </div>
                )}

                <button onClick={handleLogin} disabled={cargando || !email || !password}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-bold disabled:opacity-50"
                    style={{ background: 'var(--blue)', color: 'white' }}>
                    {cargando ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Entrando...</> : 'Entrar'}
                </button>
            </div>
            <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
