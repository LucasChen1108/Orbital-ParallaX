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

def render_overlay(video_path, start_frame, end_frame, detections, out_path):
    """Draw the tracked point on each frame and write an annotated video."""
    by_frame = {f: (cx, cy) for (f, cx, cy) in detections}

    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # NOTE: mp4v is not browser-playable. 
    # need to transcode to H.264 so the <video> tag can play it.
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, fps, (w, h))

    for frame_idx in range(start_frame, end_frame + 1):
        ret, frame = cap.read()
        if not ret:
            break
        pt = by_frame.get(frame_idx)
        if pt is not None:
            cx, cy = int(pt[0]), int(pt[1])
            cv2.circle(frame, (cx, cy), 8, (0, 255, 0), 2)
            cv2.drawMarker(frame, (cx, cy), (0, 255, 0), cv2.MARKER_CROSS, 16, 1)
        writer.write(frame)

    cap.release()
    writer.release()

    import imageio_ffmpeg, subprocess, os
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    h264_path = str(out_path).replace(".mp4", "_h264.mp4")
    subprocess.run([ffmpeg, "-y", "-i", str(out_path),
                    "-vcodec", "libx264", "-pix_fmt", "yuv420p", h264_path],
                   check=True)
    os.replace(h264_path, out_path)   # 用 H.264 版覆盖


def overlay_path_for(video_id: str):
    return UPLOAD_DIR / f"{video_id}_overlay.mp4"