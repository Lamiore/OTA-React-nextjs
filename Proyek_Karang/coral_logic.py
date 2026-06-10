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
