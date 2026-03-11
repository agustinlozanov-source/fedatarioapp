import type { EstadoInstrumento, AgentePasoEstado, PipelineEstado } from '@fedatario/shared';
import { estadoLabels, estadoBadge, agenteLabels, agentePasoColor } from '@/lib/utils/format';
import { CheckCircle, Loader2, Clock, AlertCircle, PauseCircle } from 'lucide-react';

// ── CARD ──────────────────────────────────────

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/[0.07]">
      <div>
        <div className="text-[14px] font-bold text-[#1D1D1F] tracking-tight">{title}</div>
        {subtitle && <div className="text-[12px] text-[#86868B] mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

// ── KPI CARD ──────────────────────────────────

export function KpiCard({ num, label, delta, deltaColor }: { num: string; label: string; delta?: string; deltaColor?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[28px] font-extrabold text-[#1D1D1F] tracking-tight leading-none">{num}</div>
      <div className="text-[12px] text-[#86868B] font-medium mt-1">{label}</div>
      {delta && <div className="text-[11px] font-semibold mt-1.5" style={{ color: deltaColor || 'var(--ink4)' }}>{delta}</div>}
    </div>
  );
}

// ── ESTADO BADGE ──────────────────────────────

export function EstadoBadge({ estado }: { estado: EstadoInstrumento }) {
  return <span className={`badge ${estadoBadge[estado]}`}>{estadoLabels[estado]}</span>;
}

// ── PIPELINE MINI ─────────────────────────────

const AGENTES = ['agt00_orquestador','agt01_extractor','agt02_juridico','agt03_redactor','agt04_auditor'] as const;

export function PipelineMini({ pipeline }: { pipeline: PipelineEstado }) {
  return (
    <div className="flex items-center gap-1">
      {AGENTES.map((key, i) => {
        const paso = pipeline[key];
        const color = agentePasoColor[paso.estado];
        return (
          <div key={key} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full transition-colors" style={{ background: color }} title={agenteLabels[key]} />
            {i < AGENTES.length - 1 && <div className="w-4 h-px" style={{ background: 'var(--bg3)' }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── PIPELINE DETALLE ──────────────────────────

export function PipelineDetalle({ pipeline }: { pipeline: PipelineEstado }) {
  return (
    <div className="space-y-2">
      {AGENTES.map(key => {
        const paso = pipeline[key];
        const icons: Record<AgentePasoEstado, React.ReactNode> = {
          pendiente:       <Clock size={14} style={{ color: 'var(--ink5)' }} />,
          proceso:         <Loader2 size={14} style={{ color: 'var(--blue)', animation: 'spin 1s linear infinite' }} />,
          completado:      <CheckCircle size={14} style={{ color: 'var(--green)' }} />,
          error:           <AlertCircle size={14} style={{ color: 'var(--red)' }} />,
          esperando_input: <PauseCircle size={14} style={{ color: 'var(--orange)' }} />,
        };
        return (
          <div key={key} className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--border2)' }}>
            <div className="w-5 flex justify-center">{icons[paso.estado]}</div>
            <span className="text-[13px] font-semibold flex-1" style={{ color: paso.estado === 'pendiente' ? 'var(--ink4)' : 'var(--ink)' }}>
              {agenteLabels[key]}
            </span>
            {paso.confianza !== undefined && (
              <span className="text-[11px] font-bold" style={{ color: paso.confianza >= 0.9 ? 'var(--green)' : paso.confianza >= 0.75 ? 'var(--orange)' : 'var(--red)' }}>
                {Math.round(paso.confianza * 100)}%
              </span>
            )}
            {paso.duracionMs && (
              <span className="text-[11px] text-[#86868B]">{(paso.duracionMs / 1000).toFixed(1)}s</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── PROGRESS BAR ──────────────────────────────

export function ProgressBar({ value, color = 'var(--blue)' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg3)' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
    </div>
  );
}
