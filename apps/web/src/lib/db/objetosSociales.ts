import {
    collection, doc, getDocs, addDoc,
    updateDoc, query, where, orderBy,
    serverTimestamp, increment
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { getTenantId } from '@/lib/auth';

export interface ObjetoSocial {
    id: string;
    tenantId: string;
    etiqueta: string;
    texto: string;
    usosCount: number;
    creadoEn: string;
}

export async function getObjetosSociales(): Promise<ObjetoSocial[]> {
    const tenantId = await getTenantId();
    const q = query(
        collection(db, "objetos_sociales"),
        where("tenantId", "==", tenantId),
        orderBy("usosCount", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ObjetoSocial));
}

export async function buscarObjetosSociales(
    termino: string
): Promise<ObjetoSocial[]> {
    const todos = await getObjetosSociales();
    const t = termino.toLowerCase();
    return todos.filter(o =>
        o.etiqueta.toLowerCase().includes(t) ||
        o.texto.toLowerCase().includes(t)
    );
}

export async function crearObjetoSocial(
    etiqueta: string,
    texto: string
): Promise<string> {
    const tenantId = await getTenantId();
    const ref = await addDoc(collection(db, "objetos_sociales"), {
        tenantId,
        etiqueta,
        texto,
        usosCount: 0,
        creadoEn: serverTimestamp(),
    });
    return ref.id;
}

export async function incrementarUso(id: string): Promise<void> {
    await updateDoc(doc(db, "objetos_sociales", id), {
        usosCount: increment(1),
    });
}
