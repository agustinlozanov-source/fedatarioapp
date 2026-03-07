'use client';
import { Download, BookOpen } from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { Card, CardHeader, KpiCard } from '@/components/ui';
import { mockLibro, mockInstrumentos } from '@/lib/mock/data';
import { formatDate } from '@/lib/utils/format';

export default function LibroPage() {
  const firmados = mockInstrumentos.filter(i => i.estado === 'firmado');
  const totalFolios = mockLibro.reduce((s, l) => s + (l.folioFin - l.folioInicio + 1), 0);

  return (
    <>
      <Topbar
        breadcrumb="Fedatario /"
        title="Libro & Índice"
        actions={
          <button className="btn btn-secondary text-[13px] py-1.5 px-3 flex items-center gap-1.5">
            <Download size={14} /> Exportar índice
          </button>
        }
      />

      <div className="p-6">
        <h1 className="text-[24px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Libro de Instrumentos</h1>
        <p className="text-[14px] text-[#6E6E73] mb-6">Registro oficial del protocolo · Para encuadernación</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <KpiCard num={String(mockLibro.length)} label="Instrumentos en libro" delta="Firmados y archivados" deltaColor="var(--green)" />
          <KpiCard num={String(totalFolios)} label="Folios totales" delta="Este volumen" />
          <KpiCard num="1,244 – 1,246" label="Rango actual" delta="Protocolo 2025" deltaColor="var(--blue)" />
        </div>

        <Card>
          <CardHeader
            title="Índice del protocolo"
            subtitle="Orden cronológico · Listo para encuadernación"
            action={
              <div className="flex items-center gap-1.5">
                <BookOpen size={14} style={{ color: 'var(--ink4)' }} />
                <span className="text-[12px] text-[#86868B]">Volumen 2025</span>
              </div>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['No. Instrumento', 'Sociedad', 'Partes', 'Folios', 'Fecha firma', 'Acta', ''].map(h => (
                    <th key={h} className="text-[11px] font-bold text-[#86868B] uppercase tracking-[0.05em] px-4 py-2.5 border-b border-black/[0.07] text-left whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockLibro.map((lib, idx) => (
                  <tr key={lib.id} className="hover:bg-[#F5F5F7] transition-colors">
                    <td className="px-4 py-3 border-b border-black/[0.04]">
                      <span className="text-[13px] font-bold text-[#1D1D1F] font-mono">{lib.numeroInstrumento}</span>
                    </td>
                    <td className="px-4 py-3 border-b border-black/[0.04]">
                      <div className="text-[13px] font-semibold text-[#1D1D1F]">{lib.sociedadNombre}</div>
                      <div className="text-[11px] text-[#86868B]">Acta constitutiva</div>
                    </td>
                    <td className="px-4 py-3 border-b border-black/[0.04] text-[12px] text-[#6E6E73]">
                      {lib.partes.join(' · ')}
                    </td>
                    <td className="px-4 py-3 border-b border-black/[0.04]">
                      <span className="text-[12px] font-mono">{lib.folioInicio} – {lib.folioFin}</span>
                      <span className="text-[11px] text-[#86868B] ml-1">({lib.folioFin - lib.folioInicio + 1} pp.)</span>
                    </td>
                    <td className="px-4 py-3 border-b border-black/[0.04] text-[12px] text-[#6E6E73]">
                      {formatDate(lib.fechaFirma)}
                    </td>
                    <td className="px-4 py-3 border-b border-black/[0.04]">
                      <span className="badge badge-green">Firmado</span>
                    </td>
                    <td className="px-4 py-3 border-b border-black/[0.04]">
                      <button className="btn btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1">
                        <Download size={11} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-black/[0.07] flex justify-between items-center">
            <span className="text-[12px] text-[#86868B]">{mockLibro.length} instrumentos · {totalFolios} folios totales</span>
            <button className="btn btn-primary text-[13px] py-1.5 px-3 flex items-center gap-1.5" style={{ background: 'var(--blue)', color: 'white' }}>
              <Download size={14} /> Exportar para encuadernación
            </button>
          </div>
        </Card>
      </div>
    </>
  );
}
