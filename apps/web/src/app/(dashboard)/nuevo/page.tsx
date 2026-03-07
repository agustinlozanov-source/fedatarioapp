'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import {
  ChevronRight, ChevronLeft, Plus, Search, X,
  CheckCircle, Loader2, AlertCircle, Building2,
  Users, FileText, DollarSign, Eye, Copy, Check
} from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { crearInstrumento } from '@/lib/db/instrumentos';
import { getClientes, crearCliente } from '@/lib/db/clientes';
import { getObjetosSociales, crearObjetoSocial, incrementarUso } from '@/lib/db/objetosSociales';
import { auth } from '@/lib/firebase';
import type { Cliente, TipoInstrumento, RolSocio, SocioInstrumento } from '@fedatario/shared';
import type { ObjetoSocial } from '@/lib/db/objetosSociales';

// ── TIPOS LOCALES ─────────────────────────────

interface SocioForm {
  uid: string;
  clienteId?: string;
  cliente?: Cliente;
  rol: RolSocio;
  porcentaje: number;
  esNuevo: boolean;
  nuevoNombre?: string;
  nuevoRfc?: string;
  nuevoEmail?: string;
}

interface ObjetoSocialSeleccionado {
  uid: string;
  texto: string;
  predefinidoId?: string;
}

const ROLES_FIJOS: { id: RolSocio; label: string }[] = [
  { id: 'socio', label: 'Socio' },
  { id: 'administrador_unico', label: 'Administrador Único' },
  { id: 'representante_legal', label: 'Representante Legal' },
];

const ROLES_OPCIONALES: { id: RolSocio; label: string }[] = [
  { id: 'comisario', label: 'Comisario' },
  { id: 'consejo_administracion', label: 'Consejo de Administración' },
  { id: 'secretario_consejo', label: 'Secretario del Consejo' },
  { id: 'apoderado', label: 'Apoderado' },
];

const PASOS = [
  { id: 'tipo', label: 'Tipo', icon: FileText },
  { id: 'socios', label: 'Socios', icon: Users },
  { id: 'objeto', label: 'Objeto', icon: Building2 },
  { id: 'capital', label: 'Capital', icon: DollarSign },
  { id: 'confirmacion', label: 'Confirmar', icon: Eye },
];

function uid() { return Math.random().toString(36).slice(2, 9); }

// ── BUSCADOR DE CLIENTES ──────────────────────

