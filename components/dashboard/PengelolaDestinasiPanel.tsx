'use client';

import { useEffect, useState } from 'react';
import {
  addChildDestination,
  deleteDestination,
  subscribeDestinations,
  updateDestination,
  getPriceItems,
  type Destination,
  type PriceItem,
} from '@/lib/firestore';
import { cleanPriceItems } from '@/lib/destination';
import { parseCoords, waLink } from '@/lib/format';

/**
 * Panel destinasi untuk pengelola — sengaja terpisah dari DestinasiPanel milik
 * admin, bukan DestinasiPanel yang diberi prop `role`.
 *
 * Alasannya bukan gaya: form admin memegang `managerUid`, `stationId`, dan
 * `cameraId` di state yang sama, dan menyimpannya dengan mengirim seluruh objek
 * form. Kalau panel ini menumpang di sana, tiap kolom baru yang ditambahkan
 * admin kelak otomatis ikut bisa ditulis pengelola. Di sini kolomnya dikunci
 * sejak awal: hanya yang dijanjikan Pasal 3 Perjanjian Pengelola.
 *
 * EDITABLE_KEYS harus sama persis dengan daftar di firestore.rules
 * (`affectedKeys().hasOnly([...])`). Menambah kolom di sini tanpa menambahnya
 * di rules akan membuat penyimpanan gagal total dengan permission-denied.
 */
const EDITABLE_KEYS = [
  'description',
  'image',
  'images',
  'lat',
  'lng',
  'priceItems',
  'whatsapp',
] as const;

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M12 5v14" />
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

interface Props {
  uid: string;
}

