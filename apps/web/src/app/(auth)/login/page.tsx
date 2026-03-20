'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/auth';
import { Loader2, ArrowRight, Scale } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);

    const handleLogin = async () => {
        setError('');
        setCargando(true);
        try {
            await login(email, password);
            router.push('/instrumentos');
        } catch (e: any) {
            setError('Correo o contraseña incorrectos');
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="login-root">

            {/* ── LEFT: HERO 3/4 ── */}
            <div className="login-hero">
                <div className="hero-img" />
                <div className="hero-overlay" />

                {/* Top badge */}
                <div className="hero-badge">
                    <Scale size={13} />
                    <span>Código de Comercio · México</span>
                </div>

                {/* Bottom copy */}
                <div className="hero-copy">
                    <p className="hero-eyebrow">Plataforma digital para</p>
                    <h1 className="hero-title">Correduría<br />Pública</h1>
                    <p className="hero-sub">
                        Instrumentación notarial, gestión documental<br />
                        y automatización jurídica en un solo sistema.
                    </p>

                    <div className="hero-stats">
                        {[
                            { n: '100%', l: 'Cumplimiento legal' },
                            { n: '<2 min', l: 'Por instrumento' },
                            { n: 'ISO 27001', l: 'Seguridad de datos' },
                        ].map(s => (
                            <div key={s.l} className="hero-stat">
                                <span className="hero-stat-n">{s.n}</span>
                                <span className="hero-stat-l">{s.l}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── RIGHT: FORM 1/4 ── */}
            <div className="login-panel">

                {/* Logo */}
                <div className="login-logo">
                    <div className="logo-mark">FD</div>
                    <div>
                        <div className="logo-name">Fedatario</div>
                        <div className="logo-sub">Sistema de gestión</div>
                    </div>
                </div>

                <div className="login-heading">Bienvenido</div>
                <p className="login-subheading">Ingresa tus credenciales para continuar</p>

                <div className="login-fields">
                    <div className={`field-wrap ${focusedField === 'email' ? 'focused' : ''}`}>
                        <label className="field-label">Correo electrónico</label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onFocus={() => setFocusedField('email')}
                            onBlur={() => setFocusedField(null)}
                            placeholder="correo@despacho.com"
                            className="field-input"
                            autoComplete="email"
                        />
                    </div>
                    <div className={`field-wrap ${focusedField === 'password' ? 'focused' : ''}`}>
                        <label className="field-label">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onFocus={() => setFocusedField('password')}
                            onBlur={() => setFocusedField(null)}
                            onKeyDown={e => e.key === 'Enter' && handleLogin()}
                            placeholder="••••••••"
                            className="field-input"
                            autoComplete="current-password"
                        />
                    </div>
                </div>

                {error && (
                    <div className="login-error">{error}</div>
                )}

                <button
                    onClick={handleLogin}
                    disabled={cargando || !email || !password}
                    className="login-btn"
                >
                    {cargando
                        ? <><Loader2 size={16} className="spin" /> Verificando...</>
                        : <><span>Iniciar sesión</span><ArrowRight size={16} /></>
                    }
                </button>

                <p className="login-footer">
                    Acceso restringido · Solo personal autorizado
                </p>
            </div>

            <style jsx global>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(18px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0%   { background-position: -400px 0; }
                    100% { background-position: 400px 0; }
                }

                .login-root {
                    min-height: 100vh;
                    display: flex;
                    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
                    background: #09090B;
                }

                /* ── HERO ── */
                .login-hero {
                    position: relative;
                    flex: 0 0 75%;
                    overflow: hidden;
                }
                .hero-img {
                    position: absolute; inset: 0;
                    background: url('/images/Gemini_Generated_Image_5z61nl5z61nl5z61.png') center center / cover no-repeat;
                }
                .hero-overlay {
                    position: absolute; inset: 0;
                    background: linear-gradient(
                        105deg,
                        rgba(5,5,10,0.18) 0%,
                        rgba(5,5,20,0.55) 55%,
                        rgba(5,5,20,0.92) 100%
                    );
                }
                .hero-badge {
                    position: absolute; top: 32px; left: 36px;
                    display: flex; align-items: center; gap: 7px;
                    padding: 7px 14px;
                    background: rgba(255,255,255,0.10);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255,255,255,0.18);
                    border-radius: 100px;
                    color: rgba(255,255,255,0.85);
                    font-size: 11px; font-weight: 700;
                    letter-spacing: 0.05em;
                    animation: fadeUp 0.7s ease both;
                }
                .hero-copy {
                    position: absolute; bottom: 52px; left: 48px; right: 80px;
                    animation: fadeUp 0.8s 0.1s ease both;
                }
                .hero-eyebrow {
                    font-size: 12px; font-weight: 700;
                    letter-spacing: 0.12em; text-transform: uppercase;
                    color: rgba(0,149,255,0.9);
                    margin-bottom: 10px;
                }
                .hero-title {
                    font-size: clamp(40px, 5.5vw, 68px);
                    font-weight: 800; line-height: 1.05;
                    letter-spacing: -0.03em;
                    color: #fff;
                    margin-bottom: 16px;
                }
                .hero-sub {
                    font-size: 14px; font-weight: 400; line-height: 1.7;
                    color: rgba(255,255,255,0.6);
                    margin-bottom: 36px;
                }
                .hero-stats {
                    display: flex; gap: 32px;
                }
                .hero-stat {
                    display: flex; flex-direction: column; gap: 3px;
                }
                .hero-stat-n {
                    font-size: 20px; font-weight: 800; color: #fff;
                    letter-spacing: -0.02em;
                }
                .hero-stat-l {
                    font-size: 11px; font-weight: 600;
                    color: rgba(255,255,255,0.45);
                    letter-spacing: 0.03em;
                }

                /* ── PANEL ── */
                .login-panel {
                    flex: 0 0 25%;
                    display: flex; flex-direction: column; justify-content: center;
                    padding: 48px 40px;
                    background: #FAFAFA;
                    border-left: 1px solid rgba(0,0,0,0.06);
                    animation: fadeUp 0.6s 0.15s ease both;
                    min-width: 320px;
                }
                .login-logo {
                    display: flex; align-items: center; gap: 11px;
                    margin-bottom: 40px;
                }
                .logo-mark {
                    width: 38px; height: 38px; border-radius: 11px;
                    background: #1D1D1F;
                    display: flex; align-items: center; justify-content: center;
                    color: white; font-size: 13px; font-weight: 800;
                    letter-spacing: 0.03em;
                    flex-shrink: 0;
                }
                .logo-name {
                    font-size: 16px; font-weight: 800; color: #1D1D1F;
                    letter-spacing: -0.02em;
                }
                .logo-sub {
                    font-size: 10px; font-weight: 600; color: #86868B;
                    letter-spacing: 0.04em; text-transform: uppercase;
                    margin-top: 1px;
                }
                .login-heading {
                    font-size: 26px; font-weight: 800;
                    color: #1D1D1F; letter-spacing: -0.03em;
                    margin-bottom: 6px;
                }
                .login-subheading {
                    font-size: 13px; color: #86868B; font-weight: 500;
                    margin-bottom: 28px; line-height: 1.5;
                }
                .login-fields {
                    display: flex; flex-direction: column; gap: 14px;
                    margin-bottom: 20px;
                }
                .field-wrap {
                    display: flex; flex-direction: column; gap: 6px;
                }
                .field-label {
                    font-size: 11px; font-weight: 700; color: #86868B;
                    text-transform: uppercase; letter-spacing: 0.07em;
                }
                .field-input {
                    width: 100%;
                    padding: 11px 14px;
                    border-radius: 12px;
                    border: 1.5px solid rgba(0,0,0,0.09);
                    background: #fff;
                    font-size: 13px; font-family: inherit; color: #1D1D1F;
                    outline: none;
                    transition: border-color 0.18s, box-shadow 0.18s;
                }
                .field-input:focus,
                .field-wrap.focused .field-input {
                    border-color: #0071E3;
                    box-shadow: 0 0 0 3px rgba(0,113,227,0.12);
                }
                .field-input::placeholder { color: #AEAEB2; }
                .login-error {
                    font-size: 12px; font-weight: 600;
                    color: #FF3B30;
                    background: rgba(255,59,48,0.07);
                    border: 1px solid rgba(255,59,48,0.15);
                    border-radius: 10px;
                    padding: 9px 12px;
                    margin-bottom: 14px;
                }
                .login-btn {
                    width: 100%;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    padding: 13px 20px;
                    border-radius: 13px;
                    background: #1D1D1F;
                    color: white;
                    font-size: 14px; font-weight: 700; font-family: inherit;
                    border: none; cursor: pointer;
                    transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
                    box-shadow: 0 4px 14px rgba(0,0,0,0.18);
                    letter-spacing: -0.01em;
                    margin-bottom: 20px;
                }
                .login-btn:hover:not(:disabled) {
                    background: #0071E3;
                    box-shadow: 0 6px 20px rgba(0,113,227,0.35);
                    transform: translateY(-1px);
                }
                .login-btn:active:not(:disabled) {
                    transform: translateY(0);
                }
                .login-btn:disabled {
                    opacity: 0.4; cursor: not-allowed;
                }
                .login-footer {
                    font-size: 11px; color: #AEAEB2;
                    font-weight: 500; text-align: center;
                    line-height: 1.5;
                }
                .spin { animation: spin 1s linear infinite; }

                @media (max-width: 900px) {
                    .login-hero { display: none; }
                    .login-panel { flex: 1; padding: 40px 28px; min-width: unset; }
                }
            `}</style>
        </div>
    );
}
