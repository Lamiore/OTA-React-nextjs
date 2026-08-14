import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// Flash-Lite = varian termurah yang masih masuk kuota gratis AI Studio.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite';

const MAX_CHARS = 500; // panjang satu pesan user
const MAX_TURNS = 12; // riwayat yang ikut dikirim; sisanya dibuang dari depan

// ── Konteks destinasi ──

/**
 * Ringkasan katalog buat system instruction. Dibaca lewat Admin SDK (bukan
 * client) supaya aturan Firestore tidak perlu dilonggarkan, dan di-cache di
 * memori: tanpa ini tiap pesan chat = satu read koleksi penuh.
 */
let cache: { text: string; at: number } | null = null;
const TTL = 5 * 60_000;

async function destinationContext(): Promise<string> {
  if (cache && Date.now() - cache.at < TTL) return cache.text;

  const snap = await adminDb().collection('destinations').get();
  const text = snap.docs
    .map((d) => {
      const v = d.data();
      const harga: string = Array.isArray(v.priceItems) && v.priceItems.length
        ? v.priceItems
            .map((p: { label: string; price: number; unit: string }) =>
              `${p.label} Rp${Number(p.price).toLocaleString('id-ID')}${p.unit}`)
            .join(', ')
        : v.priceStart
          ? `Tiket Masuk Rp${Number(v.priceStart).toLocaleString('id-ID')}/pax`
          : 'belum ada daftar harga';

      return [
        `## ${v.name} (id: ${d.id})`,
        `Lokasi: ${v.location}`,
        Array.isArray(v.tags) && v.tags.length ? `Tag: ${v.tags.join(', ')}` : null,
        `Harga: ${harga}`,
        v.hasMonitoring ? 'Punya sensor IoT: suhu & kualitas air bisa dilihat live.' : null,
        v.whatsapp ? `WhatsApp pengelola: ${v.whatsapp}` : null,
        v.description ? `Deskripsi: ${String(v.description).slice(0, 400)}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  cache = { text, at: Date.now() };
  return text;
}

function systemInstruction(katalog: string): string {
  return `Kamu asisten Nusa, platform pemesanan wisata selam dan pesisir.

Tugasmu membantu calon pengunjung: menjelaskan destinasi, harga, cara booking, dan memberi rekomendasi.

Aturan:
- Jawab dalam Bahasa Indonesia yang santai tapi sopan. Ringkas — maksimal 3 kalimat kecuali diminta detail.
- Harga HANYA boleh diambil dari katalog di bawah. Jangan pernah mengarang atau memperkirakan angka.
- Kalau destinasi yang ditanya tidak ada di katalog, katakan terus terang belum tersedia.
- Kalau ditanya hal di luar wisata selam / Nusa, arahkan balik dengan ramah.
- Cara booking: buka halaman destinasi, pilih tanggal dan jumlah orang, lalu bayar lewat menu Booking.
- Untuk urusan yang butuh manusia (perubahan jadwal, komplain), arahkan ke WhatsApp pengelola destinasi kalau nomornya ada di katalog.
- Jangan pakai format markdown tabel. Teks biasa saja.

Katalog destinasi saat ini:

${katalog || '(katalog kosong)'}`;
}

// ── Throttle ──

// ponytail: throttle in-memory, per-instance. Reset tiap cold start dan tidak
// dibagi antar instance serverless — cukup untuk menahan spam iseng, bukan
// serangan serius. Naikkan ke Firestore/Upstash kalau traffic sudah nyata.
const hits = new Map<string, number[]>();
const WINDOW = 60_000;
const LIMIT = 8; // pesan per IP per menit

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) hits.clear(); // batas kasar biar map tidak tumbuh terus
  return false;
}

// ── Handler ──

interface ClientMessage {
  role: 'user' | 'assistant';
  text: string;
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('[chat] GEMINI_API_KEY belum diset');
    return NextResponse.json({ error: 'not-configured' }, { status: 503 });
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'local';
  if (throttled(ip)) {
    return NextResponse.json({ error: 'too-many-requests' }, { status: 429 });
  }

  let messages: unknown;
  try {
    ({ messages } = await req.json());
  } catch {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every(
      (m): m is ClientMessage =>
        !!m &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.text === 'string' &&
        m.text.length <= MAX_CHARS
    )
  ) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }

  // Riwayat dipetakan ke bentuk Interactions API: giliran user jadi
  // `user_input`, jawaban model dikirim balik apa adanya sebagai `model_output`
  // (store: false, jadi server Google tidak menyimpan percakapan).
  const input = messages.slice(-MAX_TURNS).map((m) =>
    m.role === 'user'
      ? { type: 'user_input', content: m.text }
      : { type: 'model_output', content: [{ type: 'text', text: m.text }] }
  );

  let katalog = '';
  try {
    katalog = await destinationContext();
  } catch (err) {
    console.error('[chat] gagal baca destinations', err);
    // Bot tetap jalan tanpa katalog — cuma tidak bisa menyebut harga.
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        system_instruction: systemInstruction(katalog),
        store: false,
        input,
        generation_config: { temperature: 0.7, max_output_tokens: 400 },
      }),
    });
  } catch (err) {
    console.error('[chat] fetch gagal', err);
    return NextResponse.json({ error: 'upstream-unreachable' }, { status: 502 });
  }

  if (!res.ok) {
    // Dipotong: balasan galat Gemini bisa memuat kembali seluruh permintaan,
    // termasuk katalog di system instruction. Status + awal pesannya sudah cukup
    // untuk mendiagnosis, dan sisanya cuma menumpuk di log.
    console.error('[chat] gemini', res.status, (await res.text().catch(() => '')).slice(0, 300));
    // 429 dari Gemini = kuota gratis habis; teruskan supaya UI bisa bilang
    // "lagi ramai" alih-alih error umum.
    return NextResponse.json(
      { error: res.status === 429 ? 'quota' : 'upstream-error' },
      { status: res.status === 429 ? 429 : 502 }
    );
  }

  const data = await res.json();
  const reply: string = (data.steps ?? [])
    .flatMap((s: { type: string; content?: { type: string; text?: string }[] }) =>
      s.type === 'model_output' ? (s.content ?? []) : []
    )
    .filter((c: { type: string }) => c.type === 'text')
    .map((c: { text?: string }) => c.text ?? '')
    .join('')
    .trim();

  if (!reply) {
    console.error('[chat] balasan kosong', JSON.stringify(data).slice(0, 500));
    return NextResponse.json({ error: 'empty-reply' }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
