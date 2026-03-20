import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const SUPERADMIN_UID = process.env.NEXT_PUBLIC_SUPERADMIN_UID ?? '';

export async function PATCH(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization') ?? '';
        const idToken = authHeader.replace('Bearer ', '');
        if (!idToken) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

        const auth = adminAuth();
        const firestore = adminDb();

        const decoded = await auth.verifyIdToken(idToken);
        if (decoded.uid !== SUPERADMIN_UID) {
            return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
        }

        const { uid, rol, nombre } = await req.json();
        if (!uid) return NextResponse.json({ error: 'Falta uid' }, { status: 400 });

        // Actualizar Firestore
        const firestoreUpdates: Record<string, string> = {};
        if (rol) firestoreUpdates.rol = rol;
        if (nombre) firestoreUpdates.nombre = nombre;

        if (Object.keys(firestoreUpdates).length > 0) {
            await firestore.collection('usuarios').doc(uid).update(firestoreUpdates);
        }

        // Actualizar displayName en Auth si cambió el nombre
        if (nombre) {
            await auth.updateUser(uid, { displayName: nombre });
        }

        return NextResponse.json({ ok: true });
    } catch (e: any) {
        console.error('[superadmin/actualizar-usuario]', e);
        return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 });
    }
}
