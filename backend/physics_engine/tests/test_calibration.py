import pytest

from calibration import estimate_ball_scale


def _detection(frame, diameter, confidence=0.9):
    return {
        "frame_index": frame,
        "cx": 100.0,
        "cy": 80.0,
        "x1": 100.0 - diameter / 2,
        "y1": 80.0 - diameter / 2,
        "x2": 100.0 + diameter / 2,
        "y2": 80.0 + diameter / 2,
        "width_px": diameter,
        "height_px": diameter,
        "confidence": confidence,
        "frame_width": 320,
        "frame_height": 240,
    }


def test_ball_scale_uses_robust_median():
    detections = [_detection(i, size) for i, size in enumerate(
        [39, 40, 40, 41, 40, 39, 41, 100]
    )]
    result = estimate_ball_scale(detections, ball_diameter_m=0.2, total_frames=8)
    assert result["median_diameter_px"] == pytest.approx(40.0)
    assert result["px_per_metre"] == pytest.approx(200.0)
    assert result["quality"] == "good"


def test_ball_scale_warns_for_large_size_variation():
    detections = [
        _detection(i, size)
        for i, size in enumerate([20, 23, 26, 29, 32, 35, 38, 41, 44, 47])
    ]
    result = estimate_ball_scale(detections, ball_diameter_m=0.22, total_frames=10)
    assert result["quality"] == "unreliable"
    assert result["variation_cv_pct"] > 15
    assert result["warning"] is not None


def test_ball_scale_rejects_too_few_reliable_boxes():
    detections = [_detection(i, 8) for i in range(10)]
    with pytest.raises(ValueError, match="at least 5"):
        estimate_ball_scale(detections, ball_diameter_m=0.2, total_frames=10)


def test_ball_scale_rejects_nonpositive_diameter():
    with pytest.raises(ValueError, match="positive"):
        estimate_ball_scale([_detection(i, 30) for i in range(6)], 0, 6)
