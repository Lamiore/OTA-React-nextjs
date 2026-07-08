"""Server kamera mitra + deteksi karang (gabungan).

Menggabungkan dua sistem lama:
- arsitektur multi-kamera dari `camera-server/server.py` (satu worker per
  kamera, idle-stop, registrasi via halaman web + `cameras.json`, path
  `/stream/<id>` dipertahankan supaya website OTA tidak perlu diubah);
- deteksi coral dari `app_web.py` (`coral_logic` + YOLO `best.pt`).

Tiap kamera kini punya stream teranotasi sendiri plus statistik & riwayat
deteksi sendiri. Deteksi hanya berjalan SAAT KAMERA DITONTON: model YOLO
dimuat ketika penonton pertama datang dan dilepas lagi saat worker idle-stop
(30 dtk tanpa penonton), agar laptop tidak menanggung N inferensi paralel.

Sumber kamera yang didukung sama seperti server lama:
- angka (mis. `0`)  → webcam bawaan laptop (index perangkat OpenCV);
- URL http(s)       → stream MJPEG, mis. aplikasi IP Webcam Android;
- `test`            → pola uji bergerak, tanpa kamera & TANPA deteksi.

Halaman kelola (daftar ID + tambah/hapus kamera) dilindungi password Basic
Auth (`--password`, atau dibuat acak & dicetak di terminal). Stream/stats/
history terbuka: ID acak praktis tak tertebak dan <img> MJPEG di website
tidak bisa mengirim header auth.
"""

import argparse
import functools
import json
import secrets
import socket
import threading
import time
from pathlib import Path

import cv2
import numpy as np
from flask import (Flask, Response, abort, jsonify, redirect,
                   render_template_string, request)
from flask_cors import CORS
from ultralytics import YOLO

import coral_logic

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "cameras.json"
ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # tanpa karakter membingungkan (0/o, 1/l/i)
JPEG_QUALITY = 70
TEST_FPS = 15

# ============== TUNING INFERENSI (samakan dgn app_web.py) ==============
CONF = 0.5
IMG_SIZE = 640
MAX_DET = 20

_COLOR = {
    coral_logic.HEALTH_SEHAT: (0, 255, 0),     # hijau
    coral_logic.HEALTH_KURANG: (0, 255, 255),  # kuning
    coral_logic.HEALTH_BLEACH: (0, 0, 255),    # merah
    coral_logic.HEALTH_UNKNOWN: (200, 200, 200),
}


def resolve_model_path() -> str:
    """Cari bobot model relatif terhadap folder skrip (bukan cwd)."""
    for rel in ("best.pt", "runs/detect/train-2/weights/best.pt"):
        p = BASE_DIR / rel
        if p.exists():
            return str(p)
    print("⚠️  Bobot model tidak ditemukan. Memakai yolov8n.pt")
    return str(BASE_DIR / "yolov8n.pt")


MODEL_PATH = resolve_model_path()


def annotate(model, tracker, frame):
    """Tracking + klasifikasi kesehatan + gambar overlay pada satu frame.

    `model` & `tracker` milik satu kamera (tidak dibagi antar kamera):
    Ultralytics menyimpan state ByteTrack di dalam instance model, jadi tiap
    kamera wajib punya instance model sendiri agar track-nya tidak bertabrakan.
    """
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


app = Flask(__name__)
CORS(app)  # /stats & /history diambil via fetch() dari browser → butuh CORS


# ============== PROTEKSI HALAMAN KELOLA ==============
# Hanya halaman kelola (daftar ID + tambah/hapus kamera) yang dipassword —
# siapa pun satu WiFi tidak bisa lagi mengubah daftar kamera. Stream/stats/
# history sengaja dibiarkan terbuka: ID 6 karakter acak (~887 juta kombinasi)
# praktis tak tertebak, dan <img> MJPEG tidak bisa mengirim header auth.

def _auth_ok() -> bool:
    auth = request.authorization
    return (auth is not None and auth.password is not None
            and secrets.compare_digest(auth.password, app.config["ADMIN_PASSWORD"]))


def auth_required(fn):
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if not _auth_ok():
            return Response(
                "Login dibutuhkan. Username bebas; password ada di terminal server.",
                401, {"WWW-Authenticate": 'Basic realm="Server Kamera OTA"'})
        return fn(*args, **kwargs)
    return wrapper

cameras: dict[str, dict] = {}  # id -> {"id", "name", "source"}
workers: dict[str, "CameraWorker"] = {}
registry_lock = threading.Lock()


def load_cameras() -> None:
    if DATA_FILE.exists():
        cameras.update(json.loads(DATA_FILE.read_text()))


