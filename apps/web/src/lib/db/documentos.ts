import {
    collection, doc, getDocs, getDoc,
    addDoc, updateDoc, query, where,
    orderBy, serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import type { Documento, TipoDocumento, EstadoDocumento } from "@fedatario/shared";
import { getTenantId } from '@/lib/auth';

export async function getDocumentosInstrumento(
    instrumentoId: string
): Promise<Documento[]> {
    const q = query(
        collection(db, "documentos"),
        where("instrumentoId", "==", instrumentoId),
        orderBy("creadoEn", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Documento));
}

export async function getDocumentosCliente(
    clienteId: string
): Promise<Documento[]> {
    const q = query(
        collection(db, "documentos"),
        where("clienteId", "==", clienteId),
        orderBy("creadoEn", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Documento));
}

export async function getDocumentosPendientes(): Promise<Documento[]> {
    const q = query(
        collection(db, "documentos"),
        where("estado", "==", "pendiente"),
        orderBy("creadoEn", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Documento));
}

/** Obtiene todos los documentos del tenant (para la bandeja global). */
export async function getAllDocumentos(): Promise<Documento[]> {
    const q = query(
        collection(db, "documentos"),
        orderBy("creadoEn", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Documento));
}

/** Obtiene los documentos en la carpeta de integración de un instrumento, ordenados. */
export async function getDocumentosCarpeta(
    instrumentoId: string
): Promise<Documento[]> {
    const q = query(
        collection(db, "documentos"),
        where("carpetaInstrumentoId", "==", instrumentoId),
        orderBy("carpetaOrden", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Documento));
}

/** Agrega o actualiza un documento en la carpeta de integración de un instrumento. */
export async function agregarACarpeta(
    docId: string,
    instrumentoId: string,
    orden: number
): Promise<void> {
    await updateDoc(doc(db, "documentos", docId), {
        carpetaInstrumentoId: instrumentoId,
        carpetaOrden: orden,
    });
}

/** Remueve un documento de cualquier carpeta de integración. */
export async function removerDeCarpeta(docId: string): Promise<void> {
    await updateDoc(doc(db, "documentos", docId), {
        carpetaInstrumentoId: null,
        carpetaOrden: null,
    });
}

/** Reordena un documento dentro de la carpeta (cambia solo su orden). */
export async function reordenarEnCarpeta(
    docId: string,
    nuevoOrden: number
): Promise<void> {
    await updateDoc(doc(db, "documentos", docId), {
        carpetaOrden: nuevoOrden,
    });
}

export async function subirDocumento(
    file: File,
    clienteId: string,
    instrumentoId: string,
    tipo: TipoDocumento,
    tenantId: string
): Promise<{ id: string; url: string }> {
    const path = `pendientes/${tenantId}/${instrumentoId}/${clienteId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    const docRef = await addDoc(collection(db, "documentos"), {
        tenantId,
        clienteId,
        instrumentoId,
        tipo,
        nombre: file.name,
        storagePath: path,
        storageUrl: url,
        estado: "pendiente",
        datosExtraidos: {},
        creadoEn: serverTimestamp(),
    });
    return { id: docRef.id, url };
}

export async function aprobarDocumento(
    id: string,
    revisadoPor: string
): Promise<void> {
    await updateDoc(doc(db, "documentos", id), {
        estado: "aprobado" as EstadoDocumento,
        revisadoPor,
        revisadoEn: serverTimestamp(),
    });
}

export async function rechazarDocumento(
    id: string,
    nota: string,
    revisadoPor: string
): Promise<void> {
    await updateDoc(doc(db, "documentos", id), {
        estado: "rechazado" as EstadoDocumento,
        notaRevision: nota,
        revisadoPor,
        revisadoEn: serverTimestamp(),
    });
}

export async function guardarDatosExtraidos(
    id: string,
    datosExtraidos: Record<string, any>
): Promise<void> {
    await updateDoc(doc(db, "documentos", id), {
        datosExtraidos,
        estado: "aprobado" as EstadoDocumento,
    });
}

