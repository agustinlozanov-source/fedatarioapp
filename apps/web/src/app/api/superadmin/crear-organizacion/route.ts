import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

export const dynamic = 'force-dynamic';

const SUPERADMIN_UID = process.env.NEXT_PUBLIC_SUPERADMIN_UID ?? '';

export async function POST(req: NextRequest) {
    try {
        return await _handler(req);
    } catch (e: any) {
        console.error('[superadmin] Error no capturado:', e);
        return NextResponse.json({ error: e?.message ?? 'Error interno del servidor' }, { status: 500 });
    }
}

async function _handler(req: NextRequest) {
    // 1. Verificar que el caller es el superadmin
    const authHeader = req.headers.get('authorization') ?? '';
    const idToken = authHeader.replace('Bearer ', '');
    if (!idToken) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const auth = adminAuth();
    const firestore = adminDb();

    let callerUid: string;
    try {
        const decoded = await auth.verifyIdToken(idToken);
        callerUid = decoded.uid;
    } catch {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    if (callerUid !== SUPERADMIN_UID) {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // 2. Leer datos del body
    const body = await req.json();
    const { nombreOrg, usuarios } = body as {
        nombreOrg: string;
        usuarios: { email: string; password: string; nombre: string; rol: string }[];
    };

    if (!nombreOrg || !usuarios?.length) {
        return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    // 3. Crear el primer usuario como owner de la organización (su UID = tenantId)
    const owner = usuarios[0];
    let ownerRecord;
    try {
        ownerRecord = await auth.createUser({
            email: owner.email,
            password: owner.password,
            displayName: owner.nombre,
        });
    } catch (e: any) {
        return NextResponse.json({ error: `Error creando usuario owner: ${e.message}` }, { status: 400 });
    }

    const tenantId = ownerRecord.uid;

    // 4. Crear la organización en Firestore
    try {
        await firestore.collection('organizaciones').doc(tenantId).set({
            nombre: nombreOrg,
            ownerUid: tenantId,
            creadoEn: new Date().toISOString(),
            activo: true,
        });
    } catch (e: any) {
        return NextResponse.json({ error: `Error guardando organización en Firestore: ${e.message}` }, { status: 500 });
    }

    // 5. Crear usuarios adicionales (si los hay)
    const usuariosCreados: { uid: string; email: string; nombre: string; rol: string }[] = [];
    usuariosCreados.push({ uid: tenantId, email: owner.email, nombre: owner.nombre, rol: owner.rol });

    for (const u of usuarios.slice(1)) {
        try {
            const record = await auth.createUser({
                email: u.email,
                password: u.password,
                displayName: u.nombre,
            });
            // Los usuarios adicionales comparten el tenantId del owner
            await firestore.collection('usuarios').doc(record.uid).set({
                tenantId,
                email: u.email,
                nombre: u.nombre,
                rol: u.rol,
                creadoEn: new Date().toISOString(),
            });
            usuariosCreados.push({ uid: record.uid, email: u.email, nombre: u.nombre, rol: u.rol });
        } catch (e: any) {
            // No abortar si un usuario adicional falla, solo reportar
            usuariosCreados.push({ uid: '', email: u.email, nombre: u.nombre, rol: `ERROR: ${e.message}` });
        }
    }

    return NextResponse.json({ ok: true, tenantId, usuariosCreados });
}
