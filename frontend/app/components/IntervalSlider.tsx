"use client";

const G = "#2563a8";

interface Props {
  totalFrames: number;
  fps: number;
  startFrame: number;
  endFrame: number;
  onStartChange: (f: number) => void;
  onEndChange: (f: number) => void;
}

export default function IntervalSlider({ totalFrames, fps, startFrame, endFrame, onStartChange, onEndChange }: Props) {
  const toSec = (f: number) => (f / fps).toFixed(2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {[
        { label: "Start frame", frame: startFrame, onChange: (val: number) => { if (val < endFrame) onStartChange(val); } },
        { label: "End frame",   frame: endFrame,   onChange: (val: number) => { if (val > startFrame) onEndChange(val); } },
      ].map(({ label, frame, onChange }) => (
        <div key={label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#374151" }}>{label}</span>
            <span style={{ fontSize: "13px", fontFamily: "monospace", color: G, fontWeight: 600 }}>
              {frame} <span style={{ color: "#9ca3af", fontWeight: 400 }}>({toSec(frame)}s)</span>
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={totalFrames - 1}
            value={frame}
            onChange={e => onChange(Number(e.target.value))}
            style={{ width: "100%", accentColor: G, height: "4px" }}
          />
        </div>
      ))}

      {/* Summary */}
      <div style={{
        display: "flex", gap: "16px",
        background: "#eff6ff", border: "1px solid #bfdbfe",
        borderRadius: "8px", padding: "10px 16px", fontSize: "12px",
      }}>
        <span style={{ color: "#6b7280" }}>Selected:</span>
        <span style={{ color: G, fontWeight: 600 }}>
          frames {startFrame} – {endFrame}
        </span>
        <span style={{ color: "#6b7280" }}>
          ({(toSec(endFrame - startFrame))}s · {endFrame - startFrame} frames)
        </span>
      </div>
    </div>
  );
}
