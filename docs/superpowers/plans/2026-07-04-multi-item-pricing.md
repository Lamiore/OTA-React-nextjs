# Sistem Harga Multi-Item Destinasi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengganti harga tunggal `priceStart` dengan daftar harga multi-item (`priceItems`) per destinasi — dipilih dengan qty per item saat booking, dikelola lewat editor list di panel admin, dan dihapus dari tampilan card depan.

**Architecture:** Field array `priceItems` embedded di dokumen `destinations` (Firestore), dengan helper `getPriceItems()` yang mem-fallback destinasi legacy (`priceStart`) menjadi satu item sintetis "Tiket Masuk". Booking menyimpan snapshot `items` + `amount` total sehingga PaymentModal/NotificationBell lama tetap kompatibel.

**Tech Stack:** Next.js 14 (App Router, client components), Firebase Firestore (SDK v12), Tailwind CSS, TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-07-04-multi-item-pricing-design.md`

## Global Constraints

- Repo TIDAK punya test framework (tidak ada jest/vitest). Sesuai spec, verifikasi per task = `npx tsc --noEmit` (harus tanpa output/error) + verifikasi manual via `npm run dev` bila memungkinkan. JANGAN menambah dependency test.
- Semua teks UI berbahasa Indonesia; ikuti idiom styling yang sudah ada (kelas `text-[13px]`, warna `navy`/`navy-soft`/`teal`/`shore`, `card`, `btn-primary`, `btn-ghost`, `rounded-xl`).
- Firestore security rules TIDAK diubah (struktur koleksi tetap).
- `priceStart` tidak dihapus dari dokumen lama dan tidak ditulis lagi saat save; pembacaan selalu lewat `getPriceItems()`.
- Format rupiah pakai `formatIDR` dari `lib/format.ts` (sudah ada) kecuali komponen sudah punya formatter lokal.
- Jalankan semua perintah dari root repo: `/Users/irhammohammad/Documents/Code/React/otaapp/OTA`.

---

### Task 1: Hapus harga dari card depan (desktop & mobile)

**Files:**
- Modify: `components/desktop/DesktopDestinationCard.tsx`
- Modify: `components/mobile/DestinationCard.tsx`

**Interfaces:**
- Consumes: — (task pertama)
- Produces: kedua card tidak lagi menerima/menampilkan prop `priceStart`. Call site (`components/desktop/DesktopDestinationGrid.tsx:115` dan `components/mobile/DestinationList.tsx:85`) memakai spread `{...dest}` sehingga TIDAK perlu diubah — JSX spread mengizinkan prop berlebih.

- [ ] **Step 1: Edit `components/desktop/DesktopDestinationCard.tsx`**

Tiga perubahan pada file ini:

1. Hapus `priceStart: number;` dari `interface Props` (baris 12).
2. Hapus baris `const formatRp = (n: number) => \`Rp ${(n / 1000).toFixed(0)}k\`;` (baris 36) dan hapus `priceStart,` dari destructuring parameter komponen (baris 45).
3. Ganti seluruh blok footer (baris 105–119) menjadi:

```tsx
        {/* Footer */}
        <div className="mt-1 flex items-center justify-end border-t border-shore-200 pt-4">
          <button className="btn-primary px-4 py-2 text-xs group/btn">
            Booking
            <span className="group-hover/btn:translate-x-0.5 transition-transform duration-200">
              <ArrowIcon />
            </span>
          </button>
        </div>
```

(Yang berubah: `justify-between` → `justify-end`, dan `<div>` berisi harga + `/pax` dihapus.)

- [ ] **Step 2: Edit `components/mobile/DestinationCard.tsx`**

Tiga perubahan serupa:

1. Hapus `priceStart: number;` dari `interface Props` (baris 12).
2. Hapus baris `const formatRp = (n: number) => \`Rp ${(n / 1000).toFixed(0)}k\`;` (baris 27) dan hapus `priceStart,` dari destructuring (baris 36).
3. Ganti blok footer (baris 84–96) menjadi:

