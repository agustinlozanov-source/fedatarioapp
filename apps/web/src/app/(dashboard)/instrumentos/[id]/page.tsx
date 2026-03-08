'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { FileText, Users, Building2, CheckCircle, AlertCircle, Loader2, Download, ChevronLeft, Shield } from 'lucide-react'

// ── Tipos ──────────────────────────────────────────────────────────────────
interface Socio {
    nombre_completo: string
    genero: string
    nacionalidad_pais: string
    lugar_nacimiento: string
    fecha_nacimiento: string
    estado_civil: string
    ocupacion: string
    domicilio: {
        calle: string; numero: string; colonia: string
        cp: string; ciudad: string; estado: string
    }
    rfc: string; curp: string
    clave_elector: string; seccion_ine: string; idmex: string
}

interface Instrumento {
    id: string
    tipo_sociedad: string
    denominacion_social: string
    numero_poliza?: number
    libro_registro?: number
    ciudad_fedatario?: string
    fecha_instrumento?: string
    cud?: string
    solicitante_mua?: string
    domicilio_social?: string
    capital_fijo?: number
    objeto_social_texto?: string
    socios?: Socio[]
    estado: string
    creadoEn?: any
}

interface Hallazgo {
    tipo: string; campo: string
    descripcion: string; encontrado: string; esperado: string
}

interface AuditoriaResult {
    ok: boolean; score: number
    errores: Hallazgo[]; advertencias: Hallazgo[]; resumen: string
}

interface BorradorResult {
    textoActa: string
    auditoria: AuditoriaResult
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const AGENTS_URL = process.env.NEXT_PUBLIC_AGENTS_URL || 'http://localhost:5001'

const tipoLabel: Record<string, string> = {
    SA_de_CV: 'Sociedad Anónima de Capital Variable',
    'S_de_RL_de_CV': 'Sociedad de Responsabilidad Limitada de CV',
}

// ── Componente principal ────────────────────────────────────────────────────
export default function InstrumentoDetallePage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()

    const [instrumento, setInstrumento] = useState<Instrumento | null>(null)
    const [loading, setLoading] = useState(true)
    const [generando, setGenerando] = useState(false)
    const [borrador, setBorrador] = useState<BorradorResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [tabActiva, setTabActiva] = useState<'expediente' | 'borrador'>('expediente')

    // Cargar instrumento desde Firestore
    useEffect(() => {
        if (!id) return
        const cargar = async () => {
            try {
                const snap = await getDoc(doc(db, 'instrumentos', id))
                if (!snap.exists()) { setError('Instrumento no encontrado'); return }
                setInstrumento({ id: snap.id, ...snap.data() } as Instrumento)
            } catch (e: any) {
                setError(e.message)
            } finally {
                setLoading(false)
            }
        }
        cargar()
    }, [id])

