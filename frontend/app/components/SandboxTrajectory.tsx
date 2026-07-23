"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { API_ROOT } from "../lib/api";

const G = "#2563a8";        // tracked / real trajectory — solid blue
const SANDBOX = "#7c3aed";  // sandbox / hypothetical trajectory — dashed purple

interface RealTrajectory {
  x_positions_m: number[];
  y_positions_m: number[];
}

interface SandboxParams {
  v0: number;
  angleDeg: number;
  g: number;
  dragCoeff: number;
}

interface Props {
  realTrajectory?: RealTrajectory | null;
  initialParams?: Partial<SandboxParams>;
}

const DEFAULTS: SandboxParams = { v0: 15, angleDeg: 45, g: 9.81, dragCoeff: 0 };

export default function SandboxTrajectory({ realTrajectory, initialParams }: Props) {
  const [params, setParams] = useState<SandboxParams>({ ...DEFAULTS, ...initialParams });
  const [predicted, setPredicted] = useState<{ x_positions_m: number[]; y_positions_m: number[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const x0 = realTrajectory?.x_positions_m?.[0] ?? 0;
  const y0 = realTrajectory?.y_positions_m?.[0] ?? 0;

  // Debounced fetch — waits 150ms after the user stops dragging before calling the backend
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_ROOT}/api/v1/video/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            v0: params.v0,
            angle_deg: params.angleDeg,
            g: params.g,
            drag_coeff: params.dragCoeff,
            x0, y0,
          }),
        });
        if (!res.ok) throw new Error(`Prediction failed (${res.status})`);
        const data = await res.json();
        setPredicted(data);
      } catch {
        setError("Could not reach backend for prediction.");
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [params, x0, y0]);

  const W = 700, H = 380, pad = 48;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    const allX = [...(realTrajectory?.x_positions_m ?? []), ...(predicted?.x_positions_m ?? []), x0];
    const allY = [...(realTrajectory?.y_positions_m ?? []), ...(predicted?.y_positions_m ?? []), y0, 0];
    if (allX.length === 0) return;

    const minX = Math.min(...allX), maxX = Math.max(...allX);
    const minY = Math.min(...allY), maxY = Math.max(...allY);

    const toCanvas = (x: number, y: number): [number, number] => [
      pad + ((x - minX) / (maxX - minX || 1)) * (W - pad * 2),
      H - pad - ((y - minY) / (maxY - minY || 1)) * (H - pad * 2),
    ];

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const gy = pad + (i / 5) * (H - pad * 2);
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(W - pad, gy); ctx.stroke();
    }
    for (let i = 0; i <= 7; i++) {
      const gx = pad + (i / 7) * (W - pad * 2);
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, H - pad); ctx.stroke();
    }

    ctx.fillStyle = "#6b7280"; ctx.font = "11px system-ui"; ctx.textAlign = "center";
    ctx.fillText("x (m)", W / 2, H - 8);
    ctx.save(); ctx.translate(14, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("y (m)", 0, 0); ctx.restore();

    if (realTrajectory && realTrajectory.x_positions_m.length > 0) {
      ctx.strokeStyle = G; ctx.lineWidth = 3; ctx.lineJoin = "round";
      ctx.beginPath();
      realTrajectory.x_positions_m.forEach((x, i) => {
        const [cx, cy] = toCanvas(x, realTrajectory.y_positions_m[i]);
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      });
      ctx.stroke();
    }

    if (predicted && predicted.x_positions_m.length > 0) {
      ctx.strokeStyle = SANDBOX; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]);
      ctx.beginPath();
      predicted.x_positions_m.forEach((x, i) => {
        const [cx, cy] = toCanvas(x, predicted.y_positions_m[i]);
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const [lx, ly] = toCanvas(x0, y0);
    ctx.fillStyle = "#111827";
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
  }, [realTrajectory, predicted, x0, y0]);

  useEffect(() => { draw(); }, [draw]);

  function updateParam(key: keyof SandboxParams, value: number) {
    setParams(p => ({ ...p, [key]: value }));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>
          Sandbox Mode {loading && <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 400 }}>· updating…</span>}
        </div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          {realTrajectory && (
            <span style={{ fontSize: "10px", color: "#6b7280", display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "16px", height: "2px", background: G, display: "inline-block" }} /> tracked
            </span>
          )}
          <span style={{ fontSize: "10px", color: "#6b7280", display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "16px", height: "2px", borderTop: `2px dashed ${SANDBOX}`, display: "inline-block" }} /> sandbox
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={W} height={H}
        style={{ width: "100%", borderRadius: "8px", border: "1px solid #f3f4f6" }}
      />

      {error && <div style={{ marginTop: "8px", fontSize: "12px", color: "#dc2626" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "18px" }}>
        <SliderControl label="Initial velocity" unit=" m/s" value={params.v0} min={1} max={40} step={0.5} onChange={v => updateParam("v0", v)} />
        <SliderControl label="Launch angle" unit="°" value={params.angleDeg} min={-90} max={90} step={1} onChange={v => updateParam("angleDeg", v)} />
        <SliderControl label="Gravity" unit=" m/s²" value={params.g} min={1} max={20} step={0.1} onChange={v => updateParam("g", v)} />
        <SliderControl label="Drag coefficient" unit="" value={params.dragCoeff} min={0} max={0.2} step={0.005} onChange={v => updateParam("dragCoeff", v)} />
      </div>
    </div>
  );
}

function SliderControl({ label, unit, value, min, max, step, onChange }: {
  label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#374151", marginBottom: "6px" }}>
        <span>{label}</span>
        <span style={{ fontFamily: "monospace", color: "#2563a8", fontWeight: 600 }}>
          {value.toFixed(step < 1 ? 3 : 1)}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#2563a8" }}
      />
    </div>
  );
}
