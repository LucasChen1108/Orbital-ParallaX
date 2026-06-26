"""
yolo.py
-------
Ball detection using a YOLOv8 model (COCO "sports ball" class).

Exposes track_yolo(); colour sampling and the HSV tracker live in hsv.py.
The method dispatch (hsv vs yolo) lives in tracker/__init__.py.
"""

import cv2
from pathlib import Path

from ultralytics import YOLO

SPORTS_BALL_CLASS = 32          # COCO class id for "sports ball"
# Load the bundled weights next to this file (committed to the repo), so no
# network download is needed on first run. nano model; bump to yolov8s/m if
# balls are missed.
YOLO_WEIGHTS      = str(Path(__file__).parent / "yolov8n.pt")
YOLO_CONF         = 0.1        # confidence floor

# Module-level lazy singleton — model is loaded once and reused.
# NEVER construct YOLO() per frame or per call; that is unusably slow.
_model = None


def _get_model() -> YOLO:
    """Load the YOLOv8 model on first use, then cache it for the process."""
    global _model
    if _model is None:
        _model = YOLO(YOLO_WEIGHTS)
    return _model


def track_yolo(
    video_path: Path,
    start_frame: int,
    end_frame: int,
) -> list[tuple[int, float, float]]:
    """
    Run YOLOv8 over the frame range and return the ball centre per frame.

    Keeps only "sports ball" detections, takes the highest-confidence box,
    and uses the bbox centre. Frames with no detection are skipped — same
    contract as the HSV tracker: [(frame_index, cx_px, cy_px), ...].
    """
    model = _get_model()

    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    detections: list[tuple[int, float, float]] = []

    for frame_idx in range(start_frame, end_frame + 1):
        ret, frame = cap.read()
        if not ret:
            break

        results = model(
            frame,
            classes=[SPORTS_BALL_CLASS],
            conf=YOLO_CONF,
            verbose=False,
        )

        boxes = results[0].boxes
        if boxes is None or len(boxes) == 0:
            continue

        best_idx = int(boxes.conf.argmax())   # most confident ball
        x1, y1, x2, y2 = boxes[best_idx].xyxy[0].tolist()

        cx = (x1 + x2) / 2.0
        cy = (y1 + y2) / 2.0
        detections.append((frame_idx, cx, cy))

    cap.release()
    return detections