from pydantic import BaseModel
from typing import Optional


class UploadResponse(BaseModel):
    video_id: str
    filename: str
    duration_seconds: float
    total_frames: int
    fps: float
    width: int
    height: int
    message: str


class SampleColourRequest(BaseModel):
    video_id: str
    frame_index: int
    click_x: float
    click_y: float


class SampleColourResponse(BaseModel):
    hsv_lower: list[int]
    hsv_upper: list[int]
    sampled_hsv: list[int]


class FrameRange(BaseModel):
    start_frame: int
    end_frame: int


class CalibrationPoints(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    real_world_distance_m: float


class AnalysisRequest(BaseModel):
    video_id: str
    frame_range: FrameRange
    calibration: CalibrationPoints
    hsv_lower: list[int]
    hsv_upper: list[int]
    use_air_resistance: bool = False
    method: str = "hsv"   # "hsv" | "yolo"


class PhysicsResult(BaseModel):
    timestamps: list[float]
    x_positions_m: list[float]
    y_positions_m: list[float]
    velocities_x_ms: list[float]
    velocities_y_ms: list[float]
    accelerations_x_ms2: list[float]
    accelerations_y_ms2: list[float]
    estimated_gravity_ms2: float
    initial_velocity_ms: float
    launch_angle_deg: float
    px_per_metre: float
    drag_coefficient: Optional[float] = None


class AnalysisResponse(BaseModel):
    video_id: str
    status: str
    result: Optional[PhysicsResult] = None
    error: Optional[str] = None
    # tracking
    detections: Optional[list[tuple[int, float, float]]] = None  
    detected_frames: Optional[int] = None
    total_frames: Optional[int] = None
    detection_rate: Optional[float] = None   # 0~100
    has_overlay: bool = False
