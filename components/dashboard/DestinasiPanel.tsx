'use client';

import { useEffect, useState } from 'react';
import {
  subscribeDestinations,
  addDestination,
  updateDestination,
  deleteDestination,
  getPriceItems,
  subscribeAllCameras,
  subscribeUsers,
  type Destination,
  type DestinationInput,
  type PriceItem,
  type Camera,
  type AppUser,
} from '@/lib/firestore';
import { cleanPriceItems, destinationCameraIds, parentOptions } from '@/lib/destination';
import { sanitizeStationId, stationPath } from '@/lib/realtime';
import { parseCoords, waLink } from '@/lib/format';

const emptyForm: DestinationInput = {
  name: '',
  location: '',
  emoji: '',
  thumbColor: '#1B8A8F',
  tags: [],
  priceItems: [],
  description: '',
  image: '',
  images: [],
  lat: null,
  lng: null,
  whatsapp: '',
  hasMonitoring: false,
  stationId: '',
  cameraIds: [],
  managerUid: '',
  parentId: '',
};

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export default function DestinasiPanel() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [pengelola, setPengelola] = useState<AppUser[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DestinationInput>(emptyForm);
  const [tagInput, setTagInput] = useState('');
  // Koordinat & galeri disunting sebagai teks mentah, baru diurai saat simpan —
  // biar admin bebas mengetik setengah jalan tanpa field ikut jadi invalid.
  const [coordInput, setCoordInput] = useState('');
  const [imagesInput, setImagesInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeDestinations(setDestinations);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAllCameras(setCameras);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeUsers((users) =>
      setPengelola(users.filter((u) => u.role === 'pengelola')),
    );
    return () => unsub();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setTagInput('');
    setCoordInput('');
    setImagesInput('');
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (d: Destination) => {
    setForm({
      name: d.name,
      location: d.location,
      emoji: d.emoji,
      thumbColor: d.thumbColor,
      tags: d.tags,
      priceItems: getPriceItems(d),
      description: d.description ?? '',
      image: d.image ?? '',
      images: d.images ?? [],
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      whatsapp: d.whatsapp ?? '',
      hasMonitoring: d.hasMonitoring ?? false,
      stationId: d.stationId ?? '',
      // Lewat helper, bukan d.cameraIds langsung: destinasi lama menyimpan satu
      // kamera di `cameraId` dan tanpa ini pilihannya hilang saat diedit.
      cameraIds: destinationCameraIds(d),
      managerUid: d.managerUid ?? '',
      parentId: d.parentId ?? '',
    });
    setTagInput(d.tags.join(', '));
    setCoordInput(
      typeof d.lat === 'number' && typeof d.lng === 'number' ? `${d.lat}, ${d.lng}` : '',
    );
    setImagesInput((d.images ?? []).join('\n'));
    setEditingId(d.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

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
        { id: crypto.randomUUID(), label: '', description: '', price: 0, unit: '/pax' },
      ],
    }));

  const removeItem = (index: number) =>
    setForm((f) => ({ ...f, priceItems: (f.priceItems ?? []).filter((_, i) => i !== index) }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.location.trim()) return;
    setSaving(true);
    // Koordinat ditulis berpasangan sebagai null saat kosong/tidak valid —
    // Firestore menolak undefined, dan null membersihkan nilai lama saat edit.
    const coords = parseCoords(coordInput);
    const data: DestinationInput = {
      ...form,
      tags: tagInput.split(',').map((t) => t.trim()).filter(Boolean),
      priceItems: cleanPriceItems(form.priceItems ?? []),
      images: imagesInput.split('\n').map((u) => u.trim()).filter(Boolean),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      whatsapp: (form.whatsapp ?? '').trim(),
      // Stasiun dimatikan → id paket sensor ikut dibersihkan, biar destinasi ini
      // tidak diam-diam masih menempel ke cabang RTDB paket lama.
      stationId: form.hasMonitoring ? (form.stationId ?? '') : '',
    };
    if (editingId) {
      await updateDestination(editingId, data);
    } else {
      await addDestination(data);
    }
    setSaving(false);
    closeForm();
  };

  const handleDelete = async (d: Destination) => {
    // Menghapus induk lebih dulu membuat isinya jadi dokumen tanpa jalan masuk:
    // bukan tingkat atas jadi tidak muncul di beranda, dan halaman induk yang
    // dulu memajangnya sudah tidak ada. Dokumennya hidup terus tanpa terlihat
    // siapa pun — termasuk pengelolanya, yang butuh induk untuk mengurusnya.
    const inside = destinations.filter((x) => x.parentId === d.id);
    if (inside.length > 0) {
      alert(
        `"${d.name}" masih berisi ${inside.length} destinasi di dalamnya ` +
          `(${inside.map((x) => x.name).join(', ')}). Hapus atau pindahkan isinya dulu.`,
      );
      return;
    }
    if (!confirm('Hapus destinasi ini?')) return;
    await deleteDestination(d.id);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-medium text-navy">Destinasi</h1>
          <p className="mt-1 text-sm text-navy-soft">{destinations.length} destinasi terdaftar</p>
        </div>
        <button onClick={openAdd} className="btn-primary px-4 py-2.5 text-sm">
          <PlusIcon />
          Tambah
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/30 backdrop-blur-sm animate-fade-in" onClick={closeForm}>
          <div className="w-full max-w-lg card p-6 max-h-[85dvh] overflow-y-auto animate-fade-up m-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif text-lg font-medium text-navy">
                {editingId ? 'Edit Destinasi' : 'Tambah Destinasi'}
              </h2>
              <button onClick={closeForm} aria-label="Tutup" className="text-navy-soft hover:text-navy transition-colors">
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Nama *</label>
                <input aria-label="Nama"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nama destinasi"
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Lokasi *</label>
                <input aria-label="Lokasi"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Kota/Kabupaten"
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Induk — kolom yang memutuskan destinasi ini jadi "toko" di
                  beranda atau isi dari toko lain. Sebuah pilihan, bukan tombol
                  "tambah di dalam" seperti panel pengelola: admin juga perlu
                  memindahkan destinasi yang terlanjur salah tempat, dan satu
                  kolom di form yang sudah ada mengerjakan keduanya. */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Di Dalam Destinasi</label>
                <select aria-label="Di Dalam Destinasi"
                  value={form.parentId ?? ''}
                  onChange={(e) => {
                    const parent = destinations.find((d) => d.id === e.target.value);
                    setForm({
                      ...form,
                      parentId: e.target.value,
                      // Wilayah ikut induk kalau masih kosong — sama seperti spot
                      // buatan pengelola, yang selalu mewarisi lokasi induknya.
                      // Yang sudah diisi tidak ditimpa: admin boleh saja punya
                      // alasan menaruh spot lintas kabupaten.
                      location: form.location.trim() === '' && parent ? parent.location : form.location,
                    });
                  }}
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                >
                  <option value="">-- Destinasi utama (tampil di beranda) --</option>
                  {parentOptions(destinations, editingId).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} — {d.location}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-2xs text-navy-soft">
                  Pilih induk untuk menjadikannya spot di dalam destinasi lain: tidak
                  tampil di beranda, melainkan di halaman induknya. Pilihan tidak memuat
                  destinasi ini sendiri maupun isinya.
                </p>
              </div>

              {/* Koordinat — satu kolom, bukan dua, karena Google Maps menyalin
                  "lat, lng" sekaligus: klik kanan di titik lokasi lalu klik
                  angkanya. Menempel apa adanya sudah benar. */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Koordinat</label>
                <input aria-label="Koordinat"
                  value={coordInput}
                  onChange={(e) => setCoordInput(e.target.value)}
                  placeholder="1.7241, 125.0631"
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                />
                <p className="mt-1.5 text-2xs text-navy-soft">
                  {coordInput.trim() === '' ? (
                    <>Kosongkan untuk menyembunyikan tombol &ldquo;Rute ke lokasi&rdquo;.</>
                  ) : parseCoords(coordInput) ? (
                    <>Valid — tombol &ldquo;Rute ke lokasi&rdquo; akan tampil di halaman destinasi.</>
                  ) : (
                    <span className="text-danger">
                      Belum berbentuk <code>lat, lng</code>. Salin dari Google Maps: klik kanan di titik lokasi, lalu klik koordinatnya.
                    </span>
                  )}
                </p>
              </div>

              {/* WhatsApp pengelola */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">WhatsApp Pengelola</label>
                <input aria-label="WhatsApp Pengelola"
                  value={form.whatsapp ?? ''}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="0812xxxxxxxx"
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                />
                <p className="mt-1.5 text-2xs text-navy-soft">
                  {(form.whatsapp ?? '').trim() === '' ? (
                    <>Kosongkan untuk menyembunyikan tombol &ldquo;Chat pengelola&rdquo;.</>
                  ) : waLink(form.whatsapp ?? '') ? (
                    <>Tombol chat membuka <code className="text-navy">{waLink(form.whatsapp ?? '')?.replace('https://', '')}</code>.</>
                  ) : (
                    <span className="text-danger">Nomor terlalu pendek.</span>
                  )}
                </p>
              </div>

              {/* Warna thumb — dipakai sebagai bidang pelat tipografis pada
                  kartu destinasi yang belum punya foto.
                  Input Emoji dihapus: situs publik tidak lagi merender emoji
                  (lihat design.md § Per-page allowances), jadi mengeditnya di
                  sini berarti mengurus data yang tak pernah dilihat pengunjung.
                  Nilai `emoji` yang sudah ada di Firestore tetap dibawa apa
                  adanya saat menyimpan — tidak ada data yang dihapus. */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-navy-soft mb-1.5">Warna Thumb</label>
                  <div className="flex items-center gap-2">
                    <input aria-label="Warna Thumb"
                      type="color"
                      value={form.thumbColor}
                      onChange={(e) => setForm({ ...form, thumbColor: e.target.value })}
                      className="h-10 w-10 rounded-sm border border-shore-200 cursor-pointer"
                    />
                    <input
                      aria-label="Warna thumb (kode hex)"
                      value={form.thumbColor}
                      onChange={(e) => setForm({ ...form, thumbColor: e.target.value })}
                      className="flex-1 rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Daftar Harga */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Daftar Harga</label>
                <div className="space-y-2">
                  {(form.priceItems ?? []).map((item, i) => (
                    <div key={item.id} className="rounded-md border border-shore-200 bg-surface/60 p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <input aria-label="Daftar Harga"
                          value={item.label}
                          onChange={(e) => updateItem(i, { label: e.target.value })}
                          placeholder="Nama item (mis. Tiket Masuk)"
                          className="flex-1 min-w-0 rounded-md border border-shore-200 bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                        />
                        <input
                          type="number"
                          min={0}
                          value={item.price || ''}
                          onChange={(e) => updateItem(i, { price: Math.max(0, Number(e.target.value)) })}
                          placeholder="Harga"
                          className="w-24 rounded-md border border-shore-200 bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                        />
                        {/* Satuan bukan cuma hiasan: tulis "/jam" di sini dan
                            item ini jadi sewa per jam — halaman booking minta
                            durasinya dan harganya dikali jam (lihat isHourly di
                            lib/destination). */}
                        <input
                          value={item.unit}
                          onChange={(e) => updateItem(i, { unit: e.target.value })}
                          placeholder="/pax"
                          title='Satuan. Tulis "/jam" untuk sewa per jam — harganya dikali durasi'
                          className="w-20 rounded-md border border-shore-200 bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                        />
                        {/* Stok/hari. Kosong ≠ 0: kosong berarti tanpa batas
                            (semua destinasi lama), 0 berarti tutup hari itu.
                            Karena itu '' dikirim sebagai undefined, bukan 0. */}
                        <input
                          type="number"
                          min={0}
                          aria-label={`Stok per hari ${item.label || 'item'}`}
                          value={item.stock ?? ''}
                          onChange={(e) =>
                            updateItem(i, {
                              stock: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)),
                            })
                          }
                          placeholder="∞"
                          title="Stok per hari — kosongkan untuk tanpa batas"
                          className="w-20 rounded-md border border-shore-200 bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                        />
                        <button
                          type="button"
                          aria-label={`Hapus ${item.label || 'item'}`}
                          onClick={() => removeItem(i)}
                          className="h-8 w-8 shrink-0 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:text-danger hover:border-danger-rule transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                      <input
                        value={item.description ?? ''}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        placeholder="Deskripsi singkat (opsional) — mis. Sudah termasuk pemandu & alat"
                        className="w-full rounded-md border border-shore-200 bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          aria-label="URL foto item"
                          value={item.image ?? ''}
                          onChange={(e) => updateItem(i, { image: e.target.value })}
                          placeholder="URL foto (opsional) — item berfoto tampil sebagai kartu bergambar"
                          className="min-w-0 flex-1 rounded-md border border-shore-200 bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                        />
                        {item.image?.trim() && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.image}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-sm border border-shore-200 object-cover"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addItem} className="btn-ghost w-full px-4 py-2.5 text-sm">
                    <PlusIcon />
                    Tambah Item
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Tags (pisahkan dengan koma)</label>
                <input aria-label="Tags (pisahkan dengan koma)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Pantai, Diving, Snorkeling"
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">URL Gambar</label>
                <input aria-label="URL Gambar"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Galeri — satu URL per baris; textarea, bukan daftar field
                  dinamis, karena admin menempel beberapa tautan sekaligus. */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Galeri (satu URL per baris)</label>
                <textarea aria-label="Galeri"
                  value={imagesInput}
                  onChange={(e) => setImagesInput(e.target.value)}
                  placeholder={'https://...\nhttps://...'}
                  rows={3}
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors resize-none"
                />
                <p className="mt-1.5 text-2xs text-navy-soft">
                  Foto tambahan, tampil sebagai strip geser di bawah deskripsi. URL Gambar di atas tetap jadi foto utama.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Deskripsi</label>
                <textarea aria-label="Deskripsi"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Deskripsi singkat tentang destinasi..."
                  rows={3}
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors resize-none"
                />
              </div>

              {/* Hubungkan Kamera — boleh lebih dari satu per destinasi. */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">
                  Hubungkan Kamera Pengelola
                </label>
                {cameras.length === 0 ? (
                  <p className="text-xs text-navy-soft">Belum ada kamera terdaftar.</p>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-shore-200 bg-surface p-2">
                    {cameras.map((cam) => {
                      const checked = (form.cameraIds ?? []).includes(cam.id);
                      return (
                        <label
                          key={cam.id}
                          className="flex cursor-pointer items-start gap-2.5 rounded-sm px-2 py-1.5 hover:bg-shore-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                cameraIds: e.target.checked
                                  ? [...(form.cameraIds ?? []), cam.id]
                                  : (form.cameraIds ?? []).filter((id) => id !== cam.id),
                              })
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-teal-600"
                          />
                          <span className="text-sm text-navy">
                            {cam.name} {cam.location ? `(${cam.location})` : ''}{' '}
                            <span className="text-navy-soft">— {cam.ownerName || 'Pengelola'}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1.5 text-2xs text-navy-soft">
                  Boleh pilih lebih dari satu. Urutan centangnya jadi urutan tayang di
                  halaman destinasi. Kosongkan semua kalau destinasi ini tanpa kamera.
                </p>
              </div>

              {/* Pengelola — user berperan 'pengelola' yang mengelola destinasi ini. */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Pengelola</label>
                <select aria-label="Pengelola"
                  value={form.managerUid || ''}
                  onChange={(e) => setForm({ ...form, managerUid: e.target.value })}
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                >
                  <option value="">-- Tanpa Pengelola --</option>
                  {pengelola.map((p) => (
                    <option key={p.uid} value={p.uid}>
                      {p.name || 'Tanpa Nama'} — {p.email}
                    </option>
                  ))}
                </select>
                {pengelola.length === 0 && (
                  <p className="mt-1.5 text-2xs text-navy-soft">
                    Belum ada pengguna berperan pengelola. Tetapkan peran di panel Pengguna dulu.
                  </p>
                )}
              </div>

              {/* Monitoring IoT */}
              <div className="rounded-md border border-shore-200 bg-surface px-3.5 py-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span>
                    <span className="block text-sm font-medium text-navy">Punya stasiun sensor IoT</span>
                    <span className="block text-2xs text-navy-soft mt-0.5">Tampilkan panel sensor lengkap di destinasi ini.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.hasMonitoring ?? false}
                    onChange={(e) => setForm({ ...form, hasMonitoring: e.target.checked })}
                    className="h-5 w-5 shrink-0 rounded border-shore-300 text-teal-500 focus:ring-teal-400 cursor-pointer"
                  />
                </label>

                {form.hasMonitoring && (
                  <div className="mt-3 border-t border-shore-200/80 pt-3">
                    <label className="block text-xs font-medium text-navy-soft mb-1.5">ID Paket Sensor</label>
                    <input aria-label="ID Paket Sensor"
                      value={form.stationId ?? ''}
                      onChange={(e) => setForm({ ...form, stationId: sanitizeStationId(e.target.value) })}
                      placeholder="cth: bahoi"
                      className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                    />
                    <p className="mt-1.5 text-2xs text-navy-soft">
                      {form.stationId
                        ? <>Firmware paket ini harus PUT ke <code className="text-navy">monitoring/{form.stationId}/latest</code>.</>
                        : <>Kosongkan untuk paket pertama (firmware lama, datanya di <code className="text-navy">monitoring/latest</code>). Isi id berbeda untuk tiap paket sensor tambahan.</>}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={closeForm} className="btn-ghost flex-1 px-4 py-2.5 text-sm">
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.location.trim()}
                  className="btn-primary flex-1 px-4 py-2.5 text-sm disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan' : 'Tambah'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div className="mt-6 space-y-3">
        {destinations.length === 0 && (
          <div className="card p-8 text-center">
            <p className="text-sm text-navy-soft">Belum ada destinasi. Klik &ldquo;Tambah&rdquo; untuk menambahkan.</p>
          </div>
        )}
        {destinations.map((d) => (
          <div key={d.id} className="card flex items-center gap-4 px-5 py-4">
            {/* Thumb — foto kalau ada, selain itu pelat tipografis yang sama
                seperti yang dilihat pengunjung di kartu destinasi. Admin jadi
                melihat persis tampilan publiknya. */}
            {d.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.image}
                alt=""
                loading="lazy"
                className="h-12 w-12 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md font-serif text-lg font-semibold text-white"
                style={{ background: d.thumbColor }}
                aria-hidden="true"
              >
                {d.name.trim().charAt(0).toUpperCase()}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy truncate">{d.name}</p>
              <p className="text-xs text-navy-soft mt-0.5">{d.location} — {getPriceItems(d).length} item harga</p>
              {/* Spot di dalam kawasan lain: dibuat pengelola sendiri, dan tidak
                  pernah tampil di beranda. Tanpa baris ini daftar admin terbaca
                  seperti destinasi yang hilang dari beranda tanpa sebab. */}
              {d.parentId && (
                <p className="text-2xs text-navy-soft mt-0.5 truncate">
                  Di dalam: {destinations.find((p) => p.id === d.parentId)?.name ?? 'induk terhapus'}
                </p>
              )}
              <p className="text-2xs text-navy-soft mt-0.5 truncate">
                Pengelola: {d.managerUid
                  ? pengelola.find((p) => p.uid === d.managerUid)?.name || 'Tanpa Nama'
                  : <span className="text-warn">belum ditetapkan</span>}
              </p>
              {stationPath(d) && (
                <p className="text-2xs text-navy-soft mt-0.5 truncate">
                  Sensor: <code>{stationPath(d)}</code>
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => openEdit(d)}
                aria-label={`Ubah `}
                className="h-8 w-8 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:text-teal-600 hover:border-teal-200 transition-colors"
              >
                <EditIcon />
              </button>
              <button
                onClick={() => handleDelete(d)}
                aria-label={`Hapus `}
                className="h-8 w-8 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:text-danger hover:border-danger-rule transition-colors"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