def save_cameras() -> None:
    DATA_FILE.write_text(json.dumps(cameras, indent=2, ensure_ascii=False))


def new_camera_id() -> str:
    while True:
        cam_id = "".join(secrets.choice(ID_ALPHABET) for _ in range(6))
        if cam_id not in cameras:
            return cam_id


def lan_ip() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # tidak mengirim paket; hanya memilih interface
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def make_test_frame(cam_id: str, tick: float) -> np.ndarray:
    """Pola uji bergerak supaya pipeline stream bisa dicek tanpa kamera fisik."""
    h, w = 480, 854
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    frame[:] = (60, 45, 20)
    x = int((tick * 120) % (w + 160)) - 80
    cv2.circle(frame, (x, h // 2), 60, (80, 190, 255), -1)
    cv2.putText(frame, f"TEST {cam_id}", (24, 48),
                cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, time.strftime("%H:%M:%S"), (24, h - 28),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (200, 200, 200), 2, cv2.LINE_AA)
    return frame


class CameraWorker(threading.Thread):
    """Satu thread pembaca per kamera; semua penonton berbagi frame terakhir.

    Worker dibuat saat penonton pertama datang dan berhenti sendiri setelah
    IDLE_STOP_SECONDS tanpa penonton, supaya webcam tidak terkunci terus dan
    inferensi YOLO tidak jalan sia-sia. Tiap worker memegang instance YOLO +
    `CoralTracker` sendiri; keduanya dimuat saat run() dan dilepas saat stop.
    """

    IDLE_STOP_SECONDS = 30

    def __init__(self, cam_id: str, source: str):
        super().__init__(daemon=True)
        self.cam_id = cam_id
        self.source = source
        self.cond = threading.Condition()
        self.frame: bytes | None = None
        self.stopped = False
        self.viewers = 0
        self.last_viewer_at = time.time()
        # Tracker per-kamera dibuat lebih awal supaya /stats & /history bisa
        # membaca meski worker baru mulai; model YOLO (berat) dimuat di run().
        self.detect = source != "test"
        self.tracker = coral_logic.CoralTracker() if self.detect else None

    def add_viewer(self) -> None:
        with self.cond:
            self.viewers += 1
            self.last_viewer_at = time.time()

    def remove_viewer(self) -> None:
        with self.cond:
            self.viewers -= 1
            self.last_viewer_at = time.time()

    def _open_capture(self):
        src = int(self.source) if self.source.isdigit() else self.source
        cap = cv2.VideoCapture(src)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # kurangi delay stream jaringan
        return cap

    def _publish(self, frame: np.ndarray) -> None:
        ok, jpg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
        if ok:
            with self.cond:
                self.frame = jpg.tobytes()
                self.cond.notify_all()

    def run(self) -> None:
        # Muat model hanya saat worker benar-benar mulai (= ada penonton).
        model = None
        if self.detect:
            print(f"🧠 [{self.cam_id}] memuat model YOLO untuk deteksi...")
            model = YOLO(MODEL_PATH)
        cap = None if self.source == "test" else self._open_capture()
        try:
            while True:
                with self.cond:
                    idle = self.viewers == 0 and \
                        time.time() - self.last_viewer_at > self.IDLE_STOP_SECONDS
                if idle:
                    break

                if self.source == "test":
                    self._publish(make_test_frame(self.cam_id, time.monotonic()))
                    time.sleep(1 / TEST_FPS)
                    continue

                ok, frame = cap.read()
                if not ok:
                    cap.release()
                    time.sleep(2)  # sumber putus; coba sambung ulang
                    cap = self._open_capture()
                    continue
                if self.detect:
                    frame = annotate(model, self.tracker, frame)
                self._publish(frame)
        finally:
            if cap is not None:
                cap.release()
            model = None  # lepas referensi model → memori dibebaskan saat idle-stop
            with registry_lock:
                if workers.get(self.cam_id) is self:
                    del workers[self.cam_id]
            with self.cond:
                self.stopped = True
                self.cond.notify_all()


def get_worker(cam_id: str) -> CameraWorker:
    """Ambil worker, buat & jalankan bila belum ada. Dipakai stream/snapshot."""
    with registry_lock:
        worker = workers.get(cam_id)
        if worker is None or worker.stopped:
            worker = CameraWorker(cam_id, cameras[cam_id]["source"])
            workers[cam_id] = worker
            worker.start()
        return worker


def peek_worker(cam_id: str) -> "CameraWorker | None":
    """Ambil worker yang SUDAH ada tanpa membuat yang baru. Dipakai stats/history
    supaya polling 5 detik tidak ikut menyalakan kamera + model."""
    with registry_lock:
        worker = workers.get(cam_id)
        return worker if worker and not worker.stopped else None


def mjpeg_stream(worker: CameraWorker):
    worker.add_viewer()
    try:
        last = None
        while True:
            with worker.cond:
                worker.cond.wait_for(
                    lambda: worker.stopped or worker.frame is not last, timeout=5)
                if worker.stopped:
                    break
                if worker.frame is last:
                    continue  # timeout tanpa frame baru (sumber lambat/putus)
                last = worker.frame
            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n"
                   b"Content-Length: " + str(len(last)).encode() + b"\r\n\r\n"
                   + last + b"\r\n")
    finally:
        worker.remove_viewer()


EMPTY_STATS = {"total": 0, "by_health": {}, "by_jenis": {},
               "current": {"total": 0, "by_health": {}, "by_jenis": {}}}
EMPTY_HISTORY = {"total": 0, "count": 0, "history": []}


PAGE = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Server Kamera + Deteksi Karang — OTA</title>
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: -apple-system, "Segoe UI", sans-serif; background: #f0f4f8;
         color: #1c2b3a; padding: 24px 16px; }
  .wrap { max-width: 640px; margin: 0 auto; }
  h1 { font-size: 22px; }
  .sub { color: #5b7083; font-size: 13px; margin-top: 4px; }
  .card { background: #fff; border: 1px solid #dde6ee; border-radius: 14px;
          padding: 18px; margin-top: 16px; }
  .card h2 { font-size: 15px; margin-bottom: 10px; }
  .addr { display: flex; gap: 8px; align-items: center; }
  code { background: #eef3f8; border-radius: 8px; padding: 6px 10px; font-size: 14px; }
  .hint { color: #5b7083; font-size: 12px; margin-top: 8px; line-height: 1.5; }
  button { border: 0; border-radius: 10px; padding: 8px 14px; font-size: 13px;
           cursor: pointer; background: #0d9488; color: #fff; }
  button.ghost { background: #eef3f8; color: #1c2b3a; }
  button.danger { background: #fee2e2; color: #dc2626; }
  input { width: 100%; border: 1px solid #cdd9e4; border-radius: 10px;
          padding: 9px 12px; font-size: 14px; margin-top: 4px; }
  label { font-size: 12px; font-weight: 600; display: block; margin-top: 12px; }
  .cam { display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
         border-top: 1px solid #eef3f8; padding: 12px 0; }
  .cam:first-of-type { border-top: 0; }
  .cam .info { flex: 1; min-width: 200px; }
  .cam .name { font-size: 14px; font-weight: 600; }
  .cam .src { font-size: 12px; color: #5b7083; margin-top: 2px; word-break: break-all; }
  .id { font-family: ui-monospace, monospace; font-size: 18px; font-weight: 700;
        letter-spacing: 1px; color: #0d9488; }
  .empty { color: #5b7083; font-size: 13px; text-align: center; padding: 12px 0; }
  a { color: #0d9488; font-size: 12px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Server Kamera + Deteksi Karang</h1>
  <p class="sub">Demo lokal — semua perangkat harus satu WiFi. Tiap kamera
  distream dengan deteksi karang otomatis.</p>

  <div class="card">
    <h2>Alamat Server</h2>
    <div class="addr">
      <code id="addr">{{ base_url }}</code>
      <button class="ghost" onclick="salin('addr', this)">Salin</button>
    </div>
    <p class="hint">Tempel alamat ini di kolom <b>Alamat Server Kamera</b> di website
    OTA (halaman Kamera). Cukup sekali; ganti lagi hanya bila WiFi/IP berubah.</p>
  </div>

  <div class="card">
    <h2>Kamera Terdaftar</h2>
    {% if not cameras %}<p class="empty">Belum ada kamera. Tambahkan di bawah.</p>{% endif %}
    {% for c in cameras %}
    <div class="cam">
      <div class="info">
        <p class="name">{{ c.name }}</p>
        <p class="src">{{ c.source }} — <a href="/stream/{{ c.id }}" target="_blank">pratinjau</a></p>
      </div>
      <span class="id" id="id-{{ c.id }}">{{ c.id }}</span>
      <button class="ghost" onclick="salin('id-{{ c.id }}', this)">Salin ID</button>
      <form method="post" action="/cameras/{{ c.id }}/delete"
            onsubmit="return confirm('Hapus kamera {{ c.name }}?')">
        <button class="danger">Hapus</button>
      </form>
    </div>
    {% endfor %}
    <p class="hint">Tempel <b>ID</b> di form "Tambah Kamera" website OTA.</p>
  </div>

  <div class="card">
    <h2>Tambah Kamera</h2>
    <form method="post" action="/cameras">
      <label>Nama</label>
      <input name="name" required placeholder="Misal: Kamera Dermaga Bunaken">
      <label>Sumber</label>
      <input name="source" required
             placeholder="0 (webcam laptop) / http://192.168.1.20:8080/video / test">
      <p class="hint">Isi <code>0</code> untuk webcam laptop, URL stream IP Webcam
      untuk kamera HP, atau <code>test</code> untuk pola uji tanpa kamera.</p>
      <p style="margin-top:14px"><button>Tambah</button></p>
    </form>
  </div>
</div>
<script>
/* Clipboard API butuh HTTPS; halaman ini HTTP lokal, jadi pakai fallback. */
function salin(id, btn) {
  const teks = document.getElementById(id).textContent.trim();
  const ta = document.createElement('textarea');
  ta.value = teks;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  const asal = btn.textContent;
  btn.textContent = 'Tersalin!';
  setTimeout(() => (btn.textContent = asal), 1200);
}
</script>
</body>
</html>"""


@app.get("/")
@auth_required
def index():
    return render_template_string(
        PAGE,
        cameras=sorted(cameras.values(), key=lambda c: c["name"].lower()),
        base_url=f"http://{lan_ip()}:{app.config['PORT']}",
    )


@app.post("/cameras")
@auth_required
def add_camera():
    name = request.form.get("name", "").strip()
    source = request.form.get("source", "").strip()
    if name and source:
        with registry_lock:
            cam_id = new_camera_id()
            cameras[cam_id] = {"id": cam_id, "name": name, "source": source}
            save_cameras()
    return redirect("/")


@app.post("/cameras/<cam_id>/delete")
@auth_required
def delete_camera(cam_id: str):
    with registry_lock:
        cameras.pop(cam_id, None)
        save_cameras()
        worker = workers.get(cam_id)
    if worker:
        with worker.cond:
            worker.stopped = True
            worker.cond.notify_all()
    return redirect("/")


@app.get("/stream/<cam_id>")
def stream(cam_id: str):
    if cam_id not in cameras:
        abort(404)
    return Response(
        mjpeg_stream(get_worker(cam_id)),
        mimetype="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/snapshot/<cam_id>")
def snapshot(cam_id: str):
    """Satu frame JPEG — untuk cek cepat tanpa membuka stream."""
    if cam_id not in cameras:
        abort(404)
    worker = get_worker(cam_id)
    worker.add_viewer()
    try:
        with worker.cond:
            worker.cond.wait_for(lambda: worker.stopped or worker.frame is not None,
                                 timeout=10)
            frame = worker.frame
    finally:
        worker.remove_viewer()
    if frame is None:
        abort(503)
    return Response(frame, mimetype="image/jpeg", headers={"Cache-Control": "no-store"})


@app.get("/stats/<cam_id>")
def stats(cam_id: str):
    """Statistik deteksi kamera ini. Tidak menyalakan kamera: kalau tidak sedang
    ditonton (worker mati), balikkan nol."""
    if cam_id not in cameras:
        abort(404)
    worker = peek_worker(cam_id)
    if worker is None or worker.tracker is None:
        return jsonify(EMPTY_STATS)
    return jsonify(worker.tracker.stats())


@app.get("/history/<cam_id>")
def history(cam_id: str):
    if cam_id not in cameras:
        abort(404)
    worker = peek_worker(cam_id)
    if worker is None or worker.tracker is None:
        return jsonify(EMPTY_HISTORY)
    return jsonify(worker.tracker.history())


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Server kamera mitra + deteksi karang (demo OTA)")
    # 5000 dihindari: dipakai AirPlay Receiver di macOS. Kalau app_web.py juga
    # jalan di 5001, jalankan salah satunya dengan --port lain (mis. 5002).
    parser.add_argument("--port", type=int, default=5001)
    parser.add_argument("--password", default=None,
                        help="password halaman kelola; kosong = dibuat acak & "
                             "ditampilkan di terminal")
    args = parser.parse_args()

    load_cameras()
    app.config["PORT"] = args.port
    password = args.password or \
        "".join(secrets.choice(ID_ALPHABET) for _ in range(8))
    app.config["ADMIN_PASSWORD"] = password
    print(f"🚀 Model deteksi: {MODEL_PATH}")
    print(f"\n  Server kamera jalan di: http://{lan_ip()}:{args.port}")
    if args.password:
        print("  🔒 Halaman kelola dilindungi password (--password).\n")
    else:
        print(f"  🔒 Password halaman kelola: {password}  (username bebas)\n")
    app.run(host="0.0.0.0", port=args.port, threaded=True)


if __name__ == "__main__":
    main()
