"""
physics_engine
--------------
Public API — import from here, not from submodules.

    from physics_engine import sample_ball_colour, track_ball
    from physics_engine import compute_px_per_metre, compute_physics
"""

from .tracker          import sample_ball_colour, track_ball, track_yolo_detailed
from .solver.calculator import compute_px_per_metre, compute_physics, compute_physics_with_drag, simulate_trajectory
from .calibration import estimate_ball_scale

__all__ = [
    "sample_ball_colour",
    "track_ball",
    "track_yolo_detailed",
    "compute_px_per_metre",
    "compute_physics",
    "compute_physics_with_drag",
    "simulate_trajectory",
    "estimate_ball_scale",
]
