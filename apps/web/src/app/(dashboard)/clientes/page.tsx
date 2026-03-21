'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Upload, User, Building2, Loader2, Trash2 } from 'lucide-react';
import { Topbar } from '@/components/layout/Shell';
import { getClientes, eliminarCliente } from '@/lib/db/clientes';
import type { Cliente } from '@fedatario/shared';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [filtrados, setFiltrados] = useState<Cliente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'fisica' | 'moral'>('todos');
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

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

  const handleEliminar = async (id: string) => {
    setEliminandoId(id);
    try {
      await eliminarCliente(id);
      setClientes(prev => prev.filter(c => c.id !== id));
    } finally {
      setEliminandoId(null);
      setConfirmandoId(null);
    }
  };

  return (
    <>
      <Topbar breadcrumb="Fedatario /" title="Clientes" />

      <main className="flex-1 p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white dark:text-white mb-2">Clientes</h1>
          <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Socios y personas registradas en el sistema</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400 text-sm mb-3">Total clientes</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white dark:text-white">{clientes.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-2">Registrados</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400 text-sm mb-3">Personas físicas</p>
            <p className="text-4xl font-bold text-blue-600 dark:text-blue-400">{fisicas}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-2">Individuos</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400 text-sm mb-3">Personas morales</p>
            <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">{morales}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-2">Empresas</p>
          </div>
        </div>

        {/* Buscador y acciones */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:border-gray-700">
            <Search size={18} className="text-gray-400" />
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, RFC, CURP..."
              className="flex-1 text-sm outline-none bg-transparent text-gray-900 dark:text-white dark:text-white" />
          </div>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value as any)}
            className="px-4 py-3 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 dark:border-gray-700 text-gray-900 dark:text-white dark:text-white text-sm font-semibold outline-none">
            <option value="todos">Todos</option>
            <option value="fisica">Personas físicas</option>
            <option value="moral">Personas morales</option>
          </select>
          <Link href="/clientes/nuevo"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-semibold text-sm whitespace-nowrap">
            <Plus size={18} /> Nuevo cliente
          </Link>
          <Link href="/clientes/carga-masiva"
            className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold text-sm whitespace-nowrap">
            <Upload size={18} /> Carga masiva
          </Link>
        </div>

        {/* Contenido */}
        {cargando ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-blue-600 animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-sm text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-900 dark:text-white dark:text-white font-semibold mb-2">{busqueda ? 'Sin resultados' : 'Sin clientes aún'}</p>
            <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400 text-sm mb-6">{busqueda ? 'Intenta con otro término' : 'Crea el primer cliente o usa carga masiva'}</p>
            {!busqueda && (
              <div className="flex gap-3 justify-center">
                <Link href="/clientes/nuevo"
                  className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-semibold text-sm">
                  Nuevo cliente
                </Link>
                <Link href="/clientes/carga-masiva"
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-semibold text-sm">
                  Carga masiva
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm overflow-hidden">
            {filtrados.map((cliente, i) => (
              <div key={cliente.id} className={`relative group flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${i > 0 ? 'border-t border-gray-50 dark:border-gray-700 dark:border-gray-700' : ''}`}>
                <Link href={`/clientes/${cliente.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-bold shrink-0">
                    {cliente.tipoPersona === 'moral'
                      ? <Building2 size={16} />
                      : cliente.nombre.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 dark:text-white dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{cliente.nombre}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">
                      {[cliente.rfc, cliente.curp].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 dark:text-gray-400 shrink-0">
                    {cliente.tipoPersona === 'fisica' ? 'Física' : 'Moral'}
                  </span>
                  {cliente.email && (
                    <p className="hidden lg:block text-xs text-gray-400 truncate max-w-[180px] shrink-0">{cliente.email}</p>
                  )}
                </Link>
                {/* Botón eliminar */}
                <div className="shrink-0">
                  {confirmandoId === cliente.id ? (
                    <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 rounded-xl shadow px-2 py-1 border border-gray-200 dark:border-gray-700 dark:border-gray-600">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 dark:text-gray-400">¿Eliminar?</span>
                      <button
                        onClick={() => handleEliminar(cliente.id!)}
                        disabled={eliminandoId === cliente.id}
                        className="text-[11px] font-bold px-1.5 py-0.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50">
                        {eliminandoId === cliente.id ? '...' : 'Sí'}
                      </button>
                      <button
                        onClick={() => setConfirmandoId(null)}
                        className="text-[11px] font-bold px-1.5 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600">
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmandoId(cliente.id!)}
                      className="p-1.5 rounded-xl hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Eliminar cliente">
                      <Trash2 size={13} className="text-gray-400 hover:text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
