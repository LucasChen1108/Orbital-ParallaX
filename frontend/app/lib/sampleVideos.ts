export interface SampleVideo {
  id: string;
  name: string;
  description: string;
  videoUrl: string;
  method: "hsv" | "yolo";
  frameRange: { start_frame: number; end_frame: number };
  calibration: { x1: number; y1: number; x2: number; y2: number; real_world_distance_m: number };
  useAirResistance: boolean;
}

// To add a video: run it through the normal upload flow once locally,
// note the interval you picked and the calibration points + distance you
// entered, then add an entry here. No backend changes needed.
export const SAMPLE_VIDEOS: SampleVideo[] = [
  {
    id: "basketball-throw",
    name: "Basketball free throw",
    description: "Indoor, good lighting — a clean example to start with.",
    videoUrl: "/samples/basketball-throw.mp4",
    method: "yolo",
    frameRange: { start_frame: 0, end_frame: 60 },       // ← replace with your real values
    calibration: { x1: 100, y1: 400, x2: 100, y2: 200, real_world_distance_m: 1.0 }, // ← replace with your real values
    useAirResistance: false,
  },
];
