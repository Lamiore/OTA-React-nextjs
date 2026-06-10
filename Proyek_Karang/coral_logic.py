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
