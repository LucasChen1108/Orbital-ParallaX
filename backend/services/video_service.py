import cv2
import uuid
from pathlib import Path

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def save_video(file_bytes: bytes, filename: str) -> dict:
    video_id = str(uuid.uuid4())
    ext = Path(filename).suffix or ".mp4"
    dest = UPLOAD_DIR / f"{video_id}{ext}"
    dest.write_bytes(file_bytes)

    cap = cv2.VideoCapture(str(dest))
    if not cap.isOpened():
        dest.unlink(missing_ok=True)
        raise ValueError("Could not open video — unsupported format?")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    return {
        "video_id": video_id,
        "filename": filename,
        "duration_seconds": round(total_frames / fps, 2),
        "total_frames": total_frames,
        "fps": fps,
        "width": width,
        "height": height,
        "message": "Video uploaded successfully.",
    }


def get_video_path(video_id: str) -> Path:
    matches = list(UPLOAD_DIR.glob(f"{video_id}.*"))
    if not matches:
        raise FileNotFoundError(f"No video found for id: {video_id}")
    return matches[0]


def get_video_fps(video_path: Path) -> float:
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    cap.release()
    return fps
