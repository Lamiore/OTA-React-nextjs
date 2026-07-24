// Minta backend kirim email verifikasi (lewat SMTP sendiri, bukan Firebase).
export async function requestVerificationEmail(email: string) {
  const res = await fetch('/api/send-verification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('verification-send-failed');
}
