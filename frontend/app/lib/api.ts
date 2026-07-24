import axios from "axios";
import {
  UploadResponse,
  SampleColourResponse,
  AnalysisResponse,
  CalibrationPoints,
  FrameRange,
  AutoCalibrationResponse,
} from "../types/analysis";
import { MOCK_UPLOAD, MOCK_SAMPLE_COLOUR, MOCK_ANALYSIS } from "./mockData";

const USE_MOCK = false; // Set to true to use mock data instead of making API calls
export const API_ROOT = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE = `${API_ROOT}/api/v1/video`;

export async function uploadVideo(file: File): Promise<UploadResponse> {
  if (USE_MOCK) return MOCK_UPLOAD;
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function sampleColour(
  video_id: string,
  frame_index: number,
  click_x: number,
  click_y: number
): Promise<SampleColourResponse> {
  if (USE_MOCK) return MOCK_SAMPLE_COLOUR;
  const res = await axios.post<SampleColourResponse>(`${BASE}/sample-colour`, {
    video_id,
    frame_index,
    click_x,
    click_y,
  });
  return res.data;
}

export async function analyseVideo(
  video_id: string,
  frame_range: FrameRange,
  calibration: CalibrationPoints,
  hsv_lower: number[],
  hsv_upper: number[],
  use_air_resistance: boolean = false,
  method: "hsv" | "yolo" = "hsv"
): Promise<AnalysisResponse> {
  if (USE_MOCK) return MOCK_ANALYSIS;
  const res = await axios.post<AnalysisResponse>(`${BASE}/analyse`, {
    video_id,
    frame_range,
    calibration,
    hsv_lower,
    hsv_upper,
    use_air_resistance,
    method,
  });
  return res.data;
}

export async function autoCalibrateBall(
  video_id: string,
  frame_range: FrameRange,
  ball_diameter_m: number
): Promise<AutoCalibrationResponse> {
  const res = await axios.post<AutoCalibrationResponse>(`${BASE}/auto-calibrate`, {
    video_id,
    frame_range,
    ball_diameter_m,
  });
  return res.data;
}
