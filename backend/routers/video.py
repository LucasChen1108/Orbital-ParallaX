import sys
from pathlib import Path

import cv2
from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from fastapi.responses import FileResponse

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from models.schemas import (
    UploadResponse,
    SampleColourRequest, SampleColourResponse,
    AnalysisRequest, AnalysisResponse, PhysicsResult,
)
from services.video_service import (
    save_video, get_video_path, get_video_fps,
    render_overlay, overlay_path_for,
)
from physics_engine import (
    sample_ball_colour, track_ball,
    compute_px_per_metre, compute_physics,
    compute_physics_with_drag,
)

router = APIRouter()

ALLOWED_TYPES = {"video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"}
MAX_SIZE_MB = 200


@router.post("/upload", response_model=UploadResponse)
async def upload_video(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, f"Unsupported type: {file.content_type}.")
    contents = await file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_SIZE_MB}MB.")
    try:
        return UploadResponse(**save_video(contents, file.filename))
    except ValueError as e:
        raise HTTPException(422, str(e))


@router.post("/sample-colour", response_model=SampleColourResponse)
def sample_colour(req: SampleColourRequest):
    try:
        path = get_video_path(req.video_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))
    try:
        result = sample_ball_colour(path, req.frame_index, req.click_x, req.click_y)
    except ValueError as e:
        raise HTTPException(422, str(e))
    return SampleColourResponse(**result)


@router.post("/analyse", response_model=AnalysisResponse)
def analyse_video(req: AnalysisRequest):
    try:
        path = get_video_path(req.video_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

    try:
        c = req.calibration
        px_per_metre = compute_px_per_metre(
            c.x1, c.y1, c.x2, c.y2, c.real_world_distance_m
        )
    except ValueError as e:
        raise HTTPException(422, f"Calibration error: {e}")

    detections = track_ball(
        path,
        req.frame_range.start_frame,
        req.frame_range.end_frame,
        hsv_lower=req.hsv_lower,
        hsv_upper=req.hsv_upper,
        method=req.method,
    )

    if len(detections) < 5:
        return AnalysisResponse(
            video_id=req.video_id,
            status="failed",
            error=(
                f"Ball detected in only {len(detections)} frames (need ≥5). "
                "Try re-clicking the ball or widening the frame range."
            ),
        )

    fps = get_video_fps(path)
    try:
        if req.use_air_resistance:
            data = compute_physics_with_drag(detections, fps, px_per_metre)
        else:
            data = compute_physics(detections, fps, px_per_metre)
    except ValueError as e:
        return AnalysisResponse(video_id=req.video_id, status="failed", error=str(e))

    total = req.frame_range.end_frame - req.frame_range.start_frame + 1
    det_rate = round(100.0 * len(detections) / total, 1) if total else 0.0

    # generating overlay
    has_overlay = False
    try:
        render_overlay(path, req.frame_range.start_frame,
                       req.frame_range.end_frame, detections,
                       overlay_path_for(req.video_id))
        has_overlay = True
    except Exception:
        pass

    return AnalysisResponse(
        video_id=req.video_id,
        status="success",
        result=PhysicsResult(**data, tracker_mode=req.method),
        detections=detections,
        detected_frames=len(detections),
        total_frames=total,
        detection_rate=det_rate,
        has_overlay=has_overlay,
    )


@router.get("/frame/{video_id}/{frame_index}")
def get_frame(video_id: str, frame_index: int):
    """
    Extract a single frame from the video and return it as a JPEG.
    Used by BallPicker and CalibrationPicker canvas components.
    """
    try:
        path = get_video_path(video_id)
    except FileNotFoundError:
        raise HTTPException(404, "Video not found.")

    cap = cv2.VideoCapture(str(path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        raise HTTPException(422, f"Could not read frame {frame_index}.")

    _, buffer = cv2.imencode(".jpg", frame)
    return Response(
        content=buffer.tobytes(),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )

@router.get("/video/{video_id}")
def get_video(video_id: str):
    try:
        path = get_video_path(video_id)
    except FileNotFoundError:
        raise HTTPException(404, "Video not found.")
    return FileResponse(str(path), media_type="video/mp4")

@router.get("/status/{video_id}")
def video_status(video_id: str):
    try:
        get_video_path(video_id)
        return {"video_id": video_id, "exists": True}
    except FileNotFoundError:
        raise HTTPException(404, "Video not found.")


@router.get("/overlay/{video_id}")
def get_overlay(video_id: str):
    p = overlay_path_for(video_id)
    if not p.exists():
        raise HTTPException(404, "No overlay for this video.")
    return FileResponse(str(p), media_type="video/mp4")
