"""Server kamera lokal untuk demo fitur Kamera Mitra OTA.

Jalan di laptop pada jaringan WiFi yang sama dengan kamera dan penonton.
Mitra mendaftarkan kamera di halaman web server ini, mendapat ID pendek,
lalu menempelkan ID itu di website OTA. Website OTA menyusun URL stream
dari "Alamat Server Kamera" (disimpan di Firestore) + /stream/<id>.

Sumber kamera yang didukung:
- angka (mis. `0`)  → webcam bawaan laptop (index perangkat OpenCV);
- URL http(s)       → stream MJPEG, mis. aplikasi IP Webcam Android;
- `test`            → pola uji bergerak, tanpa kamera fisik.
"""

import argparse
import json
import secrets
import socket
import threading
import time
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, Response, abort, redirect, render_template_string, request

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "cameras.json"
ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # tanpa karakter membingungkan (0/o, 1/l/i)
JPEG_QUALITY = 70
TEST_FPS = 15

app = Flask(__name__)

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
    IDLE_STOP_SECONDS tanpa penonton, supaya webcam tidak terkunci terus.
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
                self._publish(frame)
        finally:
            if cap is not None:
                cap.release()
            with registry_lock:
                if workers.get(self.cam_id) is self:
                    del workers[self.cam_id]
            with self.cond:
                self.stopped = True
                self.cond.notify_all()


def get_worker(cam_id: str) -> CameraWorker:
    with registry_lock:
        worker = workers.get(cam_id)
        if worker is None or worker.stopped:
            worker = CameraWorker(cam_id, cameras[cam_id]["source"])
            workers[cam_id] = worker
            worker.start()
        return worker


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


PAGE = """<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Server Kamera Mitra — OTA</title>
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
  <h1>Server Kamera Mitra</h1>
  <p class="sub">Demo lokal — semua perangkat harus satu WiFi.</p>

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
def index():
    return render_template_string(
        PAGE,
        cameras=sorted(cameras.values(), key=lambda c: c["name"].lower()),
        base_url=f"http://{lan_ip()}:{app.config['PORT']}",
    )


@app.post("/cameras")
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


def main() -> None:
    parser = argparse.ArgumentParser(description="Server kamera lokal demo OTA")
    # 5000 dihindari: dipakai AirPlay Receiver di macOS.
    parser.add_argument("--port", type=int, default=5001)
    args = parser.parse_args()

    load_cameras()
    app.config["PORT"] = args.port
    print(f"\n  Server kamera jalan di: http://{lan_ip()}:{args.port}\n")
    app.run(host="0.0.0.0", port=args.port, threaded=True)


if __name__ == "__main__":
    main()
