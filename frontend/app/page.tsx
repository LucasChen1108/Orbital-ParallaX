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
} from "./types/analysis";

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
  const [useAirResistance, setUseAirResistance] = useState(false);

  function handleUploaded(data: UploadResponse) {
    setUploadData(data);
    setEndFrame(data.total_frames - 1);
    setStep(2);
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
    if (!uploadData || !colourData || !calibration) return;
    setAnalysing(true);
    setError(null);
    try {
      const res = await analyseVideo(
        uploadData.video_id,
        { start_frame: startFrame, end_frame: endFrame },
        calibration,
        colourData.hsv_lower,
        colourData.hsv_upper,
        useAirResistance,
      );
      if (res.status === "success" && res.result) {
        setResult(res.result);
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

      {/* Step 2 */}
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
          <button onClick={() => setStep(3)}>Confirm Interval →</button>
        </>
      )}

      {/* Step 3 */}
      {step >= 3 && uploadData && (
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

      {/* Step 4 */}
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

      {/* Step 5 — Analyse button */}
      {step >= 5 && (
        <>
          <hr />
          <h2>Step 5 — Run Analysis</h2>      
          <label>
            <input
              type="checkbox"
              checked={useAirResistance}
              onChange={e => setUseAirResistance(e.target.checked)}
            />
            {" "}Consider air resistance
          </label>
          <button onClick={handleAnalyse} disabled={analysing}>
            {analysing ? "Analysing..." : "Analyse Video"}
          </button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </>
      )}

      {/* Step 6 — Results */}
      {step >= 6 && result && (
        <>
          <hr />
          <ResultsPanel result={result} />
        </>
      )}
    </main>
  );
}
