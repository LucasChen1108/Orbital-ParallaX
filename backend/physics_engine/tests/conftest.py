import cv2
import numpy as np
import pytest


@pytest.fixture
def synthetic_ball_video(tmp_path):
    """Generate a short clip of a green ball moving in a parabola.

    Lets tracker tests run without depending on uploaded files or a real
    YOLO model. The ball colour is chosen to be easy to HSV-threshold.
    """
    path = tmp_path / "ball.mp4"
    w, h, fps, n = 320, 240, 30, 20
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for i in range(n):
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        x = 20 + i * 14
        y = max(15, min(h - 15, 200 - int(10 * i - 0.5 * i * i)))
        cv2.circle(frame, (x, y), 12, (0, 255, 0), -1)  # green ball (BGR)
        writer.write(frame)
    writer.release()
    return path
