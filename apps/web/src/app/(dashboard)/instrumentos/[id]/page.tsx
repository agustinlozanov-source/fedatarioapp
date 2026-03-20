'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db } from '@/lib/firebase'
import {
    FileText, Users, Building2, CheckCircle, AlertCircle,
    Loader2, Download, ChevronLeft, Shield, Hash, Briefcase,
    Pencil, Check, X, Circle, Copy, Link2, Upload as FileUp
} from 'lucide-react'

// ── TIPOS ─────────────────────────────────────────────────────────────────────

interface Socio {
    nombre_completo: string; genero: string; nacionalidad_pais: string
    lugar_nacimiento: string; fecha_nacimiento: string; estado_civil: string
    ocupacion: string
    domicilio?: { calle: string; numero: string; colonia: string; cp: string; ciudad: string; estado: string }
    rfc: string; curp: string; clave_elector: string; seccion_ine: string; idmex: string
    rol?: string; porcentaje?: number; clienteId?: string
    es_extranjero?: boolean
}

// Perfil completo del cliente leído de clientes/{id}
interface ClientePerfil {
    nombre_completo?: string
    curp?: string; rfc?: string; fecha_nacimiento?: string
    edad?: string          // override manual — si está, se usa directo en el acta
    lugar_nacimiento?: string; genero?: string; estado_civil?: string
    ocupacion?: string; nacionalidad?: string; regimen_fiscal?: string
    clave_elector?: string; seccion_ine?: string; idmex?: string; vigencia_ine?: string
    numero_pasaporte?: string; vigencia_pasaporte?: string
    numero_fm?: string; tipo_migratorio?: string; vigencia_fm?: string
    domicilio?: { calle?: string; numero?: string; colonia?: string; cp?: string; ciudad?: string; estado?: string; pais?: string }
}

interface Instrumento {
    id: string; tipo: string; tipo_sociedad?: string
    denominacion_social?: string; sociedadNombre?: string
    numero_poliza?: number; numeroInstrumento?: number; libro_registro?: number
    ciudad_fedatario?: string; fecha_instrumento?: string
    cud?: string; cudMUA?: string; solicitante_mua?: string; cudPdfUrl?: string
    domicilio_social?: string; domicilioSocial?: string
    capital_fijo?: number; capital_social?: number; capitalSocial?: number
    objeto_social_texto?: string; objetoSocial?: string
    socios?: Socio[]; estado: string; tenantId?: string; linkPortalToken?: string
}

interface DocInfo { clienteId: string; tipo: string; estado: string; datosExtraidos?: Record<string, any> }
interface Hallazgo { tipo: string; campo: string; descripcion: string; encontrado: string; esperado: string }
interface AuditoriaResult { ok: boolean; score: number; errores: Hallazgo[]; advertencias: Hallazgo[]; resumen: string }
interface BorradorResult { textoActa: string; auditoria: AuditoriaResult; campos_faltantes?: string[] }

const AGENTS_URL = process.env.NEXT_PUBLIC_AGENTS_URL || 'https://fedatario-production.up.railway.app'

const tipoLabel: Record<string, string> = {
    SA_de_CV: 'Sociedad Anónima de Capital Variable', sa_de_cv: 'Sociedad Anónima de Capital Variable',
    S_de_RL_de_CV: 'Sociedad de Responsabilidad Limitada de CV', s_de_rl: 'Sociedad de Responsabilidad Limitada de CV',
}
const rolLabel: Record<string, string> = {
    administrador_unico: 'Administrador Único', comisario: 'Comisario', socio: 'Accionista',
    representante_legal: 'Representante Legal', consejo_administracion: 'Consejo de Administración',
    secretario_consejo: 'Secretario del Consejo', apoderado: 'Apoderado',
}
const DOCS_REQUERIDOS_MX = ['ine', 'curp', 'rfc']
const DOCS_REQUERIDOS_EX = ['pasaporte', 'fm2', 'rfc', 'curp']
const DOC_LABEL: Record<string, string> = {
    ine: 'INE', curp: 'CURP', rfc: 'RFC',
    pasaporte: 'Pasaporte', fm2: 'FM2/FM3',
}

function formatFecha(f?: string) {
    if (!f) return undefined
    try { return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) }
    catch { return f }
}

function domicilioStr(d?: ClientePerfil['domicilio'] | string) {
    if (!d) return undefined
    if (typeof d === 'string') return d || undefined
    const partes = [
        d.calle,
        d.numero ? `No. ${d.numero}` : undefined,
        d.colonia ? `Col. ${d.colonia}` : undefined,
        d.cp ? `C.P. ${d.cp}` : undefined,
        d.ciudad,
        d.estado,
    ].filter(Boolean)
    return partes.length ? partes.join(', ') : undefined
}

function calcularEdad(fecha?: string, referencia?: string): string | undefined {
    if (!fecha) return undefined
    try {
        const nac = new Date(fecha + 'T12:00:00')
        const ref = referencia ? new Date(referencia + 'T12:00:00') : new Date()
        let edad = ref.getFullYear() - nac.getFullYear()
        const m = ref.getMonth() - nac.getMonth()
        if (m < 0 || (m === 0 && ref.getDate() < nac.getDate())) edad--
        return isNaN(edad) || edad < 0 ? undefined : `${edad} años`
    } catch { return undefined }
}

