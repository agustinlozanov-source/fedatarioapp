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

export async function subirDocumento(
    file: File,
    clienteId: string,
    instrumentoId: string,
    tipo: TipoDocumento,
    tenantId: string
): Promise<string> {
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
    return docRef.id;
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
