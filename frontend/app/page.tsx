"use client";
import { useState } from "react";
import VideoUploader from "./components/VideoUploader";
import IntervalSlider from "./components/IntervalSlider";
import BallPicker from "./components/BallPicker";
import CalibrationPicker from "./components/CalibrationPicker";
import ResultsPanel from "./components/ResultsPanel";
import { analyseVideo } from "./lib/api";
import {
  UploadResponse,
  SampleColourResponse,
  CalibrationPoints,
  PhysicsResult,
  AnalysisResponse,
} from "./types/analysis";
import TrajectoryPlot from "./components/TrajectoryPlot";

export default function Home() {
  const [step, setStep] = useState(1);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [startFrame, setStartFrame] = useState(0);
  const [endFrame, setEndFrame] = useState(0);
  const [colourData, setColourData] = useState<SampleColourResponse | null>(null);
  const [calibration, setCalibration] = useState<CalibrationPoints | null>(null);
  const [result, setResult] = useState<PhysicsResult | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<"hsv" | "yolo">("hsv");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);

  function handleUploaded(data: UploadResponse) {
    setUploadData(data);
    setEndFrame(data.total_frames - 1);
    setStep(2);
  }

  // After the interval is confirmed, branch by method:
  //   hsv  → Step 3 (pick ball colour) → Step 4 (calibration)
  //   yolo → skip Step 3, jump straight to Step 4 (calibration)
  function handleConfirmInterval() {
    if (method === "yolo") {
      setColourData(null);   // no colour needed for YOLO
      setStep(4);
    } else {
      setStep(3);
    }
  }

  function handleColourSampled(data: SampleColourResponse) {
    setColourData(data);
    setStep(4);
  }

  function handleCalibrated(data: CalibrationPoints) {
    setCalibration(data);
    setStep(5);
  }

  async function handleAnalyse() {
    if (!uploadData || !calibration) return;
    // HSV needs sampled colour; YOLO does not.
    if (method === "hsv" && !colourData) return;

    setAnalysing(true);
    setError(null);
    try {
      const res = await analyseVideo(
        uploadData.video_id,
        { start_frame: startFrame, end_frame: endFrame },
        calibration,
        colourData?.hsv_lower ?? [],
        colourData?.hsv_upper ?? [],
        false,
        method,
      );
      if (res.status === "success" && res.result) {
        setResult(res.result);
        setAnalysis(res);
        setStep(6);
      } else {
        setError(res.error ?? "Analysis failed.");
      }
    } catch {
      setError("Could not reach backend.");
    } finally {
      setAnalysing(false);
    }
  }

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <h1>ParallaX — Projectile Motion Analyser</h1>
      <p>Current step: {step} / 5</p>
      <hr />

      {/* Step 1 */}
      <VideoUploader onUploaded={handleUploaded} />

      {/* Step 2 — interval + tracking method */}
      {step >= 2 && uploadData && (
        <>
          <hr />
          <IntervalSlider
            totalFrames={uploadData.total_frames}
            fps={uploadData.fps}
            startFrame={startFrame}
            endFrame={endFrame}
            onStartChange={setStartFrame}
            onEndChange={setEndFrame}
          />

          <div style={{ margin: "12px 0" }}>
            <p>Tracking method:</p>
            <label>
              <input
                type="radio"
                name="method"
                checked={method === "hsv"}
                onChange={() => setMethod("hsv")}
                disabled={step > 2}
              />
              {" "}Colour (HSV) — you click the ball
            </label>
            {"  "}
            <label>
              <input
                type="radio"
                name="method"
                checked={method === "yolo"}
                onChange={() => setMethod("yolo")}
                disabled={step > 2}
              />
              {" "}YOLOv8 — automatic, no clicking
            </label>
          </div>

          <button onClick={handleConfirmInterval} disabled={step > 2}>
            Confirm Interval →
          </button>
        </>
      )}

      {/* Step 3 — only for HSV */}
      {step >= 3 && method === "hsv" && uploadData && (
        <>
          <hr />
          <BallPicker
            videoId={uploadData.video_id}
            frameIndex={startFrame}
            videoWidth={uploadData.width}
            videoHeight={uploadData.height}
            onSampled={handleColourSampled}
          />
        </>
      )}

      {/* Step 4 — calibration */}
      {step >= 4 && uploadData && (
        <>
          <hr />
          <CalibrationPicker
            videoId={uploadData.video_id}
            frameIndex={startFrame}
            videoWidth={uploadData.width}
            videoHeight={uploadData.height}
            onCalibrated={handleCalibrated}
          />
        </>
      )}

      {/* Step 5 — Analyse */}
      {step >= 5 && (
        <>
          <hr />
          <h2>Step 5 — Run Analysis</h2>
          <p>Method: {method === "yolo" ? "YOLOv8" : "Colour (HSV)"}</p>

          <button onClick={handleAnalyse} disabled={analysing}>
            {analysing ? "Analysing..." : "Analyse Video"}
          </button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </>
      )}

      {step >= 6 && analysis && (
        <>
          <hr />
          {step >= 6 && result && <><hr /><ResultsPanel result={result} /></>}
          <h3>Tracking result</h3>
          <p>
            Detected {analysis.detected_frames}/{analysis.total_frames} frames
            ({analysis.detection_rate}%) — {method === "yolo" ? "YOLOv8" : "HSV"}
          </p>

          {/* option 2: video */}
          {analysis.has_overlay && (
            <video
              src={`http://localhost:8000/api/v1/video/overlay/${analysis.video_id}`}
              controls
              style={{ maxWidth: "100%" }}
            />
          )}

          {/* option 3: scatter plot */}
          {analysis.detections && (
            <TrajectoryPlot
              detections={analysis.detections}
              width={uploadData!.width}
              height={uploadData!.height}
            />
          )}
        </>
      )}
    </main>
  );
}