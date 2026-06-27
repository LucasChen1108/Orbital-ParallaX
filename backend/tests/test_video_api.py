import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient

from main import app
from services.video_service import render_overlay

client = TestClient(app)
BASE = "/api/v1/video"


@pytest.fixture
def synthetic_video(tmp_path):
    """Short readable clip with a moving green ball."""
    path = tmp_path / "clip.mp4"
    w, h, fps, n = 160, 120, 30, 12
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for i in range(n):
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        cv2.circle(frame, (10 + i * 10, 60), 6, (0, 255, 0), -1)
        writer.write(frame)
    writer.release()
    return path


def test_overlay_404_when_missing():
    r = client.get(f"{BASE}/overlay/does-not-exist")
    assert r.status_code == 404


def test_render_overlay_produces_playable_file(synthetic_video, tmp_path):
    out = tmp_path / "overlay.mp4"
    detections = [(i, 10 + i * 10, 60) for i in range(12)]
    render_overlay(synthetic_video, 0, 11, detections, out)
    assert out.exists() and out.stat().st_size > 0
    cap = cv2.VideoCapture(str(out))
    assert cap.isOpened()   # transcoded H.264 is readable
    cap.release()


def test_analyse_returns_detection_fields(synthetic_video, monkeypatch):
    import routers.video as video_router

    # Mock tracking + overlay so the test is fast and deterministic.
    fake_detections = [(i, 50.0, 100.0 - 2.0 * i) for i in range(12)]
    monkeypatch.setattr(video_router, "track_ball", lambda *a, **k: fake_detections)
    monkeypatch.setattr(video_router, "render_overlay", lambda *a, **k: None)

    with open(synthetic_video, "rb") as f:
        up = client.post(f"{BASE}/upload",
                         files={"file": ("clip.mp4", f, "video/mp4")})
    assert up.status_code == 200
    video_id = up.json()["video_id"]

    payload = {
        "video_id": video_id,
        "frame_range": {"start_frame": 0, "end_frame": 11},
        "calibration": {"x1": 0, "y1": 0, "x2": 100, "y2": 0,
                        "real_world_distance_m": 1.0},
        "hsv_lower": [40, 50, 50],
        "hsv_upper": [80, 255, 255],
        "method": "hsv",
    }
    r = client.post(f"{BASE}/analyse", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["detected_frames"] == len(fake_detections)
    assert body["detection_rate"] is not None
    assert "has_overlay" in body
