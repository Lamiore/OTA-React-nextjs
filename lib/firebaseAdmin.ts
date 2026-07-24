import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Admin SDK singleton (server-only). Kredensial diambil dari env:
//   FIREBASE_ADMIN_SA_B64 = base64 dari file service-account JSON.
// Fallback ke applicationDefault() bila GOOGLE_APPLICATION_CREDENTIALS diset.
//
// Bikin base64-nya sekali (jangan commit hasilnya):
//   base64 -i ota-db-firebase-adminsdk-*.json | tr -d '\n'
function initAdmin() {
  if (getApps().length) return;

  const b64 = process.env.FIREBASE_ADMIN_SA_B64;
  if (b64) {
    const sa = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    initializeApp({ credential: cert(sa) });
    return;
  }
  // GOOGLE_APPLICATION_CREDENTIALS=<path ke json>
  initializeApp({ credential: applicationDefault() });
}

export function adminAuth() {
  initAdmin();
  return getAuth();
}
