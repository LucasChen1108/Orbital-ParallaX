"use client";
import { useRef, useState, useEffect } from "react";

const G = "#2563a8";
const GLIGHT = "#eff6ff";
const GBORDER = "#bfdbfe";
const BASE = "http://localhost:8000/api/v1/video";

interface Props {
  totalFrames: number;
  fps: number;
  startFrame: number;
  endFrame: number;
  onStartChange: (f: number) => void;
  onEndChange: (f: number) => void;
  videoId?: string;
}

export default function IntervalSlider({
  totalFrames, fps, startFrame, endFrame,
  onStartChange, onEndChange, videoId,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const toSec = (f: number) => (f / fps).toFixed(2);

  // Sync video time → currentFrame
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handler = () => {
      setCurrentFrame(Math.round(video.currentTime * fps));
    };
    video.addEventListener("timeupdate", handler);
    return () => video.removeEventListener("timeupdate", handler);
  }, [fps]);

  function setStartHere() {
    const video = videoRef.current;
    if (!video) return;
    const f = Math.round(video.currentTime * fps);
    if (f < endFrame) onStartChange(f);
  }

  function setEndHere() {
    const video = videoRef.current;
    if (!video) return;
    const f = Math.round(video.currentTime * fps);
    if (f > startFrame) onEndChange(f);
  }

  function handleStartChange(val: number) {
    if (val < endFrame) {
      onStartChange(val);
      const video = videoRef.current;
      if (video) video.currentTime = val / fps;
    }
  }

  function handleEndChange(val: number) {
    if (val > startFrame) {
      onEndChange(val);
      const video = videoRef.current;
      if (video) video.currentTime = val / fps;
    }
  }

  const videoUrl = videoId ? `${BASE}/video/${videoId}` : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Video player */}
      {videoUrl && (
        <div style={{ background: "#000", borderRadius: "12px", overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            style={{ width: "100%", display: "block", maxHeight: "400px" }}
          />
          {/* Frame info bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px", background: "#f9fafb", borderTop: "1px solid #e5e7eb",
          }}>
            <div style={{ fontSize: "12px", fontFamily: "monospace", color: "#6b7280" }}>
              Current:{" "}
              <span style={{ color: G, fontWeight: 600 }}>
                frame {currentFrame}
              </span>
              <span style={{ color: "#9ca3af", marginLeft: "6px" }}>
                ({(currentFrame / fps).toFixed(2)}s)
              </span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={setStartHere} style={{
                background: GLIGHT, border: `1px solid ${GBORDER}`,
                color: G, borderRadius: "7px", padding: "5px 12px",
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
              }}>
                ← Set as start
              </button>
              <button onClick={setEndHere} style={{
                background: GLIGHT, border: `1px solid ${GBORDER}`,
                color: G, borderRadius: "7px", padding: "5px 12px",
                fontSize: "12px", fontWeight: 600, cursor: "pointer",
              }}>
                Set as end →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected range visual */}
      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "14px 16px" }}>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "#374151", marginBottom: "12px" }}>
          Selected interval
        </div>

        {/* Range bar */}
        <div style={{ position: "relative", height: "6px", background: "#e5e7eb", borderRadius: "3px", marginBottom: "16px" }}>
          <div style={{
            position: "absolute",
            left: `${(startFrame / (totalFrames - 1)) * 100}%`,
            width: `${((endFrame - startFrame) / (totalFrames - 1)) * 100}%`,
            height: "100%", background: G, borderRadius: "3px",
          }} />
          {/* Start handle */}
          <div style={{
            position: "absolute",
            left: `${(startFrame / (totalFrames - 1)) * 100}%`,
            top: "50%", transform: "translate(-50%, -50%)",
            width: "14px", height: "14px", borderRadius: "50%",
            background: G, border: "2px solid #fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
          {/* End handle */}
          <div style={{
            position: "absolute",
            left: `${(endFrame / (totalFrames - 1)) * 100}%`,
            top: "50%", transform: "translate(-50%, -50%)",
            width: "14px", height: "14px", borderRadius: "50%",
            background: G, border: "2px solid #fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          }} />
        </div>

        {/* Start frame slider */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#374151" }}>Start frame</span>
            <span style={{ fontSize: "12px", fontFamily: "monospace", color: G, fontWeight: 600 }}>
              {startFrame}{" "}
              <span style={{ color: "#9ca3af", fontWeight: 400 }}>({toSec(startFrame)}s)</span>
            </span>
          </div>
          <input
            type="range" min={0} max={totalFrames - 1} value={startFrame}
            onChange={e => handleStartChange(Number(e.target.value))}
            style={{ width: "100%", accentColor: G }}
          />
        </div>

        {/* End frame slider */}
        <div style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#374151" }}>End frame</span>
            <span style={{ fontSize: "12px", fontFamily: "monospace", color: G, fontWeight: 600 }}>
              {endFrame}{" "}
              <span style={{ color: "#9ca3af", fontWeight: 400 }}>({toSec(endFrame)}s)</span>
            </span>
          </div>
          <input
            type="range" min={0} max={totalFrames - 1} value={endFrame}
            onChange={e => handleEndChange(Number(e.target.value))}
            style={{ width: "100%", accentColor: G }}
          />
        </div>
        
        {/* Summary */}
        <div style={{
          display: "flex", gap: "16px", flexWrap: "wrap",
          background: GLIGHT, border: `1px solid ${GBORDER}`,
          borderRadius: "8px", padding: "8px 14px", fontSize: "12px", marginTop: "4px",
        }}>
          <span style={{ color: "#6b7280" }}>Selected:</span>
          <span style={{ color: G, fontWeight: 600 }}>frames {startFrame} – {endFrame}</span>
          <span style={{ color: "#6b7280" }}>
            {(toSec(endFrame - startFrame))}s · {endFrame - startFrame} frames
          </span>
        </div>
      </div>
    </div>
  );
}
