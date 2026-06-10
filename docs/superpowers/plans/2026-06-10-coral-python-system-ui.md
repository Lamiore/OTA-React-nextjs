# Perbaikan Sistem & UI Web Lokal (Proyek_Karang) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Satukan jalur kamera ke server, ganti hitungan per-frame menjadi tracking (commit-on-confirmation) dengan dua metrik berlabel, ganti logika kesehatan brightness→HSV (+center-crop+smoothing), amankan thread-safety upload, dan redesign UI web lokal `index.html`.

**Architecture:** Logika murni (klasifikasi kesehatan HSV + penghitungan berbasis track) diekstrak ke modul `coral_logic.py` yang bebas kamera/Flask sehingga bisa di-unit-test. `app_web.py` memakai modul itu: background thread tunggal menjalankan `model.track()` (live), instance YOLO terpisah melayani upload `/predict`. `index.html` menampilkan `/video_feed` dan polling `/stats` & `/history`.

**Tech Stack:** Python 3.14 (venv di `Proyek_Karang/venv_mac`), Flask + flask-cors, Ultralytics YOLOv8 8.4.51, OpenCV 4.13, pytest (akan dipasang), Chart.js (CDN).

**Catatan path:** Semua perintah dijalankan dari direktori `Proyek_Karang/`. Interpreter: `venv_mac/bin/python`. Branch kerja: `coral-python-improvements`.

---

### Task 1: Setup pytest + direktori test

**Files:**
- Create: `Proyek_Karang/tests/` (direktori)

- [ ] **Step 1: Pasang pytest di venv**

Run:
```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA/Proyek_Karang && venv_mac/bin/python -m pip install pytest
```
Expected: terpasang tanpa error (`Successfully installed pytest-...`).

- [ ] **Step 2: Buat direktori tests**

Run:
```bash
mkdir -p /Users/irhammohammad/Documents/Code/React/otaapp/OTA/Proyek_Karang/tests
```

- [ ] **Step 3: Verifikasi pytest jalan**

Run:
```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA/Proyek_Karang && venv_mac/bin/python -m pytest --version
```
Expected: mencetak versi pytest (mis. `pytest 8.x`).

- [ ] **Step 4: Commit**

```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA && git add Proyek_Karang/tests && git commit -m "test: setup pytest untuk Proyek_Karang"
```
(Jika `tests/` kosong tak ter-track, lewati commit ini; akan ter-commit bersama Task 2.)

---

### Task 2: `predict_health()` — klasifikasi kesehatan HSV (TDD)

**Files:**
- Create: `Proyek_Karang/coral_logic.py`
- Test: `Proyek_Karang/tests/test_coral_logic.py`

- [ ] **Step 1: Tulis test yang gagal**

Buat `Proyek_Karang/tests/test_coral_logic.py`:

```python
import numpy as np
import cv2
import pytest

import coral_logic as cl


def solid_bgr_from_hsv(h, s, v, size=40):
    """ROI satu warna solid, dibuat dari HSV agar S/V terkontrol."""
    hsv = np.full((size, size, 3), (h, s, v), np.uint8)
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)


def test_health_sehat_saturasi_tinggi():
    roi = solid_bgr_from_hsv(60, 200, 180)  # warna jenuh
    assert cl.predict_health(roi) == cl.HEALTH_SEHAT


def test_health_kurang_saturasi_sedang():
    roi = solid_bgr_from_hsv(60, 70, 180)   # 40<=S<90
    assert cl.predict_health(roi) == cl.HEALTH_KURANG


def test_health_pemutihan_pucat():
    roi = solid_bgr_from_hsv(60, 10, 220)   # S<40 dan V>160
    assert cl.predict_health(roi) == cl.HEALTH_BLEACH


def test_health_gelap_desaturasi_bukan_pemutihan():
    roi = solid_bgr_from_hsv(60, 10, 100)   # S<40 tapi V<=160 -> bukan pemutihan
    assert cl.predict_health(roi) == cl.HEALTH_KURANG


def test_health_roi_kosong():
    assert cl.predict_health(np.zeros((0, 0, 3), np.uint8)) == cl.HEALTH_UNKNOWN


def test_health_center_crop_abaikan_border():
    # tengah jenuh (Sehat), border pucat (akan tampak Pemutihan jika tak di-crop)
    roi = solid_bgr_from_hsv(60, 10, 230, size=40)   # border pucat
    center = solid_bgr_from_hsv(60, 200, 180, size=20)
    roi[10:30, 10:30] = center
    assert cl.predict_health(roi) == cl.HEALTH_SEHAT
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run:
```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA/Proyek_Karang && venv_mac/bin/python -m pytest tests/test_coral_logic.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'coral_logic'`.

- [ ] **Step 3: Implementasi minimal `predict_health`**

Buat `Proyek_Karang/coral_logic.py`:

```python
"""Logika murni deteksi karang: klasifikasi kesehatan (HSV) + penghitungan
berbasis track. Sengaja bebas dari kamera/Flask agar bisa di-unit-test.
"""
import threading
import time
from collections import Counter

