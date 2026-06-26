"""
hsv.py
------
Ball detection using HSV colour thresholding.

M1  → user clicks ball on frame 1 → sample_ball_colour() builds HSV range
M2+ → replace track_ball() body with YOLO — signature stays identical,
      backend never needs to change.
"""

import cv2
import numpy as np
from pathlib import Path

MIN_BLOB_AREA = 100   # px² — blobs smaller than this are noise
HSV_TOLERANCE = 25    # ± hue units around sampled colour
SAT_MIN       = 60    # floor for saturation (avoids greys)
VAL_MIN       = 60    # floor for value (avoids near-black)


# ── Public: colour sampling ───────────────────────────────────────────────────

def sample_ball_colour(
    video_path: Path,
    frame_index: int,
    click_x: float,
    click_y: float,
    sample_radius: int = 8,
) -> dict:
    """
    User clicks the ball on a frame → returns HSV range for tracking.

    Reads a (2*sample_radius) px patch around the click point,
    takes the median HSV, and builds lower/upper bounds around it.

    Returns:
        {
            "hsv_lower":   [H, S, V],
            "hsv_upper":   [H, S, V],
            "sampled_hsv": [H, S, V],  ← for debug overlay on frontend
        }
    """
    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        raise ValueError(f"Could not read frame {frame_index} from video.")

    h, w = frame.shape[:2]
    cx, cy = int(click_x), int(click_y)

    # Clamp patch to frame bounds
    x1 = max(cx - sample_radius, 0)
    x2 = min(cx + sample_radius, w)
    y1 = max(cy - sample_radius, 0)
    y2 = min(cy + sample_radius, h)

    patch     = frame[y1:y2, x1:x2]
    hsv_patch = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)

    # Median is robust against edge pixels of the ball
    median_hsv = np.median(hsv_patch.reshape(-1, 3), axis=0).astype(int)
    h_val = int(median_hsv[0])
    s_val = int(median_hsv[1])
    v_val = int(median_hsv[2])

    lower = [
        max(h_val - HSV_TOLERANCE, 0),
        max(s_val - 40, SAT_MIN),
        max(v_val - 40, VAL_MIN),
    ]
    upper = [
        min(h_val + HSV_TOLERANCE, 179),
        255,
        255,
    ]

    return {
        "hsv_lower":   lower,
        "hsv_upper":   upper,
        "sampled_hsv": [h_val, s_val, v_val],
    }


# ── Public: tracking ──────────────────────────────────────────────────────────

def track_hsv(
    video_path: Path,
    start_frame: int,
    end_frame: int,
    hsv_lower: list[int],
    hsv_upper: list[int],
) -> list[tuple[int, float, float]]:
    """
    Scan frames start_frame..end_frame, detect ball centre each frame.
    Returns [(frame_index, cx_px, cy_px), ...].

    hsv_lower / hsv_upper come from sample_ball_colour() — not hardcoded.

    ── M2 upgrade path ──────────────────────────────────────────────────
    To swap in YOLOv8, replace the body of this function with
    _track_yolo(...) below. Signature stays identical — backend unchanged.
    """
    return _track_hsv(video_path, start_frame, end_frame, hsv_lower, hsv_upper)


# ── Internal ──────────────────────────────────────────────────────────────────

def _track_hsv(
    video_path: Path,
    start_frame: int,
    end_frame: int,
    hsv_lower: list[int],
    hsv_upper: list[int],
) -> list[tuple[int, float, float]]:

    lower  = np.array(hsv_lower, dtype=np.uint8)
    upper  = np.array(hsv_upper, dtype=np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))

    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    detections: list[tuple[int, float, float]] = []

    for frame_idx in range(start_frame, end_frame + 1):
        ret, frame = cap.read()
        if not ret:
            break

        hsv  = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, lower, upper)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(
            mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            continue

        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) < MIN_BLOB_AREA:
            continue

        M = cv2.moments(largest)
        if M["m00"] > 0:
            cx = M["m10"] / M["m00"]
            cy = M["m01"] / M["m00"]
            detections.append((frame_idx, cx, cy))

    cap.release()
    return detections
