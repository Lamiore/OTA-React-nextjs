'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const SAPAAN =
  'Halo! Aku asisten Lautara. Tanya apa saja soal destinasi selam, harga, atau cara booking.';

const SARAN = [
  'Rekomendasi spot buat pemula',
  'Berapa harga tiketnya?',
  'Cara booking gimana?',
];

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4z" />
    </svg>
  );
}

const ERRORS: Record<string, string> = {
  quota: 'Lagi ramai banget. Coba lagi sebentar lagi ya.',
  'too-many-requests': 'Kebanyakan pesan sekaligus. Tunggu sebentar ya.',
  'not-configured': 'Asisten belum aktif. Hubungi admin.',
};

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: SAPAAN },
  ]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selalu turun ke pesan terbaru — termasuk saat indikator "mengetik" muncul.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Esc menutup panel, kebiasaan yang sama dengan modal lain di app ini.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  async function send(text: string) {
    const isi = text.trim();
    if (!isi || sending) return;

    const next: Message[] = [...messages, { role: 'user', text: isi }];
    setMessages(next);
    setDraft('');
    setError(null);
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Sapaan awal tidak ikut dikirim: itu teks statis, bukan giliran model.
        body: JSON.stringify({ messages: next.slice(1) }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(ERRORS[data.error] ?? 'Gagal menghubungi asisten. Coba lagi.');
        return;
      }
      setMessages([...next, { role: 'assistant', text: data.reply }]);
    } catch {
      setError('Koneksi bermasalah. Cek internet kamu.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Mobile duduk di atas BottomNav (fixed bottom-3, tinggi ~68px). */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Tutup asisten' : 'Buka asisten Lautara'}
        aria-expanded={open}
        className={clsx(
          'fixed right-4 bottom-28 z-[150] flex h-14 w-14 items-center justify-center',
          'rounded-full bg-teal-500 text-white shadow-float',
          'transition-[background-color,transform] duration-micro ease-out',
          'hover:bg-teal-600 active:translate-y-px md:right-6 md:bottom-6'
        )}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Asisten Lautara"
          className={clsx(
            'fixed z-[150] flex flex-col overflow-hidden rounded-md bg-surface shadow-overlay',
            'ring-1 ring-shore-200 animate-fade-up',
            // Ponsel: lebar penuh di atas tombol. Desktop: panel sudut.
            'inset-x-4 bottom-44 max-h-[60vh]',
            'md:inset-x-auto md:right-6 md:bottom-24 md:w-[22rem] md:max-h-[30rem]'
          )}
        >
          <header className="flex items-center gap-3 border-b border-shore-200 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-600">
              <ChatIcon />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-navy">Asisten Lautara</p>
              <p className="text-2xs text-navy-soft">Biasanya balas dalam hitungan detik</p>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <p
                  className={clsx(
                    'max-w-[85%] whitespace-pre-wrap rounded-md px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'bg-teal-500 text-white'
                      : 'bg-shore-100 text-navy'
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <p className="rounded-md bg-shore-100 px-3 py-2 text-sm text-navy-soft">
                  Mengetik…
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
            )}

            {messages.length === 1 && !sending && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SARAN.map((s) => (
                  <button key={s} onClick={() => send(s)} className="chip">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex items-center gap-2 border-t border-shore-200 px-3 py-3"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder="Tulis pertanyaan…"
              aria-label="Pesan"
              className="min-w-0 flex-1 rounded-sm bg-shore-100 px-3 py-2 text-sm text-navy placeholder:text-navy-subtle focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Kirim"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-teal-500 text-white transition-colors duration-micro hover:bg-teal-600 disabled:opacity-40"
            >
              <SendIcon />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
