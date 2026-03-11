import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithEmailAndPassword } from 'firebase/auth';

export function onAuthChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
}

export function getTenantId(): Promise<string> {
    return new Promise((resolve, reject) => {
        // Si ya hay usuario, resuelve inmediatamente
        if (auth.currentUser) {
            resolve(auth.currentUser.uid);
            return;
        }
        // Si no, espera al primer cambio de estado
        const unsub = onAuthStateChanged(auth, user => {
            unsub();
            if (user) resolve(user.uid);
            else reject(new Error('No autenticado'));
        });
    });
}

export function getUser(): Promise<User> {
    return new Promise((resolve, reject) => {
        if (auth.currentUser) {
            resolve(auth.currentUser);
            return;
        }
        const unsub = onAuthStateChanged(auth, user => {
            unsub();
            if (user) resolve(user);
            else reject(new Error('No autenticado'));
        });
    });
}

export async function login(email: string, password: string) {
    return signInWithEmailAndPassword(auth, email, password);
}