// ── COMPONENTES ───────────────────────────────────────────────────────────────

function CampoEditable({ label, value, onSave, tipo = 'text', fuente }: {
    label: string
    value: string | number | undefined
    onSave: ((val: string) => Promise<void>) | null  // null = solo lectura
    tipo?: 'text' | 'number' | 'date' | 'textarea'
    fuente?: string  // texto informativo del origen del dato
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(String(value ?? ''))
    const [saving, setSaving] = useState(false)
    const [copied, setCopied] = useState(false)

    const save = async () => {
        setSaving(true)
        await onSave!(draft)
        setSaving(false)
        setEditing(false)
    }

    const copiar = () => {
        if (!value) return
        navigator.clipboard.writeText(String(value))
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="flex items-start px-5 py-3 gap-4 group">
            <div className="w-40 flex-shrink-0">
                <span className="text-xs text-gray-400">{label}</span>
                {fuente && <div className="text-[10px] text-gray-300 mt-0.5">{fuente}</div>}
            </div>
            {editing ? (
                <div className="flex gap-2 flex-1">
                    {tipo === 'textarea' ? (
                        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={5}
                            className="flex-1 text-sm text-gray-800 font-medium border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-black resize-y" autoFocus />
                    ) : (
                        <input type={tipo} value={draft} onChange={e => setDraft(e.target.value)}
                            className="flex-1 text-sm text-gray-800 font-medium border border-gray-200 rounded-lg px-2 py-0.5 focus:outline-none focus:border-black" autoFocus />
                    )}
                    <div className="flex flex-col gap-1">
                        <button onClick={save} disabled={saving} className="p-1 rounded-md hover:bg-green-50 text-green-600 disabled:opacity-40">
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        </button>
                        <button onClick={() => { setDraft(String(value ?? '')); setEditing(false) }} className="p-1 rounded-md hover:bg-red-50 text-red-400">
                            <X size={13} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className={`text-sm text-gray-800 font-medium flex-1 ${tipo === 'textarea' ? 'whitespace-pre-wrap' : 'truncate'}`}>
                        {value ?? <span className="text-gray-300 italic text-xs">Sin datos</span>}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {value && (
                            <button onClick={copiar} className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors" title="Copiar">
                                {copied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                            </button>
                        )}
                        {onSave && (
                            <button onClick={() => { setDraft(String(value ?? '')); setEditing(true) }}
                                className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
                                <Pencil size={11} />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── PÁGINA PRINCIPAL ──────────────────────────────────────────────────────────

export default function InstrumentoDetallePage() {
    const { id } = useParams<{ id: string }>()
    const router = useRouter()
    const [instrumento, setInstrumento] = useState<Instrumento | null>(null)
    const [clientes, setClientes] = useState<Record<string, ClientePerfil>>({})   // clienteId → perfil
    const [documentosPorSocio, setDocumentosPorSocio] = useState<Record<string, DocInfo[]>>({})
    const [loading, setLoading] = useState(true)
    const [generando, setGenerando] = useState(false)
    const [descargando, setDescargando] = useState(false)
    const [exportandoDocs, setExportandoDocs] = useState(false)
    const [docsUrl, setDocsUrl] = useState<string | null>(null)
    const [borrador, setBorrador] = useState<BorradorResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [cudOk, setCudOk] = useState<string | null>(null)
    const [tabActiva, setTabActiva] = useState<string>('compendio')
    const [subiendoCud, setSubiendoCud] = useState(false)
    const cudInputRef = useRef<HTMLInputElement>(null)

    // ── Cargar instrumento + perfiles de clientes ─────────────────────────────
    useEffect(() => {
        if (!id) return
        const cargar = async () => {
            try {
                const snap = await getDoc(doc(db, 'instrumentos', id))
                if (!snap.exists()) { setError('Instrumento no encontrado'); return }
                const inst = { id: snap.id, ...snap.data() } as Instrumento
                setInstrumento(inst)

                // Cargar perfiles de todos los socios con clienteId
                const clienteIds = (inst.socios ?? []).map(s => s.clienteId).filter(Boolean) as string[]
                if (clienteIds.length > 0) {
                    const perfiles: Record<string, ClientePerfil> = {}
                    await Promise.all(clienteIds.map(async cid => {
                        try {
                            const cSnap = await getDoc(doc(db, 'clientes', cid))
                            if (cSnap.exists()) perfiles[cid] = cSnap.data() as ClientePerfil
                        } catch {}
                    }))
                    setClientes(perfiles)
                }
            } catch (e: any) { setError(e.message) }
            finally { setLoading(false) }
        }
        cargar()
    }, [id])

    // ── Escuchar documentos en tiempo real ────────────────────────────────────
    useEffect(() => {
        if (!id || !instrumento) return
        const clienteIds = (instrumento.socios ?? []).map((s: any) => s.clienteId).filter(Boolean) as string[]
        if (clienteIds.length === 0) return
        const q = query(
            collection(db, 'documentos_portal'),
            where('instrumentoId', '==', id),
            where('clienteId', 'in', clienteIds)
        )
        const unsub = onSnapshot(q, snap => {
            const porSocio: Record<string, DocInfo[]> = {}
            snap.docs.forEach(d => {
                const data = d.data()
                const cid = data.clienteId
                if (!porSocio[cid]) porSocio[cid] = []
                porSocio[cid].push({ clienteId: cid, tipo: data.tipo, estado: data.estado, datosExtraidos: data.datosExtraidos })
            })
            setDocumentosPorSocio(porSocio)
        })
        return () => unsub()
    }, [id, instrumento?.socios])

    const guardarCampo = async (campo: string, valor: any) => {
        if (!id) return
        const instActualizado = instrumento ? { ...instrumento, [campo]: valor } : null
        const { porcentaje } = instActualizado
            ? (() => {
                const i = instActualizado
                const faltantes: string[] = []
                if (!getNumPoliza(i)) faltantes.push('x')
                if (!i.fecha_instrumento) faltantes.push('x')
                if (!i.tipo) faltantes.push('x')
                if (!getDenominacion(i)) faltantes.push('x')
                if (!getDomicilio(i)) faltantes.push('x')
                if (!getCapital(i)) faltantes.push('x')
                if (!getObjeto(i)) faltantes.push('x')
                const socios = i.socios ?? []
                if (socios.length === 0) faltantes.push('x')
                socios.forEach(s => {
                    const p = getSocioPerfil(s)
                    if (!p.nombre_completo) faltantes.push('x')
                    if (!p.rfc) faltantes.push('x')
                    if (!p.curp) faltantes.push('x')
                    if (!p.fecha_nacimiento) faltantes.push('x')
                    if (!p.lugar_nacimiento) faltantes.push('x')
                    if (!p.genero) faltantes.push('x')
                    if (!p.ocupacion) faltantes.push('x')
                    if (!p.estado_civil) faltantes.push('x')
                    if (!p.domicilio) faltantes.push('x')
                    if (!s.rol) faltantes.push('x')
                })
                const totalCampos = 7 + Math.max(socios.length, 1) * 10
                return { porcentaje: Math.max(0, Math.round(((totalCampos - faltantes.length) / totalCampos) * 100)) }
              })()
            : { porcentaje: 0 }
        await updateDoc(doc(db, 'instrumentos', id), { [campo]: valor, completitud: porcentaje })
        setInstrumento(prev => prev ? { ...prev, [campo]: valor, completitud: porcentaje } : prev)
    }

    const guardarCampoCliente = async (clienteId: string, campo: string, valor: string) => {
        await updateDoc(doc(db, 'clientes', clienteId), { [campo]: valor })
        setClientes(prev => ({ ...prev, [clienteId]: { ...prev[clienteId], [campo]: valor } }))
    }

    const getDenominacion = (i: Instrumento) => i.denominacion_social || ''
    const getCapital = (i: Instrumento) => i.capital_social ?? i.capital_fijo ?? (i as any).capitalSocial
    const getObjeto = (i: Instrumento) => i.objeto_social_texto || (i as any).objetoSocial || ''
    const getCUD = (i: Instrumento) => i.cud || i.cudMUA || ''
    const getNumPoliza = (i: Instrumento) => i.numero_poliza ?? i.numeroInstrumento
    const getDomicilio = (i: Instrumento) => i.domicilio_social || ''

    // Devuelve el perfil del cliente fusionado con los datos del array de socios
    // Prioridad: clientes/{id} (AGT-02) > instrumento.socios[] (captura manual)
    const getSocioPerfil = (socio: Socio): ClientePerfil => {
        const base = clientes[socio.clienteId ?? ''] ?? {}
        return {
            nombre_completo: base.nombre_completo || socio.nombre_completo,
            curp:            base.curp            || socio.curp,
            rfc:             base.rfc             || socio.rfc,
            fecha_nacimiento:base.fecha_nacimiento|| socio.fecha_nacimiento,
            lugar_nacimiento:base.lugar_nacimiento|| socio.lugar_nacimiento,
            genero:          base.genero          || socio.genero,
            estado_civil:    base.estado_civil    || socio.estado_civil,
            ocupacion:       base.ocupacion       || socio.ocupacion,
            clave_elector:   base.clave_elector   || socio.clave_elector,
            seccion_ine:     base.seccion_ine     || socio.seccion_ine,
            idmex:           base.idmex           || socio.idmex,
            vigencia_ine:    base.vigencia_ine,
            numero_pasaporte:base.numero_pasaporte,
            vigencia_pasaporte: base.vigencia_pasaporte,
            numero_fm:       base.numero_fm,
            tipo_migratorio: base.tipo_migratorio,
            vigencia_fm:     base.vigencia_fm,
            domicilio:       base.domicilio       || socio.domicilio,
            nacionalidad:    base.nacionalidad,
            regimen_fiscal:  base.regimen_fiscal,
            edad:            base.edad,   // override manual desde clientes/{id}
        }
    }

    const calcularCompletitud = () => {
        if (!instrumento) return { porcentaje: 0, faltantes: [] as string[], puedeGenerar: false }
        
        const faltantes: string[] = []
        
        // ─ CAMPOS DEL INSTRUMENTO (6 REQUERIDOS - SIN HARDCODEADOS NI AUTO-LLENADOS) ─
        if (!getNumPoliza(instrumento)) faltantes.push('Instrumento: Número de póliza')
        if (!instrumento.fecha_instrumento) faltantes.push('Instrumento: Fecha del instrumento')
        if (!instrumento.tipo) faltantes.push('Instrumento: Tipo de sociedad')
        if (!getDenominacion(instrumento)) faltantes.push('Instrumento: Denominación social')
        if (!getDomicilio(instrumento)) faltantes.push('Instrumento: Domicilio social')
        if (!getCapital(instrumento)) faltantes.push('Instrumento: Capital fijo')
        if (!getObjeto(instrumento)) faltantes.push('Instrumento: Objeto social')

        const socios = instrumento.socios ?? []
        if (socios.length === 0) faltantes.push('Requerido: Al menos un socio')

        // ─ CAMPOS POR SOCIO (10 REQUERIDOS) ─
        socios.forEach((socio, i) => {
            const perfil = getSocioPerfil(socio)
            const nombre = perfil.nombre_completo || `Socio ${i + 1}`
            
            if (!perfil.nombre_completo) faltantes.push(`${nombre}: Nombre completo`)
            if (!perfil.rfc) faltantes.push(`${nombre}: RFC`)
            if (!perfil.curp) faltantes.push(`${nombre}: CURP`)
            if (!perfil.fecha_nacimiento) faltantes.push(`${nombre}: Fecha de nacimiento`)
            if (!perfil.lugar_nacimiento) faltantes.push(`${nombre}: Lugar de nacimiento`)
            if (!perfil.genero) faltantes.push(`${nombre}: Género`)
            if (!perfil.ocupacion) faltantes.push(`${nombre}: Ocupación`)
            if (!perfil.estado_civil) faltantes.push(`${nombre}: Estado civil`)
            if (!perfil.domicilio) faltantes.push(`${nombre}: Domicilio`)
            if (!socio.rol) faltantes.push(`${nombre}: Rol`)
        })

        // ─ CÁLCULO DE PORCENTAJE ─
        const totalCampos = 7 + Math.max(socios.length, 1) * 10
        const completados = totalCampos - faltantes.length
        const porcentaje = Math.max(0, Math.round((completados / totalCampos) * 100))
        
        // ─ PUEDE GENERAR SOLO SI NO HAY FALTANTES ─
        const puedeGenerar = faltantes.length === 0

        return { porcentaje, faltantes, puedeGenerar }
    }

    const generarBorrador = async () => {
        if (!instrumento) return
        setGenerando(true); setError(null)
        try {
            const res = await fetch(`${AGENTS_URL}/orquestador/generar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instrumento_id: id, generar_docx: false, datos_instrumento: instrumento }),
            })
            const data = await res.json()
            if (!data.ok) throw new Error('Error en orquestador: ' + JSON.stringify(data))
            const r = data.data
            setBorrador({
                textoActa: r.texto_acta,
                auditoria: { ok: r.auditoria_ok, score: r.score_auditoria, errores: r.errores_auditoria, advertencias: r.advertencias_auditoria, resumen: r.resumen_auditoria },
                campos_faltantes: r.campos_faltantes,
            })
            setTabActiva('borrador')
        } catch (e: any) { setError(e.message) }
        finally { setGenerando(false) }
    }

    const descargarDocx = async () => {
        if (!instrumento) return
        setDescargando(true)
        setError(null)
        try {
            const res = await fetch(`${AGENTS_URL}/docx/generar`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    texto_acta: borrador?.textoActa ?? '',
                    nombre_archivo: getDenominacion(instrumento).toLowerCase().replace(/\s+/g, '_') || 'acta',
                    nombres_socios: instrumento.socios?.map(s => s.nombre_completo) ?? [],
                    instrumento_id: id,
                })
            })
            if (!res.ok) {
                const txt = await res.text().catch(() => '')
                throw new Error(`Error ${res.status} generando .docx${txt ? ': ' + txt.slice(0, 200) : ''}`)
            }
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url; a.download = `${getDenominacion(instrumento) || 'acta'}_borrador.docx`; a.click()
            URL.revokeObjectURL(url)
        } catch (e: any) { setError(e.message) }
        finally { setDescargando(false) }
    }

    const exportarADocs = async () => {
        if (!instrumento) return
        setExportandoDocs(true)
        setError(null)
        try {
            const res = await fetch(`${AGENTS_URL}/docx/exportar-docs`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instrumento_id: id }),
            })
            if (!res.ok) {
                const txt = await res.text().catch(() => '')
                throw new Error(`Error ${res.status} exportando a Docs${txt ? ': ' + txt.slice(0, 200) : ''}`)
            }
            const data = await res.json()
            setDocsUrl(data.url)
            window.open(data.url, '_blank')
        } catch (e: any) { setError(e.message) }
        finally { setExportandoDocs(false) }
    }

    const subirPdfCud = async (file: File) => {
        if (!id || !instrumento) return
        setSubiendoCud(true)
        setCudOk(null)
        setError(null)
        try {
            // 1. Subir PDF a Storage
            const storageRef = ref(storage, `instrumentos/${id}/cud.pdf`)
            await uploadBytes(storageRef, file)
            const url = await getDownloadURL(storageRef)
            
            // 2. Procesar CUD en backend
            const formData = new FormData()
            formData.append('archivo', file)
            formData.append('instrumento_id', id)
            
            console.log('Enviando PDF a procesar-cud-pdf...')
            const respuesta = await fetch(`${AGENTS_URL}/procesar-cud-pdf`, {
                method: 'POST',
                body: formData
            })
            
            console.log('Respuesta del backend:', respuesta.status)
            
            if (!respuesta.ok) {
                const txt = await respuesta.text().catch(() => '')
                let msg = `Error ${respuesta.status}`
                try { msg = JSON.parse(txt).detail || msg } catch {}
                throw new Error(msg)
            }
            
            const datosprocesados = await respuesta.json()
            console.log('Datos procesados:', datosprocesados)
            
            // 3. Guardar URL del PDF y marcar como procesado
            await updateDoc(doc(db, 'instrumentos', id), { 
                cudPdfUrl: url,
                denominacion_social: datosprocesados.denominacion,
                cud: datosprocesados.cud,
                solicitante_mua: datosprocesados.nombre_solicitante,
                texto_resolucion: datosprocesados.texto_resolucion,
                mua_datos: {
                    cud: datosprocesados.cud,
                    denominacion: datosprocesados.denominacion,
                    nombre_solicitante: datosprocesados.nombre_solicitante,
                    texto_resolucion: datosprocesados.texto_resolucion,
                    confianza: datosprocesados.confianza,
                    errores: datosprocesados.errores,
                }
            })
            setInstrumento(prev => prev ? {
                ...prev,
                cudPdfUrl: url,
                denominacion_social: datosprocesados.denominacion || prev.denominacion_social,
                cud: datosprocesados.cud || prev.cud,
                solicitante_mua: datosprocesados.nombre_solicitante || prev.solicitante_mua,
            } : prev)
            setCudOk(`CUD procesado correctamente (${datosprocesados.confianza}% confianza)`)
            setTimeout(() => setCudOk(null), 4000)
        } catch (e: any) {
            setError('Error al subir PDF: ' + e.message)
        } finally {
            setSubiendoCud(false)
        }
    }

    if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-gray-400" size={32} /></div>
    if (error && !instrumento) return <div className="p-8 text-red-600">{error}</div>
    if (!instrumento) return null

    const { porcentaje, faltantes, puedeGenerar } = calcularCompletitud()
    const compendioListo = puedeGenerar   // ← ahora requiere TODOS los campos críticos
    const capital = getCapital(instrumento)
    const denominacion = getDenominacion(instrumento)
    const objeto = getObjeto(instrumento)
    const cud = getCUD(instrumento)
    const numPoliza = getNumPoliza(instrumento)

    const TABS = [
        { key: 'compendio', label: `Compendio · ${porcentaje}%` },
        { key: 'expediente', label: 'Expediente' },
        ...(instrumento.linkPortalToken ? [{ key: 'portal', label: 'Portal del Cliente' }] : []),
        { key: 'borrador', label: borrador ? `Borrador · ${borrador.auditoria.score}/100` : 'Borrador' },
    ] as const

    return (
        <div className="max-w-5xl mx-auto px-6 py-8">
            {/* Input CUD — siempre en el DOM para que el ref nunca se rompa */}
            <input
                ref={cudInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) subirPdfCud(f)
                    e.target.value = ''
                }}
            />
            {/* HEADER */}
            <div className="mb-8">
                <button onClick={() => router.push('/instrumentos')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors">
                    <ChevronLeft size={16} /> Instrumentos
                </button>
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-1">{instrumento.tipo?.replace(/_/g, ' ')}</p>
                        <h1 className="text-2xl font-bold text-gray-900">{denominacion || '—'}</h1>
                        {numPoliza && <p className="text-sm text-gray-500 mt-1">Póliza #{numPoliza}</p>}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={descargarDocx} disabled={descargando} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                            {descargando ? <><Loader2 size={15} className="animate-spin" /> Generando...</> : <><Download size={15} /> Descargar .docx</>}
                        </button>
                        <button onClick={exportarADocs} disabled={exportandoDocs} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                            {exportandoDocs ? <><Loader2 size={15} className="animate-spin" /> Exportando...</> : <><FileText size={15} /> Abrir en Google Docs</>}
                        </button>
                        <button onClick={generarBorrador} disabled={generando || !compendioListo}
                            title={!compendioListo ? `Campos faltantes: ${faltantes.join(' • ')}` : ''}
                            className="flex items-center gap-2 px-5 py-2 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            {generando ? <><Loader2 size={15} className="animate-spin" /> Generando...</> : <><FileText size={15} /> Generar Borrador</>}
                        </button>
                    </div>
                </div>

                {/* BARRA DE PROGRESO */}
                <div className="mt-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500">Compendio</span>
                        <span className="text-xs font-bold" style={{ color: porcentaje >= 80 ? '#1A9640' : '#E65100' }}>{porcentaje}%{porcentaje >= 80 ? ' · Listo para borrador' : ''}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${porcentaje}%`, background: porcentaje >= 80 ? '#1A9640' : '#0071E3' }} />
                    </div>
                </div>

            </div>

            {/* TABS */}
            <div className="flex gap-1 border-b border-gray-100 mb-6">
                {TABS.map(tab => (
                    <button key={tab.key} onClick={() => setTabActiva(tab.key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tabActiva === tab.key ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── TAB COMPENDIO ── */}
            {tabActiva === 'compendio' && (
                <div className="space-y-6">
                    {/* Instrumento */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3"><Hash size={13} /> Datos del Instrumento</h2>
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl divide-y divide-gray-50 dark:divide-gray-700">
                            <CampoEditable label="Número de póliza" value={numPoliza} tipo="number" onSave={v => guardarCampo('numero_poliza', Number(v))} />
                            <CampoEditable label="Fecha del instrumento" value={formatFecha(instrumento.fecha_instrumento)} onSave={v => guardarCampo('fecha_instrumento', v)} tipo="date" />
                        </div>
                    </section>

                    {/* Sociedad */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3"><Building2 size={13} /> Sociedad</h2>
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl divide-y divide-gray-50 dark:divide-gray-700">
                            <CampoEditable label="Denominación social" value={denominacion} onSave={v => guardarCampo('denominacion_social', v)} />
                            <CampoEditable label="Tipo de sociedad" value={tipoLabel[instrumento.tipo] ?? instrumento.tipo} onSave={null} />
                            <CampoEditable label="Domicilio social" value={getDomicilio(instrumento)} onSave={v => guardarCampo('domicilio_social', v)} />
                            <CampoEditable label="Capital social" value={capital} tipo="number" onSave={v => guardarCampo('capital_social', Number(v))} />
                        </div>
                    </section>

                    {/* MUA */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3"><Shield size={13} /> MUA</h2>
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl divide-y divide-gray-50 dark:divide-gray-700">
                            {/* Carga de PDF del CUD */}
                            <div className="px-5 py-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <FileUp size={13} className="text-gray-400" />
                                    <span className="text-xs text-gray-500 font-semibold">PDF del CUD</span>
                                </div>

                                {instrumento.cudPdfUrl ? (
                                    <div className="flex items-center gap-2">
                                        <a href={instrumento.cudPdfUrl} target="_blank" rel="noopener noreferrer"
                                            className="text-sm text-blue-600 hover:underline font-medium">Ver PDF</a>
                                        <button
                                            disabled={subiendoCud}
                                            onClick={() => cudInputRef.current?.click()}
                                            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40 cursor-pointer">
                                            {subiendoCud ? 'Subiendo...' : 'Cambiar'}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        disabled={subiendoCud}
                                        onClick={() => cudInputRef.current?.click()}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 disabled:opacity-40 transition-colors cursor-pointer">
                                        {subiendoCud
                                            ? <><Loader2 size={14} className="animate-spin" />Subiendo...</>
                                            : <><FileUp size={14} />Subir PDF</>}
                                    </button>
                                )}
                                {cudOk && (
                                    <div className="flex items-center gap-2 text-sm px-3 py-2 mt-3 rounded-lg bg-green-50 text-green-700">
                                        <CheckCircle size={14} /> {cudOk}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* Socios — datos desde clientes/{id} */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3"><Users size={13} /> Socios</h2>
                        <div className="space-y-4">
                            {(instrumento.socios ?? []).map((socio, i) => {
                                const cid = socio.clienteId
                                const perfil = getSocioPerfil(socio)
                                const esExtranjero = socio.es_extranjero ?? false
                                const docsReq = esExtranjero ? DOCS_REQUERIDOS_EX : DOCS_REQUERIDOS_MX
                                const docs = cid ? (documentosPorSocio[cid] ?? []) : []
                                const aprobados = docs.filter(d => d.estado === 'aprobado').map(d => d.tipo)

                                const salvarCliente = cid
                                    ? (campo: string) => async (v: string) => guardarCampoCliente(cid, campo, v)
                                    : () => async () => {}

                                return (
                                    <div key={i} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
                                        {/* Cabecera del socio */}
                                        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">
                                                    {(perfil.nombre_completo || '?').charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="text-sm font-semibold text-gray-800">{perfil.nombre_completo || 'Sin nombre'}</span>
                                                    {esExtranjero && <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">Extranjero</span>}
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium bg-black text-white px-2.5 py-0.5 rounded-full">{rolLabel[socio.rol || ''] || socio.rol || '—'}</span>
                                        </div>

                                        <div className="divide-y divide-gray-50 dark:divide-gray-700">
                                            {/* Datos personales — desde clientes/{id} */}
                                            <CampoEditable label="% Participación" value={socio.porcentaje != null ? String(socio.porcentaje) : ''} tipo="number" fuente="Formulario" onSave={async (v) => {
                                                const nuevos = (instrumento.socios ?? []).map((s, j) => j === i ? { ...s, porcentaje: Number(v) } : s)
                                                await guardarCampo('socios', nuevos)
                                            }} />
                                            <CampoEditable label="RFC" value={perfil.rfc} fuente="RFC / Constancia SAT" onSave={salvarCliente('rfc')} />
                                            <CampoEditable label="CURP" value={perfil.curp} fuente="CURP / INE" onSave={salvarCliente('curp')} />
                                            <CampoEditable label="Fecha de nacimiento" value={formatFecha(perfil.fecha_nacimiento)} fuente="INE / CURP" onSave={salvarCliente('fecha_nacimiento')} tipo="date" />
                                            <CampoEditable
                                                label="Edad"
                                                value={perfil.edad
                                                    ? (String(perfil.edad).includes('años') ? perfil.edad : `${perfil.edad} años`)
                                                    : calcularEdad(perfil.fecha_nacimiento, instrumento?.fecha_instrumento)
                                                }
                                                fuente={perfil.edad ? 'Manual' : `Al ${formatFecha(instrumento?.fecha_instrumento) ?? 'hoy'}`}
                                                onSave={salvarCliente('edad')}
                                                tipo="number"
                                            />
                                            <CampoEditable label="Lugar de nacimiento" value={perfil.lugar_nacimiento} fuente="CURP" onSave={salvarCliente('lugar_nacimiento')} />
                                            <CampoEditable label="Género" value={perfil.genero} onSave={salvarCliente('genero')} />
                                            <CampoEditable label="Estado civil" value={perfil.estado_civil} onSave={salvarCliente('estado_civil')} />
                                            <CampoEditable label="Ocupación" value={perfil.ocupacion} onSave={salvarCliente('ocupacion')} />
                                            <CampoEditable label="Domicilio" value={domicilioStr(perfil.domicilio)} fuente="INE / Comprobante" onSave={salvarCliente('domicilio')} />

                                            {/* Campos INE — solo mexicanos */}
                                            {!esExtranjero && <>
                                                <CampoEditable label="Clave de elector" value={perfil.clave_elector} fuente="INE" onSave={null} />
                                                <CampoEditable label="Sección INE" value={perfil.seccion_ine} fuente="INE" onSave={null} />
                                                <CampoEditable label="IDMEX" value={perfil.idmex} fuente="INE" onSave={null} />
                                                <CampoEditable label="Vigencia INE" value={perfil.vigencia_ine} fuente="INE" onSave={null} />
                                            </>}

                                            {/* Campos extranjero */}
                                            {esExtranjero && <>
                                                <CampoEditable label="No. Pasaporte" value={perfil.numero_pasaporte} fuente="Pasaporte" onSave={null} />
                                                <CampoEditable label="Vigencia Pasaporte" value={perfil.vigencia_pasaporte} fuente="Pasaporte" onSave={null} />
                                                <CampoEditable label="No. FM2/FM3" value={perfil.numero_fm} fuente="FM2/FM3" onSave={null} />
                                                <CampoEditable label="Tipo migratorio" value={perfil.tipo_migratorio} fuente="FM2/FM3" onSave={null} />
                                                <CampoEditable label="Vigencia FM" value={perfil.vigencia_fm} fuente="FM2/FM3" onSave={null} />
                                                <CampoEditable label="Nacionalidad" value={perfil.nacionalidad} fuente="Pasaporte" onSave={salvarCliente('nacionalidad')} />
                                            </>}
                                        </div>

                                        {/* Documentos */}
                                        {cid && (
                                            <div className="px-5 py-3 border-t border-gray-50 bg-gray-50/50">
                                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Documentos</p>
                                                <div className="flex gap-2 flex-wrap">
                                                    {docsReq.map(tipo => {
                                                        const ok = aprobados.includes(tipo)
                                                        return (
                                                            <span key={tipo} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium"
                                                                style={{ background: ok ? '#E8F5E9' : '#FFF3E0', color: ok ? '#1A9640' : '#E65100' }}>
                                                                {ok ? <CheckCircle size={11} /> : <Circle size={11} />} {DOC_LABEL[tipo]}
                                                            </span>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    {/* Objeto social */}
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3"><Briefcase size={13} /> Objeto Social</h2>
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl divide-y divide-gray-50 dark:divide-gray-700">
                            <CampoEditable label="Objeto social" value={objeto} tipo="textarea" onSave={v => guardarCampo('objeto_social_texto', v)} />
                        </div>
                    </section>
                </div>
            )}

            {/* ── TAB EXPEDIENTE ── */}
            {tabActiva === 'expediente' && (
                <div className="space-y-6">
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3"><Building2 size={13} /> Sociedad</h2>
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl divide-y divide-gray-50 dark:divide-gray-700">
                            {([
                                ['Denominación', denominacion], ['Tipo', tipoLabel[instrumento.tipo] ?? instrumento.tipo],
                                ['Domicilio social', getDomicilio(instrumento)],
                                ['Capital social', capital ? `$${capital.toLocaleString('es-MX')} MXN` : undefined],
                                ['CUD (MUA)', cud], ['Solicitante MUA', instrumento.solicitante_mua],
                                ['Póliza', numPoliza], ['Fecha instrumento', instrumento.fecha_instrumento],
                            ] as [string, any][]).map(([label, value]) => (
                                <div key={label} className="flex items-baseline px-5 py-3 gap-4">
                                    <span className="text-xs text-gray-400 w-36 flex-shrink-0">{label}</span>
                                    <span className="text-sm text-gray-800 font-medium">{value ?? <span className="text-gray-300 italic text-xs">—</span>}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                    <section>
                        <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3"><Users size={13} /> Socios ({instrumento.socios?.length ?? 0})</h2>
                        <div className="space-y-3">
                            {(instrumento.socios ?? []).map((socio, i) => {
                                const perfil = getSocioPerfil(socio)
                                return (
                                    <div key={i} className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="font-semibold text-gray-900">{perfil.nombre_completo || '—'}</p>
                                            <span className="text-xs font-mono bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg text-gray-500">{rolLabel[socio.rol || ''] || socio.rol || '—'}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                            {([
                                                ['RFC', perfil.rfc], ['CURP', perfil.curp],
                                                ['Nacimiento', perfil.fecha_nacimiento], ['Estado civil', perfil.estado_civil],
                                                ['Ocupación', perfil.ocupacion],
                                                ['Domicilio', domicilioStr(perfil.domicilio)],
                                            ] as [string, any][]).map(([label, value]) => (
                                                <div key={label} className="flex gap-2">
                                                    <span className="text-xs text-gray-400 w-24 flex-shrink-0">{label}</span>
                                                    <span className="text-xs text-gray-700 font-mono">{value ?? '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                    {objeto && (
                        <section>
                            <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3"><FileText size={13} /> Objeto Social</h2>
                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-5 py-4">
                                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{objeto}</p>
                            </div>
                        </section>
                    )}
                </div>
            )}

            {/* ── TAB PORTAL ── */}
            {tabActiva === 'portal' && (
                <div className="space-y-6">
                    {instrumento.linkPortalToken ? (
                        <section>
                            <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3"><Link2 size={13} /> Enlace del Portal</h2>
                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-5 py-4">
                                <p className="text-xs text-gray-500 mb-3">Comparte este enlace con los socios para que suban sus documentos:</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${instrumento.linkPortalToken}`}
                                        className="flex-1 text-sm text-gray-700 font-mono border border-gray-200 rounded-lg px-3 py-2 bg-gray-50"
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/portal/${instrumento.linkPortalToken}`)
                                            alert('Enlace copiado al portapapeles')
                                        }}
                                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                                    >
                                        Copiar enlace
                                    </button>
                                </div>
                            </div>
                        </section>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                            <FileText size={40} className="mb-4 opacity-30" />
                            <p className="text-sm">No hay enlace del portal generado aún</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── TAB BORRADOR ── */}
            {tabActiva === 'borrador' && (
                <div className="space-y-6">
                    {!borrador ? (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                            <FileText size={40} className="mb-4 opacity-30" />
                            <p className="text-sm">El borrador se generará aquí</p>
                            <p className="text-xs mt-1 opacity-60">
                                {compendioListo ? 'Haz clic en "Generar Borrador"' : `Faltan ${faltantes.length} campo${faltantes.length !== 1 ? 's' : ''} requerido${faltantes.length !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                    ) : (
                        <>
                            {(borrador.campos_faltantes ?? []).length > 0 && (
                                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                    <div><p className="font-semibold mb-1">Campos incompletos:</p><p>{borrador.campos_faltantes!.join(', ')}</p></div>
                                </div>
                            )}
                            <div className={`flex items-start gap-3 px-5 py-4 rounded-2xl border ${borrador.auditoria.ok ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                                {borrador.auditoria.ok ? <CheckCircle size={18} className="mt-0.5 flex-shrink-0" /> : <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />}
                                <div>
                                    <p className="font-semibold text-sm">{borrador.auditoria.resumen}</p>
                                    {borrador.auditoria.errores.map((e, i) => <p key={i} className="text-xs mt-1 opacity-80">❌ [{e.campo}] {e.descripcion}</p>)}
                                    {borrador.auditoria.advertencias.map((a, i) => <p key={i} className="text-xs mt-1 opacity-80">⚠️ [{a.campo}] {a.descripcion}</p>)}
                                </div>
                                <div className="ml-auto text-right"><p className="text-2xl font-bold">{borrador.auditoria.score}</p><p className="text-xs opacity-60">/ 100</p></div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2"><Shield size={14} className="text-gray-400" /><span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Texto del Acta — Borrador</span></div>
                                <div className="flex items-center gap-2">
                                    <button onClick={descargarDocx} disabled={descargando}
                                        className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl text-xs font-medium hover:bg-gray-800 disabled:opacity-40 transition-colors">
                                        {descargando ? <><Loader2 size={13} className="animate-spin" /> Generando...</> : <><Download size={13} /> Descargar .docx</>}
                                    </button>
                                    <button onClick={exportarADocs} disabled={exportandoDocs}
                                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                                        {exportandoDocs ? <><Loader2 size={13} className="animate-spin" /> Exportando...</> : <><FileText size={13} /> Abrir en Google Docs</>}
                                    </button>
                                </div>
                                </div>
                                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed max-h-[600px] overflow-y-auto">{borrador.textoActa}</pre>
                            </div>
                        </>
                    )}
                </div>
            )}

            {error && (
                <div className="mt-4 flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertCircle size={14} /> {error}
                </div>
            )}
        </div>
    )
}
