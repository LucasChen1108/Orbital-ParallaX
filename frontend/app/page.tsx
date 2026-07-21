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

// Colour tokens
const G = "#2563a8";
const GLIGHT = "#eff6ff";
const GBORDER = "#bfdbfe";

export default function Home() {
  const [step, setStep] = useState(1);
  const [uploadData, setUploadData]   = useState<UploadResponse | null>(null);
  const [startFrame, setStartFrame]   = useState(0);
  const [endFrame, setEndFrame]       = useState(0);
  const [colourData, setColourData]   = useState<SampleColourResponse | null>(null);
  const [calibration, setCalibration] = useState<CalibrationPoints | null>(null);
  const [result, setResult]           = useState<PhysicsResult | null>(null);
  const [analysing, setAnalysing]     = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [useAirResistance, setUseAirResistance] = useState(false);
  const [method, setMethod]           = useState<"hsv" | "yolo">("yolo");
  const [analysis, setAnalysis]       = useState<AnalysisResponse | null>(null);

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

  function handleConfirmInterval() {
    if (method === "yolo") { setColourData(null); setStep(4); }
    else setStep(3);
  }

  function handleColourSampled(data: SampleColourResponse) {
    setColourData(data); setStep(4);
  }

  function handleCalibrated(data: CalibrationPoints) {
    setCalibration(data); setStep(5);
  }

  function handleBack() {
    if (step === 4 && method === "yolo") setStep(2);
    else setStep(s => s - 1);
  }

  function resetFlow() {
    setStep(1); setResult(null); setUploadData(null);
    setColourData(null); setCalibration(null);
    setAnalysis(null); setMethod("yolo");
  }

  async function handleAnalyse() {
    if (!uploadData || !calibration) return;
    if (method === "hsv" && !colourData) return;
    setAnalysing(true); setError(null);
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
        setResult(res.result); setAnalysis(res); setStep(6);
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
    <div style={{ minHeight: "100vh", background: "#f8f9fa", color: "#111827", fontFamily: "system-ui, sans-serif" }}>
      <Navbar currentStep={step} onLogoClick={resetFlow} />

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 2rem" }}>

        {/* Step header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "11px", color: G, letterSpacing: "0.1em", fontWeight: 600, marginBottom: "6px" }}>
            STEP {meta.n} OF 6
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px", color: "#111827" }}>
            {meta.label}
          </h1>
          <p style={{ fontSize: "14px", color: "#6b7280" }}>{meta.desc}</p>
        </div>

        {/* Card wrapper */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "16px",
          padding: "32px",
          marginBottom: "20px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}>

          {/* Step 1 */}
          {step === 1 && <VideoUploader onUploaded={handleUploaded} />}

          {/* Step 2 */}
          {step === 2 && uploadData && (
            <>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                background: GLIGHT, border: `1px solid ${GBORDER}`,
                borderRadius: "8px", padding: "6px 14px", marginBottom: "24px",
              }}>
                <span style={{ fontSize: "12px", color: "#15803d", fontWeight: 500 }}>
                  FPS: <strong>{uploadData.fps}</strong>
                  &nbsp;·&nbsp;
                  Frames: <strong>{uploadData.total_frames}</strong>
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
                videoId={uploadData.video_id}
              />

              {/* Tracking method */}
              <div style={{ marginTop: "24px", padding: "20px", background: "#f8f9fa", borderRadius: "12px", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px", color: "#374151" }}>
                  Tracking method
                </div>
                {[
                  { val: "yolo", label: "YOLOv8", desc: "Automatic detection, no clicking required" },
                ].map(opt => (
                  <label key={opt.val} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", cursor: "pointer" }}>
                    <input
                      type="radio" name="method"
                      checked={method === opt.val}
                      onChange={() => setMethod(opt.val as "hsv" | "yolo")}
                      style={{ accentColor: G, width: "16px", height: "16px" }}
                    />
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "#111827" }}>{opt.label}</span>
                      <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "8px" }}>{opt.desc}</span>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ marginTop: "24px" }}>
                <PrimaryButton onClick={handleConfirmInterval} label="Confirm interval →" />
              </div>
            </>
          )}

          {/* Step 3 */}
          {step === 3 && method === "hsv" && uploadData && (
            <BallPicker
              videoId={uploadData.video_id}
              frameIndex={startFrame}
              videoWidth={uploadData.width}
              videoHeight={uploadData.height}
              onSampled={handleColourSampled}
            />
          )}

          {/* Step 4 */}
          {step === 4 && uploadData && (
            <CalibrationPicker
              videoId={uploadData.video_id}
              frameIndex={startFrame}
              videoWidth={uploadData.width}
              videoHeight={uploadData.height}
              onCalibrated={handleCalibrated}
            />
          )}

          {/* Step 5 */}
          {step === 5 && (
            <div>
              <div style={{
                background: "#f8f9fa", border: "1px solid #e5e7eb",
                borderRadius: "12px", padding: "20px", marginBottom: "24px",
              }}>
                <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "14px", color: "#374151" }}>
                  Analysis options
                </div>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
                  Tracking method: <strong style={{ color: G }}>{method === "yolo" ? "YOLOv8" : "Colour (HSV)"}</strong>
                </div>
                <label style={{ display: "flex", alignItems: "flex-start", gap: "12px", cursor: "pointer" }}>
                  <div style={{ position: "relative", marginTop: "2px", flexShrink: 0 }}>
                    <input
                      type="checkbox" checked={useAirResistance}
                      onChange={e => setUseAirResistance(e.target.checked)}
                      style={{ opacity: 0, position: "absolute", width: 0, height: 0 }}
                    />
                    <div style={{
                      width: "36px", height: "20px", borderRadius: "10px",
                      background: useAirResistance ? G : "#d1d5db",
                      position: "relative", transition: "background 0.2s",
                    }}>
                      <div style={{
                        width: "14px", height: "14px", borderRadius: "50%", background: "#fff",
                        position: "absolute", top: "3px",
                        left: useAirResistance ? "19px" : "3px",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "#111827" }}>Consider air resistance</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "3px" }}>
                      Fits a quadratic drag model and returns an estimated drag coefficient alongside gravity.
                    </div>
                  </div>
                </label>
              </div>

              {error && (
                <div style={{
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: "10px", padding: "12px 16px",
                  fontSize: "13px", color: "#dc2626", marginBottom: "20px",
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

          {/* Step 6 */}
          {step === 6 && result && (
            <ResultsPanel
              result={result}
              analysis={analysis}
              uploadData={uploadData}
              calibration={calibration}
              frameRange={{ start_frame: startFrame, end_frame: endFrame }}
              useAirResistance={useAirResistance}
            />
          )}
        </div>

        {/* Back */}
        {step > 1 && step < 6 && (
          <button onClick={handleBack} style={{
            background: "transparent", border: "none", color: "#9ca3af",
            fontSize: "13px", cursor: "pointer", padding: 0,
          }}>
            ← Back
          </button>
        )}

        {/* New analysis */}
        {step === 6 && (
          <button
            onClick={resetFlow}
            style={{
              background: "#fff", border: "1px solid #e5e7eb",
              color: "#6b7280", fontSize: "13px", cursor: "pointer",
              padding: "8px 16px", borderRadius: "8px",
            }}
          >
            ↺ Start new analysis
          </button>
        )}

        {/* Dev mock button — only visible in local development */}
        {process.env.NODE_ENV === "development" && (
          <div style={{ marginTop: "40px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
            <button onClick={loadMockResults} style={{
              background: "transparent", border: `1px dashed ${GBORDER}`,
              color: "#15803d", padding: "8px 16px",
              borderRadius: "8px", fontSize: "12px", cursor: "pointer",
            }}>
              ⚡ Skip to mock results (dev only)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function PrimaryButton({ onClick, label, disabled }: { onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? "#86efac" : G,
      color: "#fff", border: "none", padding: "12px 28px",
      borderRadius: "10px", fontSize: "14px", fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "background 0.15s",
      boxShadow: disabled ? "none" : "0 1px 3px rgba(22,163,74,0.3)",
    }}>
      {label}
    </button>
  );
}