import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  update,
  remove,
  set,
  get,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import {
  getAuth,
  GoogleAuthProvider,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBz_CsnVtihY_wuAgzxRHK4Y8D57DQAd2M",
  authDomain: "flightclub-pro-db.firebaseapp.com",
  databaseURL:
    "https://flightclub-pro-db-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "flightclub-pro-db",
  storageBucket: "flightclub-pro-db.firebasestorage.app",
  messagingSenderId: "342700744940",
  appId: "1:342700744940:web:9b6e41852a12ebd03185c9",
};

// Instanzen initialisieren
export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firebase Methoden direkt mit-exportieren (spart Import-Chaos in anderen Dateien)
export { ref, push, onValue, update, remove, set, get };
