"use client";
import { useRef, useEffect, useState } from "react";
import { sampleColour } from "../lib/api";
import { SampleColourResponse } from "../types/analysis";

const USE_MOCK = false;
const G = "#2563a8";

interface Props {
  videoId: string;
  frameIndex: number;
  videoWidth: number;
  videoHeight: number;
  onSampled: (data: SampleColourResponse) => void;
}

export default function BallPicker({ videoId, frameIndex, videoWidth, videoHeight, onSampled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clicked, setClicked] = useState<{ x: number; y: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sampled, setSampled] = useState<SampleColourResponse | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clicked) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = G;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(clicked.x, clicked.y, 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(clicked.x - 20, clicked.y); ctx.lineTo(clicked.x + 20, clicked.y);
    ctx.moveTo(clicked.x, clicked.y - 20); ctx.lineTo(clicked.x, clicked.y + 20);
    ctx.stroke();
  }, [clicked]);

  async function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || loading || sampled) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = videoWidth / canvas.offsetWidth;
    const scaleY = videoHeight / canvas.offsetHeight;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setClicked({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setLoading(true); setError(null);
    try {
      const result = await sampleColour(videoId, frameIndex, x, y);
      setSampled(result); onSampled(result);
    } catch {
      setError("Colour sampling failed.");
    } finally {
      setLoading(false);
    }
  }

  const frameUrl = USE_MOCK
    ? null
    : `http://localhost:8000/api/v1/video/frame/${videoId}/${frameIndex}`;

  return (
    <div>
      <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
        Click directly on the ball in the frame. We sample its colour to track it through the clip.
      </p>

      <div style={{
        position: "relative", display: "inline-block", width: "100%",
        borderRadius: "12px", overflow: "hidden",
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        cursor: sampled ? "default" : "crosshair",
      }}>
        {frameUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={frameUrl} alt="video frame" style={{ display: "block", width: "100%" }} />
            <canvas
              ref={canvasRef}
              width={videoWidth}
              height={videoHeight}
              onClick={handleCanvasClick}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
          </>
        ) : (
          <div style={{ padding: "48px", textAlign: "center", color: "#9ca3af" }}>
            No frame available
          </div>
        )}
      </div>

      <div style={{ marginTop: "14px" }}>
        {loading && (
          <div style={{ fontSize: "13px", color: G }}>⏳ Sampling colour…</div>
        )}
        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "#dc2626",
          }}>{error}</div>
        )}
        {sampled && (
          <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            background: "#eff6ff", border: "1px solid #bfdbfe",
            borderRadius: "10px", padding: "12px 16px",
          }}>
            <span style={{ fontSize: "16px" }}>✓</span>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: G }}>Colour sampled</div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px", fontFamily: "monospace" }}>
                HSV [{sampled.sampled_hsv.join(", ")}]
              </div>
            </div>
            <div style={{
              marginLeft: "auto", width: "32px", height: "32px", borderRadius: "50%",
              background: `hsl(${Math.round(sampled.sampled_hsv[0] * 2)}, ${Math.round(sampled.sampled_hsv[1] / 255 * 100)}%, 50%)`,
              border: "2px solid #e5e7eb",
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
