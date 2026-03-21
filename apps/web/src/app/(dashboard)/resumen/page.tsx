'use client'

import { Topbar } from '@/components/layout/Shell'
import { TrendingUp, TrendingDown, FileCheck, Users, MoreVertical } from 'lucide-react'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function ResumenPage() {
  const [stats, setStats] = useState({
    totalInstrumentos: 0,
    instrumentosAprobados: 0,
    documentosGenerados: 0,
    clientesActivos: 0,
  })

  useEffect(() => {
    const cargarStats = async () => {
      try {
        const instrumentosRef = collection(db, 'instrumentos')
        const docsAprobados = await getDocs(query(instrumentosRef, where('estado', '==', 'aprobado')))
        const todosDocs = await getDocs(instrumentosRef)
        
        setStats({
          totalInstrumentos: todosDocs.size,
          instrumentosAprobados: docsAprobados.size,
          documentosGenerados: docsAprobados.size,
          clientesActivos: Math.floor(todosDocs.size / 2),
        })
      } catch (error) {
        console.error('Error cargando stats:', error)
      }
    }
    cargarStats()
  }, [])

  return (
    <>
      <Topbar breadcrumb="Inicio" title="Resumen General" />
      
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Bienvenido, Corredor!</h1>
          <p className="text-gray-600 dark:text-gray-400 dark:text-gray-400">Resumen de tu actividad de fe pública</p>
        </div>

        {/* Grid de Widgets */}
        <div className="grid grid-cols-3 gap-6">
          {/* Column 1 - Instrumentos por Estado */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Instrumentos por Estado</h3>
            
            <div className="space-y-4">
              {[
                { label: 'Aprobados', value: stats.instrumentosAprobados, color: 'bg-blue-500' },
                { label: 'Pendientes', value: Math.max(0, stats.totalInstrumentos - stats.instrumentosAprobados), color: 'bg-gray-400' },
                { label: 'En Revisión', value: Math.floor(stats.totalInstrumentos / 3), color: 'bg-black' },
              ].map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 dark:text-gray-300">{item.label}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white dark:text-white">{item.value}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className={`h-full ${item.color}`}
                      style={{ width: `${Math.min((item.value / stats.totalInstrumentos) * 100 || 0, 100)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2 - Documentos Generados */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white dark:text-white">Documentos Generados</h3>
              <span className="text-2xl font-bold text-blue-600">+{Math.floor(stats.documentosGenerados * 0.15)}%</span>
            </div>

            <div className="mb-6">
              <p className="text-4xl font-bold text-gray-900 dark:text-white dark:text-white">{stats.documentosGenerados}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">esta semana</p>
            </div>

            <div className="flex items-end gap-3 h-32">
              {[65, 45, 72, 35, 82, 55, 90].map((height, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-blue-500 rounded-t-lg" style={{ height: `${height}%` }}></div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">D{i + 1}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3 - Featured Card */}
          <div className="bg-black rounded-3xl p-6 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-48 h-48 opacity-20">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10">
              <p className="text-blue-400 text-sm font-semibold mb-2">NUEVA FUNCIÓN</p>
              <h3 className="text-white text-2xl font-bold mb-2">Auditoría Automática</h3>
              <p className="text-gray-400 text-sm mb-4">Verifica automáticamente documentos en tiempo real</p>
              
              <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-full transition-colors text-sm">
                Activar Ahora
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-3 gap-6 mt-6">
          {/* Estadísticas Rápidas */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <p className="text-gray-600 dark:text-gray-400 text-sm">Clientes Activos</p>
              <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                <MoreVertical size={18} className="text-gray-400" />
              </button>
            </div>
            <p className="text-4xl font-bold text-gray-900 dark:text-white mb-4">{stats.clientesActivos}</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-green-500">
                <TrendingUp size={16} />
                <span className="text-sm font-semibold">+8.2%</span>
              </div>
              <span className="text-gray-500 dark:text-gray-400 text-sm">vs mes pasado</span>
            </div>
          </div>

          {/* Últimas Acciones */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Últimas Acciones</h3>
            <div className="space-y-3">
              {[
                { icon: FileCheck, label: 'Documento generado', time: 'hace 2h' },
                { icon: Users, label: 'Cliente agregado', time: 'hace 5h' },
                { icon: FileCheck, label: 'Acta firmada', time: 'ayer' },
              ].map((item, idx) => {
                const Icon = item.icon
                return (
                  <div key={idx} className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700 last:border-0">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center">
                      <Icon size={16} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white dark:text-white">{item.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400">{item.time}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Metadatos */}
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Indicadores Clave</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Tasa de Aprobación</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">
                  {stats.totalInstrumentos > 0 
                    ? Math.round((stats.instrumentosAprobados / stats.totalInstrumentos) * 100)
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Tiempo Promedio</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white dark:text-white">2.3 días</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
