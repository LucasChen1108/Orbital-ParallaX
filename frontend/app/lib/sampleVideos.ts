import manifest from "./samples-manifest.json";

export interface SampleVideo {
  id: string;
  name: string;
  description: string;
  videoUrl: string;
  method: "hsv" | "yolo";
  frameRange: { start_frame: number; end_frame: number };
  calibration: { mode: "manual"; x1: number; y1: number; x2: number; y2: number; real_world_distance_m: number };
  useAirResistance: boolean;
  intervalHintText: string;
  calibrationHintText: string;
}

interface ManifestEntry {
  id: string;
  name: string;
  description: string;
  filename: string;
  method: "hsv" | "yolo";
  frameRange: { start_frame: number; end_frame: number };
  calibration: { mode: "manual"; x1: number; y1: number; x2: number; y2: number; real_world_distance_m: number };
  useAirResistance: boolean;
  intervalHintText: string;
  calibrationHintText: string;
}

export const SAMPLE_VIDEOS: SampleVideo[] = (manifest as ManifestEntry[]).map(v => ({
  ...v,
  videoUrl: `/samples/${v.filename}`,
}));
