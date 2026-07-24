from pydantic import BaseModel, Field
from typing import Literal, Optional


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
    mode: Literal["manual", "ball_diameter"] = "manual"
    x1: Optional[float] = None
    y1: Optional[float] = None
    x2: Optional[float] = None
    y2: Optional[float] = None
    real_world_distance_m: Optional[float] = None
    ball_diameter_m: Optional[float] = None
    px_per_metre: Optional[float] = None
    quality: Optional[Literal["good", "moderate", "unreliable"]] = None
    variation_cv_pct: Optional[float] = None
    warning: Optional[str] = None
    warning_accepted: bool = False


class AutoCalibrationRequest(BaseModel):
    video_id: str
    frame_range: FrameRange
    ball_diameter_m: float = Field(..., gt=0, le=10)


class AutoCalibrationResponse(BaseModel):
    px_per_metre: float
    median_diameter_px: float
    mean_diameter_px: float
    diameter_std_px: float
    variation_cv_pct: float
    quality: Literal["good", "moderate", "unreliable"]
    warning: Optional[str] = None
    valid_detections: int
    raw_detections: int
    total_frames: int


class AnalysisRequest(BaseModel):
    video_id: str
    frame_range: FrameRange
    calibration: CalibrationPoints
    hsv_lower: list[int]
    hsv_upper: list[int]
    use_air_resistance: bool = False
    method: str = "hsv"   # "hsv" | "yolo"


class PredictedTrajectory(BaseModel):
    x_positions_m: list[float]
    y_positions_m: list[float]


class ConfidenceInterval(BaseModel):
    lower: float
    upper: float


class FitQuality(BaseModel):
    converged: bool
    message: str
    rmse_m: float
    r_squared: float
    cost: float
    optimality: float
    function_evaluations: int
    bootstrap_samples: int
    successful_bootstraps: int


class SandboxRequest(BaseModel):
    v0: float = Field(..., ge=0, le=100, description="Initial speed, m/s")
    angle_deg: float = Field(..., ge=-180, le=180)
    g: float = Field(..., gt=0, le=50)
    drag_coeff: float = Field(0.0, ge=0, le=1)
    x0: float = 0.0
    y0: float = 0.0
    y_end: Optional[float] = None


class SandboxResponse(BaseModel):
    timestamps: list[float]
    x_positions_m: list[float]
    y_positions_m: list[float]


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
    tracker_mode: Optional[str] = None
    predicted_trajectory: Optional[PredictedTrajectory] = None
    confidence_intervals: Optional[dict[str, ConfidenceInterval]] = None
    fit_quality: Optional[FitQuality] = None


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
