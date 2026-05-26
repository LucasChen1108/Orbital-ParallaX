"use client";
import { useRef, useEffect, useState } from "react";
import { sampleColour } from "../lib/api";
import { SampleColourResponse } from "../types/analysis";

interface Props {
  videoId: string;
  frameIndex: number;
  videoWidth: number;
  videoHeight: number;
  onSampled: (data: SampleColourResponse) => void;
}

export default function BallPicker({
  videoId,
  frameIndex,
  videoWidth,
  videoHeight,
  onSampled,
}: Props) {
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
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(clicked.x, clicked.y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }, [clicked]);

  async function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
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

  return (
    <div>
      <h2>Step 3 — Click the Ball</h2>
      <p>Click directly on the ball in the frame below.</p>

      <div style={{ position: "relative", display: "inline-block" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`http://localhost:8000/api/v1/video/frame/${videoId}/${frameIndex}`}
          alt="first frame"
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
            cursor: "crosshair",
          }}
        />
      </div>

      {loading && <p>Sampling colour...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {sampled && (
        <p style={{ color: "green" }}>
          ✓ Colour sampled — HSV {sampled.sampled_hsv.join(", ")}
        </p>
      )}
    </div>
  );
}