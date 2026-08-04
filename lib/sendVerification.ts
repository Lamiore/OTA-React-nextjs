import { auth } from '@/lib/firebase';

// Minta backend kirim email verifikasi (lewat SMTP sendiri, bukan Firebase).
export async function requestVerificationEmail(email: string) {
  const res = await fetch('/api/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('verification-send-failed');
}

/**
 * Beri tahu user lewat email bahwa pengajuan pengelolanya disetujui. Dipanggil
 * admin dari dashboard; ID token admin ikut dikirim untuk dicek di server.
 */
export async function notifyApproval(uid: string) {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('not-signed-in');
  const res = await fetch('/api/notify-approval', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ uid }),
  });
  if (!res.ok) throw new Error('notify-send-failed');
}