import cv2
import numpy as np

# ----- Ambang kesehatan (HSV, skala 0-255). Tune di footage nyata. -----
S_BLEACH = 40     # saturasi di bawah ini + terang => pemutihan (hilang warna)
V_BRIGHT = 160    # value di atas ini dianggap "terang/pucat"
S_HEALTHY = 90    # saturasi >= ini => sehat

HEALTH_BLEACH = "Mengalami Pemutihan"
HEALTH_KURANG = "Kurang Sehat"
HEALTH_SEHAT = "Sehat"
HEALTH_UNKNOWN = "Tidak Diketahui"

_CROP = 0.25      # buang 25% tiap sisi -> ambil 50% tengah box


def predict_health(roi, s_bleach=S_BLEACH, v_bright=V_BRIGHT, s_healthy=S_HEALTHY):
    """Klasifikasi kesehatan karang dari ROI (BGR) via rata-rata saturasi/value HSV.

    Proxy berbasis aturan (bukan ukuran biologis tervalidasi):
      saturasi rendah + value tinggi -> pemutihan (pucat/putih)
      saturasi agak rendah           -> kurang sehat
      selain itu                     -> sehat
    """
    if roi is None or roi.size == 0:
        return HEALTH_UNKNOWN

    h, w = roi.shape[:2]
    y0, y1 = int(h * _CROP), int(h * (1 - _CROP))
    x0, x1 = int(w * _CROP), int(w * (1 - _CROP))
    core = roi[y0:y1, x0:x1]
    if core.size == 0:
        core = roi

    hsv = cv2.cvtColor(core, cv2.COLOR_BGR2HSV)
    s = float(hsv[:, :, 1].mean())
    v = float(hsv[:, :, 2].mean())

    if s < s_bleach and v > v_bright:
        return HEALTH_BLEACH
    if s < s_healthy:
        return HEALTH_KURANG
    return HEALTH_SEHAT
```

- [ ] **Step 4: Jalankan test, pastikan lolos**

Run:
```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA/Proyek_Karang && venv_mac/bin/python -m pytest tests/test_coral_logic.py -v
```
Expected: 6 test PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA && git add Proyek_Karang/coral_logic.py Proyek_Karang/tests/test_coral_logic.py && git commit -m "feat: predict_health berbasis HSV + center-crop (coral_logic)"
```

---

### Task 3: `CoralTracker` — penghitungan berbasis track (TDD)

**Files:**
- Modify: `Proyek_Karang/coral_logic.py` (tambah class `CoralTracker`)
- Test: `Proyek_Karang/tests/test_coral_logic.py` (tambah test)

- [ ] **Step 1: Tambah test yang gagal**

Tambahkan ke akhir `Proyek_Karang/tests/test_coral_logic.py`:

