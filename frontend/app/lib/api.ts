import axios from "axios";
import {
  UploadResponse,
  SampleColourResponse,
  AnalysisResponse,
  CalibrationPoints,
  FrameRange,
} from "../types/analysis";

const BASE = "http://localhost:8000/api/v1/video";

export async function uploadVideo(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post<UploadResponse>(`${BASE}/upload`, form);
  return res.data;
}

export async function sampleColour(
  video_id: string,
  frame_index: number,
  click_x: number,
  click_y: number
): Promise<SampleColourResponse> {
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
  hsv_upper: number[]
): Promise<AnalysisResponse> {
  const res = await axios.post<AnalysisResponse>(`${BASE}/analyse`, {
    video_id,
    frame_range,
    calibration,
    hsv_lower,
    hsv_upper,
  });
  return res.data;
}