"use client";

interface Props {
  totalFrames: number;
  fps: number;
  startFrame: number;
  endFrame: number;
  onStartChange: (f: number) => void;
  onEndChange: (f: number) => void;
}

export default function IntervalSlider({
  totalFrames,
  fps,
  startFrame,
  endFrame,
  onStartChange,
  onEndChange,
}: Props) {
  const toSec = (f: number) => (f / fps).toFixed(2);

  return (
    <div>
      <h2>Step 2 — Select Frame Interval</h2>

      <div>
        <label>
          Start frame: {startFrame} ({toSec(startFrame)}s)
        </label>
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={startFrame}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val < endFrame) onStartChange(val);
          }}
          style={{ width: "100%" }}
        />
      </div>

      <div>
        <label>
          End frame: {endFrame} ({toSec(endFrame)}s)
        </label>
        <input
          type="range"
          min={0}
          max={totalFrames - 1}
          value={endFrame}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val > startFrame) onEndChange(val);
          }}
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
}