export default function PengelolaDestinasiPanel({ uid }: Props) {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  /** Id destinasi yang sedang dibukakan kolom "tambah destinasi di dalam". */
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [imagesInput, setImagesInput] = useState('');
  const [coordInput, setCoordInput] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [priceItems, setPriceItems] = useState<PriceItem[]>([]);

  useEffect(() => {
    const unsub = subscribeDestinations((all) => {
      setDestinations(all.filter((d) => d.managerUid === uid));
      setLoaded(true);
    });
    return () => unsub();
  }, [uid]);

  const startEdit = (d: Destination) => {
    setEditingId(d.id);
    setError('');
    setSaved(false);
    setDescription(d.description ?? '');
    setImage(d.image ?? '');
    setImagesInput((d.images ?? []).join('\n'));
    // Koordinat digabung satu kolom: Google Maps menyalin "lat, lng" sekaligus.
    setCoordInput(d.lat != null && d.lng != null ? `${d.lat}, ${d.lng}` : '');
    setWhatsapp(d.whatsapp ?? '');
    setPriceItems(getPriceItems(d));
  };

  const updateItem = (index: number, patch: Partial<PriceItem>) =>
    setPriceItems((items) => items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const addItem = () =>
    setPriceItems((items) => [
      ...items,
      { id: crypto.randomUUID(), label: '', description: '', price: 0, unit: '/pax' },
    ]);

  const removeItem = (index: number) =>
    setPriceItems((items) => items.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!editingId) return;
    // Koordinat separuh terisi ditolak di sini, bukan diam-diam dibuang: kalau
    // dibiarkan, tombol "Rute ke lokasi" hilang tanpa pengelola tahu kenapa.
    const coords = coordInput.trim() === '' ? null : parseCoords(coordInput);
    if (coordInput.trim() !== '' && !coords) {
      setError('Koordinat belum berbentuk "lat, lng". Salin dari Google Maps: klik kanan di titik lokasi, lalu klik koordinatnya.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await updateDestination(editingId, {
        description: description.trim(),
        image: image.trim(),
        images: imagesInput.split('\n').map((u) => u.trim()).filter(Boolean),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        whatsapp: whatsapp.trim(),
        // Item tanpa nama dibuang — barisnya kosong dan tidak berguna di kartu.
        priceItems: cleanPriceItems(priceItems),
      });
      setSaved(true);
      setEditingId(null);
    } catch {
      setError('Gagal menyimpan. Kalau ini berulang, hubungi admin — kemungkinan izin destinasi ini sudah dipindahkan.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddChild = async (parent: Destination) => {
    const name = newName.trim();
    if (!name) return;
    setError('');
    setSaving(true);
    try {
      await addChildDestination(parent, name);
      setAddingTo(null);
      setNewName('');
    } catch {
      setError(
        'Gagal menambah destinasi. Kalau ini berulang, hubungi admin — kemungkinan izin destinasi induknya sudah dipindahkan.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteChild = async (d: Destination) => {
    // Anak dari anak tidak bisa dibuat lewat panel ini, tapi bisa lewat SDK.
    // Kalau induknya dihapus, isinya jadi dokumen tanpa jalan masuk: tidak
    // tampil di beranda (bukan tingkat atas) dan tidak di halaman mana pun.
    if (destinations.some((x) => x.parentId === d.id)) {
      setError(`"${d.name}" masih berisi destinasi lain. Hapus isinya dulu.`);
      return;
    }
    if (!confirm(`Hapus "${d.name}"? Deskripsi, foto, dan daftar harganya ikut hilang.`)) return;
    setError('');
    try {
      await deleteDestination(d.id);
    } catch {
      setError('Gagal menghapus. Kalau ini berulang, hubungi admin.');
    }
  };

  const inputClass =
    'w-full rounded-md border border-shore-200 bg-surface px-3.5 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors';

  if (!loaded) return null;

  if (destinations.length === 0) {
    return (
      <div>
        <h1 className="font-serif text-2xl font-medium text-navy">Destinasi</h1>
        <div className="card mt-6 p-6">
          <p className="text-sm text-navy-soft leading-relaxed">
            Belum ada destinasi yang tertaut ke akun ini. Destinasi dibuat otomatis
            begitu pengajuan pengelola disetujui — kalau pengajuanmu sudah disetujui
            tapi bagian ini masih kosong, hubungi admin.
          </p>
        </div>
      </div>
    );
  }

  const editing = destinations.find((d) => d.id === editingId);

  // Yang berdiri di tingkat atas daftar ini: destinasi tanpa induk, DAN
  // destinasi yang induknya tidak ada di daftar (induknya terhapus, atau
  // dipindah ke pengelola lain). Tanpa cabang kedua, dokumen seperti itu tidak
  // tampil di baris mana pun — pengelola tidak punya cara menyuntingnya lagi,
  // padahal halaman publiknya masih hidup.
  const ownedIds = new Set(destinations.map((d) => d.id));
  const roots = destinations.filter((d) => !d.parentId || !ownedIds.has(d.parentId));
  const childrenOf = (parentId: string) =>
    destinations
      .filter((d) => d.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h1 className="font-serif text-2xl font-medium text-navy">Destinasi</h1>
      <p className="text-sm text-navy-soft mt-1.5 leading-relaxed">
        Kamu bisa mengubah deskripsi, foto, titik lokasi, daftar harga, dan kontak
        WhatsApp. Nama dan wilayah ditetapkan admin — hubungi admin bila perlu diubah.
        Kalau kawasanmu berisi beberapa tempat, tambahkan masing-masing sebagai
        destinasi di dalamnya: tiap tempat dapat halaman, harga, dan ulasannya sendiri.
      </p>

      {saved && !editing && (
        <p className="mt-4 rounded-md border border-teal-400/40 bg-teal-50/60 px-4 py-2.5 text-sm text-teal-800">
          Perubahan tersimpan.
        </p>
      )}

      {!editing && error && (
        <p className="mt-4 text-xs text-danger leading-relaxed">{error}</p>
      )}

      {!editing && (
        <div className="mt-6 space-y-6">
          {roots.map((parent) => {
            const inside = childrenOf(parent.id);
            return (
              <div key={parent.id} className="space-y-2">
                <div className="card flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-navy capitalize">{parent.name}</p>
                    <p className="text-xs text-navy-soft mt-0.5">
                      {parent.location} — {getPriceItems(parent).length} item harga
                      {inside.length > 0 && ` · ${inside.length} destinasi di dalam`}
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(parent)}
                    className="btn-ghost shrink-0 px-4 py-2 text-sm"
                  >
                    Edit
                  </button>
                </div>

                {/* Isi destinasi ini. Menjorok ke kanan dengan garis di kiri:
                    hubungannya induk–anak, dan daftar rata yang cuma diberi
                    label tidak menunjukkan mana milik siapa saat pengelola
                    memegang lebih dari satu kawasan. */}
                <div className="ml-4 space-y-2 border-l border-shore-200 pl-4">
                  {inside.map((child) => (
                    <div key={child.id} className="card flex items-center justify-between gap-3 p-3.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-navy capitalize">{child.name}</p>
                        <p className="text-xs text-navy-soft mt-0.5">
                          {getPriceItems(child).length} item harga
                          {!child.description && ' · belum ada deskripsi'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => startEdit(child)}
                          className="btn-ghost px-4 py-2 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteChild(child)}
                          aria-label={`Hapus ${child.name}`}
                          className="h-8 w-8 rounded-sm border border-shore-200 flex items-center justify-center text-navy-soft hover:text-danger hover:border-danger-rule transition-colors"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}

                  {addingTo === parent.id ? (
                    <div className="card space-y-2.5 p-3.5">
                      <input
                        aria-label="Nama destinasi di dalam"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        // Enter mengirim: kolomnya cuma satu, dan menambah lima
                        // spot berturut-turut lewat mouse saja itu lima kali
                        // perjalanan ke tombol.
                        onKeyDown={(e) => e.key === 'Enter' && handleAddChild(parent)}
                        autoFocus
                        placeholder="Nama tempatnya (mis. Pulau Bangka)"
                        className={inputClass}
                      />
                      <p className="text-2xs text-navy-soft">
                        Wilayahnya ikut {parent.location}. Deskripsi, foto, dan daftar
                        harganya diisi lewat Edit setelah ini dibuat.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddChild(parent)}
                          disabled={saving || newName.trim() === ''}
                          className="btn-primary px-5 py-2 text-sm disabled:opacity-50"
                        >
                          {saving ? 'Menambah…' : 'Tambah'}
                        </button>
                        <button
                          onClick={() => { setAddingTo(null); setNewName(''); setError(''); }}
                          disabled={saving}
                          className="btn-ghost px-5 py-2 text-sm disabled:opacity-50"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingTo(parent.id); setNewName(''); setError(''); }}
                      className="btn-ghost w-full px-4 py-2.5 text-sm"
                    >
                      <PlusIcon />
                      Tambah destinasi di dalam
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="card mt-6 p-6 space-y-5">
          <div>
            <p className="text-sm font-medium text-navy capitalize">{editing.name}</p>
            <p className="text-xs text-navy-soft mt-0.5">
              {editing.location}
              {editing.parentId && (
                <> — di dalam {destinations.find((d) => d.id === editing.parentId)?.name}</>
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-navy-soft mb-1.5">Deskripsi</label>
            <textarea aria-label="Deskripsi"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Ceritakan destinasinya: apa yang bisa dilakukan, kondisi lokasi, waktu terbaik berkunjung."
              className={`${inputClass} resize-y`}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-navy-soft mb-1.5">URL Foto Utama</label>
            <input aria-label="URL Foto Utama"
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-navy-soft mb-1.5">Galeri (satu URL per baris)</label>
            <textarea aria-label="Galeri"
              value={imagesInput}
              onChange={(e) => setImagesInput(e.target.value)}
              rows={3}
              placeholder={'https://...\nhttps://...'}
              className={`${inputClass} resize-none`}
            />
            <p className="mt-1.5 text-2xs text-navy-soft">
              Foto tambahan, tampil sebagai strip geser di bawah deskripsi.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-navy-soft mb-1.5">Koordinat</label>
            <input aria-label="Koordinat"
              value={coordInput}
              onChange={(e) => setCoordInput(e.target.value)}
              placeholder="1.7241, 125.0631"
              className={inputClass}
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

          <div>
            <label className="block text-xs font-medium text-navy-soft mb-1.5">WhatsApp</label>
            <input aria-label="WhatsApp"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="0812xxxxxxxx"
              className={inputClass}
            />
            <p className="mt-1.5 text-2xs text-navy-soft">
              {whatsapp.trim() === '' ? (
                <>Kosongkan untuk menyembunyikan tombol &ldquo;Chat pengelola&rdquo;.</>
              ) : waLink(whatsapp) ? (
                <>Tombol chat membuka <code className="text-navy">{waLink(whatsapp)?.replace('https://', '')}</code>.</>
              ) : (
                <span className="text-danger">Nomor terlalu pendek.</span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-navy-soft mb-1.5">Daftar Harga</label>
            <div className="space-y-2">
              {priceItems.map((item, i) => (
                <div key={item.id} className="rounded-md border border-shore-200 bg-surface/60 p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <input aria-label="Nama item"
                      value={item.label}
                      onChange={(e) => updateItem(i, { label: e.target.value })}
                      placeholder="Nama item (mis. Tiket Masuk)"
                      className="flex-1 min-w-0 rounded-md border border-shore-200 bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                    />
                    <input
                      type="number"
                      min={0}
                      aria-label="Harga"
                      value={item.price || ''}
                      onChange={(e) => updateItem(i, { price: Math.max(0, Number(e.target.value)) })}
                      placeholder="Harga"
                      className="w-24 rounded-md border border-shore-200 bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                    />
                    <input
                      aria-label="Satuan"
                      value={item.unit}
                      onChange={(e) => updateItem(i, { unit: e.target.value })}
                      placeholder="/pax"
                      className="w-20 rounded-md border border-shore-200 bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-teal-400 transition-colors"
                    />
                    {/* Stok/hari. Kosong ≠ 0: kosong berarti tanpa batas,
                        0 berarti item ini tutup. Lihat PriceItem.stock. */}
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
                    aria-label="Deskripsi item"
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
                    {/* Pratinjau sekecil ini bukan hiasan: URL foto paling sering
                        salah tempel, dan tanpa ini pengelola baru tahu setelah
                        menyimpan lalu membuka halaman publiknya. */}
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

          {error && <p className="text-xs text-danger leading-relaxed">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
            >
              {saving ? 'Menyimpan…' : 'Simpan'}
            </button>
            <button
              onClick={() => { setEditingId(null); setError(''); }}
              disabled={saving}
              className="btn-ghost px-6 py-2.5 text-sm disabled:opacity-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { EDITABLE_KEYS };
