import {
    collection, doc, getDocs, getDoc,
    addDoc, updateDoc, deleteDoc, query, where, orderBy,
    serverTimestamp
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { Instrumento, EstadoInstrumento, SocioInstrumento } from "@fedatario/shared";
import { getTenantId } from '@/lib/auth';

function generarToken(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function getInstrumentos(): Promise<Instrumento[]> {
    const tenantId = await getTenantId();
    const q = query(
        collection(db, "instrumentos"),
        where("tenantId", "==", tenantId),
        orderBy("creadoEn", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Instrumento));
}

export async function getInstrumento(id: string): Promise<Instrumento | null> {
    const snap = await getDoc(doc(db, "instrumentos", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Instrumento;
}

export async function crearInstrumento(
    data: Omit<Instrumento, "id" | "creadoEn" | "actualizadoEn" | "linkPortalToken" | "linkActivo" | "socios" | "seccionesActivas" | "pipeline">
): Promise<string> {
    const tenantId = await getTenantId();
    const ref = await addDoc(collection(db, "instrumentos"), {
        ...data,
        tenantId,
        linkPortalToken: (data as any).linkPortalToken || generarToken(),
        linkActivo: true,
        socios: (data as any).socios ?? [],
        seccionesActivas: [],
        pipeline: [],
        estado: 'paso_01_identificacion',
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
    });
    return ref.id;
}

export async function actualizarInstrumento(
    id: string,
    data: Partial<Instrumento>
): Promise<void> {
    await updateDoc(doc(db, "instrumentos", id), {
        ...data,
        actualizadoEn: serverTimestamp(),
    });
}

export async function actualizarEstado(
    id: string,
    estado: EstadoInstrumento
): Promise<void> {
    await updateDoc(doc(db, "instrumentos", id), {
        estado,
        actualizadoEn: serverTimestamp(),
    });
}

export async function agregarSocio(
    instrumentoId: string,
    socio: SocioInstrumento
): Promise<void> {
    const instrumento = await getInstrumento(instrumentoId);
    if (!instrumento) throw new Error("Instrumento no encontrado");
    await updateDoc(doc(db, "instrumentos", instrumentoId), {
        socios: [...instrumento.socios, socio],
        actualizadoEn: serverTimestamp(),
    });
}

export async function cerrarInstrumento(id: string): Promise<void> {
    await updateDoc(doc(db, "instrumentos", id), {
        estado: 'cerrado',
        linkActivo: false,
        actualizadoEn: serverTimestamp(),
    });
}

export async function eliminarInstrumento(id: string): Promise<void> {
    await deleteDoc(doc(db, "instrumentos", id));
}
