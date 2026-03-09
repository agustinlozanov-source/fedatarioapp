import {
    collection, doc, getDocs, getDoc, addDoc,
    updateDoc, query, where, orderBy, serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import type { DocumentoPortal, MensajeChat, EtapaPipeline } from "@fedatario/shared";

const AGENTS_URL = process.env.NEXT_PUBLIC_AGENTS_URL || 'http://localhost:5001';

// ── DOCUMENTOS PORTAL ─────────────────────────────────────────────────────────

export async function getDocumentosInstrumento(instrumentoId: string): Promise<DocumentoPortal[]> {
    const q = query(
        collection(db, "documentos_portal"),
        where("instrumentoId", "==", instrumentoId),
        orderBy("creadoEn", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentoPortal));
}

export async function getDocumentosPendientes(): Promise<DocumentoPortal[]> {
    const q = query(
        collection(db, "documentos_portal"),
        where("estado", "==", "pendiente"),
        orderBy("creadoEn", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as DocumentoPortal));
}

/**
 * Sube un documento a Firebase Storage, lo registra en Firestore,
 * y llama automáticamente al AGT-02 para extraer los datos.
 *
 * Los datos extraídos quedan en documentos_portal/{id}.datosExtraidos
 * listos para que AGT-01 los consolide al generar el acta.
 */
export async function subirDocumentoConExtraccion(
    file: File,
    instrumentoId: string,
    clienteId: string,
    tipo: string,
    tenantId: string,
): Promise<string> {
    // 1. Subir archivo a Firebase Storage
    const path = `pendientes/${tenantId}/${instrumentoId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    // 2. Registrar en Firestore con estado "en_revision"
    const docRef = await addDoc(collection(db, "documentos_portal"), {
        tenantId,
        clienteId,
        instrumentoId,
        tipo,
        nombre: file.name,
        storageUrl: url,
        storagePath: path,
        estado: "en_revision",
        creadoEn: serverTimestamp(),
    });

    const documentoId = docRef.id;

    // 3. Llamar a AGT-02 para extraer datos (fire and forget — no bloquea la UI)
    try {
        const formData = new FormData();
        formData.append('archivo', file);
        formData.append('tipo_documento', tipo);
        formData.append('documento_id', documentoId);
        formData.append('cliente_id', clienteId);   // ← sincroniza a clientes/{id}

        const res = await fetch(`${AGENTS_URL}/extractor/archivo`, {
            method: 'POST',
            body: formData,
        });

        if (res.ok) {
            // AGT-02 ya actualizó el documento en Firestore con datosExtraidos
            // El estado queda en "aprobado" automáticamente si la extracción fue exitosa
            console.log(`AGT-02: documento ${documentoId} procesado correctamente`);
        } else {
            // Si falla la extracción, el documento queda en "en_revision" para revisión manual
            console.warn(`AGT-02: extracción falló para ${documentoId}, queda en revisión manual`);
        }
    } catch (e) {
        // No interrumpir el flujo si el agente no está disponible
        console.warn('AGT-02 no disponible, documento queda en revisión manual:', e);
    }

    return documentoId;
}

/**
 * Versión original sin extracción automática (para uso desde el dashboard).
 */
export async function subirDocumento(
    file: File,
    instrumentoId: string,
    clienteId: string,
    tipo: string,
    tenantId: string,
): Promise<string> {
    const path = `pendientes/${tenantId}/${instrumentoId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const docRef = await addDoc(collection(db, "documentos_portal"), {
        tenantId,
        clienteId,
        instrumentoId,
        tipo,
        nombre: file.name,
        storageUrl: url,
        storagePath: path,
        estado: "pendiente",
        creadoEn: serverTimestamp(),
    });

    return docRef.id;
}

export async function aprobarDocumento(id: string, revisadoPor: string): Promise<void> {
    await updateDoc(doc(db, "documentos_portal", id), {
        estado: "aprobado",
        revisadoPor,
        revisadoEn: serverTimestamp(),
    });
}

export async function rechazarDocumento(id: string, nota: string, revisadoPor: string): Promise<void> {
    await updateDoc(doc(db, "documentos_portal", id), {
        estado: "rechazado",
        notaRevision: nota,
        revisadoPor,
        revisadoEn: serverTimestamp(),
    });
}

// ── CHAT ──────────────────────────────────────────────────────────────────────

export async function getMensajes(instrumentoId: string): Promise<MensajeChat[]> {
    const q = query(
        collection(db, "chat"),
        where("instrumentoId", "==", instrumentoId),
        orderBy("creadoEn", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as MensajeChat));
}

export async function guardarMensaje(msg: Omit<MensajeChat, "id" | "creadoEn">): Promise<void> {
    await addDoc(collection(db, "chat"), {
        ...msg,
        creadoEn: serverTimestamp(),
    });
}

// ── PIPELINE VISUAL ───────────────────────────────────────────────────────────

export async function getEtapasPipeline(tenantId: string): Promise<EtapaPipeline[]> {
    const snap = await getDoc(doc(db, "pipeline_config", tenantId));
    if (!snap.exists()) return ETAPAS_DEFAULT;
    return snap.data().etapas as EtapaPipeline[];
}

export async function guardarEtapasPipeline(tenantId: string, etapas: EtapaPipeline[]): Promise<void> {
    await updateDoc(doc(db, "pipeline_config", tenantId), { etapas });
}

export const ETAPAS_DEFAULT: EtapaPipeline[] = [
    { id: 'e1', orden: 1, nombreInterno: 'paso_03_datos_basicos', nombreCliente: 'Inicio', descripcionCliente: 'Hemos recibido tu solicitud y estamos preparando todo.', icono: '📋', color: '#86868B' },
    { id: 'e2', orden: 2, nombreInterno: 'paso_05_portal_en_progreso', nombreCliente: 'Documentación', descripcionCliente: 'Sube tus documentos para que podamos procesarlos.', icono: '📄', color: '#0071E3' },
    { id: 'e3', orden: 3, nombreInterno: 'paso_07_acopio_completo', nombreCliente: 'Validación legal', descripcionCliente: 'Nuestro equipo valida que todo esté correcto.', icono: '⚖️', color: '#FF9500' },
    { id: 'e4', orden: 4, nombreInterno: 'paso_08_redaccion', nombreCliente: 'Redacción del acta', descripcionCliente: 'Estamos redactando tu acta constitutiva.', icono: '✍️', color: '#5AC8FA' },
    { id: 'e5', orden: 5, nombreInterno: 'paso_09_borrador_enviado', nombreCliente: 'Revisión final', descripcionCliente: 'El Corredor Público está revisando tu acta antes de la firma.', icono: '🔍', color: '#AF52DE' },
    { id: 'e6', orden: 6, nombreInterno: 'paso_10_firma', nombreCliente: '¡Lista para firmar!', descripcionCliente: 'Tu acta está lista. Te contactaremos para la cita de firma.', icono: '✅', color: '#1A9640' },
];