```python
def det(tid, jenis="Acropora_sp", health=cl.HEALTH_SEHAT):
    return {"id": tid, "jenis": jenis, "health": health}


def test_commit_setelah_confirm_frames():
    t = cl.CoralTracker(confirm_frames=3)
    for _ in range(2):
        t.update([det(1)])
    assert t.stats()["total"] == 0          # belum cukup frame
    t.update([det(1)])                       # frame ke-3 -> commit
    assert t.stats()["total"] == 1


def test_id_sama_tidak_dihitung_ganda():
    t = cl.CoralTracker(confirm_frames=2)
    for _ in range(10):
        t.update([det(1)])
    assert t.stats()["total"] == 1


def test_dua_id_dihitung_terpisah():
    t = cl.CoralTracker(confirm_frames=1)
    t.update([det(1), det(2)])
    assert t.stats()["total"] == 2


def test_majority_vote_kesehatan():
    t = cl.CoralTracker(confirm_frames=3)
    t.update([det(1, health=cl.HEALTH_SEHAT)])
    t.update([det(1, health=cl.HEALTH_SEHAT)])
    t.update([det(1, health=cl.HEALTH_BLEACH)])  # commit di sini, majority=Sehat
    assert t.stats()["by_health"] == {cl.HEALTH_SEHAT: 1}


def test_current_snapshot_terlihat_saat_ini():
    t = cl.CoralTracker(confirm_frames=5)
    t.update([det(1), det(2)])
    cur = t.stats()["current"]
    assert cur["total"] == 2                  # current tetap menghitung walau belum commit


def test_smoothing_dikembalikan_dari_update():
    t = cl.CoralTracker(confirm_frames=10)
    t.update([det(1, health=cl.HEALTH_SEHAT)])
    smoothed = t.update([det(1, health=cl.HEALTH_BLEACH)])
    assert smoothed == [cl.HEALTH_SEHAT]      # majority (2x Sehat? -> 1 Sehat,1 Bleach tie)
    # Catatan: pada tie Counter.most_common mengembalikan yang pertama dimasukkan (Sehat)


def test_id_committed_yang_muncul_lagi_tidak_dihitung_ulang():
    t = cl.CoralTracker(confirm_frames=2, track_ttl=5.0)
    t.update([det(1)], now=100.0)
    t.update([det(1)], now=100.1)             # commit -> total 1
    assert t.stats()["total"] == 1
    t.update([], now=200.0)                    # waktu lewat TTL -> prune entri id 1
    t.update([det(1)], now=200.1)             # id 1 muncul lagi
    assert t.stats()["total"] == 1            # tidak dihitung ulang (seen_ids)


def test_history_satu_baris_per_karang_unik():
    t = cl.CoralTracker(confirm_frames=1)
    t.update([det(1, jenis="Acropora_sp")])
    t.update([det(2, jenis="Acropora_formosa")])
    h = t.history()
    assert h["count"] == 2
    assert h["history"][0]["jenis"] == "Acropora_formosa"  # terbaru dulu
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

Run:
```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA/Proyek_Karang && venv_mac/bin/python -m pytest tests/test_coral_logic.py -v
```
Expected: FAIL — `AttributeError: module 'coral_logic' has no attribute 'CoralTracker'`.

- [ ] **Step 3: Implementasi `CoralTracker`**

Tambahkan ke akhir `Proyek_Karang/coral_logic.py`:

```python
class CoralTracker:
    """Agregasi deteksi per-frame menjadi statistik karang yang stabil & unik.

    Panggil `update()` tiap frame yang sudah diproses. Sebuah track dihitung
    sekali ke total kumulatif setelah terlihat `confirm_frames` kali
    (commit-on-confirmation); `_seen_ids` mencegah id yang sama dihitung ulang.
    Kesehatan per track dihaluskan dengan majority vote.
    """

    def __init__(self, confirm_frames=5, track_ttl=30.0):
        self.confirm_frames = confirm_frames
        self.track_ttl = track_ttl
        self._lock = threading.Lock()
        self._tracks = {}          # id -> dict(jenis, votes, frames, last_seen, committed)
        self._seen_ids = set()     # id yang sudah di-commit (permanen)
        self.total = 0             # kumulatif (tak pernah reset)
        self.by_health = {}
        self.by_jenis = {}
        self._history = []         # satu baris per karang yang di-commit
        self._max_history = 200
        self._current = {"total": 0, "by_health": {}, "by_jenis": {}}

    def update(self, detections, now=None):
        """detections: list of {"id": int|None, "jenis": str, "health": str}.

        Mengembalikan list label kesehatan yang dihaluskan (majority vote),
        searah dengan urutan input, untuk menggambar overlay.
        """
        if now is None:
            now = time.time()
        smoothed = []
        cur_health, cur_jenis, cur_total = {}, {}, 0

        with self._lock:
            for d in detections:
                tid = d.get("id")
                jenis = d["jenis"]
                health = d["health"]

                if tid is None:
                    smoothed.append(health)
                    cur_total += 1
                    cur_health[health] = cur_health.get(health, 0) + 1
                    cur_jenis[jenis] = cur_jenis.get(jenis, 0) + 1
                    continue

                entry = self._tracks.get(tid)
                if entry is None:
                    entry = {"jenis": jenis, "votes": Counter(), "frames": 0,
                             "last_seen": now, "committed": tid in self._seen_ids}
                    self._tracks[tid] = entry
                entry["jenis"] = jenis
                entry["votes"][health] += 1
                entry["frames"] += 1
                entry["last_seen"] = now

                majority = entry["votes"].most_common(1)[0][0]
                smoothed.append(majority)
                cur_total += 1
                cur_health[majority] = cur_health.get(majority, 0) + 1
                cur_jenis[jenis] = cur_jenis.get(jenis, 0) + 1

                if (not entry["committed"]
                        and tid not in self._seen_ids
                        and entry["frames"] >= self.confirm_frames):
                    entry["committed"] = True
                    self._seen_ids.add(tid)
                    self.total += 1
                    self.by_jenis[jenis] = self.by_jenis.get(jenis, 0) + 1
                    self.by_health[majority] = self.by_health.get(majority, 0) + 1
                    self._history.append({"jenis": jenis, "kesehatan": majority,
                                          "waktu": now})
                    if len(self._history) > self._max_history:
                        self._history = self._history[-self._max_history:]

            self._current = {"total": cur_total, "by_health": cur_health,
                             "by_jenis": cur_jenis}
            stale = [tid for tid, e in self._tracks.items()
                     if now - e["last_seen"] > self.track_ttl]
            for tid in stale:
                del self._tracks[tid]

        return smoothed

    def stats(self):
        with self._lock:
            return {
                "total": self.total,
                "by_health": dict(self.by_health),
                "by_jenis": dict(self.by_jenis),
                "current": {
                    "total": self._current["total"],
                    "by_health": dict(self._current["by_health"]),
                    "by_jenis": dict(self._current["by_jenis"]),
                },
            }

    def history(self):
        with self._lock:
            recent = list(self._history)
            total = self.total
        recent.reverse()
        return {"total": total, "count": len(recent), "history": recent}

    def export_rows(self):
        with self._lock:
            return list(self._history)
