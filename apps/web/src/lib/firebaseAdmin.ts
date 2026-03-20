import admin from 'firebase-admin';

function getAdminApp() {
    if (admin.apps.length) return admin.apps[0]!;

    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
        throw new Error(
            `Firebase Admin: faltan variables de entorno. ` +
            `PROJECT_ID=${!!projectId} CLIENT_EMAIL=${!!clientEmail} PRIVATE_KEY=${!!privateKey}`
        );
    }

    return admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
}

export const adminAuth = () => admin.auth(getAdminApp());
export const adminDb = () => admin.firestore(getAdminApp());