```tsx
        {/* Footer */}
        <div className="flex items-center justify-end mt-auto pt-1.5">
          <button
            onClick={() => router.push(`/destinations/${id}`)}
            className="bg-teal-500 text-white rounded-lg px-3 py-1 text-[10px] font-medium hover:bg-teal-600 transition-colors duration-200"
          >
            Booking
          </button>
        </div>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: selesai tanpa output (exit code 0). Catatan: `priceStart` masih ada di `interface Destination` (lib/firestore.ts), jadi spread `{...dest}` yang membawa `priceStart` ke card tanpa prop tersebut tetap valid.

- [ ] **Step 4: Verifikasi manual (opsional bila dev server bisa jalan)**

Run: `npm run dev`, buka `http://localhost:3000/beranda`.
Expected: card destinasi (grid desktop & list mobile) tidak menampilkan harga; hanya nama, lokasi, tags, tombol Booking.

- [ ] **Step 5: Commit**

```bash
git add components/desktop/DesktopDestinationCard.tsx components/mobile/DestinationCard.tsx
git commit -m "feat(pricing): hapus harga dari card depan destinasi"
```

---

### Task 2: Model data `PriceItem` + helper `getPriceItems` + patch kompilasi

**Files:**
- Modify: `lib/firestore.ts`
- Modify: `app/destinations/[id]/page.tsx:154` (patch sementara — diganti total di Task 3)
- Modify: `app/booking/page.tsx:87` (patch sementara — diganti total di Task 4)

**Interfaces:**
- Consumes: —
- Produces (dipakai Task 3–6):
  - `interface PriceItem { id: string; label: string; price: number; unit: string }`
  - `getPriceItems(dest: Destination): PriceItem[]`
  - `interface BookingItem { label: string; price: number; qty: number }`
  - `Destination.priceItems?: PriceItem[]`, `Destination.priceStart?: number` (jadi opsional)
  - `Booking.items?: BookingItem[]` (otomatis masuk `BookingInput` karena `Omit` tidak mengecualikannya)

- [ ] **Step 1: Edit `lib/firestore.ts` — tipe & helper**

Ganti blok `// ── Destinations ──` bagian interface (baris 17–33) menjadi:

```ts
// ── Destinations ──

export interface PriceItem {
  id: string; // key React & edit admin — crypto.randomUUID()
  label: string; // "Tiket Masuk", "Penginapan", "Sewa Alat Diving", ...
  price: number; // rupiah, >= 0
  unit: string; // "/pax", "/malam", "/set" — teks bebas
}

export interface Destination {
  id: string;
  name: string;
  location: string;
  emoji: string;
  thumbColor: string;
  tags: string[];
  /** Legacy — harga tunggal lama; hanya dipakai sebagai fallback getPriceItems. */
  priceStart?: number;
  /** Daftar harga multi-item (tiket, penginapan, sewa alat, ...). */
  priceItems?: PriceItem[];
  description: string;
  image: string;
  /** True hanya untuk destinasi yang punya stasiun sensor IoT fisik. */
  hasMonitoring?: boolean;
}

export type DestinationInput = Omit<Destination, "id">;

/**
 * Sumber kebenaran daftar harga. Destinasi legacy (hanya punya priceStart)
 * di-fallback jadi satu item "Tiket Masuk" agar tetap bisa tampil & dibooking
 * tanpa migrasi manual.
 */
export function getPriceItems(dest: Destination): PriceItem[] {
  if (dest.priceItems && dest.priceItems.length > 0) return dest.priceItems;
  if (dest.priceStart && dest.priceStart > 0) {
    return [{ id: "legacy", label: "Tiket Masuk", price: dest.priceStart, unit: "/pax" }];
  }
  return [];
}
```

- [ ] **Step 2: Edit `lib/firestore.ts` — Booking**

Tambahkan sebelum `export interface Booking` (baris ~102):

```ts
export interface BookingItem {
  label: string;
  price: number;
  qty: number;
}
```

Di dalam `interface Booking`, tambahkan satu field setelah `notes: string;`:

```ts
  /** Snapshot rincian item yang dipilih saat booking dibuat. */
  items?: BookingItem[];
```

Di `createBooking`, ganti isi `addDoc` agar `items` tidak pernah `undefined` (Firestore menolak nilai `undefined`):

```ts
export async function createBooking(data: BookingInput) {
  if (!db) return;
  await addDoc(collection(db, "bookings"), {
    ...data,
    items: data.items ?? [],
    amount: data.amount ?? 0,
    status: "confirmed",
    paymentStatus: "unpaid",
    createdAt: serverTimestamp(),
  });
}
```

