"""Robust scale estimation from YOLO sports-ball bounding boxes."""

import math

import numpy as np


def estimate_ball_scale(
    detections: list[dict],
    ball_diameter_m: float,
    total_frames: int,
) -> dict:
    """Estimate pixels per metre and flag unstable apparent ball size.

    YOLO localises the ball; a robust median of the effective bounding-box
    diameters supplies the scale. Basic geometry and confidence filtering
    remove boxes that are too small, clipped, elongated, or low-confidence.
    """
    if ball_diameter_m <= 0:
        raise ValueError("Ball diameter must be positive.")

    candidates = []
    for item in detections:
        width = float(item["width_px"])
        height = float(item["height_px"])
        confidence = float(item["confidence"])
        if width < 10 or height < 10 or confidence < 0.25:
            continue

        aspect_ratio = width / height
        if not 0.65 <= aspect_ratio <= 1.5:
            continue

        margin = 1.0
        if (
            item["x1"] <= margin
            or item["y1"] <= margin
            or item["x2"] >= item["frame_width"] - margin
            or item["y2"] >= item["frame_height"] - margin
        ):
            continue

        candidates.append(math.sqrt(width * height))

    if len(candidates) < 5:
        raise ValueError(
            "Automatic calibration needs at least 5 reliable ball detections. "
            "Use manual calibration or adjust the frame interval."
        )

    raw = np.asarray(candidates, dtype=float)
    raw_median = float(np.median(raw))
    mad = float(np.median(np.abs(raw - raw_median)))
    outlier_limit = max(3.5 * 1.4826 * mad, 0.25 * raw_median)
    cleaned = raw[np.abs(raw - raw_median) <= outlier_limit]
    if len(cleaned) < 5:
        raise ValueError(
            "Ball-size detections are too inconsistent for automatic calibration."
        )

    median_diameter_px = float(np.median(cleaned))
    mean_diameter_px = float(np.mean(cleaned))
    std_diameter_px = float(np.std(cleaned, ddof=1)) if len(cleaned) > 1 else 0.0
    variation_cv_pct = (
        100.0 * std_diameter_px / mean_diameter_px
        if mean_diameter_px > 0 else float("inf")
    )

    if variation_cv_pct <= 8.0:
        quality = "good"
    elif variation_cv_pct <= 15.0:
        quality = "moderate"
    else:
        quality = "unreliable"

    warning = None
    if quality != "good":
        warning = (
            "The ball's apparent size changes across the selected frames. "
            "This may indicate perspective motion, a flight plane that is not "
            "parallel to the camera, motion blur, or unstable detections."
        )

    return {
        "px_per_metre": median_diameter_px / ball_diameter_m,
        "median_diameter_px": median_diameter_px,
        "mean_diameter_px": mean_diameter_px,
        "diameter_std_px": std_diameter_px,
        "variation_cv_pct": variation_cv_pct,
        "quality": quality,
        "warning": warning,
        "valid_detections": int(len(cleaned)),
        "raw_detections": int(len(detections)),
        "total_frames": int(total_frames),
    }
