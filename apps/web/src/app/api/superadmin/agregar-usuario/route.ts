import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const SUPERADMIN_UID = process.env.NEXT_PUBLIC_SUPERADMIN_UID ?? '';

export async function POST(req: NextRequest) {
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

        const { tenantId, email, password, nombre, rol } = await req.json();
        if (!tenantId || !email || !password || !nombre || !rol) {
            return NextResponse.json({ error: 'Faltan datos: tenantId, email, password, nombre, rol' }, { status: 400 });
        }

        // Verificar que la organización existe
        const orgDoc = await firestore.collection('organizaciones').doc(tenantId).get();
        if (!orgDoc.exists) {
            return NextResponse.json({ error: 'Organización no encontrada' }, { status: 404 });
        }

        // Crear usuario en Firebase Auth
        const record = await auth.createUser({ email, password, displayName: nombre });

        // Guardar en Firestore
        await firestore.collection('usuarios').doc(record.uid).set({
            tenantId,
            email,
            nombre,
            rol,
            esOwner: false,
            creadoEn: new Date().toISOString(),
        });

        return NextResponse.json({ ok: true, uid: record.uid });
    } catch (e: any) {
        console.error('[superadmin/agregar-usuario]', e);
        return NextResponse.json({ error: e?.message ?? 'Error interno' }, { status: 500 });
    }
}
