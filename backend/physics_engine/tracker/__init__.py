from pathlib import Path

from .hsv  import sample_ball_colour, track_hsv
from .yolo import track_yolo


def track_ball(
    video_path: Path,
    start_frame: int,
    end_frame: int,
    hsv_lower: list[int] | None = None,
    hsv_upper: list[int] | None = None,
    method: str = "hsv",
) -> list[tuple[int, float, float]]:
    """
    Dispatch ball tracking by method.

      "hsv"  → colour thresholding (needs hsv_lower / hsv_upper)
      "yolo" → YOLOv8 sports-ball detection (ignores hsv_*)

    Returns [(frame_index, cx_px, cy_px), ...].
    """
    if method == "yolo":
        return track_yolo(video_path, start_frame, end_frame)

    if hsv_lower is None or hsv_upper is None:
        raise ValueError("hsv_lower / hsv_upper are required for method='hsv'.")
    return track_hsv(video_path, start_frame, end_frame, hsv_lower, hsv_upper)


__all__ = ["sample_ball_colour", "track_ball", "track_hsv", "track_yolo"]