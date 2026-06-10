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
