/**
 * Cek kamus dua bahasa. Yang dijaga di sini: tidak ada terjemahan yang
 * tertinggal (kunci yang cuma punya bahasa Indonesia akan tampil sebagai teks
 * Indonesia di UI Inggris tanpa error apa pun — jenis bug yang tidak kelihatan
 * sampai ada yang melapor), dan penyisipan variabel benar-benar tersubstitusi.
 *
 * Jalankan: node lib/i18n.check.ts
 */
import assert from 'node:assert/strict';
import { DICT_KEYS, LANGS, dateLocale, dictEntry, t } from './i18n.ts';

// Tiap kunci punya kedua bahasa, terisi, dan bukan cuma spasi.
for (const key of DICT_KEYS) {
  const entry = dictEntry(key)!;
  for (const { value: lang } of LANGS) {
    assert.ok(
      entry[lang] && entry[lang].trim().length > 0,
      `kunci "${key}" belum punya terjemahan ${lang}`
    );
  }
}

// Kamusnya tidak kosong — kalau DICT gagal ter-load, loop di atas lolos diam-diam.
assert.ok(DICT_KEYS.length > 50, 'kamus terlalu kecil, kemungkinan gagal ter-load');

// Kunci yang ada diterjemahkan sesuai bahasanya.
assert.equal(t('nav.home', 'id'), 'Beranda');
assert.equal(t('nav.home', 'en'), 'Home');

// Kunci yang tidak ada dikembalikan apa adanya, bukan string kosong: layar tetap
// terbaca dan kunci yang salah ketik langsung kelihatan.
assert.equal(t('tidak.ada.kunci.ini', 'en'), 'tidak.ada.kunci.ini');
assert.equal(t('tidak.ada.kunci.ini', 'id'), 'tidak.ada.kunci.ini');

// Penyisipan variabel di kedua bahasa — tidak boleh menyisakan placeholder.
const idText = t('booking.successBody', 'id', { date: '31 Jul 2026' });
const enText = t('booking.successBody', 'en', { date: '31 Jul 2026' });
assert.ok(idText.includes('31 Jul 2026'));
assert.ok(enText.includes('31 Jul 2026'));
assert.ok(!idText.includes('{date}'), 'placeholder {date} tidak tersubstitusi (id)');
assert.ok(!enText.includes('{date}'), 'placeholder {date} tidak tersubstitusi (en)');
assert.notEqual(idText, enText);

// Variabel yang muncul lebih dari sekali tersubstitusi semuanya, bukan yang pertama saja.
assert.equal(t('{x} dan {x}', 'en', { x: 'A' }), 'A dan A');

// Variabel yang tidak dipakai kunci tidak merusak apa pun.
assert.equal(t('nav.home', 'en', { tidakDipakai: 'x' }), 'Home');

// Locale Intl ikut bahasa — kalau tertukar, tanggal Inggris tampil "31 Jul" versi Indonesia.
assert.equal(dateLocale('id'), 'id-ID');
assert.equal(dateLocale('en'), 'en-GB');

console.log(`i18n.ts OK — ${DICT_KEYS.length} kunci × ${LANGS.length} bahasa`);
