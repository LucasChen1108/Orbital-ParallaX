"use client";
import { useEffect, useRef, useState } from "react";
import {
  AutoCalibrationResponse,
  CalibrationPoints,
} from "../types/analysis";
import { API_ROOT, autoCalibrateBall } from "../lib/api";

const G = "#2563a8";

interface Props {
  videoId: string;
  startFrame: number;
  endFrame: number;
  videoWidth: number;
  videoHeight: number;
  onCalibrated: (data: CalibrationPoints) => void;
  onAdjustInterval: () => void;
}

export default function CalibrationPicker({
  videoId, startFrame, endFrame, videoWidth, videoHeight,
  onCalibrated, onAdjustInterval,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [distance, setDistance] = useState("");
  const [diameterM, setDiameterM] = useState("");
  const [autoResult, setAutoResult] = useState<AutoCalibrationResponse | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "manual") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    points.forEach((p, i) => {
      ctx.fillStyle = G;
      ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), p.x, p.y);
    });

    if (points.length === 2) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2; ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke(); ctx.setLineDash([]);
    }
  }, [points, mode]);

  function selectMode(next: "automatic" | "manual") {
    setMode(next);
    setDone(false);
    setAutoError(null);
  }

  async function handleAutoScan() {
    const diameter = parseFloat(diameterM);
    if (!Number.isFinite(diameter) || diameter <= 0) return;
    setScanning(true);
    setAutoError(null);
    setAutoResult(null);
    try {
      const result = await autoCalibrateBall(
        videoId,
        { start_frame: startFrame, end_frame: endFrame },
        diameter,
      );
      setAutoResult(result);
    } catch (error: unknown) {
      const fallback = "Automatic calibration failed. Try manual calibration or adjust the frame interval.";
      if (
        typeof error === "object" && error !== null &&
        "response" in error
      ) {
        const response = (error as { response?: { data?: { detail?: string } } }).response;
        setAutoError(response?.data?.detail ?? fallback);
      } else {
        setAutoError(fallback);
      }
    } finally {
      setScanning(false);
    }
  }

  function confirmAutomatic(acceptWarning: boolean) {
    if (!autoResult) return;
    onCalibrated({
      mode: "ball_diameter",
      ball_diameter_m: parseFloat(diameterM),
      px_per_metre: autoResult.px_per_metre,
      quality: autoResult.quality,
      variation_cv_pct: autoResult.variation_cv_pct,
      warning: autoResult.warning,
      warning_accepted: acceptWarning,
    });
    setDone(true);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (points.length >= 2 || done) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = videoWidth / canvas.offsetWidth;
    const scaleY = videoHeight / canvas.offsetHeight;
    setPoints(prev => [...prev, {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }]);
  }

  function confirmManual() {
    const metres = parseFloat(distance);
    if (points.length < 2 || !Number.isFinite(metres) || metres <= 0) return;
    onCalibrated({
      mode: "manual",
      x1: points[0].x, y1: points[0].y,
      x2: points[1].x, y2: points[1].y,
      real_world_distance_m: metres,
    });
    setDone(true);
  }

  return (
    <div>
      <p style={{ fontSize:"13px", color:"#6b7280", marginBottom:"18px" }}>
        Choose how ArcLab should convert pixels into real-world distance.
      </p>

      <div className="mode-grid">
        <ModeCard
          selected={mode === "automatic"}
          title="Automatic — Ball diameter"
          description="Enter the known ball diameter. YOLO estimates the scale across the selected frames."
          badge="Recommended"
          onClick={() => selectMode("automatic")}
        />
        <ModeCard
          selected={mode === "manual"}
          title="Manual — Known distance"
          description="Select two points in one frame and enter the real-world distance between them."
          onClick={() => selectMode("manual")}
        />
      </div>

      {mode === "automatic" ? (
        <div>
          <div style={{ padding:"20px", border:"1px solid #dbeafe", borderRadius:"14px", background:"#f8fbff" }}>
            <label style={{ display:"block", fontSize:"13px", fontWeight:600, color:"#25324a", marginBottom:"8px" }}>
              Ball diameter
            </label>
            <div className="diameter-scan-row">
              <div style={{ display:"flex", alignItems:"center", background:"#fff", border:"1px solid #cbd5e1", borderRadius:"9px", overflow:"hidden" }}>
                <input
                  type="number" inputMode="decimal" min="0.001" step="0.001" value={diameterM}
                  onChange={e => { setDiameterM(e.target.value); setAutoResult(null); }}
                  placeholder="e.g. 0.22"
                  style={{ width:"130px", padding:"12px 12px", border:"none", outline:"none", fontSize:"16px" }}
                />
                <span style={{ padding:"10px 12px", color:"#64748b", background:"#f8fafc", fontSize:"13px" }}>m</span>
              </div>
              <button
                onClick={handleAutoScan}
                disabled={scanning || !diameterM}
                className="scan-button"
                style={primaryButtonStyle(scanning || !diameterM)}
              >
                {scanning ? "Detecting ball…" : "Detect ball and calibrate"}
              </button>
            </div>
            <p style={{ fontSize:"11px", color:"#64748b", marginTop:"10px" }}>
              Use the manufacturer&apos;s diameter where possible, and enter the widest diameter of the ball.
            </p>
          </div>

          {autoError && (
            <div style={{ marginTop:"14px", padding:"14px 16px", borderRadius:"10px", background:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c", fontSize:"13px" }}>
              {autoError}
              <button onClick={() => selectMode("manual")} style={linkButtonStyle}>Use manual calibration</button>
            </div>
          )}

          {autoResult && (
            <AutoCalibrationSummary
              result={autoResult}
              onConfirm={() => confirmAutomatic(autoResult.quality !== "good")}
              onManual={() => selectMode("manual")}
              onAdjustInterval={onAdjustInterval}
            />
          )}
        </div>
      ) : (
        <div>
          <p style={{ fontSize:"13px", color:"#6b7280", marginBottom:"14px" }}>
            Tap two points whose real-world distance you know.
          </p>
          <div style={{ position:"relative", width:"100%", borderRadius:"12px", overflow:"hidden", border:"1px solid #e5e7eb" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API_ROOT}/api/v1/video/frame/${videoId}/${startFrame}`}
              alt="calibration frame"
              style={{ display:"block", width:"100%" }}
            />
            <canvas
              ref={canvasRef} width={videoWidth} height={videoHeight}
              onClick={handleCanvasClick}
              style={{
                position:"absolute", inset:0, width:"100%", height:"100%",
                cursor:points.length < 2 ? "crosshair" : "default",
                touchAction: "manipulation",
              }}
            />
          </div>
          <div style={{ marginTop:"18px" }}>
            <label style={{ display:"block", fontSize:"13px", fontWeight:600, color:"#374151", marginBottom:"8px" }}>
              Real-world distance between points
            </label>
            <div style={{ display:"flex", alignItems:"center", width:"180px", background:"#fff", border:"1px solid #cbd5e1", borderRadius:"9px", overflow:"hidden" }}>
              <input
                type="number" inputMode="decimal" min="0.001" step="0.001" value={distance}
                onChange={e => setDistance(e.target.value)}
                placeholder="e.g. 1.0"
                style={{ width:"130px", padding:"12px 12px", border:"none", outline:"none", fontSize:"16px" }}
              />
              <span style={{ marginLeft:"auto", padding:"10px 12px", color:"#64748b", background:"#f8fafc", fontSize:"13px" }}>m</span>
            </div>
            <div style={{ display:"flex", gap:"10px", marginTop:"14px", flexWrap:"wrap" }}>
              <button onClick={confirmManual} disabled={points.length < 2 || !distance || done} style={primaryButtonStyle(points.length < 2 || !distance || done)}>
                {done ? "Calibration set" : "Confirm manual calibration"}
              </button>
              {points.length > 0 && !done && (
                <button onClick={() => setPoints([])} style={secondaryButtonStyle}>Reset points</button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .mode-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 24px;
        }
        .diameter-scan-row {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }
        @media (max-width: 560px) {
          .mode-grid {
            grid-template-columns: 1fr;
          }
          .diameter-scan-row {
            flex-direction: column;
            align-items: stretch;
          }
          .scan-button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function ModeCard({ selected, title, description, badge, onClick }: {
  selected: boolean; title: string; description: string; badge?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      textAlign:"left", padding:"18px", borderRadius:"13px", cursor:"pointer",
      border:`1.5px solid ${selected ? G : "#e2e8f0"}`,
      background:selected ? "#eff6ff" : "#fff",
      boxShadow:selected ? "0 4px 14px rgba(37,99,168,0.08)" : "none",
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", gap:"8px", flexWrap:"wrap", marginBottom:"7px" }}>
        <span style={{ fontSize:"14px", fontWeight:700, color:selected ? G : "#1f2937" }}>{title}</span>
        {badge && <span style={{ fontSize:"10px", padding:"3px 7px", borderRadius:"10px", background:"#dbeafe", color:G, whiteSpace:"nowrap" }}>{badge}</span>}
      </div>
      <span style={{ display:"block", fontSize:"12px", lineHeight:1.5, color:"#64748b" }}>{description}</span>
    </button>
  );
}

function AutoCalibrationSummary({ result, onConfirm, onManual, onAdjustInterval }: {
  result: AutoCalibrationResponse;
  onConfirm: () => void;
  onManual: () => void;
  onAdjustInterval: () => void;
}) {
  const warning = result.quality !== "good";
  const colours = warning
    ? { bg:"#fffbeb", border:"#fde68a", text:"#92400e" }
    : { bg:"#f0fdf4", border:"#bbf7d0", text:"#166534" };
  return (
    <div style={{ marginTop:"16px", padding:"18px", borderRadius:"13px", background:colours.bg, border:`1px solid ${colours.border}` }}>
      <div style={{ fontSize:"14px", fontWeight:700, color:colours.text, marginBottom:"12px" }}>
        {warning ? "Perspective or detection instability detected" : "Automatic calibration ready"}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(110px, 1fr))", gap:"10px", marginBottom:"12px" }}>
        <Stat label="Valid detections" value={`${result.valid_detections}/${result.total_frames}`} />
        <Stat label="Median diameter" value={`${result.median_diameter_px.toFixed(1)} px`} />
        <Stat label="Size variation" value={`${result.variation_cv_pct.toFixed(1)}%`} />
        <Stat label="Scale" value={`${result.px_per_metre.toFixed(1)} px/m`} />
      </div>
      {result.warning && <p style={{ fontSize:"12px", lineHeight:1.6, color:colours.text, marginBottom:"14px" }}>{result.warning} Continuing may reduce measurement accuracy.</p>}
      <div style={{ display:"flex", gap:"9px", flexWrap:"wrap" }}>
        <button onClick={onConfirm} style={primaryButtonStyle(false)}>
          {warning ? "Continue anyway" : "Use this calibration"}
        </button>
        {warning && <button onClick={onManual} style={secondaryButtonStyle}>Use manual calibration</button>}
        {warning && <button onClick={onAdjustInterval} style={secondaryButtonStyle}>Adjust frame interval</button>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding:"10px", borderRadius:"9px", background:"rgba(255,255,255,0.72)" }}>
      <div style={{ fontSize:"10px", color:"#64748b", marginBottom:"4px" }}>{label}</div>
      <div style={{ fontSize:"13px", fontWeight:700, color:"#1e293b", fontFamily:"monospace" }}>{value}</div>
    </div>
  );
}

const primaryButtonStyle = (disabled: boolean): React.CSSProperties => ({
  background:disabled ? "#bfdbfe" : G, color:"#fff", border:"none",
  padding:"12px 18px", borderRadius:"9px", fontSize:"13px", fontWeight:650,
  cursor:disabled ? "not-allowed" : "pointer",
  minHeight:"44px",
});

const secondaryButtonStyle: React.CSSProperties = {
  background:"#fff", color:"#475569", border:"1px solid #cbd5e1",
  padding:"11px 14px", borderRadius:"9px", fontSize:"12px", cursor:"pointer",
  minHeight:"44px",
};

const linkButtonStyle: React.CSSProperties = {
  display:"block", background:"none", border:"none", padding:"8px 0 0",
  color:"#2563a8", fontSize:"12px", fontWeight:600, cursor:"pointer",
};
