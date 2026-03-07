import {
    collection, doc, getDocs, getDoc, addDoc,
    updateDoc, query, where, orderBy, serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import type { DocumentoPortal, MensajeChat, ClientePortal, EtapaPipeline } from "@fedatario/shared";

// ── DOCUMENTOS PORTAL ─────────────────────────

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

export async function subirDocumento(
    file: File,
    instrumentoId: string,
    clienteId: string,
    tipo: string,
    tenantId: string
): Promise<string> {
    // Subir a Storage en carpeta temporal (pendiente de aprobación)
    const path = `pendientes/${tenantId}/${instrumentoId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    // Registrar en Firestore
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

// ── CHAT ──────────────────────────────────────

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

// ── PIPELINE VISUAL ───────────────────────────

export async function getEtapasPipeline(tenantId: string): Promise<EtapaPipeline[]> {
    const snap = await getDoc(doc(db, "pipeline_config", tenantId));
    if (!snap.exists()) return ETAPAS_DEFAULT;
    return snap.data().etapas as EtapaPipeline[];
}

export async function guardarEtapasPipeline(tenantId: string, etapas: EtapaPipeline[]): Promise<void> {
    await updateDoc(doc(db, "pipeline_config", tenantId), { etapas });
}

export const ETAPAS_DEFAULT: EtapaPipeline[] = [
    { id: 'e1', orden: 1, nombreInterno: 'borrador', nombreCliente: 'Inicio', descripcionCliente: 'Hemos recibido tu solicitud y estamos preparando todo.', icono: '📋', color: '#86868B' },
    { id: 'e2', orden: 2, nombreInterno: 'extraccion', nombreCliente: 'Documentación', descripcionCliente: 'Estamos revisando y procesando tus documentos.', icono: '📄', color: '#0071E3' },
    { id: 'e3', orden: 3, nombreInterno: 'validacion_juridica', nombreCliente: 'Validación legal', descripcionCliente: 'Nuestro equipo valida que todo esté correcto legalmente.', icono: '⚖️', color: '#FF9500' },
    { id: 'e4', orden: 4, nombreInterno: 'redaccion', nombreCliente: 'Redacción del acta', descripcionCliente: 'Estamos redactando tu acta constitutiva.', icono: '✍️', color: '#5AC8FA' },
    { id: 'e5', orden: 5, nombreInterno: 'revision_corredor', nombreCliente: 'Revisión final', descripcionCliente: 'El Corredor Público está revisando tu acta antes de la firma.', icono: '🔍', color: '#AF52DE' },
    { id: 'e6', orden: 6, nombreInterno: 'firmado', nombreCliente: '¡Lista para firmar!', descripcionCliente: 'Tu acta está lista. Te contactaremos para la cita de firma.', icono: '✅', color: '#1A9640' },
];
