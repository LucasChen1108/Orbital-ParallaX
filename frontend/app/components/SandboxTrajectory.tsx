"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { API_ROOT } from "../lib/api";

const REAL_COLOR = "#2563a8";
const SANDBOX_COLOR = "#7c3aed";
const DEFAULT_SCALE = 14;   // px per metre, abstract chart mode
const ABSTRACT_H = 400;     // fixed canvas height when not overlaying on video
const ABSTRACT_PAD = 48;

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

interface OverlayProps {
  frameUrl: string;
  videoWidthPx: number;
  videoHeightPx: number;
  pxPerMetre: number;
}

interface Props {
  realTrajectory?: RealTrajectory | null;
  initialParams?: Partial<SandboxParams>;
  overlay?: OverlayProps; // when provided, "On video" becomes available
}

const DEFAULTS: SandboxParams = { v0: 15, angleDeg: 45, g: 9.81, dragCoeff: 0 };

export default function SandboxTrajectory({ realTrajectory, initialParams, overlay }: Props) {
  const [params, setParams] = useState<SandboxParams>({ ...DEFAULTS, ...initialParams });
  const [predicted, setPredicted] = useState<{ timestamps: number[]; x_positions_m: number[]; y_positions_m: number[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [baseScale, setBaseScale] = useState(DEFAULT_SCALE);
  const [hover, setHover] = useState<{ xm: number; ym: number } | null>(null);
  const [panning, setPanning] = useState(false);
  const [useOverlayView, setUseOverlayView] = useState(true); // user's choice, only relevant when `overlay` is provided

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOverlayMode = !!overlay && useOverlayView;

  const x0 = realTrajectory?.x_positions_m?.[0] ?? 0;
  const y0 = realTrajectory?.y_positions_m?.[0] ?? 0;

  const W = 700;
  const H = isOverlayMode && overlay ? Math.round(W * (overlay.videoHeightPx / overlay.videoWidthPx)) : ABSTRACT_H;
  const pad = isOverlayMode ? 0 : ABSTRACT_PAD;

  function fitAbstractScale(pred: { x_positions_m: number[]; y_positions_m: number[] } | null) {
    if (!pred) return;
    const allX = [...(realTrajectory?.x_positions_m ?? []), ...pred.x_positions_m];
    const allY = [...(realTrajectory?.y_positions_m ?? []), ...pred.y_positions_m];
    const spanX = Math.max(...allX, x0) - Math.min(...allX, x0) || 1;
    const spanY = Math.max(...allY, y0) - Math.min(...allY, y0) || 1;
    const availW = W - ABSTRACT_PAD * 2 - 20;
    const availH = ABSTRACT_H - ABSTRACT_PAD * 2 - 20;
    const requiredScale = Math.min(availW / spanX, availH / spanY);
    if (requiredScale > 0) setBaseScale(s => Math.min(s, requiredScale));
  }

  // Debounced fetch — 150ms after the user stops dragging a slider.
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
            v0: params.v0, angle_deg: params.angleDeg, g: params.g,
            drag_coeff: params.dragCoeff, x0, y0,
          }),
        });
        if (!res.ok) throw new Error(`Prediction failed (${res.status})`);
        const data = await res.json();
        setPredicted(data);
        if (!isOverlayMode) fitAbstractScale(data);
      } catch {
        setError("Could not reach backend for prediction.");
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, x0, y0]);

  const worldToCanvas = useCallback((xm: number, ym: number): [number, number] => {
    if (isOverlayMode && overlay) {
      // Video-pixel space: px_x = x_m * pxPerMetre, px_y = -y_m * pxPerMetre
      // (matches backend calculator.py's inverse convention exactly)
      const scaleFactor = W / overlay.videoWidthPx;
      const pxX = xm * overlay.pxPerMetre * scaleFactor;
      const pxY = -ym * overlay.pxPerMetre * scaleFactor;
      return [(pxX - W / 2) * zoom + W / 2 + pan.x, (pxY - H / 2) * zoom + H / 2 + pan.y];
    }
    // Abstract mode: launch point is FIXED at a stable pixel anchor.
    const originPx = pad + 10;
    const originPy = H - pad - 10;
    const px = originPx + (xm - x0) * baseScale;
    const py = originPy - (ym - y0) * baseScale;
    return [(px - W / 2) * zoom + W / 2 + pan.x, (py - H / 2) * zoom + H / 2 + pan.y];
  }, [isOverlayMode, overlay, zoom, pan, baseScale, x0, y0, H, pad]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const context: CanvasRenderingContext2D = ctx;
    context.clearRect(0, 0, W, H);

    if (isOverlayMode && bgImgRef.current) {
      context.drawImage(bgImgRef.current, 0, 0, W, H);
    } else {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, W, H);
    }

    if (!isOverlayMode) {
      context.strokeStyle = "#e5e7eb"; context.lineWidth = 1;
      for (let i = 0; i <= 6; i++) {
        const gy = pad + (i / 6) * (H - pad * 2);
        context.beginPath(); context.moveTo(pad, gy); context.lineTo(W - pad, gy); context.stroke();
      }
      for (let i = 0; i <= 8; i++) {
        const gx = pad + (i / 8) * (W - pad * 2);
        context.beginPath(); context.moveTo(gx, pad); context.lineTo(gx, H - pad); context.stroke();
      }
      context.fillStyle = "#6b7280"; context.font = "11px system-ui"; context.textAlign = "center";
      context.fillText("x (m)", W / 2, H - 8);
      context.save(); context.translate(14, H / 2); context.rotate(-Math.PI / 2);
      context.fillText("y (m)", 0, 0); context.restore();
    }

    function strokeLine(points: [number, number][], color: string, width: number, dashed: boolean) {
      if (points.length === 0) return;
      if (isOverlayMode) {
        context.strokeStyle = "rgba(255,255,255,0.9)"; context.lineWidth = width + 3;
        context.setLineDash(dashed ? [8, 5] : []);
        context.beginPath();
        points.forEach(([cx, cy], i) => (i === 0 ? context.moveTo(cx, cy) : context.lineTo(cx, cy)));
        context.stroke();
      }
      context.strokeStyle = color; context.lineWidth = width; context.lineJoin = "round";
      context.setLineDash(dashed ? [7, 5] : []);
      context.beginPath();
      points.forEach(([cx, cy], i) => (i === 0 ? context.moveTo(cx, cy) : context.lineTo(cx, cy)));
      context.stroke();
      context.setLineDash([]);
    }

    if (realTrajectory && realTrajectory.x_positions_m.length > 0) {
      const pts = realTrajectory.x_positions_m.map((x, i) => worldToCanvas(x, realTrajectory.y_positions_m[i]));
      strokeLine(pts, REAL_COLOR, isOverlayMode ? 3.5 : 3, false);
    }

    if (predicted && predicted.x_positions_m.length > 0) {
      const pts = predicted.x_positions_m.map((x, i) => worldToCanvas(x, predicted.y_positions_m[i]));
      strokeLine(pts, SANDBOX_COLOR, isOverlayMode ? 3 : 2.5, true);
    }

    const [lx, ly] = worldToCanvas(x0, y0);
    context.fillStyle = "#111827";
    context.beginPath(); context.arc(lx, ly, isOverlayMode ? 5 : 4, 0, Math.PI * 2); context.fill();
    context.strokeStyle = "#fff"; context.lineWidth = 1.5;
    context.beginPath(); context.arc(lx, ly, isOverlayMode ? 5 : 4, 0, Math.PI * 2); context.stroke();

    if (hover && !isOverlayMode) {
      const [hx, hy] = worldToCanvas(hover.xm, hover.ym);
      const label = `x=${hover.xm.toFixed(2)}m  y=${hover.ym.toFixed(2)}m`;
      context.font = "11px monospace";
      const tw = context.measureText(label).width + 16;
      const tx = Math.min(hx + 10, W - tw - 4);
      context.fillStyle = "#fff"; context.strokeStyle = "#d1d5db"; context.lineWidth = 1;
      context.beginPath(); context.roundRect(tx, Math.max(4, hy - 24), tw, 20, 5); context.fill(); context.stroke();
      context.fillStyle = "#111827"; context.textAlign = "left";
      context.fillText(label, tx + 8, Math.max(18, hy - 10));
    }
  }, [isOverlayMode, realTrajectory, predicted, x0, y0, hover, worldToCanvas, H, pad]);

  // Load the background frame image whenever overlay data is provided —
  // independent of the toggle, so switching "On video" back is instant.
  useEffect(() => {
    if (!overlay) { bgImgRef.current = null; return; }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { bgImgRef.current = img; draw(); };
    img.src = overlay.frameUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay?.frameUrl]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (isOverlayMode) return; // fixed view, no zoom
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.5, Math.min(6, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, [isOverlayMode]);

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isOverlayMode) return; // fixed view, no panning
    isPanning.current = true; setPanning(true);
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isPanning.current) {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!isOverlayMode) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (W / rect.width);
      const my = (e.clientY - rect.top) * (H / rect.height);
      const originPx = pad + 10, originPy = H - pad - 10;
      const ux = (mx - W / 2 - pan.x) / zoom + W / 2;
      const uy = (my - H / 2 - pan.y) / zoom + H / 2;
      setHover({ xm: x0 + (ux - originPx) / baseScale, ym: y0 - (uy - originPy) / baseScale });
    }
  }
  function handleMouseUp() { isPanning.current = false; setPanning(false); }

  function resetView() { setZoom(1); setPan({ x: 0, y: 0 }); setBaseScale(DEFAULT_SCALE); }
  function updateParam(key: keyof SandboxParams, value: number) {
    setParams(p => ({ ...p, [key]: value }));
  }

  const metrics = useMemo(() => {
    if (!predicted || predicted.x_positions_m.length === 0) return null;
    const xs = predicted.x_positions_m, ys = predicted.y_positions_m;
    return {
      range: Math.max(...xs) - Math.min(...xs),
      maxHeight: Math.max(...ys) - y0,
      timeOfFlight: predicted.timestamps[predicted.timestamps.length - 1],
    };
  }, [predicted, y0]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#111827" }}>
          Sandbox Mode {loading && <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 400 }}>· updating…</span>}
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          {overlay && (
            <div style={{ display: "flex", background: "#f3f4f6", borderRadius: "8px", padding: "2px", gap: "2px" }}>
              <button
                onClick={() => setUseOverlayView(true)}
                style={{
                  fontSize: "11px", padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                  background: useOverlayView ? "#fff" : "transparent",
                  color: useOverlayView ? "#111827" : "#6b7280",
                  fontWeight: useOverlayView ? 600 : 400,
                  boxShadow: useOverlayView ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                On video
              </button>
              <button
                onClick={() => { setUseOverlayView(false); fitAbstractScale(predicted); }}
                style={{
                  fontSize: "11px", padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                  background: !useOverlayView ? "#fff" : "transparent",
                  color: !useOverlayView ? "#111827" : "#6b7280",
                  fontWeight: !useOverlayView ? 600 : 400,
                  boxShadow: !useOverlayView ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Chart view
              </button>
            </div>
          )}
          <span style={{ fontSize: "10px", color: "#6b7280" }}>
            {isOverlayMode ? "sliders update the sandbox curve" : "scroll to zoom · drag to pan · hover for coords"}
          </span>
          {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
            <button onClick={resetView} style={{ fontSize: "11px", background: "#eff6ff", border: "1px solid #bfdbfe", color: "#15803d", borderRadius: "6px", padding: "3px 8px", cursor: "pointer" }}>
              Reset view
            </button>
          )}
          {realTrajectory && (
            <span style={{ fontSize: "10px", color: "#6b7280", display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ width: "16px", height: "2px", background: REAL_COLOR, display: "inline-block" }} /> tracked
            </span>
          )}
          <span style={{ fontSize: "10px", color: "#6b7280", display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "16px", height: "2px", borderTop: `2px dashed ${SANDBOX_COLOR}`, display: "inline-block" }} /> sandbox
          </span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={W} height={H}
        style={{ width: "100%", borderRadius: "8px", border: "1px solid #f3f4f6", cursor: isOverlayMode ? "default" : (panning ? "grabbing" : "crosshair") }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { isPanning.current = false; setPanning(false); setHover(null); }}
      />

      {error && <div style={{ marginTop: "8px", fontSize: "12px", color: "#dc2626" }}>{error}</div>}

      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginTop: "14px" }}>
          {[["Range", `${metrics.range.toFixed(2)} m`], ["Max height", `${metrics.maxHeight.toFixed(2)} m`], ["Time of flight", `${metrics.timeOfFlight.toFixed(2)} s`]].map(([label, val]) => (
            <div key={label} style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "8px", padding: "8px 12px" }}>
              <div style={{ fontSize: "10px", color: "#7c3aed", marginBottom: "2px" }}>{label}</div>
              <div style={{ fontSize: "15px", fontWeight: 700, fontFamily: "monospace", color: "#111827" }}>{val}</div>
            </div>
          ))}
        </div>
      )}

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
        <span style={{ fontFamily: "monospace", color: "#7c3aed", fontWeight: 600 }}>
          {value.toFixed(step < 1 ? 3 : 1)}{unit}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#7c3aed" }}
      />
    </div>
  );
}
