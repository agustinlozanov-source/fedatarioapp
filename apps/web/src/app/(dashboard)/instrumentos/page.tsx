'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, Loader2, Trash2, ChevronDown, ChevronUp, ArrowRight, Users, Building2, CheckCircle, Clock } from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { KpiCard } from '@/components/ui';
import { getInstrumentos, eliminarInstrumento } from '@/lib/db/instrumentos';
import { formatDate, formatMXN } from '@/lib/utils/format';
import type { Instrumento } from '@fedatario/shared';

const TIPO_LABEL: Record<string, string> = {
  sa_de_cv: 'SA de CV',
  s_de_rl: 'S de RL de CV',
  SA_de_CV: 'SA de CV',
  S_de_RL_de_CV: 'S de RL de CV',
};

const ESTADO_LABEL: Record<string, { label: string; color: string; bg: string; paso: number }> = {
  paso_01_identificacion:   { label: 'Identificación',    color: 'var(--blue)',   bg: 'var(--blue-bg)',   paso: 1 },
  paso_02_tipo:             { label: 'Tipo definido',     color: 'var(--blue)',   bg: 'var(--blue-bg)',   paso: 2 },
  paso_03_datos_basicos:    { label: 'Datos capturados',  color: 'var(--orange)', bg: 'var(--orange-bg)', paso: 3 },
  paso_04_clientes_creados: { label: 'Portal enviado',    color: 'var(--orange)', bg: 'var(--orange-bg)', paso: 4 },
  paso_05_portal_en_progreso:{ label: 'En portal',        color: 'var(--orange)', bg: 'var(--orange-bg)', paso: 5 },
  paso_06_mua:              { label: 'Pendiente MUA',     color: 'var(--orange)', bg: 'var(--orange-bg)', paso: 6 },
  paso_07_acopio_completo:  { label: 'Acopio completo',   color: 'var(--green)',  bg: 'var(--green-bg)',  paso: 7 },
  paso_08_redaccion:        { label: 'Redactando',        color: 'var(--blue)',   bg: 'var(--blue-bg)',   paso: 8 },
  paso_09_borrador_enviado: { label: 'Borrador enviado',  color: 'var(--blue)',   bg: 'var(--blue-bg)',   paso: 9 },
  paso_10_firma:            { label: 'Firma',             color: 'var(--green)',  bg: 'var(--green-bg)',  paso: 10 },
  cerrado:                  { label: 'Cerrado',           color: 'var(--ink4)',   bg: 'var(--bg3)',       paso: 11 },
};

/** Devuelve el porcentaje de completitud guardado por el compendio (0-100). */
function calcularScore(inst: Instrumento): number {
  return inst.completitud ?? 0;
}

