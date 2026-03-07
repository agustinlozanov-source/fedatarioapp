'use client';
import { useEffect, useState } from 'react';
import {
  Plus, GripVertical, Trash2, CheckCircle,
  Loader2, ChevronDown, ChevronRight, Settings2
} from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { Card } from '@/components/ui';
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
      { id: 'f1', seccion: 'Sociedad', nombre: 'nombreSociedad', etiqueta: 'Nombre de la sociedad', tipo: 'texto', requerido: true, fuentePrincipal: 'formulario', orden: 1, enCompendio: true },
      { id: 'f2', seccion: 'Sociedad', nombre: 'tipoSociedad', etiqueta: 'Tipo de sociedad', tipo: 'seleccion', requerido: true, fuentePrincipal: 'formulario', orden: 2, enCompendio: true },
      { id: 'f3', seccion: 'Sociedad', nombre: 'objetoSocial', etiqueta: 'Objeto social', tipo: 'texto_largo', requerido: true, fuentePrincipal: 'reunion', orden: 3, enCompendio: true },
      { id: 'f4', seccion: 'Sociedad', nombre: 'capitalSocial', etiqueta: 'Capital social', tipo: 'moneda', requerido: true, fuentePrincipal: 'reunion', orden: 4, enCompendio: true },
      { id: 'f5', seccion: 'Sociedad', nombre: 'domicilioSocial', etiqueta: 'Domicilio social', tipo: 'texto', requerido: true, fuentePrincipal: 'formulario', orden: 5, enCompendio: true },
    ]
  },
  {
    id: 'sec-2', nombre: 'Socios', orden: 2,
    campos: [
      { id: 'f6', seccion: 'Socios', nombre: 'socios', etiqueta: 'Socios y participaciones', tipo: 'lista_socios', requerido: true, fuentePrincipal: 'reunion', orden: 1, enCompendio: true },
      { id: 'f7', seccion: 'Socios', nombre: 'administrador', etiqueta: 'Administrador único', tipo: 'texto', requerido: true, fuentePrincipal: 'reunion', orden: 2, enCompendio: true },
    ]
  },
  {
    id: 'sec-3', nombre: 'Duración', orden: 3,
    campos: [
      { id: 'f8', seccion: 'Duración', nombre: 'duracion', etiqueta: 'Duración de la sociedad', tipo: 'texto', requerido: true, fuentePrincipal: 'formulario', orden: 1, enCompendio: false, valorDefault: 'Indefinida' },
    ]
  },
  {
    id: 'sec-4', nombre: 'Cláusulas', orden: 4,
    campos: [
      { id: 'f9', seccion: 'Cláusulas', nombre: 'clausulaCalvo', etiqueta: 'Cláusula Calvo', tipo: 'texto', requerido: false, fuentePrincipal: 'sistema', orden: 1, enCompendio: false },
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
      <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#F5F5F7] transition-colors" onClick={() => setAbierto(!abierto)}>
        <GripVertical size={14} style={{ color: 'var(--ink5)', flexShrink: 0 }} />
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-[13px] font-semibold text-[#1D1D1F] truncate">{campo.etiqueta || 'Campo sin nombre'}</span>
          <span className="badge badge-gray text-[10px] shrink-0">{TIPOS_CAMPO.find(t => t.id === campo.tipo)?.label}</span>
          <span className="badge badge-blue text-[10px] shrink-0">{FUENTES.find(f => f.id === campo.fuentePrincipal)?.label}</span>
          {campo.requerido && <span className="badge badge-red text-[10px] shrink-0">Requerido</span>}
          {campo.enCompendio && <span className="badge badge-purple text-[10px] shrink-0">Compendio</span>}
        </div>
        {abierto ? <ChevronDown size={14} style={{ color: 'var(--ink4)' }} /> : <ChevronRight size={14} style={{ color: 'var(--ink4)' }} />}
      </div>
      {abierto && (
        <div className="px-4 pb-4 pt-3 border-t border-black/[0.06]" style={{ background: 'var(--bg2)' }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1">Etiqueta visible</label>
              <input value={campo.etiqueta} onChange={e => onUpdate({ ...campo, etiqueta: e.target.value })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: '1px solid var(--border)', background: 'white' }} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1">Nombre interno</label>
              <input value={campo.nombre} onChange={e => onUpdate({ ...campo, nombre: e.target.value })} className="w-full px-3 py-2 rounded-lg text-[13px] font-mono outline-none" style={{ border: '1px solid var(--border)', background: 'white' }} />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1">Tipo de campo</label>
              <select value={campo.tipo} onChange={e => onUpdate({ ...campo, tipo: e.target.value as TipoCampo })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: '1px solid var(--border)', background: 'white' }}>
                {TIPOS_CAMPO.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1">Fuente principal</label>
              <select value={campo.fuentePrincipal} onChange={e => onUpdate({ ...campo, fuentePrincipal: e.target.value as any })} className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: '1px solid var(--border)', background: 'white' }}>
                {FUENTES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[10px] font-bold text-[#86868B] uppercase tracking-[0.06em] block mb-1">Valor por defecto (opcional)</label>
            <input value={campo.valorDefault || ''} onChange={e => onUpdate({ ...campo, valorDefault: e.target.value })} placeholder="Dejar vacío si no aplica" className="w-full px-3 py-2 rounded-lg text-[13px] outline-none" style={{ border: '1px solid var(--border)', background: 'white' }} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={campo.requerido} onChange={e => onUpdate({ ...campo, requerido: e.target.checked })} className="w-4 h-4 rounded" style={{ accentColor: 'var(--red)' }} />
              <span className="text-[12px] font-semibold text-[#3A3A3C]">Requerido</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={campo.enCompendio} onChange={e => onUpdate({ ...campo, enCompendio: e.target.checked })} className="w-4 h-4 rounded" style={{ accentColor: 'var(--purple)' }} />
              <span className="text-[12px] font-semibold text-[#3A3A3C]">Aparece en compendio</span>
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
    const nuevo: CampoActa = { id: `f-${uid()}`, seccion: sec.nombre, nombre: '', etiqueta: 'Nuevo campo', tipo: 'texto', requerido: false, fuentePrincipal: 'formulario', orden: sec.campos.length + 1, enCompendio: false };
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
      <span className="text-[14px] text-[#86868B]">Cargando configuración...</span>
    </div>
  );

  return (
    <>
      <Topbar
        breadcrumb="Fedatario /"
        title="Configuración"
        actions={
          <button onClick={guardar} disabled={estado === 'guardando'} className="btn btn-primary text-[13px] py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: estado === 'guardado' ? 'var(--green)' : estado === 'error' ? 'var(--red)' : 'var(--blue)', color: 'white' }}>
            {estado === 'guardando' && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
            {estado === 'guardado' && <CheckCircle size={14} />}
            {estado === 'guardando' ? 'Guardando...' : estado === 'guardado' ? 'Guardado' : estado === 'error' ? 'Error' : 'Guardar cambios'}
          </button>
        }
      />

      <div className="p-6 max-w-4xl">
        <h1 className="text-[24px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Configuración del acta</h1>
        <p className="text-[14px] text-[#6E6E73] mb-2">Estructura del acta constitutiva · Editable sin código</p>

        <div className="flex items-center gap-3 mb-6">
          <span className="badge badge-gray">{secciones.length} secciones</span>
          <span className="badge badge-blue">{totalCampos} campos</span>
          <span className="badge badge-purple">{enCompendio} en compendio</span>
        </div>

        <div className="space-y-3">
          {secciones.map(sec => (
            <Card key={sec.id}>
              <div className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-[#F5F5F7] transition-colors"
                onClick={() => setSeccionesAbiertas(prev => ({ ...prev, [sec.id]: !prev[sec.id] }))}>
                <GripVertical size={15} style={{ color: 'var(--ink5)', flexShrink: 0 }} />
                <Settings2 size={15} style={{ color: 'var(--ink4)', flexShrink: 0 }} />
                <span className="text-[14px] font-bold text-[#1D1D1F] flex-1">{sec.nombre}</span>
                <span className="text-[12px] text-[#86868B] mr-2">{sec.campos.length} campos</span>
                {seccionesAbiertas[sec.id] ? <ChevronDown size={15} style={{ color: 'var(--ink4)' }} /> : <ChevronRight size={15} style={{ color: 'var(--ink4)' }} />}
              </div>

              {seccionesAbiertas[sec.id] && (
                <div className="px-4 pb-4 pt-4 border-t border-black/[0.06]">
                  {sec.campos.length === 0 && (
                    <div className="text-center py-4 text-[13px] text-[#86868B]">No hay campos en esta sección</div>
                  )}
                  {sec.campos.map(campo => (
                    <CampoRow key={campo.id} campo={campo}
                      onUpdate={nuevo => actualizarCampo(sec.id, campo.id, nuevo)}
                      onDelete={() => eliminarCampo(sec.id, campo.id)}
                    />
                  ))}
                  <div className="flex items-center justify-between mt-2">
                    <button onClick={() => agregarCampo(sec.id)} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ color: 'var(--blue)', background: 'var(--blue-bg)' }}>
                      <Plus size={13} /> Agregar campo
                    </button>
                    <button onClick={() => eliminarSeccion(sec.id)} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ color: 'var(--red)', background: 'var(--red-bg)' }}>
                      <Trash2 size={12} /> Eliminar sección
                    </button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>

        <div className="mt-4">
          {!mostrarNuevaSeccion ? (
            <button onClick={() => setMostrarNuevaSeccion(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold border-2 border-dashed transition-colors hover:border-[var(--blue)] hover:text-[var(--blue)]" style={{ borderColor: 'var(--border)', color: 'var(--ink4)' }}>
              <Plus size={15} /> Agregar sección
            </button>
          ) : (
            <div className="flex gap-2">
              <input autoFocus value={nuevaSeccion} onChange={e => setNuevaSeccion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') agregarSeccion(); if (e.key === 'Escape') setMostrarNuevaSeccion(false); }}
                placeholder="Nombre de la sección..." className="flex-1 px-3 py-2.5 rounded-xl text-[13px] outline-none"
                style={{ border: '1px solid var(--blue)', background: 'white' }} />
              <button onClick={agregarSeccion} className="btn btn-primary px-4" style={{ background: 'var(--blue)', color: 'white' }}>Agregar</button>
              <button onClick={() => setMostrarNuevaSeccion(false)} className="btn btn-secondary px-4">Cancelar</button>
            </div>
          )}
        </div>

        <div className="mt-4 p-4 rounded-xl text-[12px] leading-relaxed" style={{ background: 'var(--blue-bg)', color: 'var(--ink3)', border: '1px solid var(--blue-border)' }}>
          <strong style={{ color: 'var(--blue)' }}>Compendio para secretarias:</strong> Los campos marcados con <strong>Compendio</strong> aparecen en el documento resumen para facilitar la captura en sistemas de gobierno.
        </div>
      </div>
      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
