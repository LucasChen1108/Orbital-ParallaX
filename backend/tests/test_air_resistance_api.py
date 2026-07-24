from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app


client = TestClient(app)
BASE = "/api/v1/video"


def _physics_result(drag_coefficient=None):
    timestamps = [i / 30 for i in range(12)]
    return {
        "timestamps": timestamps,
        "x_positions_m": [0.2 * i for i in range(12)],
        "y_positions_m": [1.0 + 0.1 * i - 0.01 * i**2 for i in range(12)],
        "velocities_x_ms": [6.0] * 12,
        "velocities_y_ms": [4.0 - 0.3 * i for i in range(12)],
        "accelerations_x_ms2": [0.0] * 12,
        "accelerations_y_ms2": [-9.81] * 12,
        "estimated_gravity_ms2": 9.81,
        "initial_velocity_ms": 7.21,
        "launch_angle_deg": 33.69,
        "px_per_metre": 100.0,
        "drag_coefficient": drag_coefficient,
        "predicted_trajectory": {
            "x_positions_m": [0.2 * i for i in range(16)],
            "y_positions_m": [1.0 + 0.1 * i - 0.01 * i**2 for i in range(16)],
        },
    }


@pytest.fixture(autouse=True)
def isolated_analysis_dependencies(monkeypatch, tmp_path):
    import routers.video as video_router

    detections = [(i, 20.0 + 5.0 * i, 90.0 - 3.0 * i) for i in range(12)]
    monkeypatch.setattr(
        video_router,
        "get_video_path",
        lambda _video_id: Path(tmp_path / "synthetic.mp4"),
    )
    monkeypatch.setattr(video_router, "get_video_fps", lambda _path: 30.0)
    monkeypatch.setattr(
        video_router,
        "track_ball",
        lambda *_args, **_kwargs: detections,
    )
    monkeypatch.setattr(video_router, "render_overlay", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        video_router,
        "overlay_path_for",
        lambda _video_id: tmp_path / "overlay.mp4",
    )
    video_router._YOLO_DETECTION_CACHE.clear()


def _analyse_payload(*, use_air_resistance: bool, method: str = "hsv"):
    return {
        "video_id": f"issue-39-{method}-{use_air_resistance}",
        "frame_range": {"start_frame": 0, "end_frame": 11},
        "calibration": {
            "mode": "manual",
            "x1": 0,
            "y1": 0,
            "x2": 100,
            "y2": 0,
            "real_world_distance_m": 1.0,
        },
        "hsv_lower": [40, 50, 50],
        "hsv_upper": [80, 255, 255],
        "use_air_resistance": use_air_resistance,
        "method": method,
    }


def test_analyse_with_air_resistance(monkeypatch):
    import routers.video as video_router

    monkeypatch.setattr(
        video_router,
        "compute_physics_with_drag",
        lambda *_args, **_kwargs: _physics_result(drag_coefficient=0.04),
    )
    response = client.post(
        f"{BASE}/analyse",
        json=_analyse_payload(use_air_resistance=True),
    )

    assert response.status_code == 200
    assert response.json()["result"]["drag_coefficient"] == pytest.approx(0.04)


def test_analyse_without_air_resistance(monkeypatch):
    import routers.video as video_router

    monkeypatch.setattr(
        video_router,
        "compute_physics",
        lambda *_args, **_kwargs: _physics_result(),
    )
    response = client.post(
        f"{BASE}/analyse",
        json=_analyse_payload(use_air_resistance=False),
    )

    assert response.status_code == 200
    assert response.json()["result"]["drag_coefficient"] is None


@pytest.mark.parametrize("method", ["hsv", "yolo"])
def test_analyse_returns_tracker_mode(monkeypatch, method):
    import routers.video as video_router

    monkeypatch.setattr(
        video_router,
        "compute_physics",
        lambda *_args, **_kwargs: _physics_result(),
    )
    response = client.post(
        f"{BASE}/analyse",
        json=_analyse_payload(use_air_resistance=False, method=method),
    )

    assert response.status_code == 200
    assert response.json()["result"]["tracker_mode"] == method


def test_analyse_returns_predicted_trajectory(monkeypatch):
    import routers.video as video_router

    monkeypatch.setattr(
        video_router,
        "compute_physics",
        lambda *_args, **_kwargs: _physics_result(),
    )
    response = client.post(
        f"{BASE}/analyse",
        json=_analyse_payload(use_air_resistance=False),
    )

    assert response.status_code == 200
    trajectory = response.json()["result"]["predicted_trajectory"]
    assert isinstance(trajectory["x_positions_m"], list)
    assert isinstance(trajectory["y_positions_m"], list)
    assert trajectory["x_positions_m"]
    assert len(trajectory["x_positions_m"]) == len(trajectory["y_positions_m"])