/** Fuzzy search: devuelve 0 si no coincide, >0 cuanto mejor el match. */
function fuzzyMatch(texto: string, q: string): boolean {
  if (!q) return true;
  texto = texto.toLowerCase();
  q = q.toLowerCase();
  if (texto.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < texto.length && qi < q.length; i++) {
    if (texto[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

function instrumentoMatchesBusqueda(inst: Instrumento, q: string): boolean {
  if (!q) return true;
  const campos = [
    inst.denominacion_social ?? '',
    TIPO_LABEL[inst.tipo] ?? inst.tipo,
    ESTADO_LABEL[inst.estado]?.label ?? inst.estado,
    String(inst.numero_poliza ?? inst.numeroInstrumento ?? ''),
    ...(inst.socios ?? []).map(s => s.nombre_completo ?? ''),
  ];
  return campos.some(c => fuzzyMatch(c, q));
}

export default function InstrumentosPage() {
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  useEffect(() => {
    getInstrumentos()
      .then(setInstrumentos)
      .finally(() => setCargando(false));
  }, []);

  const filtrados = useMemo(() =>
    instrumentos.filter(i => instrumentoMatchesBusqueda(i, busqueda)),
    [instrumentos, busqueda]
  );

  const handleEliminar = async (id: string) => {
    setEliminandoId(id);
    try {
      await eliminarInstrumento(id);
      setInstrumentos(prev => prev.filter(i => i.id !== id));
    } finally {
      setEliminandoId(null);
      setConfirmandoId(null);
    }
  };

  const enProceso = instrumentos.filter(i => i.estado !== 'cerrado').length;
  const cerrados = instrumentos.filter(i => i.estado === 'cerrado').length;

  return (
    <>
      <Topbar
        breadcrumb="Fedatario /"
        title="Instrumentos"
        actions={
          <Link href="/nuevo"
            className="btn btn-primary text-[13px] py-1.5 px-3 flex items-center gap-1.5 no-underline"
            style={{ background: 'var(--blue)', color: 'white' }}>
            <Plus size={14} /> Nuevo instrumento
          </Link>
        }
      />

      <div className="p-6">
        <h1 className="text-[24px] font-extrabold text-[#1D1D1F] dark:text-white tracking-tight mb-1">Instrumentos</h1>
        <p className="text-[14px] text-[#6E6E73] dark:text-gray-400 mb-6">Actas constitutivas y expedientes</p>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <KpiCard num={String(instrumentos.length)} label="Total" delta="Todos los instrumentos" deltaColor="var(--blue)" />
          <KpiCard num={String(enProceso)} label="En proceso" delta="Pendientes de cerrar" deltaColor="var(--orange)" />
          <KpiCard num={String(cerrados)} label="Cerrados" delta="Completados" deltaColor="var(--green)" />
        </div>

        {/* Buscador Fuzzy */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-black/[0.08] dark:border-white/[0.08] mb-4 shadow-sm">
          <Search size={15} style={{ color: 'var(--ink4)' }} />
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, socio, tipo, estado, póliza..."
            className="flex-1 text-[13px] outline-none bg-transparent"
            style={{ color: 'var(--ink)' }}
          />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="text-[11px] text-[#86868B] dark:text-gray-400 hover:text-[#1D1D1F] dark:text-white">✕</button>
          )}
        </div>

        {/* Lista PAD */}
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} style={{ color: 'var(--ink4)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] dark:bg-gray-700 flex items-center justify-center mb-3">
              <FileText size={20} style={{ color: 'var(--ink4)' }} />
            </div>
            <div className="text-[15px] font-bold text-[#1D1D1F] dark:text-white mb-1">
              {busqueda ? 'Sin resultados' : 'Sin instrumentos aún'}
            </div>
            <div className="text-[13px] text-[#86868B] dark:text-gray-400 mb-4">
              {busqueda ? `No hay coincidencias para "${busqueda}"` : 'Crea el primer instrumento para comenzar'}
            </div>
            {!busqueda && (
              <Link href="/nuevo"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold no-underline"
                style={{ background: 'var(--blue)', color: 'white' }}>
                <Plus size={14} /> Nuevo instrumento
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-black/[0.07] dark:border-white/[0.07] rounded-2xl overflow-hidden shadow-sm">
            {filtrados.map((inst, i) => {
              const estado = ESTADO_LABEL[inst.estado] || { label: inst.estado, color: 'var(--ink4)', bg: 'var(--bg3)', paso: 0 };
              const score = calcularScore(inst);
              const expanded = expandidoId === inst.id;
              const scoreColor = score >= 80 ? 'var(--green)' : score >= 40 ? 'var(--orange)' : 'var(--red)';

              return (
                <div key={inst.id} className={i > 0 ? 'border-t border-black/[0.04] dark:border-white/[0.05]' : ''}>
                  {/* Fila principal */}
                  <div
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#F5F5F7] dark:hover:bg-gray-700 transition-colors cursor-pointer group"
                    onClick={() => setExpandidoId(expanded ? null : inst.id!)}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-bold"
                      style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                      {(inst.denominacion_social ?? 'S').charAt(0).toUpperCase()}
                    </div>

                    {/* Nombre + tipo */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-[#1D1D1F] dark:text-white truncate">
                          {inst.denominacion_social || 'Sin nombre'}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                          style={{ background: 'var(--bg3)', color: 'var(--ink4)' }}>
                          {TIPO_LABEL[inst.tipo] || inst.tipo}
                        </span>
                      </div>
                      <div className="text-[12px] text-[#86868B] dark:text-gray-400 flex items-center gap-1.5 mt-0.5">
                        {inst.numero_poliza && <span className="font-mono">Pól. {inst.numero_poliza}</span>}
                        {inst.numero_poliza && inst.socios?.length > 0 && <span>·</span>}
                        <Users size={11} />
                        <span>{inst.socios?.length ?? 0} socio{(inst.socios?.length ?? 0) !== 1 ? 's' : ''}</span>
                        {inst.capital_social && <><span>·</span><span>{formatMXN(inst.capital_social)}</span></>}
                      </div>
                    </div>

                    {/* Score de integración */}
                    <div className="shrink-0 text-center w-16">
                      <div className="text-[15px] font-extrabold" style={{ color: scoreColor }}>{score}%</div>
                      <div className="text-[10px] text-[#86868B] dark:text-gray-400">Integración</div>
                    </div>

                    {/* Estado */}
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: estado.bg, color: estado.color }}>
                      {estado.label}
                    </span>

                    {/* Acciones */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {confirmandoId === inst.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); handleEliminar(inst.id!); }}
                            disabled={eliminandoId === inst.id}
                            className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                            style={{ background: 'var(--red-bg)', color: 'var(--red)' }}>
                            {eliminandoId === inst.id ? '...' : 'Sí'}
                          </button>
                          <button onClick={e => { e.stopPropagation(); setConfirmandoId(null); }}
                            className="text-[11px] font-bold px-2 py-0.5 rounded-lg"
                            style={{ background: 'var(--bg3)', color: 'var(--ink4)' }}>
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setConfirmandoId(inst.id!); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Eliminar">
                          <Trash2 size={12} style={{ color: 'var(--ink4)' }} />
                        </button>
                      )}
                      <Link href={`/instrumentos/${inst.id}`}
                        onClick={e => e.stopPropagation()}
                        className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors no-underline"
                        title="Abrir instrumento">
                        <ArrowRight size={12} style={{ color: 'var(--blue)' }} />
                      </Link>
                    </div>

                    {/* Chevron */}
                    <div className="shrink-0">
                      {expanded
                        ? <ChevronUp size={14} style={{ color: 'var(--ink4)' }} />
                        : <ChevronDown size={14} style={{ color: 'var(--ink4)' }} />
                      }
                    </div>
                  </div>

                  {/* Vista rápida expandida */}
                  {expanded && (
                    <div className="px-5 pb-4 border-t border-black/[0.04] dark:border-white/[0.06]" style={{ background: 'var(--bg2)' }}>
                      <div className="pt-4 grid grid-cols-2 gap-4">

                        {/* Panel izquierdo: socios */}
                        <div>
                          <div className="text-[11px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5">
                            <Users size={11} /> Socios
                          </div>
                          <div className="space-y-1.5">
                            {(inst.socios ?? []).length === 0 ? (
                              <div className="text-[12px] text-[#86868B] dark:text-gray-400">Sin socios asignados</div>
                            ) : (inst.socios ?? []).map((s, si) => (
                              <div key={si} className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded-xl px-3 py-2">
                                <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center text-[11px] font-bold text-blue-600 shrink-0">
                                  {(s.nombre_completo ?? 'S').charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white truncate">
                                    {s.nombre_completo || `Socio ${si + 1}`}
                                  </div>
                                  <div className="text-[10px] text-[#86868B] dark:text-gray-400">{s.rol?.replace(/_/g, ' ')} · {s.porcentaje}%</div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                  <span title="Datos" className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                                    style={{ background: s.datosCompletos ? 'var(--green-bg)' : 'var(--bg3)', color: s.datosCompletos ? 'var(--green)' : 'var(--ink4)' }}>
                                    {s.datosCompletos ? '✓' : '○'}
                                  </span>
                                  <span title="Docs" className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                                    style={{ background: s.documentosCompletos ? 'var(--green-bg)' : 'var(--bg3)', color: s.documentosCompletos ? 'var(--green)' : 'var(--ink4)' }}>
                                    {s.documentosCompletos ? '✓' : '○'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Panel derecho: progreso + info */}
                        <div className="space-y-3">
                          {/* Score visual */}
                          <div className="bg-white dark:bg-gray-700 rounded-xl px-4 py-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-[#86868B] dark:text-gray-400 uppercase tracking-[0.06em]">Score de integración</span>
                              <span className="text-[13px] font-extrabold" style={{ color: scoreColor }}>{score}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-[#F5F5F7] dark:bg-gray-600 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: scoreColor }} />
                            </div>
                            <div className="flex justify-between text-[10px] text-[#86868B] dark:text-gray-400 mt-1">
                              <span>{(inst.socios ?? []).filter(s => s.datosCompletos && s.documentosCompletos).length} / {inst.socios?.length ?? 0} socios completos</span>
                              <span>Paso {estado.paso}/11</span>
                            </div>
                          </div>

                          {/* Datos del instrumento */}
                          <div className="bg-white dark:bg-gray-700 rounded-xl px-4 py-3 space-y-1.5">
                            {[
                              { label: 'Capital', val: inst.capital_social ? formatMXN(inst.capital_social) : undefined },
                              { label: 'Domicilio', val: inst.domicilio_social },
                              { label: 'Fecha', val: inst.fecha_instrumento },
                              { label: 'Ciudad', val: inst.ciudad_fedatario },
                            ].filter(f => f.val).map(f => (
                              <div key={f.label} className="flex gap-2 items-baseline">
                                <span className="text-[11px] text-[#86868B] dark:text-gray-400 w-16 shrink-0">{f.label}</span>
                                <span className="text-[12px] font-semibold text-[#1D1D1F] dark:text-white truncate">{f.val}</span>
                              </div>
                            ))}
                          </div>

                          <Link href={`/instrumentos/${inst.id}`}
                            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-[13px] font-bold no-underline transition-colors"
                            style={{ background: 'var(--blue)', color: 'white' }}>
                            Abrir instrumento <ArrowRight size={13} />
                          </Link>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
