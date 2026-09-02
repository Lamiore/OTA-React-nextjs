#!/usr/bin/env python3
"""Bangun lampiran .docx dari sumber .md, mengikuti tata tulis panduan jurusan.

    python3 scripts/build-docs.py

Menghasilkan docs/Manual-Teknis-Nusa.docx dan docs/Panduan-Pengguna-Nusa.docx.

Templatnya tidak disimpan sebagai berkas — dibangun ulang tiap kali jalan dari
reference.docx bawaan pandoc lalu ditambal ke spesifikasi di bawah. Dengan
begitu tidak ada blob biner yang ikut ter-commit, dan tidak ada pertanyaan
"templat mana yang dipakai waktu itu".

Spesifikasi disalin dari badan skripsi (Skripsi-OTA-bersih.docx) supaya lampiran
seragam dengan dokumen induknya:

    kertas   A4 (11906 x 16838 twip)
    margin   kiri & atas 4 cm (2268), kanan & bawah 3 cm (1701)
    huruf    Times New Roman 12 pt (sz 24 = setengah-poin)
    spasi    1,15 (w:line 276 = 276/240)

Blok "Daftar Isi" yang ditulis tangan di .md dibuang saat konversi, diganti
daftar isi otomatis Word yang punya nomor halaman. Di .md blok itu tetap
berguna sebagai tautan jangkar waktu dibaca di GitHub, jadi sumbernya tidak
diubah.
"""

import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

AKAR = Path(__file__).resolve().parent.parent
DOCS = AKAR / "docs"

BERKAS = [
    ("manual-teknis.md", "Manual-Teknis-Nusa.docx"),
    ("panduan-pengguna.md", "Panduan-Pengguna-Nusa.docx"),
]

# --- spesifikasi tata tulis (twip; 1 cm = 567 twip) ---
MARGIN = 'w:top="2268" w:right="1701" w:bottom="1701" w:left="2268"'
KERTAS = 'w:w="11906" w:h="16838"'
HURUF = "Times New Roman"
UKURAN = "24"  # setengah-poin -> 12 pt
SPASI = "276"  # 276/240 -> 1,15

RID_FOOTER = "rId900"

FOOTER_XML = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="center"/><w:rPr><w:sz w:val="20"/></w:rPr></w:pPr>
    <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r>
    <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>1</w:t></w:r>
    <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>
