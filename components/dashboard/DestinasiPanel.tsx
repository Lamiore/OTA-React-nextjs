'use client';

import { useEffect, useState } from 'react';
import {
  subscribeDestinations,
  addDestination,
  updateDestination,
  deleteDestination,
  getPriceItems,
  subscribeAllCameras,
  type Destination,
  type DestinationInput,
  type PriceItem,
  type Camera,
} from '@/lib/firestore';

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
  cameraId: '',
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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DestinationInput>(emptyForm);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeDestinations(setDestinations);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeAllCameras(setCameras);
    return () => unsub();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setTagInput('');
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
      hasMonitoring: d.hasMonitoring ?? false,
      cameraId: d.cameraId ?? '',
    });
    setTagInput(d.tags.join(', '));
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
    // Denormalisasi kamera yang di-link ke dokumen destinasi (publik) supaya
    // halaman /destinations/[id] bisa menampilkan stream tanpa membaca koleksi
    // cameras yang privat. Saat unlink (cameraId kosong) field ini WAJIB
    // di-clear agar stream lama tidak "nyangkut" publik.
    const linkedCam = form.cameraId ? cameras.find((c) => c.id === form.cameraId) : null;
    const data: DestinationInput = {
      ...form,
      tags: tagInput.split(',').map((t) => t.trim()).filter(Boolean),
      priceItems: (form.priceItems ?? []).filter((it) => it.label.trim() !== ''),
      cameraStreamId: linkedCam?.cameraId ?? '',
      cameraName: linkedCam?.name ?? '',
      cameraStreamUrl: linkedCam?.streamUrl ?? '',
    };
    if (editingId) {
      await updateDestination(editingId, data);
    } else {
      await addDestination(data);
    }
    // Single-select: cuma ada 1 stasiun sensor fisik, jadi kalau destinasi ini
    // ditandai sebagai lokasi stasiun, matikan penanda di destinasi lain.
    if (data.hasMonitoring) {
      await Promise.all(
        destinations
          .filter((d) => d.id !== editingId && d.hasMonitoring)
          .map((d) => updateDestination(d.id, { hasMonitoring: false })),
      );
    }
    setSaving(false);
    closeForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus destinasi ini?')) return;
    await deleteDestination(id);
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
                        <input
                          value={item.unit}
                          onChange={(e) => updateItem(i, { unit: e.target.value })}
                          placeholder="/pax"
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

              {/* Hubungkan Kamera */}
              <div>
                <label className="block text-xs font-medium text-navy-soft mb-1.5">Hubungkan Kamera Mitra/Pengelola</label>
                <select aria-label="Hubungkan Kamera Mitra/Pengelola"
                  value={form.cameraId || ''}
                  onChange={(e) => setForm({ ...form, cameraId: e.target.value })}
                  className="w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                >
                  <option value="">-- Tanpa Kamera --</option>
                  {cameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.name} {cam.location ? `(${cam.location})` : ''} — {cam.ownerName || 'Mitra'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Monitoring IoT */}
              <label className="flex items-center justify-between gap-3 rounded-md border border-shore-200 bg-surface px-3.5 py-3 cursor-pointer">
                <span>
                  <span className="block text-sm font-medium text-navy">Lokasi stasiun sensor IoT</span>
                  <span className="block text-2xs text-navy-soft mt-0.5">Tampilkan panel sensor lengkap di destinasi ini. Hanya 1 destinasi — mengaktifkan di sini otomatis mematikan yang lain.</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.hasMonitoring ?? false}
                  onChange={(e) => setForm({ ...form, hasMonitoring: e.target.checked })}
                  className="h-5 w-5 shrink-0 rounded border-shore-300 text-teal-500 focus:ring-teal-400 cursor-pointer"
                />
              </label>

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
                onClick={() => handleDelete(d.id)}
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
