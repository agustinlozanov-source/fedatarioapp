import admin from 'firebase-admin';

function getAdminApp() {
    if (admin.apps.length) return admin.apps[0]!;

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    // Netlify a veces envuelve el valor entre comillas o no interpreta \n como saltos de línea reales
    const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
    const privateKey = rawKey
        .replace(/^["']|["']$/g, '')  // elimina comillas envolventes si existen
        .replace(/\\n/g, '\n');        // convierte \n literales en saltos de línea reales

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            `Firebase Admin: faltan variables de entorno. ` +
            `PROJECT_ID=${!!projectId} CLIENT_EMAIL=${!!clientEmail} PRIVATE_KEY=${!!privateKey}`
        );
    }

    // Validación básica del formato PEM
    if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END')) {
        throw new Error(
            `Firebase Admin: FIREBASE_ADMIN_PRIVATE_KEY no tiene formato PEM válido. ` +
            `Asegúrate de que NO tenga comillas externas y que los \\n sean saltos de línea reales. ` +
            `Primeros 40 chars: ${privateKey.substring(0, 40)}`
        );
    }

    return admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
}

export const adminAuth = () => admin.auth(getAdminApp());
export const adminDb = () => admin.firestore(getAdminApp());
