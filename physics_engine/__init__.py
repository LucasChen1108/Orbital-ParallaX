"""
physics_engine
--------------
Public API — import from here, not from submodules.

    from physics_engine import sample_ball_colour, track_ball
    from physics_engine import compute_px_per_metre, compute_physics
"""

from .tracker          import sample_ball_colour, track_ball
from .solver.calculator import compute_px_per_metre, compute_physics

__all__ = [
    "sample_ball_colour",
    "track_ball",
    "compute_px_per_metre",
    "compute_physics",
]