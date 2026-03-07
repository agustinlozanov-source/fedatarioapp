'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Upload, ArrowRight, User, Building2, Loader2, FileText } from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { KpiCard } from '@/components/ui';
import { getClientes } from '@/lib/db/clientes';
import type { Cliente } from '@fedatario/shared';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtrados, setFiltrados] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'fisica' | 'moral'>('todos');

  useEffect(() => {
    getClientes()
      .then(data => { setClientes(data); setFiltrados(data); })
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    let resultado = clientes;
    if (filtroTipo !== 'todos') {
      resultado = resultado.filter(c => c.tipoPersona === filtroTipo);
    }
    if (busqueda.trim()) {
      const t = busqueda.toLowerCase();
      resultado = resultado.filter(c =>
        c.nombre.toLowerCase().includes(t) ||
        c.rfc?.toLowerCase().includes(t) ||
        c.curp?.toLowerCase().includes(t)
      );
    }
    setFiltrados(resultado);
  }, [busqueda, filtroTipo, clientes]);

  const fisicas = clientes.filter(c => c.tipoPersona === 'fisica').length;
  const morales = clientes.filter(c => c.tipoPersona === 'moral').length;

  return (
    <>
      <Topbar
        breadcrumb="Fedatario /"
        title="Clientes"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/clientes/carga-masiva"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold no-underline"
              style={{ background: 'var(--bg2)', color: 'var(--ink3)', border: '1px solid var(--border)' }}>
              <Upload size={14} /> Carga masiva
            </Link>
            <Link href="/clientes/nuevo"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-bold no-underline"
              style={{ background: 'var(--blue)', color: 'white' }}>
              <Plus size={14} /> Nuevo cliente
            </Link>
          </div>
        }
      />

      <div className="p-6">
        <h1 className="text-[24px] font-extrabold text-[#1D1D1F] tracking-tight mb-1">Clientes</h1>
        <p className="text-[14px] text-[#6E6E73] mb-6">Socios y personas registradas en el sistema</p>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <KpiCard num={String(clientes.length)} label="Total clientes" delta="Registrados" deltaColor="var(--blue)" />
          <KpiCard num={String(fisicas)} label="Personas físicas" delta="Individuos" deltaColor="var(--ink3)" />
          <KpiCard num={String(morales)} label="Personas morales" delta="Empresas" deltaColor="var(--ink3)" />
        </div>

        {/* Buscador y filtros */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white"
            style={{ border: '1px solid var(--border)' }}>
            <Search size={14} style={{ color: 'var(--ink4)' }} />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, RFC, CURP..."
              className="flex-1 text-[13px] outline-none" />
          </div>
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg2)' }}>
            {(['todos', 'fisica', 'moral'] as const).map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                style={{
                  background: filtroTipo === t ? 'white' : 'transparent',
                  color: filtroTipo === t ? 'var(--ink)' : 'var(--ink4)',
                  boxShadow: filtroTipo === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {t === 'todos' ? 'Todos' : t === 'fisica' ? 'Física' : 'Moral'}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} style={{ color: 'var(--ink4)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] flex items-center justify-center mb-3">
              <User size={20} style={{ color: 'var(--ink4)' }} />
            </div>
            <div className="text-[15px] font-bold text-[#1D1D1F] mb-1">
              {busqueda ? 'Sin resultados' : 'Sin clientes aún'}
            </div>
            <div className="text-[13px] text-[#86868B] mb-4">
              {busqueda ? 'Intenta con otro término' : 'Crea el primer cliente o usa carga masiva'}
            </div>
            {!busqueda && (
              <div className="flex gap-2">
                <Link href="/clientes/nuevo"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold no-underline"
                  style={{ background: 'var(--blue)', color: 'white' }}>
                  <Plus size={14} /> Nuevo cliente
                </Link>
                <Link href="/clientes/carga-masiva"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold no-underline"
                  style={{ background: 'var(--bg2)', color: 'var(--ink3)', border: '1px solid var(--border)' }}>
                  <Upload size={14} /> Carga masiva
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtrados.map(cliente => (
              <div key={cliente.id}
                className="bg-white border border-black/[0.07] rounded-xl p-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:-translate-y-px transition-all">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[14px] font-bold"
                    style={{ background: 'var(--blue-bg)', color: 'var(--blue)' }}>
                    {cliente.tipoPersona === 'moral'
                      ? <Building2 size={18} style={{ color: 'var(--blue)' }} />
                      : cliente.nombre.charAt(0).toUpperCase()
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-bold text-[#1D1D1F] truncate">{cliente.nombre}</span>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                        style={{ background: 'var(--bg3)', color: 'var(--ink4)' }}>
                        {cliente.tipoPersona === 'fisica' ? 'Física' : 'Moral'}
                      </span>
                      {cliente.nacionalidad && cliente.nacionalidad !== 'Mexicana' && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: 'var(--orange-bg)', color: 'var(--orange)' }}>
                          {cliente.nacionalidad}
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-[#86868B]">
                      {[cliente.rfc, cliente.curp].filter(Boolean).join(' · ') || 'Sin RFC/CURP'}
                    </div>
                  </div>

                  {/* Acciones */}
                  <Link href={`/clientes/${cliente.id}`}
                    className="flex items-center gap-1 text-[12px] font-semibold no-underline shrink-0"
                    style={{ color: 'var(--blue)' }}>
                    Ver <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
