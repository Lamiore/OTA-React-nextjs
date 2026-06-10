import os
import cv2
from ultralytics import YOLO

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
# START CAMERA
# ==============================
# Open Laptop Webcam (0 is built-in camera)
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("❌ Error: Kamera gagal dibuka! Pastikan tidak ada aplikasi lain yang sedang menggunakan kamera.")
    exit(1)

print("🎥 Kamera berhasil dijalankan.")
print("ℹ️ Tekan tombol 'q' pada jendela video untuk keluar dari aplikasi.")

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        print("⚠️ Warning: Gagal membaca frame dari kamera.")
        break

    # Jalankan Prediksi YOLO (imgsz=320 untuk kecepatan optimal di CPU)
    results = model.predict(source=frame, conf=0.5, imgsz=320, show=False, verbose=False)

    # Plot bounding box bawaan YOLO ke frame
    annotated_frame = results[0].plot()
    detections = results[0].boxes.cls.tolist()  # List of detected class IDs
    
    # Hitung jumlah populasi per jenis karang
    counts = {}
    for class_id in detections:
        name = model.names[int(class_id)]
        counts[name] = counts.get(name, 0) + 1

    # Tampilkan Statistik di Layar Jendela
    y_pos = 30
    cv2.putText(annotated_frame, "Statistik Populasi:", (10, y_pos), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    for name, count in counts.items():
        y_pos += 30
        text = f"- {name}: {count}"
        cv2.putText(annotated_frame, text, (10, y_pos), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

    # Tampilkan hasil video di jendela GUI
    cv2.imshow("Aplikasi Deteksi & Penghitung Karang Polimdo", annotated_frame)

    # Berhenti jika menekan tombol 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
print("👋 Aplikasi ditutup dengan sukses.")