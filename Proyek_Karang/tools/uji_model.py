from ultralytics import YOLO
import cv2

# 1. Load model hasil training tadi
model = YOLO('runs/detect/train-2/weights/best.pt')

# 2. Jalankan deteksi pada foto baru
# Ganti 'path/ke/foto_karang_baru.jpg' dengan lokasi foto Anda
results = model.predict(source='dataset/images/Acropora formosa.jpg', save=True, conf=0.5)

print("✅ Selesai! Hasil deteksi disimpan di folder runs/detect/predict")