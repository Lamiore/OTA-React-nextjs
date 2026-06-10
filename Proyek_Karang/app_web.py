import os
import cv2
import numpy as np
import base64
import csv
import threading
import time
from io import StringIO
from flask import Flask, render_template, request, jsonify, Response
from flask_cors import CORS
from ultralytics import YOLO

app = Flask(__name__)
CORS(app)

# ==============================
# CONFIRM MODEL PATH
# ==============================
# Try loading best.pt from root, then training directory, then fallback to yolov8n.pt
MODEL_PATH = "best.pt"
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = "runs/detect/train-2/weights/best.pt"

if not os.path.exists(MODEL_PATH):
    print(f"⚠️ Warning: Model weights '{MODEL_PATH}' not found. Using default yolov8n.pt")
    MODEL_PATH = "yolov8n.pt"

print(f"🚀 Loading YOLO model from: {MODEL_PATH}")
model = YOLO(MODEL_PATH)

# ==============================
# INFERENCE TUNING
# ==============================
# imgsz=640 matches the training size (was 320) -> better accuracy, but ~4x slower on CPU.
# conf is kept conservative (0.5): the model is overfit on few images, so a higher cutoff
# would also drop the genuine detections. agnostic_nms + max_det curb spurious/overlapping boxes.
CONF = 0.5
IMG_SIZE = 640
MAX_DET = 20
RECORD_INTERVAL = 2.0  # seconds between history records (webcam runs at ~25 fps)

# ==============================
# THREAD-SAFE STORAGE HISTORY
# ==============================
MAX_HISTORY = 200            # recent detections kept for the timeline feed
history_data = []            # recent detections (each carries a timestamp) for /history
history_lock = threading.Lock()

# Cumulative counters (never capped, never reset) for accurate running totals
total_count = 0
by_health_count = {}
by_jenis_count = {}

def add_to_history(detections):
    """Records detections into the recent feed and the cumulative counters (thread-safe)."""
    global history_data, total_count
    if not detections:
        return
    with history_lock:
        for det in detections:
            total_count += 1
            by_health_count[det['kesehatan']] = by_health_count.get(det['kesehatan'], 0) + 1
            by_jenis_count[det['jenis']] = by_jenis_count.get(det['jenis'], 0) + 1
        history_data.extend(detections)
        if len(history_data) > MAX_HISTORY:
            history_data = history_data[-MAX_HISTORY:]

# ==============================
# RULE-BASED CORAL HEALTH PREDICTION
# ==============================
def predict_health(roi):
    """Predicts coral health based on its average brightness in BGR format."""
    if roi.size == 0:
        return "Tidak Diketahui"

    # Calculate average color channel intensity (OpenCV uses BGR)
    avg_color = roi.mean(axis=(0, 1))
    blue, green, red = avg_color[0], avg_color[1], avg_color[2]
    
    # Calculate average brightness
    brightness = (red + green + blue) / 3

    if brightness > 180:
        return "Mengalami Pemutihan"
    elif brightness > 120:
        return "Kurang Sehat"
    else:
        return "Sehat"

# ==============================
# FRAME ANNOTATION UTILITY
# ==============================
def annotate_frame(frame):
    """Runs YOLO prediction, computes health status, and draws bounding boxes."""
    results = model.predict(frame, conf=CONF, imgsz=IMG_SIZE, max_det=MAX_DET, agnostic_nms=True, verbose=False)
    detections = []
    
    for box in results[0].boxes:
        cls_id = int(box.cls[0])
        label = model.names[cls_id]
        x1, y1, x2, y2 = map(int, box.xyxy[0])

        roi = frame[y1:y2, x1:x2]
        health = predict_health(roi)

        detection_data = {"jenis": label, "kesehatan": health, "waktu": time.time()}
        detections.append(detection_data)

        # Draw status-based bounding box
        if health == "Sehat":
            color = (0, 255, 0)      # Green
        elif health == "Kurang Sehat":
            color = (0, 255, 255)    # Yellow
        else:
            color = (0, 0, 255)      # Red

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        cv2.putText(
            frame,
            f"{label} | {health}",
            (x1, max(y1 - 10, 20)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            color,
            2,
        )
    return frame, detections

# ==============================
# THREAD-SAFE BACKGROUND STREAMER
# ==============================
class CameraStreamer(object):
    """
    A thread-safe camera streamer that reads from webcam once in the background,
    caches processed frames, and serves them to multiple Flask clients simultaneously.
    This resolves OpenCV threading conflicts and heavily reduces CPU usage.
    """
    def __init__(self):
        self.cap = None
        self.lock = threading.Lock()
        self.running = False
        self.thread = None
        self.latest_frame = None
        self.latest_detections = []

    def start(self):
        with self.lock:
            if not self.running:
                self.cap = cv2.VideoCapture(0)
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
                self.running = True
                self.thread = threading.Thread(target=self._capture_loop, daemon=True)
                self.thread.start()
                print("📷 Camera background capture thread started successfully.")

    def _capture_loop(self):
        last_record = 0.0
        while self.running:
            success, frame = self.cap.read()
            if not success:
                time.sleep(0.05)
                continue

            # Run YOLO annotation on local webcam frames
            annotated, detections = annotate_frame(frame)

            # JPEG compress the annotated frame to save bandwidth/CPU on read
            ok, jpeg = cv2.imencode('.jpg', annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 70])
            if ok:
                self.latest_frame = jpeg.tobytes()
                self.latest_detections = detections
                # Throttle history: at ~25 fps a static coral would otherwise flood
                # the log with hundreds of identical rows and inflate the total.
                now = time.time()
                if detections and now - last_record >= RECORD_INTERVAL:
                    add_to_history(detections)
                    last_record = now

            # Cap webcam frame rate to ~25 FPS to save CPU resources
            time.sleep(0.04)

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

