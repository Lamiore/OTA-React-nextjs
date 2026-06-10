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
    assert smoothed == [cl.HEALTH_SEHAT]      # majority (tie -> elemen pertama dimasukkan = Sehat)


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
