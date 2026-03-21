'use client';
import { useEffect, useState } from 'react';
import {
  Plus, GripVertical, Trash2, CheckCircle,
  Loader2, ChevronDown, ChevronRight, Settings2, Sun, Bell, Shield, Lock
} from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { getPlantilla, guardarPlantilla } from '@/lib/db/plantilla';
import type { CampoActa, TipoCampo } from '@fedatario/shared';
import type { SeccionConfig } from '@/lib/db/plantilla';

type EstadoGuardado = 'idle' | 'guardando' | 'guardado' | 'error';

const TIPOS_CAMPO: { id: TipoCampo; label: string }[] = [
  { id: 'texto', label: 'Texto corto' },
  { id: 'texto_largo', label: 'Texto largo' },
  { id: 'numero', label: 'Número' },
  { id: 'moneda', label: 'Moneda' },
  { id: 'porcentaje', label: 'Porcentaje' },
  { id: 'fecha', label: 'Fecha' },
  { id: 'seleccion', label: 'Selección' },
  { id: 'lista_socios', label: 'Lista de socios' },
];

const FUENTES = [
  { id: 'reunion', label: 'Reunión / Whisper' },
  { id: 'documento', label: 'Documento' },
  { id: 'formulario', label: 'Formulario' },
  { id: 'sistema', label: 'Sistema' },
];

const SECCIONES_DEFAULT: SeccionConfig[] = [
  {
    id: 'sec-1', nombre: 'Sociedad', orden: 1,
    campos: [
      { id: 'f1', seccion: 'Sociedad', nombre: 'nombreSociedad', etiqueta: 'Nombre de la sociedad', tipo: 'texto', requerido: true, fuenteDocumento: 'formulario', orden: 1, enCompendio: true },
      { id: 'f2', seccion: 'Sociedad', nombre: 'tipoSociedad', etiqueta: 'Tipo de sociedad', tipo: 'seleccion', requerido: true, fuenteDocumento: 'formulario', orden: 2, enCompendio: true },
      { id: 'f3', seccion: 'Sociedad', nombre: 'objetoSocial', etiqueta: 'Objeto social', tipo: 'texto_largo', requerido: true, fuenteDocumento: 'formulario', orden: 3, enCompendio: true },
      { id: 'f4', seccion: 'Sociedad', nombre: 'capitalSocial', etiqueta: 'Capital social', tipo: 'moneda', requerido: true, fuenteDocumento: 'formulario', orden: 4, enCompendio: true },
      { id: 'f5', seccion: 'Sociedad', nombre: 'domicilioSocial', etiqueta: 'Domicilio social', tipo: 'texto', requerido: true, fuenteDocumento: 'formulario', orden: 5, enCompendio: true },
    ]
  },
  {
    id: 'sec-2', nombre: 'Socios', orden: 2,
    campos: [
      { id: 'f6', seccion: 'Socios', nombre: 'socios', etiqueta: 'Socios y participaciones', tipo: 'lista_socios', requerido: true, fuenteDocumento: 'formulario', orden: 1, enCompendio: true },
      { id: 'f7', seccion: 'Socios', nombre: 'administrador', etiqueta: 'Administrador único', tipo: 'texto', requerido: true, fuenteDocumento: 'formulario', orden: 2, enCompendio: true },
    ]
  },
  {
    id: 'sec-3', nombre: 'Duración', orden: 3,
    campos: [
      { id: 'f8', seccion: 'Duración', nombre: 'duracion', etiqueta: 'Duración de la sociedad', tipo: 'texto', requerido: true, fuenteDocumento: 'formulario', orden: 1, enCompendio: false, valorDefault: 'Indefinida' },
    ]
  },
  {
    id: 'sec-4', nombre: 'Cláusulas', orden: 4,
    campos: [
      { id: 'f9', seccion: 'Cláusulas', nombre: 'clausulaCalvo', etiqueta: 'Cláusula Calvo', tipo: 'texto', requerido: false, fuenteDocumento: 'sistema', orden: 1, enCompendio: false },
    ]
  },
];

function uid() { return Math.random().toString(36).slice(2, 9); }

