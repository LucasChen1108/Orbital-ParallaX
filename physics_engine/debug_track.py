"""
debug_track.py
--------------
Sanity-check the ball tracker by drawing detections back onto the video.

It runs HSV and/or YOLO over a frame range, overlays the detected centre
on each frame (annotated .mp4), plots the trajectory (.png), and prints a
detection-rate summary so you can eyeball whether the marker tracks the ball.

Run from the project root with the venv active.
"""

import argparse
from pathlib import Path

import cv2
import matplotlib
matplotlib.use("Agg")            # no display needed; write PNG to disk
import matplotlib.pyplot as plt

from physics_engine.tracker import sample_ball_colour, track_hsv, track_yolo


COLOURS = {            # BGR for OpenCV overlay
    "hsv":  (0, 0, 255),     # red
    "yolo": (0, 255, 0),     # green
}


def _run_tracker(method, video_path, start, end, hsv_lower, hsv_upper):
    if method == "yolo":
        return track_yolo(video_path, start, end)
    return track_hsv(video_path, start, end, hsv_lower, hsv_upper)


def _detection_rate(detections, start, end):
    total = end - start + 1
    got = len(detections)
    return got, total, (100.0 * got / total if total else 0.0)


def _pick_point(video_path, frame_index):
    """Open the start frame in a window; user clicks the ball.

    Returns (x, y) in pixel coordinates. Click the ball, then press any
    key to confirm; press Esc to abort.
    """
    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        raise SystemExit(f"Could not read frame {frame_index} for picking.")

    clicked = {}

    def on_mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            clicked["pt"] = (x, y)

    win = "Click the ball, then press any key (Esc to cancel)"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(win, on_mouse)
    while True:
        disp = frame.copy()
        if "pt" in clicked:
            cv2.circle(disp, clicked["pt"], 8, (0, 0, 255), 2)
        cv2.imshow(win, disp)
        key = cv2.waitKey(20) & 0xFF
        if key == 27:                       # Esc → cancel
            cv2.destroyAllWindows()
            raise SystemExit("Picking cancelled.")
        if key != 255 and "pt" in clicked:  # any key after a click → confirm
            break
    cv2.destroyAllWindows()
    return clicked["pt"]


def _write_overlay(video_path, start, end, results, out_path):
    """results: {method: {frame_idx: (cx, cy)}}"""
    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, fps, (w, h))

    for frame_idx in range(start, end + 1):
        ret, frame = cap.read()
        if not ret:
            break

        y = 30
        for method, by_frame in results.items():
            colour = COLOURS[method]
            pt = by_frame.get(frame_idx)
            if pt is not None:
                cx, cy = int(pt[0]), int(pt[1])
                cv2.circle(frame, (cx, cy), 8, colour, 2)
                cv2.drawMarker(frame, (cx, cy), colour,
                               cv2.MARKER_CROSS, 16, 1)
            label = f"{method}: {'hit' if pt else 'MISS'}"
            cv2.putText(frame, label, (10, y),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, colour, 2)
            y += 28

        writer.write(frame)

    cap.release()
    writer.release()


def _plot_trajectories(results, out_path):
    plt.figure(figsize=(8, 5))
    for method, by_frame in results.items():
        if not by_frame:
            continue
        xs = [p[0] for p in by_frame.values()]
        ys = [p[1] for p in by_frame.values()]
        plt.scatter(xs, ys, s=12, label=method, color=(
            "red" if method == "hsv" else "green"))
    plt.gca().invert_yaxis()      # image y grows downward
    plt.xlabel("x (px)")
    plt.ylabel("y (px)")
    plt.title("Tracked trajectory")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path, dpi=120)
    plt.close()


def main():
    ap = argparse.ArgumentParser(description="Visualise ball tracking output.")
    ap.add_argument("video", type=Path, help="Path to the video file.")
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--end", type=int, default=120)
    ap.add_argument("--method", choices=["hsv", "yolo", "both"], default="yolo")
    ap.add_argument("--click", type=int, nargs=2, metavar=("X", "Y"),
                    help="Ball pixel location on the start frame (HSV only).")
    ap.add_argument("--outdir", type=Path, default=Path("debug_out"))
    args = ap.parse_args()

    args.outdir.mkdir(exist_ok=True)

    methods = ["hsv", "yolo"] if args.method == "both" else [args.method]

    # HSV needs a colour range sampled from a click point.
    # If --click is given, use it; otherwise open a window to click the ball.
    hsv_lower = hsv_upper = None
    if "hsv" in methods:
        if args.click:
            cx, cy = float(args.click[0]), float(args.click[1])
        else:
            px, py = _pick_point(args.video, args.start)
            cx, cy = float(px), float(py)
            print(f"Picked point: ({px}, {py})")
        sampled = sample_ball_colour(args.video, args.start, cx, cy)
        hsv_lower, hsv_upper = sampled["hsv_lower"], sampled["hsv_upper"]
        print(f"Sampled HSV range: lower={hsv_lower} upper={hsv_upper}")

    results = {}
    for m in methods:
        dets = _run_tracker(m, args.video, args.start, args.end,
                            hsv_lower, hsv_upper)
        results[m] = {f: (cx, cy) for (f, cx, cy) in dets}
        got, total, pct = _detection_rate(dets, args.start, args.end)
        print(f"[{m}] detected {got}/{total} frames ({pct:.1f}%)")

    overlay_path = args.outdir / "overlay.mp4"
    plot_path = args.outdir / "trajectory.png"
    _write_overlay(args.video, args.start, args.end, results, overlay_path)
    _plot_trajectories(results, plot_path)

    print(f"\nAnnotated video → {overlay_path}")
    print(f"Trajectory plot → {plot_path}")
    print("Open the video and check the marker sits on the ball every frame.")


if __name__ == "__main__":
    main()
