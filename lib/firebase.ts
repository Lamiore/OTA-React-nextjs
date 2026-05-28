import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isConfigured = !!firebaseConfig.apiKey;

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _rtdb: Database | null = null;
let _auth: Auth | null = null;

function getApp(): FirebaseApp | null {
  if (!isConfigured) return null;
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return _app;
}

export const db: Firestore | null = (() => {
  const app = getApp();
  if (!app) return null;
  if (!_db) _db = getFirestore(app);
  return _db;
})();

export const rtdb: Database | null = (() => {
  const app = getApp();
  if (!app) return null;
  if (!_rtdb) _rtdb = getDatabase(app);
  return _rtdb;
})();

export const auth: Auth | null = (() => {
  const app = getApp();
  if (!app) return null;
  if (!_auth) _auth = getAuth(app);
  return _auth;
})();
