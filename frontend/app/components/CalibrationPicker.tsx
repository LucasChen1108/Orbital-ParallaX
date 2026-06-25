"use client";
import { useRef, useEffect, useState } from "react";
import { CalibrationPoints } from "../types/analysis";

interface Props {
  videoId: string;
  frameIndex: number;
  videoWidth: number;
  videoHeight: number;
  onCalibrated: (data: CalibrationPoints) => void;
}

export default function CalibrationPicker({ videoId, frameIndex, videoWidth, videoHeight, onCalibrated }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [distance, setDistance] = useState<string>("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    points.forEach((p, i) => {
      // Point circle
      ctx.fillStyle = "#7F77DD";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      // Number label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(i + 1), p.x, p.y);
    });

    if (points.length === 2) {
      // Connecting line
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Distance label at midpoint
      const mx = (points[0].x + points[1].x) / 2;
      const my = (points[0].y + points[1].y) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.beginPath();
      ctx.roundRect(mx - 28, my - 10, 56, 20, 4);
      ctx.fill();
      ctx.fillStyle = "#FFD700";
      ctx.font = "11px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(distance ? `${distance}m` : "? m", mx, my);
    }
  }, [points, distance]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (points.length >= 2 || done) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = videoWidth / canvas.offsetWidth;
    const scaleY = videoHeight / canvas.offsetHeight;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setPoints(prev => [...prev, { x, y }]);
  }

  function handleConfirm() {
    const d = parseFloat(distance);
    if (points.length < 2 || isNaN(d) || d <= 0) return;
    onCalibrated({ x1: points[0].x, y1: points[0].y, x2: points[1].x, y2: points[1].y, real_world_distance_m: d });
    setDone(true);
  }

  return (
    <div>
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", marginBottom: "20px" }}>
        Click 2 points on the frame whose real-world distance you know (e.g. a ruler, a door, a metre stick).
      </p>

      {/* Progress indicator */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {[1, 2].map(n => (
          <div key={n} style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "6px 12px", borderRadius: "8px", fontSize: "12px",
            background: points.length >= n ? "rgba(127,119,221,0.15)" : "rgba(255,255,255,0.03)",
            border: `1px solid ${points.length >= n ? "rgba(127,119,221,0.4)" : "rgba(255,255,255,0.08)"}`,
            color: points.length >= n ? "#AFA9EC" : "rgba(255,255,255,0.25)",
          }}>
            <div style={{
              width: "18px", height: "18px", borderRadius: "50%", fontSize: "11px",
              display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600,
              background: points.length >= n ? "#7F77DD" : "rgba(255,255,255,0.08)",
              color: points.length >= n ? "#fff" : "rgba(255,255,255,0.3)",
            }}>{n}</div>
            Point {n} {points.length >= n ? "✓" : ""}
          </div>
        ))}
        {points.length < 2 && (
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", alignSelf: "center", marginLeft: "4px" }}>
            — click {2 - points.length} more point{2 - points.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Frame + canvas */}
      <div style={{
        position: "relative", display: "inline-block", width: "100%",
        borderRadius: "12px", overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`http://localhost:8000/api/v1/video/frame/${videoId}/${frameIndex}`}
          alt="calibration frame"
          style={{ display: "block", width: "100%", maxWidth: "640px" }}
        />
        <canvas
          ref={canvasRef}
          width={videoWidth}
          height={videoHeight}
          onClick={handleCanvasClick}
          style={{
            position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
            cursor: points.length < 2 && !done ? "crosshair" : "default",
          }}
        />
      </div>

      {/* Controls */}
      <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
        <div>
          <label style={{ fontSize: "13px", color: "rgba(255,255,255,0.6)", display: "block", marginBottom: "8px" }}>
            Real-world distance between the two points (metres)
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={distance}
            onChange={e => setDistance(e.target.value)}
            placeholder="e.g. 1.0"
            style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "14px", width: "160px",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={handleConfirm}
            disabled={points.length < 2 || !distance || done}
            style={{
              background: points.length < 2 || !distance || done ? "rgba(127,119,221,0.3)" : "#7F77DD",
              color: "#fff", border: "none", padding: "10px 24px",
              borderRadius: "10px", fontSize: "14px", fontWeight: 600,
              cursor: points.length < 2 || !distance || done ? "not-allowed" : "pointer",
            }}
          >
            {done ? "✓ Calibration set" : "Confirm calibration →"}
          </button>

          {points.length > 0 && !done && (
            <button
              onClick={() => setPoints([])}
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.4)", padding: "10px 16px",
                borderRadius: "10px", fontSize: "13px", cursor: "pointer",
              }}
            >
              Reset points
            </button>
          )}
        </div>

        {done && (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            background: "rgba(93,202,165,0.08)", border: "1px solid rgba(93,202,165,0.25)",
            borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "#5DCAA5",
          }}>
            ✓ Calibration confirmed — {distance}m between points
          </div>
        )}
      </div>
    </div>
  );
}
