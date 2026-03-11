'use client';
import { Download, BookOpen } from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { mockLibro, mockInstrumentos } from '@/lib/mock/data';
import { formatDate } from '@/lib/utils/format';

export default function LibroPage() {
  const firmados = mockInstrumentos.filter(i => i.estado === 'firmado');
  const totalFolios = mockLibro.reduce((s, l) => s + (l.folioFin - l.folioInicio + 1), 0);
  const porcentajeFirmados = Math.round((firmados.length / mockInstrumentos.length) * 100);

  return (
    <>
      <Topbar breadcrumb="Fedatario /" title="Libro & Índice" />

      <main className="flex-1 p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Libro de Instrumentos</h1>
          <p className="text-gray-600 dark:text-gray-400">Registro oficial del protocolo · Para encuadernación</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">Instrumentos en libro</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white">{mockLibro.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Firmados y archivados</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">Folios totales</p>
            <p className="text-4xl font-bold text-green-600 dark:text-green-400">{totalFolios}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Este volumen</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">Porcentaje firmado</p>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{porcentajeFirmados}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Del protocolo</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">Rango actual</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">1,244 – 1,246</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">Protocolo 2025</p>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Índice del protocolo</h2>
                <p className="text-sm text-gray-600">Orden cronológico · Listo para encuadernación</p>
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-semibold text-sm">
                <Download size={16} /> Exportar índice
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Instrumento</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Sociedad</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Partes</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Folios</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Fecha firma</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody>
                {mockLibro.map((lib, idx) => (
                  <tr key={lib.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-gray-900">{lib.numeroInstrumento}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{lib.sociedadNombre}</div>
                      <div className="text-xs text-gray-500">Acta constitutiva</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {lib.partes.join(' · ')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                      {lib.folioInicio} – {lib.folioFin}
                      <span className="text-gray-500 font-normal"> ({lib.folioFin - lib.folioInicio + 1}pp.)</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(lib.fechaFirma)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Firmado</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-full hover:bg-gray-300 transition-colors text-xs font-semibold flex items-center gap-1.5 ml-auto">
                        <Download size={14} /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
            <span className="text-sm text-gray-600">{mockLibro.length} instrumentos · {totalFolios} folios totales</span>
            <button className="px-6 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-semibold text-sm flex items-center gap-2">
              <Download size={16} /> Exportar para encuadernación
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