```

- [ ] **Step 4: Jalankan semua test, pastikan lolos**

Run:
```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA/Proyek_Karang && venv_mac/bin/python -m pytest tests/ -v
```
Expected: semua test PASS (6 dari Task 2 + 8 dari Task 3 = 14).

- [ ] **Step 5: Commit**

```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA && git add Proyek_Karang/coral_logic.py Proyek_Karang/tests/test_coral_logic.py && git commit -m "feat: CoralTracker commit-on-confirmation + majority-vote (coral_logic)"
```

---

### Task 4: Integrasikan ke `app_web.py` (track live + upload terpisah + endpoint)

Ini mengubah glue Flask/streaming — diverifikasi manual (bukan pytest). Ganti **seluruh isi** `app_web.py` dengan versi di bawah.

**Files:**
- Modify (rewrite): `Proyek_Karang/app_web.py`

- [ ] **Step 1: Tulis ulang `app_web.py`**

Ganti seluruh isi `Proyek_Karang/app_web.py` dengan:

```python
import os
import csv
import threading
import time
from io import StringIO

import cv2
import numpy as np
from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS
from ultralytics import YOLO

import coral_logic

app = Flask(__name__)
CORS(app)

# ============== MODEL PATH ==============
MODEL_PATH = "best.pt"
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = "runs/detect/train-2/weights/best.pt"
if not os.path.exists(MODEL_PATH):
    print("⚠️ Warning: bobot model tidak ditemukan. Memakai yolov8n.pt")
    MODEL_PATH = "yolov8n.pt"

print(f"🚀 Loading YOLO model from: {MODEL_PATH}")
# `model` hanya dipakai background thread (live tracking) agar state tracker
# tidak dirusak. `upload_model` instance terpisah untuk /predict (Flask worker
# thread) — Ultralytics tidak thread-safe untuk inferensi konkuren.
model = YOLO(MODEL_PATH)
upload_model = YOLO(MODEL_PATH)

# ============== INFERENCE TUNING ==============
CONF = 0.5
IMG_SIZE = 640
MAX_DET = 20

tracker = coral_logic.CoralTracker()

# ============== DRAW HELPERS ==============
_COLOR = {
    coral_logic.HEALTH_SEHAT: (0, 255, 0),     # hijau
    coral_logic.HEALTH_KURANG: (0, 255, 255),  # kuning
    coral_logic.HEALTH_BLEACH: (0, 0, 255),    # merah
    coral_logic.HEALTH_UNKNOWN: (200, 200, 200),
}


