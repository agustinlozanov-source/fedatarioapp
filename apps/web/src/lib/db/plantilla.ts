import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { CampoActa } from "@fedatario/shared";
import { getTenantId } from '@/lib/auth';

export interface SeccionConfig {
    id: string;
    nombre: string;
    orden: number;
    campos: CampoActa[];
}

export interface PlantillaConfig {
    secciones: SeccionConfig[];
    actualizadaEn?: any;
}

export async function getPlantilla(): Promise<PlantillaConfig> {
    const tenantId = await getTenantId();
    const snap = await getDoc(doc(db, "plantillas", tenantId));
    if (!snap.exists()) return { secciones: [] };
    return snap.data() as PlantillaConfig;
}

export async function guardarPlantilla(config: PlantillaConfig): Promise<void> {
    const tenantId = await getTenantId();
    await setDoc(doc(db, "plantillas", tenantId), {
        ...config,
        actualizadaEn: serverTimestamp(),
    });
}
