import os
import cv2
import uuid
from pathlib import Path

# Restrict OpenCV's ffmpeg backend to local-file protocols. On some ffmpeg
# builds, cv2.VideoCapture() otherwise treats local files as network streams
# and tries RTSP/HTTP first, causing ~50s stream-timeout hangs that make
# render_overlay() fail (has_overlay=false). This option is read when a video
# is opened, so setting it here covers every VideoCapture call in this module.
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "protocol_whitelist;file,crypto,data"

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


def render_overlay(video_path, start_frame, end_frame, detections, out_path,
                   timestamps=None, xs=None, ys=None, vxs=None, vys=None):
    # Build per-frame stats lookup
    stats_by_frame = {}
    if timestamps and xs and ys and vxs and vys:
        for i, (t, x, y, vx, vy) in enumerate(zip(timestamps, xs, ys, vxs, vys)):
            # Map result index back to absolute frame number
            abs_frame = start_frame + i
            v = (vx**2 + vy**2) ** 0.5
            stats_by_frame[abs_frame] = {
                "t": t, "x": x, "y": y, "vx": vx, "vy": vy, "v": v
            }

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
        # Draw FULL trajectory arc on every frame
        past_points = []
        for fi in range(start_frame, end_frame + 1):
            if fi in by_frame:
                px, py = int(by_frame[fi][0]), int(by_frame[fi][1])
                past_points.append((px, py))

        # Draw the arc line
        if len(past_points) >= 2:
            for i in range(1, len(past_points)):
                cv2.line(frame, past_points[i-1], past_points[i],
                         (127, 119, 221), 6)  # purple line, 6px thick

        # Draw current ball position
        pt = by_frame.get(frame_idx)
        if pt is not None:
            cx, cy = int(pt[0]), int(pt[1])
            cv2.circle(frame, (cx, cy), 35, (255, 215, 0), 4)
            cv2.circle(frame, (cx, cy), 18, (255, 215, 0), -1)

        # ── Stats box (top-left corner) ──────────────────────────
        # Find closest detection to current frame for stats
        closest_frame = min(by_frame.keys(), key=lambda f: abs(f - frame_idx)) if by_frame else None
        if closest_frame is not None and closest_frame in stats_by_frame:
            s = stats_by_frame[closest_frame]
            lines = [
                "ArcLab",
                f"Frame:  {frame_idx}",
                f"t:      {s['t']:.3f} s",
                f"x:      {s['x']:.3f} m",
                f"y:      {s['y']:.3f} m",
                f"vx:     {s['vx']:.2f} m/s",
                f"vy:     {s['vy']:.2f} m/s",
                f"|v|:    {s['v']:.2f} m/s",
            ]
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 2.0
            thickness = 4
            pad = 40
            line_h = 80

            # Auto-size box width to fit longest line
            max_w = 0
            for line in lines:
                (tw, _), _ = cv2.getTextSize(line, font, font_scale, thickness)
                max_w = max(max_w, tw)
            box_w = max_w + pad * 2
            box_h = pad * 2 + line_h * len(lines)
            bx, by2 = 40, 40

            # Fully opaque dark background
            cv2.rectangle(frame, (bx, by2), (bx + box_w, by2 + box_h),
                          (35, 12, 15), -1)

            # Purple accent bar on left edge
            cv2.rectangle(frame, (bx, by2), (bx + 10, by2 + box_h),
                          (225, 100, 180), -1)

            # Thin border
            cv2.rectangle(frame, (bx, by2), (bx + box_w, by2 + box_h),
                          (255, 100, 180), 3)

            # Text lines
            for i, line in enumerate(lines):
                ty = by2 + pad + i * line_h + line_h // 2
                if i == 0:
                    # Title — purple tint, slightly bigger
                    cv2.putText(frame, line, (bx + pad + 16, ty), font,
                                font_scale * 1.1, (255, 130, 200), thickness + 1)
                else:
                    # Split label and value for two-colour rendering
                    if ":" in line:
                        label, value = line.split(":", 1)
                        label += ":"
                        (lw, _), _ = cv2.getTextSize(label, font, font_scale, thickness)
                        cv2.putText(frame, label, (bx + pad + 16, ty), font,
                                    font_scale, (255, 130, 200), thickness)
                        cv2.putText(frame, value, (bx + pad + 16 + lw + 10, ty), font,
                                    font_scale, (240, 240, 240), thickness)
                    else:
                        cv2.putText(frame, line, (bx + pad + 16, ty), font,
                                    font_scale, (240, 240, 240), thickness)
        writer.write(frame)

    cap.release()
    writer.release()

    import imageio_ffmpeg
    import subprocess
    import os
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    h264_path = str(out_path).replace(".mp4", "_h264.mp4")
    subprocess.run([ffmpeg, "-y", "-i", str(out_path),
                    "-vcodec", "libx264", "-pix_fmt", "yuv420p", h264_path],
                   check=True)
    os.replace(h264_path, out_path)   # 用 H.264 版覆盖


def overlay_path_for(video_id: str):
    return UPLOAD_DIR / f"{video_id}_overlay.mp4"
