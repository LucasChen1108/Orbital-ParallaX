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

export default function CalibrationPicker({
  videoId,
  frameIndex,
  videoWidth,
  videoHeight,
  onCalibrated,
}: Props) {
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
      ctx.fillStyle = "blue";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.font = "12px sans-serif";
      ctx.fillText(String(i + 1), p.x - 4, p.y + 4);
    });
    if (points.length === 2) {
      ctx.strokeStyle = "blue";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
    }
  }, [points]);

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (points.length >= 2 || done) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = videoWidth / canvas.offsetWidth;
    const scaleY = videoHeight / canvas.offsetHeight;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setPoints((prev) => [...prev, { x, y }]);
  }

  function handleConfirm() {
    const d = parseFloat(distance);
    if (points.length < 2 || isNaN(d) || d <= 0) return;
    onCalibrated({
      x1: points[0].x,
      y1: points[0].y,
      x2: points[1].x,
      y2: points[1].y,
      real_world_distance_m: d,
    });
    setDone(true);
  }

  return (
    <div>
      <h2>Step 4 — Calibration</h2>
      <p>Click 2 points on the frame whose real-world distance you know.</p>

      <div style={{ position: "relative", display: "inline-block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`http://localhost:8000/api/v1/video/frame/${videoId}/${frameIndex}`}
          alt="calibration frame"
          style={{ display: "block", maxWidth: "640px" }}
        />
        <canvas
          ref={canvasRef}
          width={videoWidth}
          height={videoHeight}
          onClick={handleCanvasClick}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            cursor: points.length < 2 ? "crosshair" : "default",
          }}
        />
      </div>

      <div>
        <label>
          Real-world distance between points (metres):&nbsp;
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            style={{ width: "80px" }}
          />
        </label>
        <button
          onClick={handleConfirm}
          disabled={points.length < 2 || !distance || done}
        >
          Confirm Calibration
        </button>
        {points.length < 2 && (
          <span> — click {2 - points.length} more point(s)</span>
        )}
        {done && <span style={{ color: "green" }}> ✓ Calibration set</span>}
      </div>

      {points.length > 0 && (
        <button onClick={() => setPoints([])}>Reset points</button>
      )}
    </div>
  );
}