import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBm0exIdZ1-9Sc0ueybnrmr_nbTOX8RTwE",
  authDomain: "fedatarioapp.firebaseapp.com",
  projectId: "fedatarioapp",
  storageBucket: "fedatarioapp.firebasestorage.app",
  messagingSenderId: "272102437544",
  appId: "1:272102437544:web:b9919a2f2300496b6cc89d"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
