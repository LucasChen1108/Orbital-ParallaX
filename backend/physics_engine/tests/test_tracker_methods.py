import numpy as np
import pytest

import tracker
from tracker import track_ball, track_hsv
import tracker.yolo as yolo_mod


# ── dispatcher ────────────────────────────────────────────────────────────────

def test_dispatch_routes_to_yolo(monkeypatch):
    calls = {}
    monkeypatch.setattr(tracker, "track_yolo",
                        lambda v, s, e: calls.setdefault("yolo", True) or [])
    track_ball("video.mp4", 0, 10, method="yolo")
    assert "yolo" in calls


def test_dispatch_routes_to_hsv(monkeypatch):
    calls = {}
    monkeypatch.setattr(tracker, "track_hsv",
                        lambda v, s, e, lo, hi: calls.setdefault("hsv", True) or [])
    track_ball("video.mp4", 0, 10,
               hsv_lower=[40, 50, 50], hsv_upper=[80, 255, 255], method="hsv")
    assert "hsv" in calls


def test_hsv_method_requires_colour_range():
    with pytest.raises(ValueError):
        track_ball("video.mp4", 0, 10, method="hsv")


# ── YOLO tracker ───────────────────────────────────────────────

def test_track_yolo_returns_centre_tuples(monkeypatch, synthetic_ball_video):
    class FakeBoxes:
        conf = np.array([0.9])

        def __len__(self):
            return 1

        def __getitem__(self, i):
            box = type("Box", (), {})()
            box.xyxy = np.array([[10.0, 20.0, 30.0, 40.0]])
            return box

    class FakeResult:
        boxes = FakeBoxes()

    class FakeModel:
        def __call__(self, frame, **kwargs):
            return [FakeResult()]

    monkeypatch.setattr(yolo_mod, "_get_model", lambda: FakeModel())

    detections = yolo_mod.track_yolo(synthetic_ball_video, 0, 4)
    assert len(detections) >= 1
    for frame_idx, cx, cy in detections:
        assert isinstance(frame_idx, int)
        assert (cx, cy) == (20.0, 30.0)   # centre of bbox [10, 20, 30, 40]


def test_track_yolo_detailed_keeps_box_size_and_confidence(monkeypatch, synthetic_ball_video):
    class FakeBoxes:
        conf = np.array([0.85])

        def __len__(self):
            return 1

        def __getitem__(self, i):
            box = type("Box", (), {})()
            box.xyxy = np.array([[10.0, 20.0, 34.0, 42.0]])
            return box

    class FakeResult:
        boxes = FakeBoxes()

    class FakeModel:
        def __call__(self, frame, **kwargs):
            return [FakeResult()]

    monkeypatch.setattr(yolo_mod, "_get_model", lambda: FakeModel())
    detections = yolo_mod.track_yolo_detailed(synthetic_ball_video, 0, 2)
    assert detections
    assert detections[0]["width_px"] == 24.0
    assert detections[0]["height_px"] == 22.0
    assert detections[0]["confidence"] == pytest.approx(0.85)


# ── HSV tracker (regression on synthetic clip) ────────────────────────────────

def test_track_hsv_detects_green_ball(synthetic_ball_video):
    detections = track_hsv(synthetic_ball_video, 0, 19, [40, 50, 50], [80, 255, 255])
    assert len(detections) >= 5
    for frame_idx, cx, cy in detections:
        assert isinstance(frame_idx, int)
        assert 0 <= cx <= 320 and 0 <= cy <= 240
