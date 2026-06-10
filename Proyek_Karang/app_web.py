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
        file = request.files.get('file')
        if file is None:
            return jsonify({'error': 'tidak ada file yang diunggah'}), 400
        nparr = np.frombuffer(file.read(), np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return jsonify({'error': 'file bukan gambar yang valid'}), 400
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
