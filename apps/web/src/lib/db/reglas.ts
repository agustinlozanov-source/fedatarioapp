import {
    collection, doc, getDocs, addDoc,
    updateDoc, deleteDoc, query, where,
    orderBy, serverTimestamp
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { Regla } from "@fedatario/shared";
import { getTenantId } from '@/lib/auth';

export async function getReglas(): Promise<Regla[]> {
    const tenantId = await getTenantId();
    const q = query(
        collection(db, "reglas"),
        where("tenantId", "==", tenantId),
        orderBy("creadoEn", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Regla));
}

export async function crearRegla(
    data: Omit<Regla, "id" | "creadoEn">
): Promise<string> {
    const tenantId = await getTenantId();
    const ref = await addDoc(collection(db, "reglas"), {
        ...data,
        tenantId,
        creadoEn: serverTimestamp(),
    });
    return ref.id;
}

export async function actualizarRegla(
    id: string,
    data: Partial<Regla>
): Promise<void> {
    await updateDoc(doc(db, "reglas", id), data);
}

export async function toggleRegla(id: string, activa: boolean): Promise<void> {
    await updateDoc(doc(db, "reglas", id), { activa });
}

export async function eliminarRegla(id: string): Promise<void> {
    await deleteDoc(doc(db, "reglas", id));
}
