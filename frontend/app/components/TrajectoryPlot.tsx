"use client";
import { useEffect, useRef } from "react";

export default function TrajectoryPlot({
  detections,
  width,
  height,
}: {
  detections: [number, number, number][];
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = 600 / width;
    canvas.width = 600;
    canvas.height = height * scale;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#16a34a";
    for (const [, cx, cy] of detections) {
      ctx.beginPath();
      ctx.arc(cx * scale, cy * scale, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [detections, width, height]);

  return <canvas ref={ref} style={{ border: "1px solid #ccc" }} />;
}