# Automatically spin up the camera capture loop
camera_streamer.start()

# ==============================
# FLASK ROUTING
# ==============================
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/video_feed')
def video_feed():
    """Returns the MJPEG stream to clients using the cached background frames."""
    def generate_mjpeg():
        while True:
            frame = camera_streamer.get_frame()
            if frame is None:
                time.sleep(0.1)
                continue
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n'
            )
            time.sleep(0.04) # Match capture rate (~25 FPS)

    return Response(
        generate_mjpeg(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
    )

@app.route('/predict_camera', methods=['POST'])
def predict_camera():
    """Receives base64 image from web clients, runs predictions, and returns results."""
    try:
        data = request.json['image']
        encoded = data.split(',')[1]
        img_bytes = base64.b64decode(encoded)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        # Run detection and draw annotations
        processed_frame, detections = annotate_frame(frame)
        
        # Save to global history
        if detections:
            add_to_history(detections)

        # Re-encode and return image
        _, buffer = cv2.imencode('.jpg', processed_frame)
        processed_image = base64.b64encode(buffer).decode('utf-8')

        return jsonify({
            'image': processed_image,
            'total': len(detections),
            'populasi': detections
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/predict', methods=['POST'])
def predict():
    """Receives image file uploads and returns detection summary."""
    try:
        file = request.files['file']
        img_bytes = file.read()
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        results = model.predict(img, conf=CONF, imgsz=IMG_SIZE, max_det=MAX_DET, agnostic_nms=True, verbose=False)
        counts = []

        for box in results[0].boxes:
            cls_id = int(box.cls[0])
            label = model.names[cls_id]
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            roi = img[y1:y2, x1:x2]
            health = predict_health(roi)

            detection_data = {"jenis": label, "kesehatan": health, "waktu": time.time()}
            counts.append(detection_data)

        # Save to history
        if counts:
            add_to_history(counts)

        return jsonify({
            'total': len(counts),
            'populasi': counts
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/stats')
def stats():
    """Returns cumulative coral detection stats (running totals since the server started)."""
    with history_lock:
        return jsonify({
            'total': total_count,
            'by_health': dict(by_health_count),
            'by_jenis': dict(by_jenis_count),
        })


@app.route('/history')
def history():
    """Returns the recent detection feed (newest first) plus the cumulative total."""
    with history_lock:
        recent = list(history_data)
        total = total_count
    recent.reverse()
    return jsonify({
        'total': total,
        'count': len(recent),
        'history': recent,
    })

@app.route('/export_csv')
def export_csv():
    """Safely exports global detection history to a downloadable CSV file."""
    with history_lock:
        history_copy = list(history_data)

    si = StringIO()
    writer = csv.writer(si)
    writer.writerow(['No', 'Waktu', 'Jenis Karang', 'Status Kesehatan'])

    for idx, item in enumerate(history_copy, start=1):
        waktu = item.get('waktu')
        waktu_str = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(waktu)) if waktu else ''
        writer.writerow([idx, waktu_str, item['jenis'], item['kesehatan']])

    output = si.getvalue()
    return Response(
        output,
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=history_deteksi_karang.csv"}
    )

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=5001, debug=False) # Set debug=False for thread-safety and single initialization
    finally:
        camera_streamer.stop()