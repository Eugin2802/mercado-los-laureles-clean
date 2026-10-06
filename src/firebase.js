import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDk5UjLvhUyZP6EvzJ_a9Z_6i-RH59w61Y",
  authDomain: "mercado-los-laureles.firebaseapp.com",
  projectId: "mercado-los-laureles",
  messagingSenderId: "128490325118",
  appId: "1:128490325118:web:0ceec8ef264f113658442f",
  measurementId: "G-CSGN02823K",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);

export { app, db };