'use client';

import { useEffect, useState } from 'react';
import {
  subscribeDestinations,
  addDestination,
  updateDestination,
  deleteDestination,
  type Destination,
  type DestinationInput,
} from '@/lib/firestore';

const emptyForm: DestinationInput = {
  name: '',
  location: '',
  emoji: '',
  thumbColor: '#1B8A8F',
  tags: [],
  priceStart: 0,
  description: '',
  image: '',
  hasMonitoring: false,
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
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DestinationInput>(emptyForm);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeDestinations(setDestinations);
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
      priceStart: d.priceStart,
      description: d.description ?? '',
      image: d.image ?? '',
      hasMonitoring: d.hasMonitoring ?? false,
    });
    setTagInput(d.tags.join(', '));
    setEditingId(d.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.location.trim()) return;
    setSaving(true);
    const data: DestinationInput = {
      ...form,
      tags: tagInput.split(',').map((t) => t.trim()).filter(Boolean),
    };
    if (editingId) {
      await updateDestination(editingId, data);
    } else {
      await addDestination(data);
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
        <button onClick={openAdd} className="btn-primary rounded-xl px-4 py-2.5 text-[13px]">
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
              <button onClick={closeForm} className="text-navy-soft hover:text-navy transition-colors">
                <CloseIcon />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Nama *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nama destinasi"
                  className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Lokasi *</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Kota/Kabupaten"
                  className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Emoji + Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Emoji</label>
                  <input
                    value={form.emoji}
                    onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                    placeholder="e.g. 🏖️"
                    className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Warna Thumb</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.thumbColor}
                      onChange={(e) => setForm({ ...form, thumbColor: e.target.value })}
                      className="h-10 w-10 rounded-lg border border-shore-200 cursor-pointer"
                    />
                    <input
                      value={form.thumbColor}
                      onChange={(e) => setForm({ ...form, thumbColor: e.target.value })}
                      className="flex-1 rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Price */}
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Harga Mulai (Rp)</label>
                <input
                  type="number"
                  value={form.priceStart || ''}
                  onChange={(e) => setForm({ ...form, priceStart: Number(e.target.value) })}
                  placeholder="0"
                  className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Tags (pisahkan dengan koma)</label>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Pantai, Diving, Snorkeling"
                  className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">URL Gambar</label>
                <input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-medium text-navy-soft uppercase tracking-wider mb-1.5">Deskripsi</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Deskripsi singkat tentang destinasi..."
                  rows={3}
                  className="w-full rounded-xl border border-shore-200 bg-surface px-3.5 py-2.5 text-[13px] text-navy outline-none focus:border-teal-400 transition-colors resize-none"
                />
              </div>

              {/* Monitoring IoT */}
              <label className="flex items-center justify-between gap-3 rounded-xl border border-shore-200 bg-surface px-3.5 py-3 cursor-pointer">
                <span>
                  <span className="block text-[13px] font-medium text-navy">Punya stasiun sensor IoT</span>
                  <span className="block text-[11px] text-navy-soft mt-0.5">Tampilkan sensor live di halaman detail destinasi ini</span>
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
                <button onClick={closeForm} className="btn-ghost flex-1 rounded-xl px-4 py-2.5 text-[13px]">
                  Batal
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name.trim() || !form.location.trim()}
                  className="btn-primary flex-1 rounded-xl px-4 py-2.5 text-[13px] disabled:opacity-50"
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
            {/* Thumb */}
            <div
              className="h-12 w-12 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: d.thumbColor + '20', color: d.thumbColor }}
            >
              {d.emoji || '📍'}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-navy truncate">{d.name}</p>
              <p className="text-[12px] text-navy-soft mt-0.5">{d.location} — Rp {d.priceStart?.toLocaleString('id-ID') ?? '0'}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => openEdit(d)}
                className="h-8 w-8 rounded-lg border border-shore-200 flex items-center justify-center text-navy-soft hover:text-teal-600 hover:border-teal-200 transition-colors"
              >
                <EditIcon />
              </button>
              <button
                onClick={() => handleDelete(d.id)}
                className="h-8 w-8 rounded-lg border border-shore-200 flex items-center justify-center text-navy-soft hover:text-red-500 hover:border-red-200 transition-colors"
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
