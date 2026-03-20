import admin from 'firebase-admin';

function getAdminApp() {
    if (admin.apps.length) return admin.apps[0]!;

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

    // Netlify puede almacenar \n como \\n (doble escape), como \n literal, o como salto de línea real
    const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '';
    const privateKey = rawKey
        .replace(/^["']|["']$/g, '')   // elimina comillas envolventes si existen
        .replace(/\\\\n/g, '\n')        // caso doble-escape: \\n → salto de línea real
        .replace(/\\n/g, '\n');         // caso normal: \n literal → salto de línea real

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            `Firebase Admin: faltan variables de entorno. ` +
            `PROJECT_ID=${!!projectId} CLIENT_EMAIL=${!!clientEmail} PRIVATE_KEY=${!!privateKey}`
        );
    }

    // Diagnóstico detallado si el formato PEM falla
    if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END')) {
        throw new Error(
            `Firebase Admin: PRIVATE_KEY sin cabeceras PEM. ` +
            `Raw length=${rawKey.length} Processed length=${privateKey.length} ` +
            `Primeros 60 chars: "${rawKey.substring(0, 60)}"`
        );
    }

    if (!privateKey.includes('\n')) {
        throw new Error(
            `Firebase Admin: PRIVATE_KEY no tiene saltos de línea reales después del procesamiento. ` +
            `Revisa el formato en Netlify. Raw primeros 80 chars: "${rawKey.substring(0, 80)}"`
        );
    }

    return admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
}

export const adminAuth = () => admin.auth(getAdminApp());
export const adminDb = () => admin.firestore(getAdminApp());
