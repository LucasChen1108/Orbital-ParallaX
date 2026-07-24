export interface UploadResponse {
  video_id: string;
  filename: string;
  duration_seconds: number;
  total_frames: number;
  fps: number;
  width: number;
  height: number;
  message: string;
}
export interface SampleColourResponse {
  hsv_lower: number[];
  hsv_upper: number[];
  sampled_hsv: number[];
}
export interface FrameRange {
  start_frame: number;
  end_frame: number;
}
export interface CalibrationPoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  real_world_distance_m: number;
}
export interface PhysicsResult {
  timestamps: number[];
  x_positions_m: number[];
  y_positions_m: number[];
  velocities_x_ms: number[];
  velocities_y_ms: number[];
  accelerations_x_ms2: number[];
  accelerations_y_ms2: number[];
  estimated_gravity_ms2: number;
  initial_velocity_ms: number;
  launch_angle_deg: number;
  px_per_metre: number;
  drag_coefficient?: number;
  tracker_mode?: "hsv" | "yolo";
  predicted_trajectory?: {
    x_positions_m: number[];
    y_positions_m: number[];
  };
  confidence_intervals?: Record<string, {
    lower: number;
    upper: number;
  }>;
  fit_quality?: {
    converged: boolean;
    message: string;
    rmse_m: number;
    r_squared: number;
    cost: number;
    optimality: number;
    function_evaluations: number;
    bootstrap_samples: number;
    successful_bootstraps: number;
  };
}
export interface AnalysisRequest {
  video_id: string;
  frame_range: FrameRange;
  calibration: CalibrationPoints;
  use_air_resistance?: boolean;
}
export interface AnalysisResponse {
  video_id: string;
  status: string;
  result?: PhysicsResult;
  error?: string;
  detections?: [number, number, number][];   // [frame, cx, cy]
  detected_frames?: number;
  total_frames?: number;
  detection_rate?: number;
  has_overlay?: boolean;
}