function BuscadorCliente({ onSelect, onCrear, authListo }: {
  onSelect: (c: Cliente) => void;
  onCrear: () => void;
  authListo: boolean;
}) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [todos, setTodos] = useState<Cliente[]>([]);
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authListo) return;
    getClientes().then(setTodos);
  }, [authListo]);

  useEffect(() => {
    if (!q.trim()) { setResultados([]); return; }
    const t = q.toLowerCase();
    setResultados(todos.filter(c =>
      c.nombre.toLowerCase().includes(t) ||
      c.rfc?.toLowerCase().includes(t) ||
      c.curp?.toLowerCase().includes(t)
    ).slice(0, 6));
  }, [q, todos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
        style={{ border: '1px solid var(--border)', background: 'white' }}>
        <Search size={14} style={{ color: 'var(--ink4)' }} />
        <input value={q} onChange={e => { setQ(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          placeholder="Buscar por nombre, RFC, CURP..."
          className="flex-1 text-[13px] outline-none" />
        {q && <button onClick={() => setQ('')}><X size={13} style={{ color: 'var(--ink4)' }} /></button>}
      </div>
      {abierto && q.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg z-50 overflow-hidden"
          style={{ border: '1px solid var(--border)' }}>
          {resultados.length === 0
            ? <div className="px-4 py-3 text-[13px] text-[#86868B]">No se encontraron clientes</div>
            : resultados.map(c => (
              <button key={c.id} onClick={() => { onSelect(c); setQ(''); setAbierto(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#F5F5F7] transition-colors text-left">
                <div className="w-8 h-8 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[12px] font-bold shrink-0">
                  {c.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#1D1D1F]">{c.nombre}</div>
                  <div className="text-[11px] text-[#86868B]">{c.rfc || c.curp || 'Sin RFC/CURP'}</div>
                </div>
              </button>
            ))
          }
          <button onClick={() => { onCrear(); setAbierto(false); setQ(''); }}
            className="w-full flex items-center gap-2 px-4 py-3 border-t border-black/[0.06] hover:bg-[#F5F5F7] transition-colors"
            style={{ color: 'var(--blue)' }}>
            <Plus size={14} />
            <span className="text-[13px] font-semibold">Crear nuevo cliente</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── PÁGINA PRINCIPAL ──────────────────────────

export default function NuevoInstrumentoPage() {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [authListo, setAuthListo] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) setAuthListo(true);
    });
    return () => unsub();
  }, []);

  // Paso 1
  const [tipo, setTipo] = useState<TipoInstrumento | null>(null);
  const [numeroInstrumento, setNumeroInstrumento] = useState('');

  // Paso 2 — Socios
  const [socios, setSocios] = useState<SocioForm[]>([
    { uid: uid(), rol: 'socio', porcentaje: 50, esNuevo: false },
    { uid: uid(), rol: 'administrador_unico', porcentaje: 50, esNuevo: false },
  ]);

  // Paso 3 — Objeto(s) social(es)
  const [objetosSociales, setObjetosSociales] = useState<ObjetoSocialSeleccionado[]>([]);
  const [todosPredefinidos, setTodosPredefinidos] = useState<ObjetoSocial[]>([]);
  const [busquedaObjeto, setBusquedaObjeto] = useState('');
  const [resultadosObjeto, setResultadosObjeto] = useState<ObjetoSocial[]>([]);
  const [abiertoObjeto, setAbiertoObjeto] = useState(false);
  const [nuevoObjetoTexto, setNuevoObjetoTexto] = useState('');
  const [nuevoObjetoEtiqueta, setNuevoObjetoEtiqueta] = useState('');
  const [mostrarNuevoObjeto, setMostrarNuevoObjeto] = useState(false);
  const objetoRef = useRef<HTMLDivElement>(null);

  // Paso 4 — Capital
  const [capitalSocial, setCapitalSocial] = useState('');

  // Token del portal (se genera al crear)
  const [tokenPortal, setTokenPortal] = useState('');
  const [instrumentoId, setInstrumentoId] = useState('');

  useEffect(() => {
    if (!authListo) return;
    getObjetosSociales().then(o => {
      setTodosPredefinidos(o);
      setResultadosObjeto(o.slice(0, 5));
    });
  }, [authListo]);

  useEffect(() => {
    if (!busquedaObjeto.trim()) {
      setResultadosObjeto(todosPredefinidos.slice(0, 5));
      return;
    }
    const t = busquedaObjeto.toLowerCase();
    setResultadosObjeto(todosPredefinidos.filter(o =>
      o.etiqueta.toLowerCase().includes(t) ||
      o.texto.toLowerCase().includes(t)
    ).slice(0, 6));
  }, [busquedaObjeto, todosPredefinidos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (objetoRef.current && !objetoRef.current.contains(e.target as Node))
        setAbiertoObjeto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── SOCIOS ────────────────────────────────

  const totalPorcentaje = socios.reduce((s, x) => s + (x.porcentaje || 0), 0);

  const agregarSocio = () =>
    setSocios(prev => [...prev, { uid: uid(), rol: 'socio', porcentaje: 0, esNuevo: false }]);

  const eliminarSocio = (uid: string) =>
    setSocios(prev => prev.filter(s => s.uid !== uid));

  const actualizarSocio = (uid: string, data: Partial<SocioForm>) =>
    setSocios(prev => prev.map(s => s.uid === uid ? { ...s, ...data } : s));

  const distribuir = () => {
    const por = Math.floor(100 / socios.length);
    const resto = 100 - por * socios.length;
    setSocios(prev => prev.map((s, i) => ({ ...s, porcentaje: por + (i === 0 ? resto : 0) })));
  };

  // ── OBJETOS SOCIALES ──────────────────────

  const agregarObjetoPredefinido = (o: ObjetoSocial) => {
    if (objetosSociales.find(x => x.predefinidoId === o.id)) return;
    setObjetosSociales(prev => [...prev, { uid: uid(), texto: o.texto, predefinidoId: o.id }]);
    setBusquedaObjeto('');
    setAbiertoObjeto(false);
  };

  const agregarObjetoNuevo = async () => {
    if (!nuevoObjetoTexto.trim()) return;
    const id = await crearObjetoSocial(
      nuevoObjetoEtiqueta || nuevoObjetoTexto.slice(0, 40),
      nuevoObjetoTexto
    );
    setObjetosSociales(prev => [...prev, { uid: uid(), texto: nuevoObjetoTexto, predefinidoId: id }]);
    const actualizados = await getObjetosSociales();
    setTodosPredefinidos(actualizados);
    setNuevoObjetoTexto('');
    setNuevoObjetoEtiqueta('');
    setMostrarNuevoObjeto(false);
  };

  const eliminarObjeto = (uid: string) =>
    setObjetosSociales(prev => prev.filter(o => o.uid !== uid));

  const actualizarObjetoTexto = (uid: string, texto: string) =>
    setObjetosSociales(prev => prev.map(o => o.uid === uid ? { ...o, texto } : o));

  // ── CREAR ─────────────────────────────────

  const confirmarCrear = async () => {
    setCreando(true);
    setError('');
    try {
      const tenantId = auth.currentUser!.uid;

      const sociosFinales: SocioInstrumento[] = [];
      for (const socio of socios) {
        let clienteId = socio.clienteId;
        if (socio.esNuevo && socio.nuevoNombre) {
          clienteId = await crearCliente({
            tenantId,
            tipoPersona: 'fisica',
            nombre: socio.nuevoNombre,
            ...(socio.nuevoRfc ? { rfc: socio.nuevoRfc } : {}),
            ...(socio.nuevoEmail ? { email: socio.nuevoEmail } : {}),
            portalActivo: true,
          } as any);
        }
        if (!clienteId) continue;
        sociosFinales.push({
          clienteId,
          rol: socio.rol,
          porcentaje: socio.porcentaje,
          datosCompletos: false,
          documentosCompletos: false,
        });
      }

      // Incrementar uso de objetos sociales predefinidos
      for (const obj of objetosSociales) {
        if (obj.predefinidoId) await incrementarUso(obj.predefinidoId);
      }

      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);

      const id = await crearInstrumento({
        tenantId,
        tipo: tipo!,
        numeroInstrumento: numeroInstrumento ? parseInt(numeroInstrumento) : undefined,
        objetoSocial: objetosSociales.map(o => o.texto).join('\n\n'),
        capitalSocial: capitalSocial ? parseFloat(capitalSocial.replace(/,/g, '')) : undefined,
        estado: 'paso_03_datos_basicos',
        socios: sociosFinales,
        seccionesActivas: [],
        linkPortalToken: token,
      } as any);

      setTokenPortal(token);
      setInstrumentoId(id);
      setPaso(5); // paso de éxito
    } catch (e: any) {
      setError(e.message || e.code || 'Error desconocido');
      setCreando(false);
    }
  };

  const linkPortal = tokenPortal
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${tokenPortal}`
    : '';

  const copiarLink = () => {
    navigator.clipboard.writeText(linkPortal);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <>
      <Topbar breadcrumb="Instrumentos /" title="Nuevo instrumento" />

      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-[24px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Nuevo instrumento</h1>
        <p className="text-[14px] text-[#6E6E73] mb-6">Captura de primera sesión</p>

        {/* Stepper — solo mientras no esté en paso de éxito */}
        {paso < 5 && (
          <div className="flex items-center mb-8">
            {PASOS.map((p, i) => {
              const Icon = p.icon;
              const activo = i === paso;
              const completado = i < paso;
              return (
                <div key={p.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                      style={{ background: completado ? 'var(--green)' : activo ? 'var(--blue)' : 'var(--bg3)' }}>
                      {completado
                        ? <CheckCircle size={16} color="white" />
                        : <Icon size={15} color={activo ? 'white' : 'var(--ink4)'} />}
                    </div>
                    <span className="text-[10px] font-semibold mt-1"
                      style={{ color: activo ? 'var(--blue)' : completado ? 'var(--green)' : 'var(--ink4)' }}>
                      {p.label}
                    </span>
                  </div>
                  {i < PASOS.length - 1 && (
                    <div className="flex-1 h-0.5 mx-1 mb-4"
                      style={{ background: i < paso ? 'var(--green)' : 'var(--bg3)' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── PASO 1 — TIPO ── */}
        {paso === 0 && (
          <div>
            <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-1">Tipo de instrumento</h2>
            <p className="text-[13px] text-[#86868B] mb-6">El tipo define el formato y las reglas del acta</p>

            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { id: 'sa_de_cv' as TipoInstrumento, label: 'Sociedad Anónima', sub: 'S.A. de C.V.', desc: 'Capital variable, socios con acciones' },
                { id: 's_de_rl' as TipoInstrumento, label: 'Sociedad de Responsabilidad Limitada', sub: 'S. de R.L.', desc: 'Partes sociales, máximo 50 socios' },
              ].map(t => (
                <button key={t.id} onClick={() => setTipo(t.id)}
                  className="p-5 rounded-2xl text-left transition-all"
                  style={{
                    border: tipo === t.id ? '2px solid var(--blue)' : '2px solid var(--border)',
                    background: tipo === t.id ? 'var(--blue-bg)' : 'white',
                  }}>
                  <div className="text-[15px] font-bold text-[#1D1D1F] mb-0.5">{t.label}</div>
                  <div className="text-[12px] font-mono mb-3" style={{ color: 'var(--blue)' }}>{t.sub}</div>
                  <div className="text-[12px] text-[#86868B]">{t.desc}</div>
                  {tipo === t.id && (
                    <div className="mt-3 flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--blue)' }}>
                      <CheckCircle size={11} /> Seleccionado
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1.5">
                Número de instrumento
                <span className="ml-1 text-[10px] font-normal text-[#86868B]">(puedes modificarlo después)</span>
              </label>
              <input value={numeroInstrumento} onChange={e => setNumeroInstrumento(e.target.value)}
                placeholder="Ej. 1234"
                className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono outline-none"
                style={{ border: '1px solid var(--border)', background: 'white' }} />
            </div>
          </div>
        )}

        {/* ── PASO 2 — SOCIOS ── */}
        {paso === 1 && (
          <div>
            <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-1">Socios</h2>
            <p className="text-[13px] text-[#86868B] mb-3">Mínimo 2 · Los porcentajes deben sumar 100%</p>

            {/* Indicador porcentaje */}
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-4"
              style={{
                background: totalPorcentaje === 100 ? 'var(--green-bg)' : totalPorcentaje > 100 ? 'var(--red-bg)' : 'var(--orange-bg)',
              }}>
              <span className="text-[13px] font-semibold"
                style={{ color: totalPorcentaje === 100 ? 'var(--green)' : totalPorcentaje > 100 ? 'var(--red)' : 'var(--orange)' }}>
                {totalPorcentaje === 100 ? '✓ Porcentajes correctos' : `Total: ${totalPorcentaje}% — debe ser 100%`}
              </span>
              <button onClick={distribuir}
                className="text-[11px] font-semibold px-3 py-1 rounded-lg"
                style={{ background: 'white', color: 'var(--ink3)' }}>
                Distribuir equitativamente
              </button>
            </div>

            <div className="space-y-3">
              {socios.map((socio, idx) => (
                <div key={socio.uid} className="bg-white border border-black/[0.07] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-bold text-[#1D1D1F]">Socio {idx + 1}</span>
                    {socios.length > 2 && (
                      <button onClick={() => eliminarSocio(socio.uid)}
                        className="p-1.5 rounded-lg hover:bg-[#F5F5F7]">
                        <X size={14} style={{ color: 'var(--red)' }} />
                      </button>
                    )}
                  </div>

                  {/* Cliente asignado */}
                  {socio.cliente ? (
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-3"
                      style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border, #D1FAE5)' }}>
                      <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-[11px] font-bold shrink-0"
                        style={{ color: 'var(--green)' }}>
                        {socio.cliente.nombre.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-[#1D1D1F] truncate">{socio.cliente.nombre}</div>
                        <div className="text-[11px] text-[#86868B]">{socio.cliente.rfc || 'Sin RFC'}</div>
                      </div>
                      <button onClick={() => actualizarSocio(socio.uid, { cliente: undefined, clienteId: undefined })}>
                        <X size={13} style={{ color: 'var(--ink4)' }} />
                      </button>
                    </div>
                  ) : socio.esNuevo ? (
                    <div className="space-y-2 mb-3 p-3 rounded-xl"
                      style={{ background: 'var(--blue-bg)', border: '1px solid var(--blue-border, #BFDBFE)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em]">Nuevo cliente</span>
                        <button onClick={() => actualizarSocio(socio.uid, { esNuevo: false })}
                          className="text-[11px]" style={{ color: 'var(--ink4)' }}>
                          ← Buscar existente
                        </button>
                      </div>
                      <input value={socio.nuevoNombre || ''}
                        onChange={e => actualizarSocio(socio.uid, { nuevoNombre: e.target.value })}
                        placeholder="Nombre completo *"
                        className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                        style={{ border: '1px solid var(--border)', background: 'white' }} />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={socio.nuevoRfc || ''}
                          onChange={e => actualizarSocio(socio.uid, { nuevoRfc: e.target.value })}
                          placeholder="RFC (opcional)"
                          className="px-3 py-2 rounded-lg text-[13px] font-mono outline-none"
                          style={{ border: '1px solid var(--border)', background: 'white' }} />
                        <input value={socio.nuevoEmail || ''}
                          onChange={e => actualizarSocio(socio.uid, { nuevoEmail: e.target.value })}
                          placeholder="Email (opcional)"
                          className="px-3 py-2 rounded-lg text-[13px] outline-none"
                          style={{ border: '1px solid var(--border)', background: 'white' }} />
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3">
                      <BuscadorCliente
                        onSelect={c => actualizarSocio(socio.uid, { cliente: c, clienteId: c.id, esNuevo: false })}
                        onCrear={() => actualizarSocio(socio.uid, { esNuevo: true })}
                        authListo={authListo}
                      />
                    </div>
                  )}

                  {/* Rol y porcentaje */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1">Rol</label>
                      <select value={socio.rol}
                        onChange={e => actualizarSocio(socio.uid, { rol: e.target.value as RolSocio })}
                        className="w-full px-3 py-2 rounded-lg text-[13px] outline-none"
                        style={{ border: '1px solid var(--border)', background: 'white' }}>
                        <optgroup label="Roles fijos">
                          {ROLES_FIJOS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </optgroup>
                        <optgroup label="Roles opcionales">
                          {ROLES_OPCIONALES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1">Participación %</label>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ border: '1px solid var(--border)', background: 'white' }}>
                        <input type="number" min="0" max="100"
                          value={socio.porcentaje}
                          onChange={e => actualizarSocio(socio.uid, { porcentaje: parseFloat(e.target.value) || 0 })}
                          className="flex-1 text-[13px] outline-none font-mono" />
                        <span className="text-[13px] text-[#86868B]">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={agregarSocio}
              className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold border-2 border-dashed transition-colors hover:border-[var(--blue)]"
              style={{ borderColor: 'var(--border)', color: 'var(--ink4)' }}>
              <Plus size={14} /> Agregar socio
            </button>
          </div>
        )}

        {/* ── PASO 3 — OBJETO SOCIAL ── */}
        {paso === 2 && (
          <div>
            <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-1">Objeto social</h2>
            <p className="text-[13px] text-[#86868B] mb-6">Puedes agregar uno o varios objetos sociales</p>

            {/* Objetos seleccionados */}
            {objetosSociales.length > 0 && (
              <div className="space-y-2 mb-4">
                {objetosSociales.map((obj, idx) => (
                  <div key={obj.uid} className="bg-white border border-black/[0.07] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em]">
                        Objeto {idx + 1}
                        {obj.predefinidoId && <span className="ml-2 px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>Predefinido</span>}
                      </span>
                      <button onClick={() => eliminarObjeto(obj.uid)}>
                        <X size={13} style={{ color: 'var(--red)' }} />
                      </button>
                    </div>
                    <textarea value={obj.texto}
                      onChange={e => actualizarObjetoTexto(obj.uid, e.target.value)}
                      rows={3}
                      className="w-full text-[13px] outline-none resize-none"
                      style={{ border: 'none', background: 'transparent' }} />
                  </div>
                ))}
              </div>
            )}

            {/* Buscador predefinidos */}
            <div ref={objetoRef} className="relative mb-3">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                style={{ border: '1px solid var(--border)', background: 'white' }}>
                <Search size={14} style={{ color: 'var(--ink4)' }} />
                <input value={busquedaObjeto}
                  onChange={e => { setBusquedaObjeto(e.target.value); setAbiertoObjeto(true); }}
                  onFocus={() => setAbiertoObjeto(true)}
                  placeholder="Buscar objeto social predefinido..."
                  className="flex-1 text-[13px] outline-none" />
              </div>
              {abiertoObjeto && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg z-50 overflow-hidden"
                  style={{ border: '1px solid var(--border)' }}>
                  {resultadosObjeto.length === 0
                    ? <div className="px-4 py-3 text-[13px] text-[#86868B]">No hay objetos predefinidos aún</div>
                    : resultadosObjeto.map(o => (
                      <button key={o.id} onClick={() => agregarObjetoPredefinido(o)}
                        className="w-full px-4 py-3 hover:bg-[#F5F5F7] transition-colors text-left border-b border-black/[0.04] last:border-0">
                        <div className="text-[13px] font-semibold text-[#1D1D1F]">{o.etiqueta}</div>
                        <div className="text-[11px] text-[#86868B] mt-0.5 line-clamp-2">{o.texto}</div>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Crear nuevo objeto */}
            {!mostrarNuevoObjeto ? (
              <button onClick={() => setMostrarNuevoObjeto(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold border-2 border-dashed transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--ink4)' }}>
                <Plus size={14} /> Redactar objeto social nuevo
              </button>
            ) : (
              <div className="border border-black/[0.07] rounded-xl p-4 bg-white">
                <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-2">Nuevo objeto social</div>
                <input value={nuevoObjetoEtiqueta}
                  onChange={e => setNuevoObjetoEtiqueta(e.target.value)}
                  placeholder="Nombre corto para identificarlo (ej. Comercio de tecnología)"
                  className="w-full px-3 py-2 rounded-lg text-[13px] outline-none mb-2"
                  style={{ border: '1px solid var(--border)' }} />
                <textarea value={nuevoObjetoTexto}
                  onChange={e => setNuevoObjetoTexto(e.target.value)}
                  placeholder="Redacta el objeto social completo..."
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-none mb-3"
                  style={{ border: '1px solid var(--border)' }} />
                <div className="flex gap-2">
                  <button onClick={agregarObjetoNuevo}
                    disabled={!nuevoObjetoTexto.trim()}
                    className="flex-1 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40"
                    style={{ background: 'var(--blue)', color: 'white' }}>
                    Agregar
                  </button>
                  <button onClick={() => { setMostrarNuevoObjeto(false); setNuevoObjetoTexto(''); setNuevoObjetoEtiqueta(''); }}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold"
                    style={{ background: 'var(--bg2)', color: 'var(--ink3)' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {objetosSociales.length === 0 && (
              <div className="mt-4 p-3 rounded-xl text-[12px]" style={{ background: 'var(--orange-bg)', color: 'var(--orange)' }}>
                Agrega al menos un objeto social para continuar
              </div>
            )}
          </div>
        )}

        {/* ── PASO 4 — CAPITAL ── */}
        {paso === 3 && (
          <div>
            <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-1">Capital social</h2>
            <p className="text-[13px] text-[#86868B] mb-6">El valor inicial de la sociedad</p>

            <div className="bg-white border border-black/[0.07] rounded-2xl p-6">
              <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-2">
                Monto en pesos mexicanos
              </label>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-[20px]"
                style={{ border: '2px solid var(--border)', background: 'var(--bg2)' }}>
                <span className="font-bold text-[#86868B]">$</span>
                <input value={capitalSocial}
                  onChange={e => setCapitalSocial(e.target.value)}
                  placeholder="50,000.00"
                  className="flex-1 text-[20px] font-mono font-bold outline-none bg-transparent"
                  style={{ color: 'var(--ink)' }} />
                <span className="text-[14px] text-[#86868B] font-semibold">MXN</span>
              </div>
              <p className="text-[12px] text-[#86868B] mt-3">
                No es necesario exhibirlo ante el Fedatario Público ni tenerlo depositado en el banco.
                Recomendación del despacho: $50,000 – $100,000 MXN.
              </p>
            </div>
          </div>
        )}

        {/* ── PASO 5 — CONFIRMACIÓN ── */}
        {paso === 4 && (
          <div>
            <h2 className="text-[18px] font-bold text-[#1D1D1F] mb-1">Confirmar</h2>
            <p className="text-[13px] text-[#86868B] mb-6">Resumen de la primera sesión</p>

            <div className="space-y-3">
              {/* Tipo e instrumento */}
              <div className="bg-white border border-black/[0.07] rounded-xl p-4">
                <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-2">Instrumento</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-bold text-[#1D1D1F]">
                      {tipo === 'sa_de_cv' ? 'Sociedad Anónima de Capital Variable' : 'Sociedad de Responsabilidad Limitada'}
                    </div>
                    {numeroInstrumento && (
                      <div className="text-[12px] font-mono text-[#86868B] mt-0.5">No. {numeroInstrumento}</div>
                    )}
                  </div>
                  <span className="badge badge-blue">{tipo === 'sa_de_cv' ? 'SA de CV' : 'S de RL'}</span>
                </div>
              </div>

              {/* Socios */}
              <div className="bg-white border border-black/[0.07] rounded-xl p-4">
                <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-2">Socios ({socios.length})</div>
                {socios.map((s, i) => (
                  <div key={s.uid} className="flex items-center gap-3 py-2 border-b border-black/[0.04] last:border-0">
                    <div className="w-7 h-7 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[11px] font-bold shrink-0">
                      {(s.cliente?.nombre || s.nuevoNombre || '?').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-[#1D1D1F] truncate">
                        {s.cliente?.nombre || s.nuevoNombre || 'Sin nombre'}
                        {s.esNuevo && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>Nuevo</span>}
                      </div>
                      <div className="text-[11px] text-[#86868B]">
                        {[...ROLES_FIJOS, ...ROLES_OPCIONALES].find(r => r.id === s.rol)?.label}
                      </div>
                    </div>
                    <div className="text-[13px] font-mono font-bold">{s.porcentaje}%</div>
                  </div>
                ))}
              </div>

              {/* Objeto social */}
              {objetosSociales.length > 0 && (
                <div className="bg-white border border-black/[0.07] rounded-xl p-4">
                  <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-2">
                    Objeto social ({objetosSociales.length})
                  </div>
                  {objetosSociales.map((o, i) => (
                    <div key={o.uid} className="text-[12px] text-[#3A3A3C] leading-relaxed mb-2 last:mb-0 pb-2 last:pb-0 border-b border-black/[0.04] last:border-0">
                      {o.texto.slice(0, 120)}{o.texto.length > 120 ? '...' : ''}
                    </div>
                  ))}
                </div>
              )}

              {/* Capital */}
              {capitalSocial && (
                <div className="bg-white border border-black/[0.07] rounded-xl p-4">
                  <div className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-1">Capital social</div>
                  <div className="text-[18px] font-bold font-mono text-[#1D1D1F]">
                    ${parseFloat(capitalSocial.replace(/,/g, '')).toLocaleString('es-MX')} MXN
                  </div>
                </div>
              )}

              {/* Pendientes */}
              <div className="p-3 rounded-xl text-[12px]" style={{ background: 'var(--orange-bg)', color: 'var(--orange)' }}>
                <div className="font-bold mb-1">Se completará después:</div>
                <div>Denominación social (3 opciones del cliente) · Domicilio social · CUD del MUA</div>
              </div>

              {error && (
                <div className="p-3 rounded-xl text-[12px] flex items-start gap-2" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                  <AlertCircle size={14} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PASO 6 — ÉXITO ── */}
        {paso === 5 && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--green-bg)' }}>
              <CheckCircle size={32} style={{ color: 'var(--green)' }} />
            </div>
            <h2 className="text-[22px] font-extrabold text-[#1D1D1F] mb-1">Instrumento creado</h2>
            <p className="text-[14px] text-[#86868B] mb-8">El expediente está abierto y listo para continuar</p>

            {/* Link del portal */}
            <div className="bg-white border border-black/[0.07] rounded-2xl p-5 mb-4 text-left">
              <div className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.06em] mb-2">
                Link del portal para los socios
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2"
                style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <span className="flex-1 text-[12px] font-mono text-[#3A3A3C] truncate">{linkPortal}</span>
                <button onClick={copiarLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold shrink-0 transition-all"
                  style={{ background: copiado ? 'var(--green)' : 'var(--blue)', color: 'white' }}>
                  {copiado ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                </button>
              </div>
              <p className="text-[11px] text-[#86868B]">
                Comparte este link con los socios para que completen sus datos y suban sus documentos.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => router.push(`/instrumentos/${instrumentoId}`)}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold"
                style={{ background: 'var(--blue)', color: 'white' }}>
                Ir al expediente
              </button>
              <button onClick={() => router.push('/instrumentos')}
                className="flex-1 py-3 rounded-xl text-[14px] font-bold"
                style={{ background: 'var(--bg2)', color: 'var(--ink3)' }}>
                Ver todos
              </button>
            </div>
          </div>
        )}

        {/* ── NAVEGACIÓN ── */}
        {paso < 5 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/[0.07]">
            <button onClick={() => paso === 0 ? router.push('/instrumentos') : setPaso(p => p - 1)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
              style={{ background: 'var(--bg2)', color: 'var(--ink3)' }}>
              <ChevronLeft size={16} /> {paso === 0 ? 'Cancelar' : 'Anterior'}
            </button>

            {paso < 4 ? (
              <button onClick={() => setPaso(p => p + 1)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={{ background: 'var(--blue)', color: 'white' }}>
                Siguiente <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={confirmarCrear} disabled={creando}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50"
                style={{ background: 'var(--green)', color: 'white' }}>
                {creando
                  ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Creando...</>
                  : <><CheckCircle size={15} /> Crear instrumento</>}
              </button>
            )}
          </div>
        )}
      </div>
      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
