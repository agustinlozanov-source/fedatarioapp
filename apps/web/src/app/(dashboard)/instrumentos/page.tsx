'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, ArrowRight, FileText, Loader2 } from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { KpiCard } from '@/components/ui';
import { getInstrumentos } from '@/lib/db/instrumentos';
import { formatDate, formatMXN } from '@/lib/utils/format';
import type { Instrumento } from '@fedatario/shared';

const TIPO_LABEL: Record<string, string> = {
  sa_de_cv: 'SA de CV',
  s_de_rl: 'S de RL',
};

const ESTADO_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  paso_01_identificacion: { label: 'Identificación', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  paso_02_tipo: { label: 'Tipo definido', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  paso_03_datos_basicos: { label: 'Datos capturados', color: 'var(--orange)', bg: 'var(--orange-bg)' },
  paso_04_clientes_creados: { label: 'Portal enviado', color: 'var(--orange)', bg: 'var(--orange-bg)' },
  paso_05_portal_en_progreso: { label: 'En portal', color: 'var(--orange)', bg: 'var(--orange-bg)' },
  paso_06_mua: { label: 'Pendiente MUA', color: 'var(--orange)', bg: 'var(--orange-bg)' },
  paso_07_acopio_completo: { label: 'Acopio completo', color: 'var(--green)', bg: 'var(--green-bg)' },
  paso_08_redaccion: { label: 'Redactando', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  paso_09_borrador_enviado: { label: 'Borrador enviado', color: 'var(--blue)', bg: 'var(--blue-bg)' },
  paso_10_firma: { label: 'Firma', color: 'var(--green)', bg: 'var(--green-bg)' },
  cerrado: { label: 'Cerrado', color: 'var(--ink4)', bg: 'var(--bg3)' },
};

export default function InstrumentosPage() {
  const [instrumentos, setInstrumentos] = useState<Instrumento[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    getInstrumentos()
      .then(setInstrumentos)
      .finally(() => setCargando(false));
  }, []);

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
        <h1 className="text-[24px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Instrumentos</h1>
        <p className="text-[14px] text-[#6E6E73] mb-6">Actas constitutivas activas</p>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <KpiCard num={String(instrumentos.length)} label="Total" delta="Todos los instrumentos" deltaColor="var(--blue)" />
          <KpiCard num={String(enProceso)} label="En proceso" delta="Pendientes de cerrar" deltaColor="var(--orange)" />
          <KpiCard num={String(cerrados)} label="Cerrados" delta="Completados" deltaColor="var(--green)" />
        </div>

        {/* Lista */}
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} style={{ color: 'var(--ink4)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : instrumentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-3">
              <FileText size={20} style={{ color: 'var(--ink4)' }} />
            </div>
            <div className="text-[15px] font-bold text-[#1D1D1F] mb-1">Sin instrumentos aún</div>
            <div className="text-[13px] text-[#86868B] mb-4">Crea el primer instrumento para comenzar</div>
            <Link href="/nuevo"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold no-underline"
              style={{ background: 'var(--blue)', color: 'white' }}>
              <Plus size={14} /> Nuevo instrumento
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {instrumentos.map(inst => {
              const estado = ESTADO_LABEL[inst.estado] || { label: inst.estado, color: 'var(--ink4)', bg: 'var(--bg3)' };
              return (
                <div key={inst.id}
                  className="bg-white border border-black/[0.07] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-px transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {inst.numeroInstrumento && (
                          <span className="text-[11px] font-mono text-[#86868B]">No. {inst.numeroInstrumento}</span>
                        )}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--bg3)', color: 'var(--ink4)' }}>
                          {TIPO_LABEL[inst.tipo] || inst.tipo}
                        </span>
                      </div>
                      <div className="text-[16px] font-bold text-[#1D1D1F] tracking-tight">
                        {inst.denominacion_social || 'Sin nombre aún'}
                      </div>
                      <div className="text-[13px] text-[#6E6E73] mt-0.5">
                        {inst.socios.length} socio{inst.socios.length !== 1 ? 's' : ''}
                        {inst.capital_social ? ` · ${formatMXN(inst.capital_social)}` : ''}
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: estado.bg, color: estado.color }}>
                      {estado.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#86868B]">{formatDate(inst.creadoEn)}</span>
                    <Link href={`/instrumentos/${inst.id}`}
                      className="flex items-center gap-1 text-[12px] font-semibold no-underline"
                      style={{ color: 'var(--blue)' }}>
                      Ver instrumento <ArrowRight size={13} />
                    </Link>
                  </div>
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
