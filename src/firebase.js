import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD3rSNceVuUallFz_iabfFiEZaykBU2cPo",
  authDomain: "pistazo.firebaseapp.com",
  projectId: "pistazo",
  storageBucket: "pistazo.firebasestorage.app",
  messagingSenderId: "145245126804",
  appId: "1:145245126804:web:0a21b1e705d7dec2203481",
  measurementId: "G-6Y1LW8HSTC",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
