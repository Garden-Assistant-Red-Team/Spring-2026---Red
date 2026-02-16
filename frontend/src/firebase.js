// Firebase core
import { initializeApp } from "firebase/app";

// Services
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBGwCtzhY98gdkq2lNGYKdmXtKXxzbLJY8",
  authDomain: "garden-assistant-381fe.firebaseapp.com",
  projectId: "garden-assistant-381fe",
  storageBucket: "garden-assistant-381fe.firebasestorage.app",
  messagingSenderId: "755682524506",
  appId: "1:755682524506:web:4c661775651b8234178763",
  measurementId: "G-4S85VD97QV"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;