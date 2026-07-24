import numpy as np
import pytest

from solver.calculator import (
    _safe_window,
    _solve_drag_trajectory,
    compute_physics,
    compute_physics_with_drag,
    compute_px_per_metre,
)


# ── calibration ───────────────────────────────────────────────────────────────

def test_px_per_metre_basic():
    # 200 pixels = 2 metres → 100 px/m
    assert compute_px_per_metre(0, 0, 200, 0, 2.0) == 100.0

def test_px_per_metre_diagonal():
    # 3-4-5 triangle: pixel dist = 5, real = 1m → 5 px/m
    ratio = compute_px_per_metre(0, 0, 3, 4, 1.0)
    assert abs(ratio - 5.0) < 1e-9

def test_px_per_metre_zero_distance_raises():
    with pytest.raises(ValueError, match="positive"):
        compute_px_per_metre(0, 0, 100, 0, 0.0)

def test_px_per_metre_same_point_raises():
    with pytest.raises(ValueError, match="too close"):
        compute_px_per_metre(50, 50, 50, 50, 1.0)


# ── safe window ───────────────────────────────────────────────────────────────

def test_safe_window_odd():
    assert _safe_window(20) % 2 == 1

def test_safe_window_respects_n():
    assert _safe_window(6) <= 6

def test_safe_window_minimum():
    assert _safe_window(5) >= 5


# ── compute_physics ───────────────────────────────────────────────────────────

def _make_detections(n=20, fps=30.0, px_per_metre=100.0):
    """Simulate a ball in free fall: x constant, y increases (screen coords)."""
    g = 9.81
    detections = []
    for i in range(n):
        t  = i / fps
        cx = 200.0                          # no horizontal motion
        cy = 100.0 + 0.5 * g * t**2 * px_per_metre  # free fall in px
        detections.append((i, cx, cy))
    return detections

def test_compute_physics_returns_correct_keys():
    dets   = _make_detections()
    result = compute_physics(dets, fps=30.0, px_per_metre=100.0)
    expected_keys = {
        "timestamps", "x_positions_m", "y_positions_m",
        "velocities_x_ms", "velocities_y_ms",
        "accelerations_x_ms2", "accelerations_y_ms2",
        "estimated_gravity_ms2", "initial_velocity_ms",
        "launch_angle_deg", "px_per_metre",
        "predicted_trajectory",
    }
    assert expected_keys == set(result.keys())

def test_compute_physics_gravity_estimate():
    dets   = _make_detections(n=30, fps=30.0, px_per_metre=100.0)
    result = compute_physics(dets, fps=30.0, px_per_metre=100.0)
    # Should be close to 9.81 m/s²  (tolerance loosened for edge effects)
    assert abs(result["estimated_gravity_ms2"] - 9.81) < 2.0

def test_compute_physics_list_lengths_match():
    dets   = _make_detections(n=20)
    result = compute_physics(dets, fps=30.0, px_per_metre=100.0)
    n = len(result["timestamps"])
    assert len(result["x_positions_m"])       == n
    assert len(result["velocities_x_ms"])     == n
    assert len(result["accelerations_y_ms2"]) == n

def test_compute_physics_too_few_frames():
    with pytest.raises(ValueError, match="at least 5"):
        compute_physics([(i, 100.0, 100.0) for i in range(3)], 30.0, 100.0)


# ── bounded drag fit and bootstrap uncertainty ────────────────────────────────

def _make_drag_detections(
    n=36,
    fps=30.0,
    px_per_metre=100.0,
    missing_frames=(),
    noise_px=0.0,
    seed=7,
):
    frames = np.array([i for i in range(n) if i not in set(missing_frames)])
    timestamps = frames / fps
    states = _solve_drag_trajectory(
        timestamps,
        x0=2.0,
        y0=-1.0,
        g=9.81,
        drag_coeff=0.04,
        vx0=8.0,
        vy0=7.0,
    )
    rng = np.random.default_rng(seed)
    x_px = states[0] * px_per_metre
    y_px = -states[1] * px_per_metre
    if noise_px:
        x_px += rng.normal(0.0, noise_px, len(frames))
        y_px += rng.normal(0.0, noise_px, len(frames))
    return [
        (int(frame), float(x), float(y))
        for frame, x, y in zip(frames, x_px, y_px)
    ]


def test_drag_point_estimate_recovers_synthetic_parameters():
    result = compute_physics_with_drag(
        _make_drag_detections(), 30.0, 100.0,
        bootstrap_samples=0,
    )
    assert result["fit_quality"]["converged"] is True
    assert abs(result["estimated_gravity_ms2"] - 9.81) < 0.8
    assert abs(result["drag_coefficient"] - 0.04) < 0.03
    assert abs(result["initial_velocity_ms"] - np.hypot(8.0, 7.0)) < 0.8


def test_drag_bootstrap_returns_95_percent_intervals():
    result = compute_physics_with_drag(
        _make_drag_detections(noise_px=0.4), 30.0, 100.0,
        bootstrap_samples=20,
        random_seed=123,
    )
    intervals = result["confidence_intervals"]
    assert set(intervals) == {
        "estimated_gravity_ms2",
        "drag_coefficient",
        "initial_velocity_ms",
        "launch_angle_deg",
    }
    assert all(ci["lower"] <= ci["upper"] for ci in intervals.values())
    assert result["fit_quality"]["successful_bootstraps"] >= 10


def test_drag_fit_handles_missing_tracking_frames():
    result = compute_physics_with_drag(
        _make_drag_detections(missing_frames=(4, 9, 10, 21, 28)),
        30.0,
        100.0,
        bootstrap_samples=0,
    )
    assert result["fit_quality"]["converged"] is True
    assert len(result["timestamps"]) == 31
    assert abs(result["estimated_gravity_ms2"] - 9.81) < 1.0


def test_drag_fit_handles_noisy_tracking_data():
    result = compute_physics_with_drag(
        _make_drag_detections(noise_px=1.0),
        30.0,
        100.0,
        bootstrap_samples=0,
    )
    assert result["fit_quality"]["converged"] is True
    assert result["fit_quality"]["rmse_m"] < 0.1
    assert 5.0 <= result["estimated_gravity_ms2"] <= 15.0


def test_drag_fit_rejects_short_video():
    with pytest.raises(ValueError, match="at least 8"):
        compute_physics_with_drag(
            _make_drag_detections(n=7),
            30.0,
            100.0,
            bootstrap_samples=0,
        )
