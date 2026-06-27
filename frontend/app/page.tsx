"use client";
import { useState } from "react";
import Navbar from "./components/Navbar";
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
import { MOCK_ANALYSIS } from "./lib/mockData";

const STEP_META = [
  { n: 1, label: "Upload",    desc: "Drop your video file to get started." },
  { n: 2, label: "Interval",  desc: "Select the frames that contain the motion." },
  { n: 3, label: "Ball",      desc: "Click the ball so we can track its colour." },
  { n: 4, label: "Calibrate", desc: "Draw a line of known real-world length." },
  { n: 5, label: "Analyse",   desc: "Run the physics engine on your clip." },
  { n: 6, label: "Results",   desc: "Your physics output." },
];

export default function Home() {
  const [step, setStep] = useState(1);
  const [uploadData, setUploadData]     = useState<UploadResponse | null>(null);
  const [startFrame, setStartFrame]     = useState(0);
  const [endFrame, setEndFrame]         = useState(0);
  const [colourData, setColourData]     = useState<SampleColourResponse | null>(null);
  const [calibration, setCalibration]   = useState<CalibrationPoints | null>(null);
  const [result, setResult]             = useState<PhysicsResult | null>(null);
  const [analysing, setAnalysing]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [useAirResistance, setUseAirResistance] = useState(false);
  const [method, setMethod]             = useState<"hsv" | "yolo">("hsv");
  const [analysis, setAnalysis]         = useState<AnalysisResponse | null>(null);

  function loadMockResults() {
    if (MOCK_ANALYSIS.result) {
      setResult(MOCK_ANALYSIS.result);
      setStep(6);
    }
  }

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

  // Back button: for YOLO, step 4 goes back to 2 (no ball-pick step).
  function handleBack() {
    if (step === 4 && method === "yolo") setStep(2);
    else setStep(s => s - 1);
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
        useAirResistance,
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

  const meta = STEP_META[step - 1];

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a12", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <Navbar currentStep={step} />

      <main style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 2rem" }}>

        {/* Step header */}
        <div style={{ marginBottom: "32px" }}>
          <div style={{ fontSize: "11px", color: "#7F77DD", letterSpacing: "0.1em", marginBottom: "6px" }}>
            STEP {meta.n} OF 6
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px" }}>
            {meta.label}
          </h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)" }}>{meta.desc}</p>
        </div>

        {/* Card wrapper */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "16px",
          padding: "32px",
          marginBottom: "24px",
        }}>

          {/* Step 1 — Upload */}
          {step === 1 && (
            <VideoUploader onUploaded={handleUploaded} />
          )}

          {/* Step 2 — Interval + tracking method */}
          {step === 2 && uploadData && (
            <>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                background: "rgba(127,119,221,0.1)", border: "1px solid rgba(127,119,221,0.2)",
                borderRadius: "8px", padding: "6px 12px", marginBottom: "24px",
              }}>
                <span style={{ fontSize: "12px", color: "#AFA9EC" }}>
                  Detected FPS: <strong>{uploadData.fps}</strong>
                  &nbsp;·&nbsp;
                  Total frames: <strong>{uploadData.total_frames}</strong>
                  &nbsp;·&nbsp;
                  Duration: <strong>{uploadData.duration_seconds.toFixed(1)}s</strong>
                </span>
              </div>
              <IntervalSlider
                totalFrames={uploadData.total_frames}
                fps={uploadData.fps}
                startFrame={startFrame}
                endFrame={endFrame}
                onStartChange={setStartFrame}
                onEndChange={setEndFrame}
              />

              {/* Tracking method selection */}
              <div style={{ marginTop: "24px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "10px", color: "rgba(255,255,255,0.7)" }}>
                  Tracking method
                </div>
                <label style={{ display: "block", marginBottom: "8px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="method"
                    checked={method === "hsv"}
                    onChange={() => setMethod("hsv")}
                  />
                  {" "}Colour (HSV) — you click the ball
                </label>
                <label style={{ display: "block", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="method"
                    checked={method === "yolo"}
                    onChange={() => setMethod("yolo")}
                  />
                  {" "}YOLOv8 — automatic, no clicking
                </label>
              </div>

              <div style={{ marginTop: "28px" }}>
                <PrimaryButton onClick={handleConfirmInterval} label="Confirm interval →" />
              </div>
            </>
          )}

          {/* Step 3 — Ball picker (HSV only) */}
          {step === 3 && method === "hsv" && uploadData && (
            <BallPicker
              videoId={uploadData.video_id}
              frameIndex={startFrame}
              videoWidth={uploadData.width}
              videoHeight={uploadData.height}
              onSampled={handleColourSampled}
            />
          )}

          {/* Step 4 — Calibration */}
          {step === 4 && uploadData && (
            <CalibrationPicker
              videoId={uploadData.video_id}
              frameIndex={startFrame}
              videoWidth={uploadData.width}
              videoHeight={uploadData.height}
              onCalibrated={handleCalibrated}
            />
          )}

          {/* Step 5 — Analyse */}
          {step === 5 && (
            <div>
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "12px", padding: "20px", marginBottom: "24px",
              }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "14px", color: "rgba(255,255,255,0.7)" }}>
                  Options
                </div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)", marginBottom: "16px" }}>
                  Tracking method: <strong style={{ color: "#AFA9EC" }}>{method === "yolo" ? "YOLOv8" : "Colour (HSV)"}</strong>
                </div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}>
                  <div style={{ position: "relative", marginTop: "2px" }}>
                    <input
                      type="checkbox"
                      checked={useAirResistance}
                      onChange={e => setUseAirResistance(e.target.checked)}
                      style={{ opacity: 0, position: "absolute", width: 0, height: 0 }}
                    />
                    <div style={{
                      width: "36px", height: "20px", borderRadius: "10px",
                      background: useAirResistance ? "#7F77DD" : "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      position: "relative", transition: "background 0.2s",
                    }}>
                      <div style={{
                        width: "14px", height: "14px", borderRadius: "50%", background: "#fff",
                        position: "absolute", top: "2px",
                        left: useAirResistance ? "18px" : "2px",
                        transition: "left 0.2s",
                      }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500 }}>Consider air resistance</div>
                    <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "3px" }}>
                      Fits a quadratic drag model and returns an estimated drag coefficient alongside gravity.
                    </div>
                  </div>
                </label>
              </div>

              {error && (
                <div style={{
                  background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.3)",
                  borderRadius: "10px", padding: "12px 16px",
                  fontSize: "13px", color: "#FF8080", marginBottom: "20px",
                }}>
                  {error}
                </div>
              )}

              <PrimaryButton
                onClick={handleAnalyse}
                label={analysing ? "Analysing…" : "Run analysis →"}
                disabled={analysing}
              />
            </div>
          )}

          {/* Step 6 — Results */}
          {step === 6 && result && (
            <>
              <ResultsPanel
                result={result}
                analysis={analysis}
                uploadData={uploadData}
                calibration={calibration}
                frameRange={{ start_frame: startFrame, end_frame: endFrame }}
                useAirResistance={useAirResistance}
              />
            </>
          )}

        </div>

        {/* Back link (steps 2–5) */}
        {step > 1 && step < 6 && (
          <button
            onClick={handleBack}
            style={{
              background: "transparent", border: "none", color: "rgba(255,255,255,0.3)",
              fontSize: "13px", cursor: "pointer", padding: 0,
            }}
          >
            ← Back
          </button>
        )}

        {/* New analysis (step 6) */}
        {step === 6 && (
          <button
            onClick={() => {
              setStep(1); setResult(null); setUploadData(null);
              setColourData(null); setCalibration(null);
              setAnalysis(null); setMethod("hsv");
            }}
            style={{
              background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)", fontSize: "13px", cursor: "pointer",
              padding: "8px 16px", borderRadius: "8px",
            }}
          >
            ↺ Start new analysis
          </button>
        )}

        <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={loadMockResults}
            style={{
              background: "transparent", border: "1px dashed rgba(127,119,221,0.3)",
              color: "rgba(127,119,221,0.6)", padding: "8px 16px",
              borderRadius: "8px", fontSize: "12px", cursor: "pointer",
            }}
          >
            ⚡ Skip to mock results (dev only)
          </button>
        </div>
      </main>
    </div>
  );
}

function PrimaryButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? "rgba(127,119,221,0.3)" : "#7F77DD",
        color: "#fff", border: "none", padding: "12px 28px",
        borderRadius: "10px", fontSize: "14px", fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background 0.15s",
      }}
    >
      {label}
    </button>
  );
}
