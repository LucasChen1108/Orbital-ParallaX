import { AnalysisResponse } from "../types/analysis";

export const MOCK_ANALYSIS: AnalysisResponse = {
  video_id: "mock-001",
  status: "success",
  result: {
    timestamps: [0, 0.033, 0.066, 0.1, 0.133, 0.166, 0.2, 0.233, 0.266, 0.3],
    x_positions_m: [0.0, 0.41, 0.82, 1.23, 1.64, 2.05, 2.46, 2.87, 3.28, 3.69],
    y_positions_m: [0.0, 0.38, 0.68, 0.90, 1.03, 1.08, 1.04, 0.92, 0.71, 0.42],
    velocities_x_ms: [12.3, 12.3, 12.3, 12.3, 12.3, 12.3, 12.3, 12.3, 12.3, 12.3],
    velocities_y_ms: [9.6, 7.3, 5.0, 2.7, 0.4, -1.9, -4.2, -6.5, -8.8, -11.1],
    accelerations_x_ms2: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    accelerations_y_ms2: [-9.74, -9.74, -9.74, -9.74, -9.74, -9.74, -9.74, -9.74, -9.74, -9.74],
    estimated_gravity_ms2: 9.74,
    initial_velocity_ms: 15.8,
    launch_angle_deg: 38.2,
    px_per_metre: 142.5,
    tracker_mode: "yolo",
    predicted_trajectory: {
      x_positions_m: [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0],
      y_positions_m: [0.0, 0.44, 0.79, 1.05, 1.22, 1.29, 1.28, 1.17, 0.98, 0.69, 0.31],
    },
  },
};

export const MOCK_UPLOAD = {
  video_id: "mock-001",
  filename: "shot_071.mp4",
  duration_seconds: 4.6,
  total_frames: 138,
  fps: 30,
  width: 1280,
  height: 720,
  message: "Upload successful",
};

export const MOCK_SAMPLE_COLOUR = {
  hsv_lower: [25, 100, 100],
  hsv_upper: [35, 255, 255],
  sampled_hsv: [30, 180, 210],
};