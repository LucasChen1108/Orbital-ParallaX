"use client";
import { useRef, useEffect, useState } from "react";
import { PhysicsResult } from "../types/analysis";

interface Props {
  result: PhysicsResult;
}

export default function ResultsPanel({ result }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showGhost, setShowGhost] = useState(true);
  const [showStrobe, setShowStrobe] = useState(false);

  const W = 600, H = 300;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const xs = result.x_positions_m;
    const ys = result.y_positions_m;
    if (!xs.length) return;

    // Compute bounds
    const allX = [...xs, ...(showGhost && result.predicted_trajectory ? result.predicted_trajectory.x_positions_m : [])];
    const allY = [...ys, ...(showGhost && result.predicted_trajectory ? result.predicted_trajectory.y_positions_m : [])];
    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minY = Math.min(...allY), maxY = Math.max(...allY);
    const pad = 40;

    function toCanvas(x: number, y: number): [number, number] {
      const cx = pad + ((x - minX) / (maxX - minX || 1)) * (W - pad * 2);
      // flip Y (canvas y grows downward)
      const cy = H - pad - ((y - minY) / (maxY - minY || 1)) * (H - pad * 2);
      return [cx, cy];
    }

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad + (i / 5) * (H - pad * 2);
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    }
    for (let i = 0; i <= 6; i++) {
      const x = pad + (i / 6) * (W - pad * 2);
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke();
    }

    // Axis labels
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("x (m)", W / 2, H - 8);
    ctx.save();
    ctx.translate(12, H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("y (m)", 0, 0);
    ctx.restore();

    // Tracked trajectory
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    xs.forEach((x, i) => {
      const [cx, cy] = toCanvas(x, ys[i]);
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    // Strobe dots
    if (showStrobe) {
      xs.forEach((x, i) => {
        const [cx, cy] = toCanvas(x, ys[i]);
        ctx.fillStyle = "rgba(127,119,221,0.6)";
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Ghost trajectory
    if (showGhost && result.predicted_trajectory) {
      const gx = result.predicted_trajectory.x_positions_m;
      const gy = result.predicted_trajectory.y_positions_m;
      ctx.strokeStyle = "rgba(127,119,221,0.7)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      gx.forEach((x, i) => {
        const [cx, cy] = toCanvas(x, gy[i]);
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Start / end dots
    const [sx, sy] = toCanvas(xs[0], ys[0]);
    const [ex, ey] = toCanvas(xs[xs.length - 1], ys[ys.length - 1]);
    ctx.fillStyle = "#FFD700";
    ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();

  }, [result, showGhost, showStrobe]);

  const metrics = [
    { label: "Gravity estimate", value: result.estimated_gravity_ms2.toFixed(2), unit: "m/s²", good: Math.abs(result.estimated_gravity_ms2 - 9.81) < 1.0 },
    { label: "Initial velocity", value: result.initial_velocity_ms.toFixed(2), unit: "m/s", good: true },
    { label: "Launch angle", value: result.launch_angle_deg.toFixed(1), unit: "°", good: true },
    { label: "Frames analysed", value: String(result.timestamps.length), unit: "frames", good: true },
    ...(result.drag_coefficient != null ? [{ label: "Drag coefficient", value: result.drag_coefficient.toFixed(3), unit: "", good: true }] : []),
  ];

  return (
    <div>
      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "24px" }}>
        {metrics.map(({ label, value, unit, good }) => (
          <div key={label} style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "12px", padding: "16px",
          }}>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "6px" }}>{label}</div>
            <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "monospace", color: good ? "#fff" : "#FF8080" }}>
              {value}
              <span style={{ fontSize: "13px", fontWeight: 400, color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Trajectory canvas */}
      <div style={{
        background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "12px", padding: "16px", marginBottom: "16px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600 }}>Trajectory</div>
          <div style={{ display: "flex", gap: "16px" }}>
            {/* Legend */}
            <span style={{ fontSize: "11px", color: "#FFD700", display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "14px", height: "2px", background: "#FFD700", display: "inline-block" }} />tracked
            </span>
            {showGhost && result.predicted_trajectory && (
              <span style={{ fontSize: "11px", color: "rgba(127,119,221,0.9)", display: "flex", alignItems: "center", gap: "5px" }}>
                <span style={{ width: "14px", height: "0", borderTop: "1.5px dashed rgba(127,119,221,0.9)", display: "inline-block" }} />ghost
              </span>
            )}
          </div>
        </div>
        <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", borderRadius: "8px" }} />
      </div>

      {/* Toggles */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "24px", flexWrap: "wrap" }}>
        <Toggle label="Ghost trajectory" value={showGhost} onChange={setShowGhost} disabled={!result.predicted_trajectory} />
        <Toggle label="Strobe view" value={showStrobe} onChange={setShowStrobe} />
      </div>

      {/* Tracker mode badge */}
      {result.tracker_mode && (
        <div style={{ marginBottom: "16px" }}>
          <span style={{
            fontSize: "11px", padding: "4px 10px", borderRadius: "20px", fontWeight: 500,
            background: result.tracker_mode === "yolo" ? "rgba(93,202,165,0.1)" : "rgba(255,255,255,0.05)",
            border: result.tracker_mode === "yolo" ? "1px solid rgba(93,202,165,0.3)" : "1px solid rgba(255,255,255,0.1)",
            color: result.tracker_mode === "yolo" ? "#5DCAA5" : "rgba(255,255,255,0.4)",
          }}>
            Tracker: {result.tracker_mode === "yolo" ? "YOLOv8" : "HSV colour"}
          </span>
        </div>
      )}

      {/* Export buttons (placeholder) */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button style={{
          background: "#7F77DD", color: "#fff", border: "none",
          padding: "10px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
        }}>
          ↓ Export PDF
        </button>
        <button style={{
          background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
          color: "rgba(255,255,255,0.6)", padding: "10px 20px",
          borderRadius: "10px", fontSize: "13px", cursor: "pointer",
        }}>
          ↓ Export CSV
        </button>
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      style={{
        display: "flex", alignItems: "center", gap: "8px",
        background: value ? "rgba(127,119,221,0.12)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${value ? "rgba(127,119,221,0.3)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: "8px", padding: "8px 14px", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div style={{
        width: "32px", height: "18px", borderRadius: "9px",
        background: value ? "#7F77DD" : "rgba(255,255,255,0.1)",
        position: "relative", transition: "background 0.2s", flexShrink: 0,
      }}>
        <div style={{
          width: "12px", height: "12px", borderRadius: "50%", background: "#fff",
          position: "absolute", top: "3px", left: value ? "17px" : "3px",
          transition: "left 0.2s",
        }} />
      </div>
      <span style={{ fontSize: "13px", color: value ? "#AFA9EC" : "rgba(255,255,255,0.4)" }}>{label}</span>
    </button>
  );
}