`BookingInput` TIDAK perlu diubah — `items` otomatis ikut karena tidak ada di daftar `Omit`.

- [ ] **Step 3: Patch dua pemakai `priceStart` agar tetap kompile**

`priceStart` kini opsional, jadi dua baris ini error tanpa patch:

Di `app/destinations/[id]/page.tsx` baris 154, ganti:

```tsx
                {formatRp(dest.priceStart ?? 0)}
```

Di `app/booking/page.tsx` baris 87, ganti:

```tsx
        amount: (destination.priceStart ?? 0) * form.guests,
```

(Keduanya sementara — Task 3 dan Task 4 mengganti seluruh blok ini.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: tanpa output. Catatan: `components/dashboard/DestinasiPanel.tsx` tetap valid — `priceStart: 0` boleh untuk field opsional, dan baris 301 sudah pakai optional chaining.

- [ ] **Step 5: Commit**

```bash
git add lib/firestore.ts app/destinations/\[id\]/page.tsx app/booking/page.tsx
git commit -m "feat(pricing): model PriceItem + getPriceItems, snapshot items di booking"
```

---

### Task 3: Halaman detail — card "Daftar Harga"

**Files:**
- Modify: `app/destinations/[id]/page.tsx`

**Interfaces:**
- Consumes: `getPriceItems(dest)`, `PriceItem` dari Task 2.
- Produces: halaman detail menampilkan semua item harga; tidak ada lagi pemakaian `dest.priceStart` di file ini.

- [ ] **Step 1: Update import**

Ganti baris 7:

```tsx
import { getPriceItems, type Destination } from '@/lib/firestore';
```

- [ ] **Step 2: Ganti card harga**

Di dalam komponen, setelah guard `if (!dest) { ... }` (yaitu tepat sebelum `return` utama di baris ~84), tambahkan:

```tsx
  const priceItems = getPriceItems(dest);
```

Lalu ganti seluruh blok `{/* Price + Booking */}` (baris 149–164, termasuk patch `?? 0` dari Task 2) menjadi:

```tsx
          {/* Daftar Harga + Booking */}
          <div className="card p-5 sm:p-6">
            <h2 className="text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-3">Daftar Harga</h2>
            {priceItems.length > 0 ? (
              <ul className="divide-y divide-shore-100">
                {priceItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="text-[14px] text-navy">{item.label}</span>
                    <span className="text-[14px] font-semibold text-navy shrink-0">
                      {formatRp(item.price)}
                      <span className="text-[12px] text-navy-soft font-normal"> {item.unit}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-navy-soft">Belum ada daftar harga untuk destinasi ini.</p>
            )}
            <button
              onClick={() => router.push(`/booking?dest=${dest.id}`)}
              className="btn-primary w-full rounded-xl px-6 py-3 text-[14px] mt-4"
            >
              Booking Sekarang
            </button>
          </div>
```

(`formatRp` yang sudah ada di file ini — Intl id-ID — tetap dipakai. Section `LiveMonitorSection` di atasnya JANGAN disentuh.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: tanpa output.

- [ ] **Step 4: Verifikasi manual (opsional)**

Run: `npm run dev`, buka detail salah satu destinasi.
Expected: card "Daftar Harga" berisi baris item; destinasi legacy (hanya `priceStart`) menampilkan satu baris "Tiket Masuk — Rp X /pax". Section monitoring tetap tampil untuk destinasi ber-stasiun.

- [ ] **Step 5: Commit**

```bash
git add app/destinations/\[id\]/page.tsx
git commit -m "feat(pricing): daftar harga multi-item di detail destinasi"
```

---

### Task 4: Halaman booking — pilih item dengan qty per item

**Files:**
- Modify: `app/booking/page.tsx`

**Interfaces:**
- Consumes: `getPriceItems(destination)`, `PriceItem`, `BookingItem`, `createBooking` (Task 2), `formatIDR` dari `lib/format.ts`.
- Produces: dokumen booking berisi `items: BookingItem[]` (hanya qty ≥ 1) dan `amount` = Σ(price × qty). Tidak ada lagi pemakaian `priceStart` di file ini.

- [ ] **Step 1: Update import**

Ganti baris 8 dan tambah import format:

```tsx
import { createBooking, getPriceItems, type Destination } from '@/lib/firestore';
import { formatIDR } from '@/lib/format';
```

- [ ] **Step 2: State qty + derived values**

Di `BookingContent`, setelah deklarasi `const [form, setForm] = useState({...})` (baris ~42), tambahkan:

```tsx
  const [qty, setQty] = useState<Record<string, number>>({});

  const priceItems = destination ? getPriceItems(destination) : [];
  const totalQty = priceItems.reduce((s, it) => s + (qty[it.id] ?? 0), 0);
  const total = priceItems.reduce((s, it) => s + it.price * (qty[it.id] ?? 0), 0);

  const setItemQty = (id: string, next: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, next) }));
```

Lalu tambahkan effect default qty (item pertama = 1) setelah effect "Load destination" yang sudah ada (baris ~56):

```tsx
  // Default: item pertama (biasanya tiket masuk) qty 1
  useEffect(() => {
    if (!destination) return;
    const items = getPriceItems(destination);
    if (items.length > 0) setQty({ [items[0].id]: 1 });
  }, [destination]);
```

- [ ] **Step 3: Update `handleSubmit`**

Ganti seluruh `handleSubmit` (baris 65–95) menjadi:

```tsx
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      router.push('/profile');
      return;
    }
    if (!destination) {
      setError('Pilih destinasi terlebih dahulu.');
      return;
    }
    const items = priceItems
      .filter((it) => (qty[it.id] ?? 0) > 0)
      .map((it) => ({ label: it.label, price: it.price, qty: qty[it.id] ?? 0 }));
    if (items.length === 0) {
      setError('Pilih minimal satu item.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await createBooking({
        userId: user.uid,
        destinationId: destination.id,
        destinationName: destination.name,
        date: form.date,
        guests: form.guests,
        name: form.name,
        phone: form.phone,
        notes: form.notes,
        items,
        amount: total,
      });
      setSuccess(true);
    } catch {
      setError('Gagal membuat booking. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };
```

- [ ] **Step 4: Section "Pilih Item" di form**

Sisipkan blok berikut di dalam `<form>`, di antara blok `{/* Destination info */}` dan blok `{/* Date + Guests */}`:

```tsx
            {/* Pilih item harga */}
            {destination && (
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Pilih Item *</label>
                {priceItems.length === 0 ? (
                  <div className="rounded-xl border border-shore-200 bg-surface px-4 py-3">
                    <p className="text-[13px] text-navy-soft">Destinasi ini belum punya daftar harga, booking belum bisa dilakukan.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-shore-200 bg-surface divide-y divide-shore-100">
                    {priceItems.map((it) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-navy truncate">{it.label}</p>
                          <p className="text-[12px] text-navy-soft">
                            {formatIDR(it.price)} <span className="text-navy-soft/70">{it.unit}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            aria-label={`Kurangi ${it.label}`}
                            onClick={() => setItemQty(it.id, (qty[it.id] ?? 0) - 1)}
                            className="h-7 w-7 rounded-lg border border-shore-200 flex items-center justify-center text-navy-soft hover:text-navy hover:border-shore-300 transition-colors"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-[13px] font-medium text-navy">{qty[it.id] ?? 0}</span>
                          <button
                            type="button"
                            aria-label={`Tambah ${it.label}`}
                            onClick={() => setItemQty(it.id, (qty[it.id] ?? 0) + 1)}
                            className="h-7 w-7 rounded-lg border border-shore-200 flex items-center justify-center text-navy-soft hover:text-navy hover:border-shore-300 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
```

- [ ] **Step 5: Estimasi total + tombol submit**

Ganti blok `{/* Price estimate */}` (yang memakai `destination.priceStart * form.guests`) menjadi:

```tsx
            {/* Price estimate */}
            {destination && totalQty > 0 && (
              <div className="card p-4 flex items-center justify-between">
                <p className="text-[13px] text-navy-soft">Estimasi total</p>
                <p className="text-lg font-semibold text-navy">{formatIDR(total)}</p>
              </div>
            )}
```

Ganti atribut `disabled` tombol submit menjadi:

```tsx
              disabled={submitting || !destination || totalQty === 0}
```

Terakhir, di tombol "Booking Lagi" pada tampilan sukses, tambahkan reset qty setelah `setForm(...)`:

```tsx
                setQty(priceItems.length > 0 ? { [priceItems[0].id]: 1 } : {});
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: tanpa output.

- [ ] **Step 7: Verifikasi manual (opsional)**

Run: `npm run dev` → dari detail destinasi klik "Booking Sekarang".
Expected: daftar item dengan stepper; item pertama qty 1; total berubah sesuai qty; submit nonaktif saat semua qty 0; setelah submit, dokumen `bookings` di Firestore berisi `items` + `amount` benar; "Jumlah Orang" tetap tersimpan di `guests` tanpa memengaruhi total.

- [ ] **Step 8: Commit**

```bash
git add app/booking/page.tsx
git commit -m "feat(pricing): pilih item + qty per item di form booking"
```

---

### Task 5: Panel admin — editor daftar harga dinamis

**Files:**
- Modify: `components/dashboard/DestinasiPanel.tsx`

**Interfaces:**
- Consumes: `getPriceItems`, `PriceItem` (Task 2).
- Produces: dokumen destinasi baru/teredit punya `priceItems` (tanpa menulis `priceStart`); destinasi legacy termigrasi otomatis saat diedit-simpan.

- [ ] **Step 1: Update import & `emptyForm`**

Ganti import (baris 3–11):

```tsx
import {
  subscribeDestinations,
  addDestination,
  updateDestination,
  deleteDestination,
  getPriceItems,
  type Destination,
  type DestinationInput,
  type PriceItem,
} from '@/lib/firestore';
```

Ganti `emptyForm` (baris 13–23) — `priceStart: 0` dihapus, `priceItems: []` masuk:

```tsx
const emptyForm: DestinationInput = {
  name: '',
  location: '',
  emoji: '',
  thumbColor: '#1B8A8F',
  tags: [],
  priceItems: [],
  description: '',
  image: '',
  hasMonitoring: false,
};
```

- [ ] **Step 2: `openEdit` migrasi legacy + helper editor**

Di `openEdit` (baris 82–97), ganti baris `priceStart: d.priceStart,` menjadi:

```tsx
      priceItems: getPriceItems(d),
```

(Untuk destinasi legacy, `getPriceItems` menghasilkan item "Tiket Masuk" dari `priceStart` — tersimpan sebagai `priceItems` saat disave = migrasi bertahap.)

Tambahkan tiga helper di dalam komponen, setelah `closeForm`:

```tsx
  const updateItem = (index: number, patch: Partial<PriceItem>) =>
    setForm((f) => ({
      ...f,
      priceItems: (f.priceItems ?? []).map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }));

  const addItem = () =>
    setForm((f) => ({
      ...f,
      priceItems: [
        ...(f.priceItems ?? []),
        { id: crypto.randomUUID(), label: '', price: 0, unit: '/pax' },
      ],
    }));

  const removeItem = (index: number) =>
    setForm((f) => ({ ...f, priceItems: (f.priceItems ?? []).filter((_, i) => i !== index) }));
```

- [ ] **Step 3: `handleSave` — buang item tanpa nama**

Di `handleSave`, ganti pembentukan `data` menjadi:

```tsx
    const data: DestinationInput = {
      ...form,
      tags: tagInput.split(',').map((t) => t.trim()).filter(Boolean),
      priceItems: (form.priceItems ?? []).filter((it) => it.label.trim() !== ''),
    };
```

- [ ] **Step 4: Ganti field "Harga Mulai" dengan editor list**

Ganti seluruh blok `{/* Price */}` (baris 203–213) menjadi:

```tsx
              {/* Daftar Harga */}
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Daftar Harga</label>
                <div className="space-y-2">
                  {(form.priceItems ?? []).map((item, i) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        value={item.label}
                        onChange={(e) => updateItem(i, { label: e.target.value })}
                        placeholder="Nama item (mis. Tiket Masuk)"
                        className="flex-1 min-w-0 rounded-xl border border-shore-200 bg-surface px-3 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                      />
                      <input
                        type="number"
                        min={0}
                        value={item.price || ''}
                        onChange={(e) => updateItem(i, { price: Math.max(0, Number(e.target.value)) })}
                        placeholder="Harga"
                        className="w-24 rounded-xl border border-shore-200 bg-surface px-3 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                      />
                      <input
                        value={item.unit}
                        onChange={(e) => updateItem(i, { unit: e.target.value })}
                        placeholder="/pax"
                        className="w-20 rounded-xl border border-shore-200 bg-surface px-3 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                      />
                      <button
                        type="button"
                        aria-label={`Hapus ${item.label || 'item'}`}
                        onClick={() => removeItem(i)}
                        className="h-8 w-8 shrink-0 rounded-lg border border-shore-200 flex items-center justify-center text-navy-soft hover:text-red-500 hover:border-red-200 transition-colors"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={addItem} className="btn-ghost w-full rounded-xl px-4 py-2.5 text-[13px]">
                    <PlusIcon />
                    Tambah Item
                  </button>
                </div>
              </div>
```

- [ ] **Step 5: Baris list destinasi**

Ganti baris 301 menjadi:

```tsx
              <p className="text-[12px] text-navy-soft mt-0.5">{d.location} — {getPriceItems(d).length} item harga</p>
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: tanpa output.

- [ ] **Step 7: Verifikasi manual (opsional)**

Di dashboard admin → Destinasi: tambah destinasi dengan 3 item harga → tersimpan; edit destinasi legacy → editor terisi "Tiket Masuk" dari `priceStart`, simpan → dokumen punya `priceItems`; hapus item → hilang dari daftar; baris list menampilkan "N item harga".

- [ ] **Step 8: Commit**

```bash
git add components/dashboard/DestinasiPanel.tsx
git commit -m "feat(pricing): editor daftar harga dinamis di panel admin + migrasi legacy"
```

---

### Task 6: Rincian item di PaymentModal + verifikasi menyeluruh

**Files:**
- Modify: `components/notifications/PaymentModal.tsx`

**Interfaces:**
- Consumes: `Booking.items?: BookingItem[]` (Task 2), `formatIDR` (sudah diimport di file ini).
- Produces: rincian pembayaran per item; booking lama tanpa `items` tampil seperti sebelumnya.

- [ ] **Step 1: Sisipkan rincian item**

Di `PaymentModal.tsx`, sisipkan blok berikut di antara `<h2 ...>{booking.destinationName}</h2>` (baris 88) dan `<div className="mt-4 flex items-center justify-between rounded-xl bg-shore-50 ...">` (baris 90):

```tsx
                {booking.items && booking.items.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {booking.items.map((it, i) => (
                      <li key={i} className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="text-navy-soft">{it.label} ×{it.qty}</span>
                        <span className="font-medium text-navy shrink-0">{formatIDR(it.price * it.qty)}</span>
                      </li>
                    ))}
                  </ul>
                )}
```

Lalu pada `<div>` Total tepat di bawahnya, ganti `mt-4` menjadi `mt-3` agar rapat dengan rincian:

```tsx
                <div className="mt-3 flex items-center justify-between rounded-xl bg-shore-50 px-4 py-3">
```

- [ ] **Step 2: Type-check + lint keseluruhan**

Run: `npx tsc --noEmit && npm run lint`
Expected: tsc tanpa output; lint "No ESLint warnings or errors" (atau hanya warning yang sudah ada sebelum perubahan ini — jangan menambah warning baru).

- [ ] **Step 3: Sisa pemakaian priceStart**

Run: `grep -rn "priceStart" app components lib`
Expected: hanya tersisa di `lib/firestore.ts` (definisi interface + `getPriceItems`). Bila muncul di file lain, itu kelalaian task sebelumnya — perbaiki dulu.

- [ ] **Step 4: Verifikasi manual end-to-end (opsional)**

Checklist dari spec:
1. Card beranda (desktop & mobile) tanpa harga.
2. Detail destinasi menampilkan daftar harga; legacy → satu item "Tiket Masuk".
3. Booking: pilih beberapa item, total benar, dokumen berisi `items` + `amount`; PaymentModal menampilkan rincian.
4. Admin: CRUD item harga; edit legacy memigrasi ke `priceItems`.
5. Booking lama (tanpa `items`) tetap normal di riwayat & PaymentModal.

- [ ] **Step 5: Commit**

```bash
git add components/notifications/PaymentModal.tsx
git commit -m "feat(pricing): rincian item pembayaran di PaymentModal"
```
