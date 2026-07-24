import numpy as np
import pytest

from solver.calculator import (
    _solve_drag_trajectory,
    compute_physics_with_drag,
    simulate_trajectory,
)


FPS = 30.0
PX_PER_METRE = 100.0


def _synthetic_drag_detections(
    *,
    frames: int = 36,
    gravity: float = 9.81,
    drag_coefficient: float = 0.04,
) -> list[tuple[int, float, float]]:
    frame_indices = np.arange(frames)
    timestamps = frame_indices / FPS
    states = _solve_drag_trajectory(
        timestamps,
        x0=2.0,
        y0=-1.0,
        g=gravity,
        drag_coeff=drag_coefficient,
        vx0=8.0,
        vy0=7.0,
    )
    return [
        (int(frame), float(x * PX_PER_METRE), float(-y * PX_PER_METRE))
        for frame, x, y in zip(frame_indices, states[0], states[1])
    ]


@pytest.fixture(scope="module")
def drag_result() -> dict:
    return compute_physics_with_drag(
        _synthetic_drag_detections(),
        fps=FPS,
        px_per_metre=PX_PER_METRE,
        bootstrap_samples=0,
    )


def test_compute_physics_with_drag_gravity(drag_result):
    assert drag_result["estimated_gravity_ms2"] == pytest.approx(9.81, abs=1.0)


def test_compute_physics_with_drag_coefficient(drag_result):
    assert drag_result["drag_coefficient"] > 0


def test_drag_range_shorter_than_no_drag():
    initial_conditions = {
        "v0": 15.0,
        "angle_deg": 45.0,
        "g": 9.81,
    }
    no_drag = simulate_trajectory(**initial_conditions, drag_coeff=0.0)
    with_drag = simulate_trajectory(**initial_conditions, drag_coeff=0.05)

    no_drag_range = max(no_drag["x_positions_m"]) - min(no_drag["x_positions_m"])
    drag_range = max(with_drag["x_positions_m"]) - min(with_drag["x_positions_m"])

    assert drag_range < no_drag_range


def test_drag_result_has_correct_keys(drag_result):
    required_keys = {
        "drag_coefficient",
        "estimated_gravity_ms2",
        "timestamps",
        "x_positions_m",
        "y_positions_m",
    }
    assert required_keys <= drag_result.keys()