function CampoRow({ campo, onUpdate, onDelete }: {
  campo: CampoActa;
  onUpdate: (c: CampoActa) => void;
  onDelete: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="border border-black/[0.06] rounded-xl overflow-hidden mb-2">
      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#F5F5F7] dark:hover:bg-gray-700 transition-colors" onClick={() => setAbierto(!abierto)}>
        <GripVertical size={14} style={{ color: 'var(--ink5)', flexShrink: 0 }} />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-[#1D1D1F] dark:text-white truncate">{campo.etiqueta || 'Campo sin nombre'}</span>
          <span className="badge badge-gray text-[10px] shrink-0">{TIPOS_CAMPO.find(t => t.id === campo.tipo)?.label}</span>
          <span className="badge badge-blue text-[10px] shrink-0">{FUENTES.find(f => f.id === campo.fuenteDocumento)?.label}</span>
          {campo.requerido && <span className="badge badge-red text-[10px] shrink-0">Requerido</span>}
          {campo.enCompendio && <span className="badge badge-purple text-[10px] shrink-0">Compendio</span>}
        </div>
        {abierto ? <ChevronDown size={14} style={{ color: 'var(--ink4)' }} /> : <ChevronRight size={14} style={{ color: 'var(--ink4)' }} />}
      </div>
      {abierto && (
        <div className="px-4 pb-4 pt-3 border-t border-black/[0.06]" style={{ background: 'var(--bg2)' }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] block mb-1">Etiqueta visible</label>
              <input value={campo.etiqueta} onChange={e => onUpdate({ ...campo, etiqueta: e.target.value })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none text-gray-900 dark:text-white" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] block mb-1">Nombre interno</label>
              <input value={campo.nombre} onChange={e => onUpdate({ ...campo, nombre: e.target.value })} className="w-full px-3 py-2 rounded-lg text-[13px] font-mono outline-none text-gray-900 dark:text-white" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] block mb-1">Tipo de campo</label>
              <select value={campo.tipo} onChange={e => onUpdate({ ...campo, tipo: e.target.value as TipoCampo })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none text-gray-900 dark:text-white" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
                {TIPOS_CAMPO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] block mb-1">Fuente principal</label>
              <select value={campo.fuenteDocumento} onChange={e => onUpdate({ ...campo, fuenteDocumento: e.target.value as any })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none text-gray-900 dark:text-white" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
                {FUENTES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[10px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] block mb-1">Valor por defecto (opcional)</label>
            <input value={campo.valorDefault || ''} onChange={e => onUpdate({ ...campo, valorDefault: e.target.value })} placeholder="Dejar vacío si no aplica" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none text-gray-900 dark:text-white" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={campo.requerido} onChange={e => onUpdate({ ...campo, requerido: e.target.checked })} className="w-4 h-4 rounded" style={{ accentColor: 'var(--red)' }} />
              <span className="text-[12px] font-semibold text-[#3A3A3C] dark:text-gray-200">Requerido</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={campo.enCompendio} onChange={e => onUpdate({ ...campo, enCompendio: e.target.checked })} className="w-4 h-4 rounded" style={{ accentColor: 'var(--purple)' }} />
              <span className="text-[12px] font-semibold text-[#3A3A3C] dark:text-gray-200">Aparece en compendio</span>
            </label>
            <button onClick={onDelete} className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1.5 rounded-lg" style={{ color: 'var(--red)', background: 'var(--red-bg)' }}>
              <Trash2 size={12} /> Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConfigPage() {
  const [secciones, setSecciones] = useState<SeccionConfig[]>([]);
  const [cargando, setCargando] = useState(true);
  const [estado, setEstado] = useState<EstadoGuardado>('idle');
  const [seccionesAbiertas, setSeccionesAbiertas] = useState<Record<string, boolean>>({});
  const [nuevaSeccion, setNuevaSeccion] = useState('');
  const [mostrarNuevaSeccion, setMostrarNuevaSeccion] = useState(false);

  useEffect(() => {
    getPlantilla().then(config => {
      const data = config.secciones.length > 0 ? config.secciones : SECCIONES_DEFAULT;
      setSecciones(data);
      const abiertas: Record<string, boolean> = {};
      data.forEach(s => { abiertas[s.id] = true; });
      setSeccionesAbiertas(abiertas);
    }).finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setEstado('guardando');
    try {
      await guardarPlantilla({ secciones });
      setEstado('guardado');
      setTimeout(() => setEstado('idle'), 2500);
    } catch {
      setEstado('error');
      setTimeout(() => setEstado('idle'), 2500);
    }
  };

  const agregarSeccion = () => {
    if (!nuevaSeccion.trim()) return;
    const sec: SeccionConfig = { id: `sec-${uid()}`, nombre: nuevaSeccion.trim(), orden: secciones.length + 1, campos: [] };
    setSecciones(prev => [...prev, sec]);
    setSeccionesAbiertas(prev => ({ ...prev, [sec.id]: true }));
    setNuevaSeccion('');
    setMostrarNuevaSeccion(false);
  };

  const eliminarSeccion = (secId: string) => setSecciones(prev => prev.filter(s => s.id !== secId));

  const agregarCampo = (secId: string) => {
    const sec = secciones.find(s => s.id === secId);
    if (!sec) return;
    const nuevo: CampoActa = { id: `f-${uid()}`, seccion: sec.nombre, nombre: '', etiqueta: 'Nuevo campo', tipo: 'texto', requerido: false, fuenteDocumento: 'formulario', orden: sec.campos.length + 1, enCompendio: false };
    setSecciones(prev => prev.map(s => s.id === secId ? { ...s, campos: [...s.campos, nuevo] } : s));
  };

  const actualizarCampo = (secId: string, campoId: string, nuevo: CampoActa) =>
    setSecciones(prev => prev.map(s => s.id === secId ? { ...s, campos: s.campos.map(c => c.id === campoId ? nuevo : c) } : s));

  const eliminarCampo = (secId: string, campoId: string) =>
    setSecciones(prev => prev.map(s => s.id === secId ? { ...s, campos: s.campos.filter(c => c.id !== campoId) } : s));

  const totalCampos = secciones.reduce((s, sec) => s + sec.campos.length, 0);
  const enCompendio = secciones.reduce((s, sec) => s + sec.campos.filter(c => c.enCompendio).length, 0);

  if (cargando) return (
    <div className="flex items-center justify-center h-screen gap-3">
      <Loader2 size={20} style={{ color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />
      <span className="text-[14px] text-[#86868B] dark:text-gray-400">Cargando configuración...</span>
    </div>
  );

  return (
    <>
      <Topbar breadcrumb="Fedatario /" title="Configuración" />

      <main className="flex-1 p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white dark:text-white mb-2">Configuración</h1>
          <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Personaliza tu experiencia y preferencias</p>
        </div>

        {/* Settings Grid */}
        <div className="space-y-6">
          {/* Tema */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Sun size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white dark:text-white">Tema</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400">Elige entre modo claro y oscuro</p>
                </div>
              </div>
              <select className="px-4 py-2 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:text-white font-semibold text-sm outline-none">
                <option>Claro</option>
                <option>Oscuro</option>
                <option>Automático</option>
              </select>
            </div>
          </div>

          {/* Notificaciones */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Bell size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white dark:text-white">Notificaciones</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400">Recibe alertas de documentos pendientes</p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
              </label>
            </div>
          </div>

          {/* Privacidad */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400">
                  <Shield size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white dark:text-white">Privacidad</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400">Controla quién puede ver tus documentos</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold text-sm">
                Editar
              </button>
            </div>
          </div>

          {/* Cambiar contraseña */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400">
                  <Lock size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white dark:text-white">Seguridad</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400">Cambia tu contraseña regularmente</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-semibold text-sm">
                Cambiar
              </button>
            </div>
          </div>

          {/* Configuración del acta (Collapsible) */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm">
            <div 
              className="flex items-center justify-between px-6 py-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={() => setMostrarNuevaSeccion(!mostrarNuevaSeccion)}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center text-gray-600 dark:text-gray-400">
                  <Settings2 size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white dark:text-white">Estructura del acta</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-400">{secciones.length} secciones · {totalCampos} campos</p>
                </div>
              </div>
              <ChevronDown size={20} className={`text-gray-400 transition-transform ${mostrarNuevaSeccion ? 'rotate-180' : ''}`} />
            </div>

            {mostrarNuevaSeccion && (
              <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
                {secciones.map(sec => (
                  <div key={sec.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white dark:text-white">{sec.nombre}</h4>
                      <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-full">{sec.campos.length} campos</span>
                    </div>
                    <button onClick={() => eliminarSeccion(sec.id)} className="text-xs px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-semibold">
                      Eliminar sección
                    </button>
                  </div>
                ))}
                <button onClick={() => {}} className="w-full py-3 px-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-600 dark:hover:border-blue-400 transition-colors font-semibold text-sm flex items-center justify-center gap-2">
                  <Plus size={16} /> Agregar sección
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Guardar cambios */}
        <div className="mt-8 flex justify-end">
          <button onClick={guardar} disabled={estado === 'guardando'} className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: estado === 'guardado' ? '#10b981' : estado === 'error' ? '#ef4444' : '#0066ff' }}>
            {estado === 'guardando' && <Loader2 size={16} className="animate-spin" />}
            {estado === 'guardado' && <CheckCircle size={16} />}
            {estado === 'guardando' ? 'Guardando...' : estado === 'guardado' ? 'Guardado' : estado === 'error' ? 'Error' : 'Guardar cambios'}
          </button>
        </div>
      </main>
      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