"""


def tambal_styles(xml: str) -> str:
    """Pasang Times New Roman 12 pt + spasi 1,15 di docDefaults dan gaya Normal.

    docDefaults sengaja ikut ditambal, bukan Normal saja: judul bab dan sel
    tabel mewarisi rFonts dari sana, dan bawaan pandoc menunjuk font tema
    (Aptos di Word 365) — itu yang bikin berkas lama tidak sesuai panduan.
    """
    xml = xml.replace(
        '<w:rFonts w:asciiTheme="minorHAnsi" w:eastAsiaTheme="minorEastAsia" '
        'w:hAnsiTheme="minorHAnsi" w:cstheme="minorBidi" />',
        f'<w:rFonts w:ascii="{HURUF}" w:eastAsia="{HURUF}" '
        f'w:hAnsi="{HURUF}" w:cs="{HURUF}" />',
        1,
    )
    xml = xml.replace(
        "<w:pPr>\n        <w:spacing w:after=\"200\" />\n      </w:pPr>",
        f'<w:pPr><w:spacing w:after="200" w:line="{SPASI}" '
        f'w:lineRule="auto" /></w:pPr>',
        1,
    )
    normal_baru = (
        '<w:style w:type="paragraph" w:default="1" w:styleId="Normal">'
        '<w:name w:val="Normal" /><w:qFormat />'
        f'<w:pPr><w:spacing w:line="{SPASI}" w:lineRule="auto" /></w:pPr>'
        f'<w:rPr><w:rFonts w:ascii="{HURUF}" w:eastAsia="{HURUF}" '
        f'w:hAnsi="{HURUF}" w:cs="{HURUF}" />'
        f'<w:sz w:val="{UKURAN}" /><w:szCs w:val="{UKURAN}" /></w:rPr>'
        "</w:style>"
    )
    xml, n = re.subn(
        r'<w:style w:type="paragraph" w:default="1" w:styleId="Normal">.*?</w:style>',
        normal_baru,
        xml,
        count=1,
        flags=re.S,
    )
    if n != 1:
        sys.exit("gagal menambal gaya Normal — struktur reference.docx pandoc berubah")
    return xml


def tambal_document(xml: str) -> str:
    """Isi <w:sectPr> kosong bawaan pandoc dengan kertas, margin, dan footer.

    Urutan anak sectPr ditentukan skema OOXML: footerReference dulu, lalu
    footnotePr, baru pgSz dan pgMar. Word menolak berkasnya kalau terbalik.
    """
    lama = "<w:sectPr>\n      <w:footnotePr>\n        <w:numRestart w:val=\"eachSect\" />\n      </w:footnotePr>\n    </w:sectPr>"
    baru = (
        "<w:sectPr>"
        f'<w:footerReference w:type="default" r:id="{RID_FOOTER}"/>'
        '<w:footnotePr><w:numRestart w:val="eachSect" /></w:footnotePr>'
        f"<w:pgSz {KERTAS}/>"
        f'<w:pgMar {MARGIN} w:header="720" w:footer="720" w:gutter="0"/>'
        "</w:sectPr>"
    )
    if lama not in xml:
        sys.exit("gagal menambal sectPr — struktur reference.docx pandoc berubah")
    return xml.replace(lama, baru, 1)


def bangun_template(tujuan: Path) -> None:
    """Ambil reference.docx bawaan pandoc, tambal, tulis ulang sebagai zip."""
    with tempfile.TemporaryDirectory() as tmp:
        asal = Path(tmp) / "asal.docx"
        asal.write_bytes(
            subprocess.run(
                ["pandoc", "--print-default-data-file", "reference.docx"],
                capture_output=True,
                check=True,
            ).stdout
        )

        with zipfile.ZipFile(asal) as z:
            isi = {n: z.read(n) for n in z.namelist()}

        isi["word/styles.xml"] = tambal_styles(
            isi["word/styles.xml"].decode("utf-8")
        ).encode("utf-8")
        isi["word/document.xml"] = tambal_document(
            isi["word/document.xml"].decode("utf-8")
        ).encode("utf-8")
        isi["word/footer1.xml"] = FOOTER_XML.encode("utf-8")

        ct = isi["[Content_Types].xml"].decode("utf-8")
        isi["[Content_Types].xml"] = ct.replace(
            "</Types>",
            '<Override PartName="/word/footer1.xml" ContentType='
            '"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
            "</Types>",
            1,
        ).encode("utf-8")

        rels = isi["word/_rels/document.xml.rels"].decode("utf-8")
        isi["word/_rels/document.xml.rels"] = rels.replace(
            "</Relationships>",
            f'<Relationship Id="{RID_FOOTER}" Type="http://schemas.openxmlformats.org'
            '/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
            "</Relationships>",
            1,
        ).encode("utf-8")

        with zipfile.ZipFile(tujuan, "w", zipfile.ZIP_DEFLATED) as z:
            for nama, data in isi.items():
                z.writestr(nama, data)


def buang_daftar_isi(teks: str) -> str:
    """Hapus blok "## Daftar Isi" sampai garis pemisah berikutnya.

    Daftar isi otomatis Word menggantikannya; kalau keduanya ikut, dokumen
    punya dua daftar isi berturut-turut.
    """
    return re.sub(r"^## Daftar Isi\n.*?^---\n", "", teks, count=1, flags=re.S | re.M)


def main() -> None:
    if not shutil.which("pandoc"):
        sys.exit("pandoc belum terpasang — `brew install pandoc`")

    with tempfile.TemporaryDirectory() as tmp:
        template = Path(tmp) / "reference.docx"
        bangun_template(template)

        for sumber, hasil in BERKAS:
            asal = DOCS / sumber
            if not asal.exists():
                sys.exit(f"tidak ketemu: {asal}")

            bersih = Path(tmp) / sumber
            bersih.write_text(buang_daftar_isi(asal.read_text()))

            subprocess.run(
                [
                    "pandoc", str(bersih),
                    "--from=gfm",
                    "--to=docx",
                    f"--reference-doc={template}",
                    "--toc",
                    "--toc-depth=3",
                    "-o", str(DOCS / hasil),
                ],
                check=True,
            )
            print(f"  {sumber} -> docs/{hasil}")

    print("\nSelesai. Buka di Word, klik daftar isinya, tekan F9 untuk mengisi")
    print("nomor halaman (medan TOC baru terhitung setelah Word membukanya).")


if __name__ == "__main__":
    main()
