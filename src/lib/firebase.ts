import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyALrqrk66avVJ6yOJP4icypBL5rsKOGPNM",
  authDomain: "ticketflow-klvln.firebaseapp.com",
  projectId: "ticketflow-klvln",
  storageBucket: "ticketflow-klvln.firebasestorage.app",
  messagingSenderId: "49607990729",
  appId: "1:49607990729:web:b33ff86af663e2a273dc18"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
