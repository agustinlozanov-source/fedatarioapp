import {
    collection, doc, getDocs, getDoc,
    addDoc, updateDoc, deleteDoc, query, where, orderBy,
    serverTimestamp, writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getTenantId } from "@/lib/auth";
import type { Cliente } from "@fedatario/shared";

export async function getClientes(): Promise<Cliente[]> {
    const tenantId = await getTenantId();
    const q = query(
        collection(db, "clientes"),
        where("tenantId", "==", tenantId),
        orderBy("nombre", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Cliente));
}

export async function getCliente(id: string): Promise<Cliente | null> {
    const snap = await getDoc(doc(db, "clientes", id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Cliente;
}

export async function crearCliente(
    data: Omit<Cliente, "id" | "creadoEn" | "actualizadoEn">
): Promise<string> {
    const tenantId = await getTenantId();
    // Limpiar undefined
    const limpio = Object.fromEntries(
        Object.entries({ ...data, tenantId })
            .filter(([_, v]) => v !== undefined)
    );
    const ref = await addDoc(collection(db, "clientes"), {
        ...limpio,
        portalActivo: true,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
    });
    return ref.id;
}

export async function actualizarCliente(
    id: string,
    data: Partial<Cliente>
): Promise<void> {
    // Limpiar undefined
    const limpio = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(doc(db, "clientes", id), {
        ...limpio,
        actualizadoEn: serverTimestamp(),
    });
}

export async function cargaMasivaClientes(
    clientes: Omit<Cliente, "id" | "creadoEn" | "actualizadoEn">[]
): Promise<number> {
    const tenantId = await getTenantId();
    const batch = writeBatch(db);
    let count = 0;
    for (const cliente of clientes) {
        const limpio = Object.fromEntries(
            Object.entries({ ...cliente, tenantId })
                .filter(([_, v]) => v !== undefined)
        );
        const ref = doc(collection(db, "clientes"));
        batch.set(ref, {
            ...limpio,
            portalActivo: true,
            creadoEn: serverTimestamp(),
            actualizadoEn: serverTimestamp(),
        });
        count++;
    }
    await batch.commit();
    return count;
}

export async function eliminarCliente(id: string): Promise<void> {
    await deleteDoc(doc(db, "clientes", id));
}
}