def annotate_tracked(frame):
    """Jalankan tracking, klasifikasi+haluskan kesehatan, update tracker, gambar."""
    results = model.track(frame, persist=True, conf=CONF, imgsz=IMG_SIZE,
                          max_det=MAX_DET, tracker="bytetrack.yaml", verbose=False)
    boxes = results[0].boxes
    dets, coords = [], []
    for box in boxes:
        cls_id = int(box.cls[0])
        label = model.names[cls_id]
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        tid = int(box.id[0]) if box.id is not None else None
        health = coral_logic.predict_health(frame[y1:y2, x1:x2])
        dets.append({"id": tid, "jenis": label, "health": health})
        coords.append((x1, y1, x2, y2))

    smoothed = tracker.update(dets)
    for (x1, y1, x2, y2), d, sm in zip(coords, dets, smoothed):
        color = _COLOR.get(sm, (200, 200, 200))
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(frame, f"{d['jenis']} | {sm}", (x1, max(y1 - 10, 20)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
    return frame


# ============== BACKGROUND CAMERA STREAMER ==============
class CameraStreamer(object):
    """Baca kamera sekali di background thread, cache frame teranotasi, layani
    banyak klien sekaligus (hindari konflik OpenCV multi-thread)."""

    def __init__(self):
        self.cap = None
        self.lock = threading.Lock()
        self.running = False
        self.thread = None
        self.latest_frame = None

    def start(self):
        with self.lock:
            if not self.running:
                self.cap = cv2.VideoCapture(0)
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.running = True
                self.thread = threading.Thread(target=self._capture_loop, daemon=True)
                self.thread.start()
                print("📷 Camera background capture thread started.")

    def _capture_loop(self):
        while self.running:
            success, frame = self.cap.read()
            if not success:
                time.sleep(0.05)
                continue
            annotated = annotate_tracked(frame)
            ok, jpeg = cv2.imencode('.jpg', annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            if ok:
                self.latest_frame = jpeg.tobytes()
            time.sleep(0.04)   # ~25 FPS

    def get_frame(self):
        return self.latest_frame

    def stop(self):
        with self.lock:
            self.running = False
            if self.cap:
                self.cap.release()
                self.cap = None
            print("📷 Camera background capture thread stopped.")


camera_streamer = CameraStreamer()
camera_streamer.start()

# ============== FLASK ROUTING ==============
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/video_feed')
def video_feed():
    def generate_mjpeg():
        while True:
            frame = camera_streamer.get_frame()
            if frame is None:
                time.sleep(0.1)
                continue
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            time.sleep(0.04)
    return Response(generate_mjpeg(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/predict', methods=['POST'])
def predict():
    """Upload gambar satu kali. TIDAK memengaruhi statistik/history live."""
    try:
        file = request.files['file']
        nparr = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        results = upload_model.predict(img, conf=CONF, imgsz=IMG_SIZE,
                                       max_det=MAX_DET, agnostic_nms=True, verbose=False)
        counts = []
        for box in results[0].boxes:
            label = upload_model.names[int(box.cls[0])]
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            health = coral_logic.predict_health(img[y1:y2, x1:x2])
            counts.append({"jenis": label, "kesehatan": health, "waktu": time.time()})
        return jsonify({'total': len(counts), 'populasi': counts})
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/stats')
def stats():
    return jsonify(tracker.stats())


@app.route('/history')
def history():
    return jsonify(tracker.history())


@app.route('/export_csv')
def export_csv():
    rows = tracker.export_rows()
    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(['No', 'Waktu', 'Jenis Karang', 'Status Kesehatan'])
    for idx, item in enumerate(rows, start=1):
        waktu = item.get('waktu')
        waktu_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(waktu)) if waktu else ''
        writer.writerow([idx, waktu_str, item['jenis'], item['kesehatan']])
    return Response(si.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition":
                             "attachment; filename=history_deteksi_karang.csv"})


if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=5001, debug=False)
    finally:
        camera_streamer.stop()
```

- [ ] **Step 2: Verifikasi import (tanpa kamera)**

Run:
```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA/Proyek_Karang && venv_mac/bin/python -c "import app_web; print('import OK'); print(sorted([r.rule for r in app_web.app.url_map.iter_rules()]))"
```
Expected: mencetak `import OK` dan daftar route memuat `/stats`, `/history`, `/video_feed`, `/predict`, `/export_csv`, `/` — dan **tidak** ada `/predict_camera`. (Model akan ter-load; kamera mungkin gagal dibuka di lingkungan tanpa webcam — itu tidak apa-apa untuk cek import.)

- [ ] **Step 3: Commit**

```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA && git add Proyek_Karang/app_web.py && git commit -m "feat: app_web pakai model.track + upload model terpisah; hapus /predict_camera"
```

---

### Task 5: Redesign `index.html` (tampilkan /video_feed + polling)

UI murni — diverifikasi manual di browser. Ganti **seluruh isi** file.

**Files:**
- Modify (rewrite): `Proyek_Karang/templates/index.html`

- [ ] **Step 1: Tulis ulang `index.html`**

Ganti seluruh isi `Proyek_Karang/templates/index.html` dengan:

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Deteksi Karang AI</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',system-ui,Arial,sans-serif;background:#0b1220;color:#e2e8f0}
    .wrap{max-width:1100px;margin:auto;padding:24px 16px}
    header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px}
    h1{font-size:24px;font-weight:700}
    .muted{color:#94a3b8;font-size:13px}
    .status{display:inline-flex;align-items:center;gap:8px;font-size:13px;padding:6px 12px;border-radius:999px;background:#1e293b}
    .dot{width:8px;height:8px;border-radius:50%}
    .dot.ok{background:#22c55e;box-shadow:0 0 8px #22c55e;animation:pulse 1.5s infinite}
    .dot.off{background:#ef4444}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    .grid{display:grid;gap:20px;grid-template-columns:1fr}
    @media(min-width:900px){.grid{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}}
    .card{background:#111a2e;border:1px solid #1e293b;border-radius:16px;padding:20px;margin-bottom:20px}
    .card h2{font-size:16px;margin-bottom:14px}
    .video-shell{position:relative;border-radius:12px;overflow:hidden;background:#000;border:1px solid #1e293b}
    .video-shell img{display:block;width:100%}
    .live-badge{position:absolute;top:10px;left:10px;background:rgba(239,68,68,.9);color:#fff;font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;display:flex;align-items:center;gap:6px}
    .live-badge .dot{background:#fff;animation:pulse 1.5s infinite}
    .legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:14px;font-size:12px;color:#cbd5e1}
    .legend span{display:flex;align-items:center;gap:6px}
    .sw{width:10px;height:10px;border-radius:50%}
    .metrics{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
    .metric{background:#0b1220;border:1px solid #1e293b;border-radius:12px;padding:14px}
    .metric .num{font-size:30px;font-weight:700}
    .metric .lbl{font-size:12px;color:#94a3b8;margin-top:2px}
    .metric .hint{font-size:11px;color:#64748b;margin-top:6px;line-height:1.4}
    canvas#healthChart{max-width:260px;margin:0 auto;display:block}
    .bars{margin-top:8px}
    .bar-row{margin-bottom:10px}
    .bar-row .top{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;color:#cbd5e1}
    .track{height:8px;background:#1e293b;border-radius:999px;overflow:hidden}
    .fill{height:100%;border-radius:999px;background:#38bdf8;transition:width .6s}
    .hist{max-height:320px;overflow:auto}
    .hrow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 12px;background:#0b1220;border:1px solid #1e293b;border-radius:10px;margin-bottom:8px;font-size:13px}
    .badge{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px}
    .b-sehat{background:rgba(34,197,94,.15);color:#4ade80}
    .b-kurang{background:rgba(250,204,21,.15);color:#facc15}
    .b-bleach{background:rgba(239,68,68,.15);color:#f87171}
    .b-unknown{background:#1e293b;color:#94a3b8}
    button{padding:10px 16px;border:none;border-radius:10px;background:#38bdf8;color:#06283d;font-weight:600;font-size:14px;cursor:pointer}
    button:hover{background:#7dd3fc}
    input[type=file]{margin-bottom:12px;color:#cbd5e1;font-size:13px}
    .empty{color:#64748b;font-size:13px;padding:8px 0}
  </style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>🪸 Deteksi Karang Real-Time AI</h1>
      <p class="muted">Klasifikasi jenis &amp; kesehatan karang via YOLOv8 + tracking</p>
    </div>
    <span class="status"><span id="connDot" class="dot off"></span><span id="connText">Menghubungkan…</span></span>
  </header>

  <div class="grid">
    <div>
      <div class="card">
        <h2>Kamera Live</h2>
        <div class="video-shell">
          <span class="live-badge"><span class="dot"></span>LIVE</span>
          <img src="/video_feed" alt="Live deteksi karang">
        </div>
        <div class="legend">
          <span><span class="sw" style="background:#22c55e"></span>Sehat</span>
          <span><span class="sw" style="background:#facc15"></span>Kurang Sehat</span>
          <span><span class="sw" style="background:#ef4444"></span>Pemutihan</span>
        </div>
        <div class="metrics">
          <div class="metric">
            <div class="num" id="mCurrent">—</div>
            <div class="lbl">Terlihat saat ini</div>
            <div class="hint">Jumlah karang yang sedang tampak di frame.</div>
          </div>
          <div class="metric">
            <div class="num" id="mTotal">—</div>
            <div class="lbl">Total unik kumulatif</div>
            <div class="hint">Perkiraan jumlah track unik sejak server aktif.</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h2>Upload Gambar <span class="muted">(uji — tidak masuk statistik live)</span></h2>
        <input type="file" id="fileInput" accept="image/*"><br>
        <button onclick="uploadImage()">Deteksi Gambar</button>
        <div id="uploadResult" style="margin-top:14px"></div>
      </div>
    </div>

    <div>
      <div class="card">
        <h2>Statistik Kesehatan <span class="muted">(kumulatif)</span></h2>
        <canvas id="healthChart"></canvas>
        <div class="bars" id="jenisBars" style="margin-top:18px"></div>
      </div>

      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <h2 style="margin:0">History Deteksi</h2>
          <button onclick="exportCSV()" style="padding:8px 12px;font-size:12px">Export CSV</button>
        </div>
        <div class="hist" id="historyList"><p class="empty">Belum ada data.</p></div>
      </div>
    </div>
  </div>
</div>

<script>
const HEALTH_BADGE = {
  'Sehat': 'b-sehat',
  'Kurang Sehat': 'b-kurang',
  'Mengalami Pemutihan': 'b-bleach',
  'Tidak Diketahui': 'b-unknown',
};
let healthChart;

function setConn(ok){
  document.getElementById('connDot').className = 'dot ' + (ok ? 'ok' : 'off');
  document.getElementById('connText').innerText = ok ? 'Terhubung' : 'Server terputus';
}

function renderChart(byHealth){
  const order = ['Sehat','Kurang Sehat','Mengalami Pemutihan'];
  const data = order.map(l => byHealth[l] || 0);
  const ctx = document.getElementById('healthChart');
  if(healthChart){
    healthChart.data.datasets[0].data = data;
    healthChart.update();
    return;
  }
  healthChart = new Chart(ctx, {
    type:'doughnut',
    data:{ labels:['Sehat','Kurang Sehat','Pemutihan'],
      datasets:[{ data, backgroundColor:['#22c55e','#facc15','#ef4444'], borderWidth:0 }] },
    options:{ plugins:{ legend:{ labels:{ color:'#cbd5e1' } } } }
  });
}

function renderJenis(byJenis){
  const entries = Object.entries(byJenis).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const max = entries.length ? entries[0][1] : 1;
  const box = document.getElementById('jenisBars');
  if(!entries.length){ box.innerHTML = '<p class="empty">Belum ada data jenis.</p>'; return; }
  box.innerHTML = entries.map(([j,c])=>`
    <div class="bar-row">
      <div class="top"><span>${j.replace(/_/g,' ')}</span><span>${c}</span></div>
      <div class="track"><div class="fill" style="width:${Math.round(c/max*100)}%"></div></div>
    </div>`).join('');
}

async function pollStats(){
  try{
    const r = await fetch('/stats'); if(!r.ok) throw 0;
    const s = await r.json();
    document.getElementById('mCurrent').innerText = s.current ? s.current.total : 0;
    document.getElementById('mTotal').innerText = s.total;
    renderChart(s.by_health || {});
    renderJenis(s.by_jenis || {});
    setConn(true);
  }catch(e){ setConn(false); }
}

async function pollHistory(){
  try{
    const r = await fetch('/history'); if(!r.ok) throw 0;
    const j = await r.json();
    const box = document.getElementById('historyList');
    if(!j.history.length){ box.innerHTML = '<p class="empty">Belum ada data.</p>'; return; }
    box.innerHTML = j.history.map(it=>{
      const t = new Date(it.waktu*1000).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
      const cls = HEALTH_BADGE[it.kesehatan] || 'b-unknown';
      return `<div class="hrow"><span>${it.jenis.replace(/_/g,' ')}<br><span class="muted">${t}</span></span>
        <span class="badge ${cls}">${it.kesehatan}</span></div>`;
    }).join('');
  }catch(e){ /* pertahankan tampilan terakhir */ }
}

async function uploadImage(){
  const f = document.getElementById('fileInput').files[0];
  const out = document.getElementById('uploadResult');
  if(!f){ out.innerHTML = '<p class="empty">Pilih gambar dulu.</p>'; return; }
  out.innerHTML = '<p class="empty">Memproses…</p>';
  const fd = new FormData(); fd.append('file', f);
  try{
    const r = await fetch('/predict',{method:'POST',body:fd});
    const d = await r.json();
    if(d.error){ out.innerHTML = `<p class="empty">Error: ${d.error}</p>`; return; }
    const rows = d.populasi.map(it=>{
      const cls = HEALTH_BADGE[it.kesehatan] || 'b-unknown';
      return `<div class="hrow"><span>${it.jenis.replace(/_/g,' ')}</span><span class="badge ${cls}">${it.kesehatan}</span></div>`;
    }).join('');
    out.innerHTML = `<p style="margin-bottom:10px">Total terdeteksi: <b>${d.total}</b></p>${rows||'<p class="empty">Tidak ada karang terdeteksi.</p>'}`;
  }catch(e){ out.innerHTML = '<p class="empty">Gagal menghubungi server.</p>'; }
}

function exportCSV(){ window.location.href = '/export_csv'; }

pollStats(); pollHistory();
setInterval(pollStats, 2000);
setInterval(pollHistory, 2000);
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA && git add Proyek_Karang/templates/index.html && git commit -m "feat: redesign index.html (video_feed + dua metrik + polling, hapus getUserMedia)"
```

---

### Task 6: Verifikasi integrasi end-to-end (manual)

Butuh webcam. Jalankan server lalu uji checklist spec §8.

**Files:** — (tidak ada perubahan file; verifikasi saja)

- [ ] **Step 1: Jalankan server**

Run (di terminal terpisah, biarkan jalan):
```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA/Proyek_Karang && venv_mac/bin/python app_web.py
```
Expected: muncul `🚀 Loading YOLO model...` lalu `📷 Camera background capture thread started.` tanpa error.

- [ ] **Step 2: Cek endpoint stats (bentuk baru)**

Run:
```bash
curl -s http://localhost:5001/stats
```
Expected: JSON memuat `total`, `by_health`, `by_jenis`, dan `current` (dengan `current.total`). Bentuk top-level tetap kompatibel dengan panel Next.js.

- [ ] **Step 3: Buka UI di browser**

Buka `http://localhost:5001`. Verifikasi:
  - Video live tampil (badge LIVE).
  - Status pojok kanan → "Terhubung" (hijau).
  - **"Terlihat saat ini"** mencerminkan jumlah karang di layar dan **stabil** (tidak kedip tiap detik) saat menyorot scene berisi karang.
  - Doughnut & bar jenis terisi setelah ada deteksi yang di-commit (≥ `CONFIRM_FRAMES` frame).

- [ ] **Step 4: Uji stabilitas track-id (ujian kredibilitas angka kumulatif)**

Sorot satu karang diam. Amati "Total unik kumulatif": idealnya naik **sekali** lalu tetap. Bila terus naik (id sering berganti), turunkan sensitivitas dengan menaikkan `confirm_frames` di `coral_logic.CoralTracker(confirm_frames=...)` (instansiasi di `app_web.py`) atau tuning parameter ByteTrack. Catat temuan.

- [ ] **Step 5: Uji logika kesehatan**

Lewat kartu **Upload Gambar**, unggah beberapa gambar (karang berwarna vs pucat). Verifikasi label kesehatan masuk akal. Bila perlu, tune `S_BLEACH`/`V_BRIGHT`/`S_HEALTHY` di `coral_logic.py`, jalankan ulang `pytest tests/ -v`, commit.

- [ ] **Step 6: Verifikasi upload tidak mengubah statistik live**

Sebelum & sesudah upload, panggil `curl -s http://localhost:5001/stats`. Nilai `total` kumulatif **tidak berubah** karena upload.

- [ ] **Step 7: Verifikasi export CSV**

Buka `http://localhost:5001/export_csv` (atau klik tombol Export CSV). File `history_deteksi_karang.csv` terunduh berisi satu baris per karang unik.

- [ ] **Step 8: (Opsional) Verifikasi website Next.js tidak rusak**

Pastikan `NEXT_PUBLIC_CAMERA_URL` menunjuk ke server ini, jalankan `npm run dev` di root, buka `/monitoring`. Panel kamera, statistik, dan history tetap berfungsi.

- [ ] **Step 9: Commit catatan tuning (bila ada)**

Bila Step 4/5 mengubah konstanta:
```bash
cd /Users/irhammohammad/Documents/Code/React/otaapp/OTA && git add Proyek_Karang/coral_logic.py Proyek_Karang/app_web.py && git commit -m "tune: kalibrasi ambang kesehatan & confirm_frames berdasarkan footage"
```

---

## Self-Review (diisi penulis plan)

- **Spec coverage:** §2 kamera→Task 4/5; §3 hitungan→Task 3 (+verifikasi Task 6 Step 4); §4 kesehatan HSV→Task 2; §5 thread-safety→Task 4 (`upload_model`); §6 endpoint→Task 4; §7 UI→Task 5; §8 verifikasi→Task 6. Semua tercakup.
- **Placeholder scan:** Tidak ada TBD/TODO; semua step berisi kode/perintah konkret.
- **Type consistency:** Kunci dict konsisten (`id`/`jenis`/`health` untuk input `update`; `jenis`/`kesehatan`/`waktu` untuk history & `/predict`); konstanta `HEALTH_*`, `CONF`, `IMG_SIZE`, `MAX_DET`, `confirm_frames` dipakai seragam di seluruh task.
