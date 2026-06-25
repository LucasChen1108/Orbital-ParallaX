"use client";
import { useRef, useEffect, useState } from "react";
import { sampleColour } from "../lib/api";
import { SampleColourResponse } from "../types/analysis";

const USE_MOCK = false;

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

  // Draw crosshair on click point
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !clicked) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Circle
    ctx.strokeStyle = "#7F77DD";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(clicked.x, clicked.y, 12, 0, Math.PI * 2);
    ctx.stroke();
    // Crosshair lines
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(clicked.x - 18, clicked.y);
    ctx.lineTo(clicked.x + 18, clicked.y);
    ctx.moveTo(clicked.x, clicked.y - 18);
    ctx.lineTo(clicked.x, clicked.y + 18);
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
    setLoading(true);
    setError(null);
    try {
      const result = await sampleColour(videoId, frameIndex, x, y);
      setSampled(result);
      onSampled(result);
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
      <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", marginBottom: "20px" }}>
        Click directly on the ball in the frame. We sample its colour to track it through the clip.
      </p>

      {/* Canvas / mock area */}
      <div style={{
        position: "relative", display: "inline-block", width: "100%",
        borderRadius: "12px", overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "#111118",
        cursor: sampled ? "default" : "crosshair",
      }}>
        {frameUrl ? (
          // Real backend frame
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frameUrl}
              alt="video frame"
              style={{ display: "block", width: "100%", maxWidth: "640px" }}
            />
            <canvas
              ref={canvasRef}
              width={videoWidth}
              height={videoHeight}
              onClick={handleCanvasClick}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            />
          </>
        ) : (
          // Mock placeholder
          <div
            onClick={() => {
              if (sampled || loading) return;
              // simulate a click in the centre
              const fakeClick = { x: 200, y: 150 };
              setClicked(fakeClick);
              setLoading(true);
              setTimeout(async () => {
                try {
                  const result = await sampleColour(videoId, frameIndex, 320, 240);
                  setSampled(result);
                  onSampled(result);
                } finally {
                  setLoading(false);
                }
              }, 400);
            }}
            style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}
          >
            {/* Mock scene */}
            <svg viewBox="0 0 640 360" style={{ width: "100%", height: "100%", display: "block" }}>
              {/* Background */}
              <rect width="640" height="360" fill="#1a1a2e"/>
              {/* Grid */}
              {[1,2,3,4,5].map(i => (
                <line key={`h${i}`} x1="0" y1={i*60} x2="640" y2={i*60} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              ))}
              {[1,2,3,4,5,6,7,8,9].map(i => (
                <line key={`v${i}`} x1={i*71} y1="0" x2={i*71} y2="360" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              ))}
              {/* Trajectory arc (faint) */}
              <path d="M 80 300 Q 240 80 460 300" stroke="rgba(255,215,0,0.15)" strokeWidth="1.5" fill="none" strokeDasharray="4 3"/>
              {/* Ball */}
              <circle cx="240" cy="140" r="14" fill="#FFD700" opacity="0.9"/>
              <circle cx="240" cy="140" r="14" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
              {/* Crosshair hint if not clicked */}
              {!clicked && !sampled && (
                <>
                  <circle cx="240" cy="140" r="22" fill="none" stroke="rgba(127,119,221,0.5)" strokeWidth="1.5" strokeDasharray="4 3"/>
                  <text x="268" y="136" fill="rgba(255,255,255,0.4)" fontSize="11" fontFamily="monospace">click the ball</text>
                </>
              )}
              {/* Crosshair if clicked */}
              {clicked && (
                <>
                  <circle cx="240" cy="140" r="18" fill="none" stroke="#7F77DD" strokeWidth="2"/>
                  <line x1="215" y1="140" x2="265" y2="140" stroke="#FFD700" strokeWidth="1.5"/>
                  <line x1="240" y1="115" x2="240" y2="165" stroke="#FFD700" strokeWidth="1.5"/>
                </>
              )}
              {/* Mock label */}
              <rect x="8" y="8" width="80" height="20" rx="4" fill="rgba(127,119,221,0.2)"/>
              <text x="14" y="21" fill="#AFA9EC" fontSize="10" fontFamily="monospace">MOCK FRAME</text>
            </svg>
          </div>
        )}
      </div>

      {/* Status */}
      <div style={{ marginTop: "16px" }}>
        {loading && (
          <div style={{ fontSize: "13px", color: "#AFA9EC" }}>⏳ Sampling colour…</div>
        )}
        {error && (
          <div style={{
            background: "rgba(220,50,50,0.1)", border: "1px solid rgba(220,50,50,0.3)",
            borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "#FF8080",
          }}>{error}</div>
        )}
        {sampled && (
          <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            background: "rgba(93,202,165,0.08)", border: "1px solid rgba(93,202,165,0.25)",
            borderRadius: "10px", padding: "12px 16px",
          }}>
            <span style={{ fontSize: "16px" }}>✓</span>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#5DCAA5" }}>Colour sampled</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "2px", fontFamily: "monospace" }}>
                HSV [{sampled.sampled_hsv.join(", ")}]
              </div>
            </div>
            {/* Colour swatch */}
            <div style={{
              marginLeft: "auto", width: "32px", height: "32px", borderRadius: "50%",
              background: `hsl(${Math.round(sampled.sampled_hsv[0] * 2)}, ${Math.round(sampled.sampled_hsv[1] / 255 * 100)}%, 50%)`,
              border: "2px solid rgba(255,255,255,0.15)",
            }} />
          </div>
        )}
      </div>
    </div>
  );
}
