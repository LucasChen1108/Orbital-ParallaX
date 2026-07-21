import pytest

from tracker.hsv import HSV_TOLERANCE, SAT_MIN, VAL_MIN


# ── colour range logic ────────────────────────────────────────────────────────
# We test the maths without needing a real video file.

def _build_range(h, s, v):
    """Mirror the range-building logic from sample_ball_colour."""
    lower = [
        max(h - HSV_TOLERANCE, 0),
        max(s - 40, SAT_MIN),
        max(v - 40, VAL_MIN),
    ]
    upper = [
        min(h + HSV_TOLERANCE, 179),
        255,
        255,
    ]
    return lower, upper

def test_range_lower_less_than_upper():
    lower, upper = _build_range(12, 180, 200)
    assert lower[0] < upper[0]
    assert lower[1] < upper[1]
    assert lower[2] < upper[2]

def test_hue_clamp_low():
    # hue near 0 should not go negative
    lower, upper = _build_range(5, 150, 150)
    assert lower[0] >= 0

def test_hue_clamp_high():
    # hue near 179 should not exceed 179
    lower, upper = _build_range(175, 150, 150)
    assert upper[0] <= 179

def test_saturation_floor():
    # low-saturation click should still meet SAT_MIN
    lower, _ = _build_range(30, 20, 200)
    assert lower[1] >= SAT_MIN

def test_value_floor():
    # dark click should still meet VAL_MIN
    lower, _ = _build_range(30, 150, 20)
    assert lower[2] >= VAL_MIN