import admin from 'firebase-admin';

function getAdminApp() {
    if (admin.apps.length) return admin.apps[0]!;
    const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '')
        .replace(/\\n/g, '\n');
    return admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey,
        }),
    });
}

export const adminAuth = () => admin.auth(getAdminApp());
export const adminDb = () => admin.firestore(getAdminApp());