    // Generar borrador — llama AGT-04 + AGT-05
    const generarBorrador = async () => {
        if (!instrumento) return
        setGenerando(true)
        setError(null)
        try {
            // 1. AGT-04 Redactor
            const resRedactor = await fetch(`${AGENTS_URL}/redactor/generar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    numero_poliza: instrumento.numero_poliza ?? 0,
                    libro_registro: instrumento.libro_registro ?? 5,
                    ciudad_fedatario: instrumento.ciudad_fedatario ?? 'MATAMOROS',
                    fecha_instrumento: instrumento.fecha_instrumento ?? new Date().toISOString().split('T')[0],
                    tipo_sociedad: instrumento.tipo_sociedad,
                    denominacion_social: instrumento.denominacion_social,
                    cud: instrumento.cud ?? '',
                    solicitante_mua: instrumento.solicitante_mua ?? '',
                    domicilio_social: instrumento.domicilio_social ?? '',
                    capital_fijo: instrumento.capital_fijo ?? 100000,
                    objeto_social_texto: instrumento.objeto_social_texto ?? '',
                    socios: instrumento.socios ?? [],
                }),
            })
            const dataRedactor = await resRedactor.json()
            if (!dataRedactor.ok) throw new Error('Error en AGT-04: ' + JSON.stringify(dataRedactor))
            const textoActa: string = dataRedactor.data.texto_acta

            // 2. AGT-05 Auditor
            const resAuditor = await fetch(`${AGENTS_URL}/auditor/verificar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texto_acta: textoActa,
                    datos: {
                        numero_poliza: instrumento.numero_poliza ?? 0,
                        libro_registro: instrumento.libro_registro ?? 5,
                        ciudad_fedatario: instrumento.ciudad_fedatario ?? 'MATAMOROS',
                        fecha_instrumento: instrumento.fecha_instrumento ?? new Date().toISOString().split('T')[0],
                        tipo_sociedad: instrumento.tipo_sociedad,
                        denominacion_social: instrumento.denominacion_social,
                        cud: instrumento.cud ?? '',
                        solicitante_mua: instrumento.solicitante_mua ?? '',
                        domicilio_social: instrumento.domicilio_social ?? '',
                        capital_fijo: instrumento.capital_fijo ?? 100000,
                        objeto_social_texto: instrumento.objeto_social_texto ?? '',
                        socios: instrumento.socios ?? [],
                    },
                }),
            })
            const dataAuditor = await resAuditor.json()
            if (!dataAuditor.ok) throw new Error('Error en AGT-05: ' + JSON.stringify(dataAuditor))

            setBorrador({ textoActa, auditoria: dataAuditor.data })
            setTabActiva('borrador')
        } catch (e: any) {
            setError(e.message)
        } finally {
            setGenerando(false)
        }
    }

    // Descargar como .docx
    const descargarDocx = async () => {
        if (!borrador) return
        try {
            const res = await fetch(`${AGENTS_URL}/docx/generar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texto_acta: borrador.textoActa,
                    nombre_archivo: instrumento?.denominacion_social
                        ?.toLowerCase().replace(/\s+/g, '_') ?? 'acta',
                    nombres_socios: instrumento?.socios?.map((s: any) => s.nombre_completo) ?? [],
                    instrumento_id: id
                })
            })
            if (!res.ok) throw new Error('Error generando .docx')
            const blob = await res.blob()
            const url  = URL.createObjectURL(blob)
            const a    = document.createElement('a')
            a.href     = url
            a.download = `${instrumento?.denominacion_social ?? 'acta'}_borrador.docx`
            a.click()
            URL.revokeObjectURL(url)
        } catch (e: any) {
            setError(e.message)
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-gray-400" size={32} />
        </div>
    )

    if (error && !instrumento) return (
        <div className="p-8 text-red-600">{error}</div>
    )

    if (!instrumento) return null

    const expedienteCompleto = !!(
        instrumento.socios?.length &&
        instrumento.cud &&
        instrumento.objeto_social_texto &&
        instrumento.capital_fijo &&
        instrumento.numero_poliza
    )

    return (
        <div className="max-w-5xl mx-auto px-6 py-8">

            {/* Header */}
            <div className="mb-8">
                <button
                    onClick={() => router.push('/instrumentos')}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
                >
                    <ChevronLeft size={16} /> Instrumentos
                </button>
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">
                            {instrumento.tipo_sociedad?.replace(/_/g, ' ')}
                        </p>
                        <h1 className="text-2xl font-bold text-gray-900">{instrumento.denominacion_social}</h1>
                        {instrumento.numero_poliza && (
                            <p className="text-sm text-gray-500 mt-1">Póliza #{instrumento.numero_poliza}</p>
                        )}
                    </div>
                    <div className="flex gap-3">
                        {borrador && borrador.auditoria.score >= 90 && (
                            <button
                                onClick={descargarDocx}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <Download size={15} /> Descargar borrador
                            </button>
                        )}
                        <button
                            onClick={generarBorrador}
                            disabled={generando || !expedienteCompleto}
                            className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            {generando
                                ? <><Loader2 size={15} className="animate-spin" /> Generando...</>
                                : <><FileText size={15} /> Generar Borrador</>
                            }
                        </button>
                    </div>
                </div>

                {!expedienteCompleto && (
                    <div className="mt-4 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        <AlertCircle size={14} />
                        Expediente incompleto — faltan datos para generar el acta.
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-100 mb-6">
                {(['expediente', 'borrador'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setTabActiva(tab)}
                        className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tabActiva === tab
                            ? 'border-black text-black'
                            : 'border-transparent text-gray-400 hover:text-gray-700'
                            }`}
                    >
                        {tab === 'borrador' ? `Borrador${borrador ? ` · ${borrador.auditoria.score}/100` : ''}` : 'Expediente'}
                    </button>
                ))}
            </div>

            {/* Tab: Expediente */}
            {tabActiva === 'expediente' && (
                <div className="space-y-6">

                    {/* Datos de la sociedad */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                            <Building2 size={13} /> Sociedad
                        </h2>
                        <div className="bg-white border border-gray-100 rounded-2xl divide-y divide-gray-50">
                            {[
                                ['Denominación', instrumento.denominacion_social],
                                ['Tipo', tipoLabel[instrumento.tipo_sociedad] ?? instrumento.tipo_sociedad],
                                ['Domicilio social', instrumento.domicilio_social],
                                ['Capital fijo', instrumento.capital_fijo ? `$${instrumento.capital_fijo.toLocaleString('es-MX')} MXN` : '—'],
                                ['CUD (MUA)', instrumento.cud],
                                ['Solicitante MUA', instrumento.solicitante_mua],
                                ['Póliza', instrumento.numero_poliza],
                                ['Fecha instrumento', instrumento.fecha_instrumento],
                            ].map(([label, value]) => (
                                <div key={label as string} className="flex items-baseline px-5 py-3 gap-4">
                                    <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
                                    <span className="text-sm text-gray-800 font-medium">{value ?? '—'}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Socios */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                            <Users size={13} /> Socios ({instrumento.socios?.length ?? 0})
                        </h2>
                        <div className="space-y-3">
                            {(instrumento.socios ?? []).map((socio, i) => (
                                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-3">
                                        <p className="font-semibold text-gray-900">{socio.nombre_completo}</p>
                                        <span className="text-xs font-mono bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg text-gray-500">
                                            {i === 0
                                                ? instrumento.tipo_sociedad === 'SA_de_CV' ? 'Administrador Único' : 'Gerente General'
                                                : instrumento.tipo_sociedad === 'SA_de_CV' ? 'Comisario' : 'Socio'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                        {[
                                            ['RFC', socio.rfc],
                                            ['CURP', socio.curp],
                                            ['Nacimiento', socio.fecha_nacimiento],
                                            ['Estado civil', socio.estado_civil],
                                            ['Ocupación', socio.ocupacion],
                                            ['Domicilio', socio.domicilio ? `${socio.domicilio.calle} ${socio.domicilio.numero}, ${socio.domicilio.colonia}, ${socio.domicilio.cp}` : '—'],
                                        ].map(([label, value]) => (
                                            <div key={label as string} className="flex gap-2">
                                                <span className="text-xs text-gray-400 w-24 flex-shrink-0">{label}</span>
                                                <span className="text-xs text-gray-700 font-mono">{value ?? '—'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Objeto social */}
                    {instrumento.objeto_social_texto && (
                        <section>
                            <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                                <FileText size={13} /> Objeto Social
                            </h2>
                            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-4">
                                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                    {instrumento.objeto_social_texto}
                                </p>
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* Tab: Borrador */}
            {tabActiva === 'borrador' && (
                <div className="space-y-6">
                    {!borrador ? (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                            <FileText size={40} className="mb-4 opacity-30" />
                            <p className="text-sm">El borrador se generará aquí</p>
                            <p className="text-xs mt-1 opacity-60">Haz clic en "Generar Borrador" para comenzar</p>
                        </div>
                    ) : (
                        <>
                            {/* Resultado auditoría */}
                            <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border ${borrador.auditoria.ok
                                ? 'bg-green-50 border-green-100 text-green-800'
                                : 'bg-red-50 border-red-100 text-red-800'
                                }`}>
                                {borrador.auditoria.ok
                                    ? <CheckCircle size={18} className="mt-0.5 flex-shrink-0" />
                                    : <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
                                }
                                <div>
                                    <p className="font-semibold text-sm">{borrador.auditoria.resumen}</p>
                                    {borrador.auditoria.errores.map((e, i) => (
                                        <p key={i} className="text-xs mt-1 opacity-80">
                                            ❌ [{e.campo}] {e.descripcion}
                                        </p>
                                    ))}
                                    {borrador.auditoria.advertencias.map((a, i) => (
                                        <p key={i} className="text-xs mt-1 opacity-80">
                                            ⚠️ [{a.campo}] {a.descripcion}
                                        </p>
                                    ))}
                                </div>
                                <div className="ml-auto text-right">
                                    <p className="text-2xl font-bold">{borrador.auditoria.score}</p>
                                    <p className="text-xs opacity-60">/ 100</p>
                                </div>
                            </div>

                            {/* Texto del acta */}
                            <div className="bg-white border border-gray-100 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Shield size={14} className="text-gray-400" />
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                                        Texto del Acta — Borrador
                                    </span>
                                </div>
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-[600px] overflow-y-auto">
                                    {borrador.textoActa}
                                </pre>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Error inline */}
            {error && (
                <div className="mt-4 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertCircle size={14} /> {error}
                </div>
            )}
        </div>
    )
}
