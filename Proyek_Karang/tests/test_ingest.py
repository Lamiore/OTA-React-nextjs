"""Cek validasi route /ingest (mode push). Sengaja tidak menyentuh jalur sukses
karena itu memuat model YOLO; jalur sukses diverifikasi manual end-to-end."""
import pytest

import kamera_deteksi as kd


@pytest.fixture
def client():
    kd.app.config["TESTING"] = True
    kd.cameras.clear()
    return kd.app.test_client()


def test_ingest_unknown_camera_404(client):
    assert client.post("/ingest/nope", data=b"x").status_code == 404


def test_ingest_non_push_camera_400(client):
    kd.cameras["cam0"] = {"id": "cam0", "name": "webcam", "source": "0"}
    assert client.post("/ingest/cam0", data=b"x").status_code == 400


def test_ingest_invalid_image_400(client):
    kd.cameras["camp"] = {"id": "camp", "name": "hp", "source": "push"}
    assert client.post("/ingest/camp", data=b"notjpeg").status_code == 400


def test_broadcast_unknown_camera_404(client):
    assert client.get("/broadcast/nope").status_code == 404


def test_worker_source_kind_case_insensitive():
    assert kd.CameraWorker("x", "Push").is_push
    assert kd.CameraWorker("y", "PUSH").is_push
    assert kd.CameraWorker("z", "test").is_test
    assert not kd.CameraWorker("w", "0").is_push


def test_ingest_accepts_capital_push_source(client):
    # "Push" (kapital) tidak boleh ditolak sebagai sumber salah; data tak-valid
    # tetap 400 karena bukan JPEG, bukan karena source-nya.
    kd.cameras["camP"] = {"id": "camP", "name": "hp", "source": "Push"}
    assert client.post("/ingest/camP", data=b"notjpeg").status_code == 400
