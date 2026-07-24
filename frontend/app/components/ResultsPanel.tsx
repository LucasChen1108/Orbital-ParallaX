"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { PhysicsResult, AnalysisResponse, UploadResponse, CalibrationPoints, FrameRange } from "../types/analysis";
import { API_ROOT } from "../lib/api";
import SandboxTrajectory from "./SandboxTrajectory";

const APP_VERSION = "2.0.0-M2";
const BASE = `${API_ROOT}/api/v1/video`;
const G = "#2563a8";
const GLIGHT = "#eff6ff";
const GBORDER = "#bfdbfe";

interface Props {
  result: PhysicsResult;
  analysis?: AnalysisResponse | null;
  uploadData?: UploadResponse | null;
  calibration?: CalibrationPoints | null;
  frameRange?: FrameRange;
  useAirResistance?: boolean;
}

interface HoverPoint { idx: number; cx: number; cy: number; }

export default function ResultsPanel({ result, analysis, uploadData, calibration, frameRange, useAirResistance }: Props) {
  const trajectoryCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayVideoRef = useRef<HTMLVideoElement>(null);

  const [showGhost, setShowGhost] = useState(true);
  const [showStrobe, setShowStrobe] = useState(false);
  const [strobeInterval, setStrobeInterval] = useState(0.1);
  const [strobeIntervalInput, setStrobeIntervalInput] = useState("0.1");
  const [showStrobeTimestamps, setShowStrobeTimestamps] = useState(true);
  
  const [exportingPdf, setExportingPdf] = useState(false);
  const [videoTab, setVideoTab] = useState<"original" | "overlay">("original");
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [jumpSize, setJumpSize] = useState(10);
  const [jumpInput, setJumpInput] = useState("10");
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const [panning, setPanning] = useState(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);

  const frameStart = frameRange?.start_frame ?? 0;
  const frameEnd   = frameRange?.end_frame   ?? (result.timestamps.length - 1);
  const totalAnalysedFrames = result.timestamps.length;
  const fps = uploadData?.fps ?? 30;

  const originalVideoUrl = uploadData ? `${BASE}/video/${uploadData.video_id}` : "";   
  const overlayVideoUrl  = analysis?.has_overlay ? `${BASE}/overlay/${analysis.video_id}` : "";  

  const xs    = result.x_positions_m;
  const ys    = result.y_positions_m;
  const vxArr = result.velocities_x_ms;
  const vyArr = result.velocities_y_ms;
  const n     = result.timestamps.length;
  const netVelocities   = vxArr.map((vx, i) => Math.sqrt(vx ** 2 + (vyArr[i] ?? 0) ** 2));
  const peakVelocity    = Math.max(...netVelocities);
  const maxHeight       = Math.max(...ys);
  const horizontalRange = Math.abs(xs[xs.length - 1] - xs[0]);
  const timeOfFlight    = result.timestamps[n - 1] - result.timestamps[0];

  // R²
  let r2 = 1;
  const ts = result.timestamps;
  if (n >= 3) {
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
    const t0 = ts[0];
    const X   = ts.map(t => [1, t - t0, (t - t0) ** 2]);
    const XT  = [0,1,2].map(j => X.map(row => row[j]));
    const XTX = [0,1,2].map(ri => [0,1,2].map(ci => XT[ri].reduce((s,v,k) => s + v*X[k][ci], 0)));
    const XTy = [0,1,2].map(ri => XT[ri].reduce((s,v,k) => s + v*ys[k], 0));
    const det = (m: number[][]) =>
      m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) -
      m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) +
      m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
    const D = det(XTX);
    if (Math.abs(D) > 1e-12) {
      const coeff = [0,1,2].map(k => {
        const M = XTX.map((row,ri) => row.map((v,ci) => ci===k ? XTy[ri] : v));
        return det(M) / D;
      });
      const ssRes = ys.reduce((a, y, i) => {
        const t = ts[i] - t0;
        return a + (y - (coeff[0] + coeff[1]*t + coeff[2]*t*t)) ** 2;
      }, 0);
      r2 = ssTot > 1e-12 ? Math.max(0, 1 - ssRes/ssTot) : 1;
    }
  }
  const fitLabel = result.drag_coefficient != null ? "Drag Model" : "Parabolic";
  const confidenceInterval = (key: string, digits: number, unit: string) => {
    const interval = result.confidence_intervals?.[key];
    if (!interval) return undefined;
    return `95% CI ${interval.lower.toFixed(digits)}–${interval.upper.toFixed(digits)} ${unit}`;
  };
  const uncertainty = (key: string, digits: number) => {
    const interval = result.confidence_intervals?.[key];
    if (!interval) return undefined;
    const halfWidth = (interval.upper - interval.lower) / 2;
    return `± ${halfWidth.toFixed(digits)}`;
  };

  // Video sync
  // Video sync
  useEffect(() => {
    const activeVideo = videoTab === "original" ? videoRef.current : overlayVideoRef.current;
    if (!activeVideo) return;
    const handleTimeUpdate = () => {
      const idx = Math.round(activeVideo.currentTime * fps) - frameStart;
      setCurrentFrameIdx(Math.max(0, Math.min(totalAnalysedFrames - 1, idx)));
    };
    activeVideo.addEventListener("timeupdate", handleTimeUpdate);
    return () => activeVideo.removeEventListener("timeupdate", handleTimeUpdate);
  }, [fps, frameStart, totalAnalysedFrames, videoTab, originalVideoUrl, overlayVideoUrl]);

  const goToFrame = useCallback((newIdx: number) => {
    const clamped = Math.max(0, Math.min(totalAnalysedFrames - 1, newIdx));
    setCurrentFrameIdx(clamped);
    const t = (frameStart + clamped) / fps;
    if (videoRef.current) videoRef.current.currentTime = t;
    if (overlayVideoRef.current) overlayVideoRef.current.currentTime = t;
  }, [totalAnalysedFrames, frameStart, fps]);

  // Keep newly-shown video tab in sync with current frame      
  useEffect(() => {                                            
    const activeVideo = videoTab === "original" ? videoRef.current : overlayVideoRef.current;  
    if (activeVideo) activeVideo.currentTime = (frameStart + currentFrameIdx) / fps;  
  }, [videoTab]); 

  // Wheel zoom
  useEffect(() => {
    const canvas = trajectoryCanvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.5, Math.min(8, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  const W = 800, H = 400;
  const pad = 52;

  const getBounds = useCallback(() => {
    const allX = [...xs, ...(showGhost && result.predicted_trajectory ? result.predicted_trajectory.x_positions_m : [])];
    const allY = [...ys, ...(showGhost && result.predicted_trajectory ? result.predicted_trajectory.y_positions_m : [])];
    return { minX: Math.min(...allX), maxX: Math.max(...allX), minY: Math.min(...allY), maxY: Math.max(...allY) };
  }, [xs, ys, showGhost, result.predicted_trajectory]);

  const toCanvas = useCallback((x: number, y: number, bounds: ReturnType<typeof getBounds>): [number, number] => {
    const { minX, maxX, minY, maxY } = bounds;
    const cx = pad + ((x - minX) / (maxX - minX || 1)) * (W - pad * 2);
    const cy = H - pad - ((y - minY) / (maxY - minY || 1)) * (H - pad * 2);
    return [(cx - W/2) * zoom + W/2 + pan.x, (cy - H/2) * zoom + H/2 + pan.y];
  }, [zoom, pan.x, pan.y]);

  const drawTrajectory = useCallback(() => {
    const canvas = trajectoryCanvasRef.current;
    if (!canvas || !xs.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const bounds = getBounds();
    const { minX, maxX, minY, maxY } = bounds;

    // White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Grid
    const xSteps = 7, ySteps = 5;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (let i = 0; i <= ySteps; i++) {
      const yVal = maxY - (i / ySteps) * (maxY - minY);
      const gy = toCanvas(minX, yVal, bounds)[1];
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(W - pad, gy); ctx.stroke();
      ctx.fillStyle = "#9ca3af"; ctx.font = "10px monospace"; ctx.textAlign = "right";
      ctx.fillText(yVal.toFixed(2), pad - 6, gy + 3);
    }
    for (let i = 0; i <= xSteps; i++) {
      const xVal = minX + (i / xSteps) * (maxX - minX);
      const gx = toCanvas(xVal, minY, bounds)[0];
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, H - pad); ctx.stroke();
      ctx.fillStyle = "#9ca3af"; ctx.font = "10px monospace"; ctx.textAlign = "center";
      ctx.fillText(xVal.toFixed(2), gx, H - pad + 14);
    }

    // Axis labels
    ctx.fillStyle = "#6b7280"; ctx.font = "11px system-ui"; ctx.textAlign = "center";
    ctx.fillText("x (m)", W / 2, H - 4);
    ctx.save(); ctx.translate(14, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("y (m)", 0, 0); ctx.restore();

    // Zoom indicator
    if (zoom !== 1) {
      ctx.fillStyle = G; ctx.font = "bold 11px monospace"; ctx.textAlign = "right";
      ctx.fillText(`${zoom.toFixed(1)}×`, W - 8, 18);
    }

    // Ghost trajectory
    if (showGhost && result.predicted_trajectory) {
      const gx2 = result.predicted_trajectory.x_positions_m;
      const gy2 = result.predicted_trajectory.y_positions_m;
      ctx.strokeStyle = "#48cb31"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      gx2.forEach((x, i) => {
        const [cx, cy] = toCanvas(x, gy2[i], bounds);
        if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
      });
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Tracked trajectory — green
    ctx.strokeStyle = G; ctx.lineWidth = 3; ctx.lineJoin = "round";
    ctx.beginPath();
    xs.forEach((x, i) => {
      const [cx, cy] = toCanvas(x, ys[i], bounds);
      if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    // Strobe dots
    if (showStrobe && strobeInterval > 0) {
      const ts = result.timestamps;
      const minT = ts[0];
      const maxT = ts[ts.length - 1];
      const strobeIndices: number[] = [];

      // Find the closest frames for each multiple of strobeInterval
      let k = Math.ceil(minT / strobeInterval);
      while (true) {
        const targetT = k * strobeInterval;
        if (targetT > maxT) break;

        let closestIdx = 0;
        let minDiff = Infinity;
        for (let idx = 0; idx < ts.length; idx++) {
          const diff = Math.abs(ts[idx] - targetT);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = idx;
          }
        }

        if (!strobeIndices.includes(closestIdx)) {
          strobeIndices.push(closestIdx);
        }
        k++;
      }

      strobeIndices.forEach((i) => {
        const [cx, cy] = toCanvas(xs[i], ys[i], bounds);

        // Draw 3D-like ghost ball with radial gradient
        const r = 8;
        const grad = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, r);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, "#93c5fd"); // light blue
        grad.addColorStop(1, "#2563a8");   // primary brand blue
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // White border
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Subtle arc shadow on the bottom-right edge of the ball
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0.25 * Math.PI, 0.75 * Math.PI);
        ctx.stroke();

        // Small timestamp label next to each dot
        if (showStrobeTimestamps) {
          ctx.fillStyle = "#374151";
          ctx.font = "10px monospace";
          ctx.textAlign = "left";
          ctx.fillText(`${ts[i].toFixed(2)}s`, cx + 12, cy + 3);
        }
      });
    }

    // Start/end labels
    function drawLabel(px: number, py: number, label: string, alignRight: boolean) {
      if (!ctx) return;
      ctx.fillStyle = G;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.stroke();
      const lines2 = label.split("\n");
      const lineH2 = 14, boxW2 = 118, boxH2 = lines2.length * lineH2 + 10;
      const bx2 = alignRight ? Math.max(4, px - boxW2 - 10) : Math.min(px + 10, W - boxW2 - 4);
      const by3 = Math.max(4, Math.min(py - boxH2 / 2, H - boxH2 - 4));
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.roundRect(bx2, by3, boxW2, boxH2, 6); ctx.fill();
      ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(bx2, by3, boxW2, boxH2, 6); ctx.stroke();
      lines2.forEach((ln, i) => {
        ctx.fillStyle = i === 0 ? G : "#374151";
        ctx.font = i === 0 ? "bold 10px monospace" : "10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(ln, bx2 + 7, by3 + 13 + i * lineH2);
      });
    }

    const [sx, sy] = toCanvas(xs[0], ys[0], bounds);
    const [ex, ey] = toCanvas(xs[xs.length-1], ys[ys.length-1], bounds);
    drawLabel(sx, sy, `START\nt=${result.timestamps[0].toFixed(3)}s\nx=${xs[0].toFixed(3)}m\ny=${ys[0].toFixed(3)}m`, false);
    drawLabel(ex, ey, `END\nt=${result.timestamps[n-1].toFixed(3)}s\nx=${xs[n-1].toFixed(3)}m\ny=${ys[n-1].toFixed(3)}m`, true);

    // Current frame dot
    const fi = currentFrameIdx;
    if (fi >= 0 && fi < xs.length) {
      const [bx, by] = toCanvas(xs[fi], ys[fi], bounds);
      ctx.strokeStyle = G; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(bx, by, 12, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = G;
      ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI*2); ctx.fill();
    }

    // Hover tooltip
    if (hoverPoint) {
      const { idx, cx: hx, cy: hy } = hoverPoint;
      ctx.strokeStyle = G; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = GLIGHT;
      ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(hx, pad); ctx.lineTo(hx, H-pad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, hy); ctx.lineTo(W-pad, hy); ctx.stroke();
      ctx.setLineDash([]);
      const netV = netVelocities[idx] ?? 0;
      const tipLines = [
        `frame ${frameStart + idx}`,
        `t  = ${result.timestamps[idx]?.toFixed(3)} s`,
        `x  = ${xs[idx]?.toFixed(3)} m`,
        `y  = ${ys[idx]?.toFixed(3)} m`,
        `vx = ${vxArr[idx]?.toFixed(3)} m/s`,
        `vy = ${vyArr[idx]?.toFixed(3)} m/s`,
        `|v|= ${netV.toFixed(3)} m/s`,
        `click to seek video`,
      ];
      const tipW = 160, tipH = tipLines.length * 16 + 10;
      const tx = hx + 16 + tipW > W ? hx - tipW - 16 : hx + 16;
      const ty = Math.max(4, Math.min(hy - tipH/2, H - tipH - 4));
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.roundRect(tx, ty, tipW, tipH, 8); ctx.fill();
      ctx.strokeStyle = GBORDER; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(tx, ty, tipW, tipH, 8); ctx.stroke();
      tipLines.forEach((ln, i) => {
        const isLast = i === tipLines.length - 1;
        const isFirst = i === 0;
        ctx.fillStyle = isFirst ? G : isLast ? "#9ca3af" : "#374151";
        ctx.font = isFirst ? "bold 10px monospace" : "10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(ln, tx + 8, ty + 13 + i * 16);
      });
    }
  }, [xs, ys, showGhost, showStrobe, strobeInterval, showStrobeTimestamps, result, currentFrameIdx, frameStart, hoverPoint, zoom, getBounds, toCanvas, netVelocities, vxArr, vyArr, n]);

  useEffect(() => { drawTrajectory(); }, [drawTrajectory]);

  // Mouse events
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning.current) {
      didDrag.current = true;
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      lastMouse.current = { x: e.clientX, y: e.clientY };
      return;
    }
    const canvas = trajectoryCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top) * (H / rect.height);
    const bounds = getBounds();
    let nearest = -1, nearDist = Infinity;
    xs.forEach((x, i) => {
      const [cx, cy] = toCanvas(x, ys[i], bounds);
      const d = Math.hypot(cx - mx, cy - my);
      if (d < nearDist) { nearDist = d; nearest = i; }
    });
    if (nearest >= 0 && nearDist < 30) {
      const [cx, cy] = toCanvas(xs[nearest], ys[nearest], bounds);
      setHoverPoint({ idx: nearest, cx, cy });
    } else setHoverPoint(null);
  }, [xs, ys, getBounds, toCanvas]);

  const handleCanvasClick = useCallback(() => {
    if (!didDrag.current && hoverPoint) goToFrame(hoverPoint.idx);
  }, [hoverPoint, goToFrame]);

  const handleMouseDownWithPos = useCallback((e: React.MouseEvent) => {
    isPanning.current = true; setPanning(true);
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false; setPanning(false);
    setTimeout(() => { didDrag.current = false; }, 0);
  }, []);

  // Frame data
  const currentAbsFrame = frameStart + currentFrameIdx;
  const currentX    = xs[currentFrameIdx]?.toFixed(3) ?? "—";
  const currentY    = ys[currentFrameIdx]?.toFixed(3) ?? "—";
  const currentVx   = vxArr[currentFrameIdx]?.toFixed(3) ?? "—";
  const currentVy   = vyArr[currentFrameIdx]?.toFixed(3) ?? "—";
  const currentNetV = netVelocities[currentFrameIdx]?.toFixed(3) ?? "—";
  const detectionSet    = new Set((analysis?.detections ?? []).map(([f]) => f));
  const currentDetected = detectionSet.has(currentAbsFrame);

  // CSV export
  function handleExportCSV() {
    const headers = ["frame_index","timestamp_s","x_px","y_px","x_m","y_m","velocity_x_ms","velocity_y_ms","net_velocity_ms","acceleration_x_ms2","acceleration_y_ms2","detection_status"];
    const rows = result.timestamps.map((t, i) => {
      const fi  = frameStart + i;
      const det = analysis?.detections?.find(([f]) => f === fi);
      const netV = Math.sqrt((vxArr[i]??0)**2 + (vyArr[i]??0)**2);
      return [fi, t.toFixed(4), det?det[1].toFixed(1):"", det?det[2].toFixed(1):"",
        xs[i]?.toFixed(4)??"", ys[i]?.toFixed(4)??"",
        vxArr[i]?.toFixed(4)??"", vyArr[i]?.toFixed(4)??"", netV.toFixed(4),
        result.accelerations_x_ms2[i]?.toFixed(4)??"", result.accelerations_y_ms2[i]?.toFixed(4)??"",
        detectionSet.has(fi) ? "Detected" : "Interpolated",
      ].join(",");
    });
    const lines = [
      `# ArcLab Projectile Analysis Export`, `# App version: ${APP_VERSION}`,
      `# Generated: ${new Date().toISOString()}`, `#`,
      `# Video: ${uploadData?.filename ?? "unknown"}`,
      `# Tracking mode: ${result.tracker_mode ?? "hsv"}`,
      `# Air resistance: ${useAirResistance ? "yes" : "no"}`,
      `# Gravity: ${result.estimated_gravity_ms2.toFixed(4)} m/s²`,
      `# Initial velocity: ${result.initial_velocity_ms.toFixed(4)} m/s`,
      `# Launch angle: ${result.launch_angle_deg.toFixed(2)} °`,
      `# ${fitLabel} fit R²: ${r2.toFixed(4)}`,
      ``, headers.join(","), ...rows,
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `arclab_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // PDF export
  async function handleExportPDF() {
    setExportingPdf(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210, margin = 16; let y = margin;
      const checkPage = (need = 10) => { if (y + need > 280) { doc.addPage(); y = margin; } };
      const sectionTitle = (title: string) => {
        checkPage(14);
        doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(40,40,40);
        doc.text(title, margin, y); y += 3;
        doc.setDrawColor(22,163,74); doc.setLineWidth(0.4);
        doc.line(margin, y, pageW-margin, y); y += 5;
        doc.setLineWidth(0.2); doc.setDrawColor(200,200,200);
      };
      const tableRow = (label: string, value: string, shade: boolean) => {
        checkPage(8);
        if (shade) { doc.setFillColor(240,253,244); doc.rect(margin, y-4, pageW-margin*2, 7, "F"); }
        doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(80,80,80);
        doc.text(label, margin+2, y);
        doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
        doc.text(value, pageW-margin-2, y, { align: "right" }); y += 7;
      };
      doc.setFillColor(22,163,74); doc.rect(0,0,pageW,18,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text("ArcLab — Projectile Analysis Report", margin, 12);
      doc.setFontSize(8); doc.setFont("helvetica","normal");
      doc.text(`v${APP_VERSION} · ${new Date().toLocaleString()}`, pageW-margin, 12, { align: "right" });
      y = 26;
      sectionTitle("1. Physics Summary");
      [["Estimated Gravity",`${result.estimated_gravity_ms2.toFixed(4)} m/s²`],["Initial Velocity",`${result.initial_velocity_ms.toFixed(4)} m/s`],["Launch Angle",`${result.launch_angle_deg.toFixed(2)} °`],["Maximum Height",`${maxHeight.toFixed(3)} m`],["Horizontal Range",`${horizontalRange.toFixed(3)} m`],["Time of Flight",`${timeOfFlight.toFixed(3)} s`],["Peak Velocity",`${peakVelocity.toFixed(3)} m/s`]].forEach(([l,v],i) => tableRow(l,v,i%2===0));      y += 4;
      sectionTitle("2. Experimental Context");
      [["Video File",uploadData?.filename??"—"],["Resolution",`${uploadData?.width??"?"}×${uploadData?.height??"?"} @ ${uploadData?.fps??"?"}fps`],["Analysed Frames",`${frameStart} – ${frameEnd}`],["Tracking Mode",result.tracker_mode==="yolo"?"YOLOv8":"HSV Colour"],["Air Resistance",useAirResistance?"Yes":"No"],["Calibration (px/m)",result.px_per_metre.toFixed(2)],...(calibration?[["Cal Pt 1",`(${calibration.x1.toFixed(1)}, ${calibration.y1.toFixed(1)})`],["Cal Pt 2",`(${calibration.x2.toFixed(1)}, ${calibration.y2.toFixed(1)})`],["Cal Distance",`${calibration.real_world_distance_m} m`]]:[]),["App Version",APP_VERSION],["Export Timestamp",new Date().toISOString()]].forEach(([l,v],i) => tableRow(l,v,i%2===0));
      y += 4;
      sectionTitle("3. Quality Metrics");
      [["Detection Rate",`${analysis?.detection_rate?.toFixed(1)??"?"}%`],["Detected Frames",`${analysis?.detected_frames??"?"} / ${analysis?.total_frames??"?"}`],["Points Used for Fit",String(n)],[`${fitLabel} Fit R²`,r2.toFixed(4)]].forEach(([l,v],i) => tableRow(l,v,i%2===0));
      y += 4;
      sectionTitle("4. Trajectory Chart");
      const canvas = trajectoryCanvasRef.current;
      if (canvas) {
        const imgData = canvas.toDataURL("image/png");
        const chartW = pageW-margin*2, chartH = chartW*(H/W);
        checkPage(chartH+4);
        doc.addImage(imgData,"PNG",margin,y,chartW,chartH); y += chartH+6;
      }
      sectionTitle("5. Frame-by-Frame Raw Data");
      const cols = ["Frame","t (s)","x (m)","y (m)","vx (m/s)","vy (m/s)","v (m/s)","Status"];
      const colW = (pageW-margin*2)/cols.length;
      checkPage(10);
      doc.setFillColor(22,163,74); doc.rect(margin,y-4,pageW-margin*2,7,"F");
      doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(8);
      cols.forEach((c,i) => doc.text(c, margin+i*colW+1, y)); y += 5;
      doc.setFont("helvetica","normal");
      result.timestamps.forEach((t,i) => {
        checkPage(6);
        const fi = frameStart+i;
        const detected = detectionSet.has(fi);
        const netV = Math.sqrt((vxArr[i]??0)**2+(vyArr[i]??0)**2);
        if (i%2===0) { doc.setFillColor(240,253,244); doc.rect(margin,y-3,pageW-margin*2,6,"F"); }
        doc.setTextColor(detected?40:120,40,40); doc.setFontSize(7.5);
        [String(fi),t.toFixed(3),xs[i]?.toFixed(3)??"-",ys[i]?.toFixed(3)??"-",(vxArr[i]??0).toFixed(3),(vyArr[i]??0).toFixed(3),netV.toFixed(3),detected?"✓":"interp."].forEach((v,j) => doc.text(v,margin+j*colW+1,y));
        y += 5.5;
      });
      const pageCount = doc.getNumberOfPages();
      for (let p=1; p<=pageCount; p++) {
        doc.setPage(p); doc.setFontSize(7.5); doc.setTextColor(160,160,160);
        doc.text("ArcLab · Team ParallaX · NUS Orbital 2026", pageW/2, 291, { align: "center" });
        doc.text(`Page ${p} / ${pageCount}`, pageW-margin, 291, { align: "right" });
      }
      doc.save(`arclab_report_${new Date().toISOString().slice(0,10)}.pdf`);
    } finally { setExportingPdf(false); }
  }

  const metrics = [
    { icon: "g", label: "Gravity estimate", value: result.estimated_gravity_ms2.toFixed(2), error: uncertainty("estimated_gravity_ms2", 2), unit: "m/s²", ci: confidenceInterval("estimated_gravity_ms2", 2, "m/s²") },
    { icon: "v", label: "Initial velocity", value: result.initial_velocity_ms.toFixed(2), error: uncertainty("initial_velocity_ms", 2), unit: "m/s", ci: confidenceInterval("initial_velocity_ms", 2, "m/s") },
    { icon: "θ", label: "Launch angle", value: result.launch_angle_deg.toFixed(1), error: uncertainty("launch_angle_deg", 1), unit: "°", ci: confidenceInterval("launch_angle_deg", 1, "°") },
    { icon: "▦", label: "Frames analysed", value: String(n), error: undefined, unit: "frames", ci: undefined },
  ];
  return (
    <div>
      {/* Metric cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:"16px", marginBottom:"24px" }}>
        {metrics.map(({ icon, label, value, error, unit, ci }) => (
          <div key={label} style={{
            background:"linear-gradient(145deg, #ffffff 0%, #fbfdff 100%)",
            border:"1px solid #dbeafe",
            borderRadius:"20px", padding:"24px 26px",
            boxShadow:"0 10px 30px rgba(37,99,168,0.08)",
            minHeight:"190px",
          }}>
            <div style={{
              width:"50px", height:"50px", borderRadius:"16px",
              display:"flex", alignItems:"center", justifyContent:"center",
              background:"linear-gradient(145deg, #dbeafe, #eef2ff)",
              color:"#0866e8", fontSize:"27px", fontWeight:750,
              fontFamily:"Arial, Helvetica, sans-serif",
              marginBottom:"16px",
            }}>{icon}</div>
            <div style={{ fontSize:"17px", color:"#111827", fontWeight:650, marginBottom:"16px" }}>{label}</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:"12px", whiteSpace:"nowrap" }}>
              <span style={{ fontSize:"40px", lineHeight:1, fontWeight:750, fontFamily:"Arial, Helvetica, sans-serif", color:"#0866e8", letterSpacing:"-0.03em" }}>
                {value}
              </span>
              {error && <span style={{ fontSize:"20px", fontWeight:500, color:"#5f6f89" }}>{error}</span>}
            </div>
            <div style={{ fontSize:"17px", fontWeight:500, color:"#52627c", marginTop:"12px" }}>{unit}</div>
            {ci && (
              <div title={ci} style={{
                display:"inline-flex", alignItems:"center", gap:"9px", marginTop:"18px", padding:"7px 12px",
                borderRadius:"12px", background:"#eaf3ff",
                color:"#536783", fontSize:"12px", fontWeight:600,
              }}>
                <span>95% confidence interval</span>
                <span style={{
                  width:"16px", height:"16px", border:"1.5px solid #71839e",
                  borderRadius:"50%", display:"inline-flex", alignItems:"center",
                  justifyContent:"center", fontSize:"10px", fontWeight:800,
                }}>i</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quality badges */}
      {analysis?.detection_rate != null && (
        <div style={{ display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap" }}>
          <QBadge good={analysis.detection_rate>=80} label={`Detection rate: ${analysis.detection_rate.toFixed(1)}% (${analysis.detected_frames}/${analysis.total_frames} frames)`} />
          <QBadge good={r2>=0.98} label={`${fitLabel} fit R² = ${r2.toFixed(4)}`} />
          {result.fit_quality && (
            <>
              <QBadge good={result.fit_quality.converged} label={result.fit_quality.converged ? "Bounded fit converged" : "Fit did not converge"} />
              <QBadge good={result.fit_quality.rmse_m <= 0.05} label={`Fit RMSE = ${result.fit_quality.rmse_m.toFixed(4)} m`} />
              <QBadge
                good={result.fit_quality.successful_bootstraps >= Math.max(10, result.fit_quality.bootstrap_samples * 0.9)}
                label={`Bootstrap: ${result.fit_quality.successful_bootstraps}/${result.fit_quality.bootstrap_samples}`}
              />
            </>
          )}
        </div>
      )}

      {/* Video player */}
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:"12px", overflow:"hidden", marginBottom:"16px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb" }}>
          {(["original","overlay"] as const).map(tab => (
            <button key={tab} onClick={() => setVideoTab(tab)} style={{
              flex:1, padding:"10px", fontSize:"12px", fontWeight:600, border:"none", cursor:"pointer",
              background: videoTab===tab ? GLIGHT : "#f9fafb",
              color: videoTab===tab ? "#15803d" : "#6b7280",
              borderBottom: videoTab===tab ? `2px solid ${G}` : "2px solid transparent",
            }}>
              {tab === "original" ? "Original" : "Overlay (annotated)"}
            </button>
          ))}
        </div>
        <div style={{ position:"relative", background:"#000" }}>
          {videoTab === "original" && originalVideoUrl && (
            <video ref={videoRef} src={originalVideoUrl} controls style={{ width:"100%", display:"block", maxHeight:"500px" }} />
          )}
          {videoTab === "overlay" && (
            overlayVideoUrl
            ? <video ref={overlayVideoRef} src={overlayVideoUrl} controls style={{ width:"100%", display:"block", maxHeight:"500px" }} />
            : <div style={{ padding:"48px", textAlign:"center", color:"#9ca3af", fontSize:"13px", background:"#f9fafb" }}>No overlay available — re-run analysis to generate one</div>
          )}
          {videoTab === "original" && (
            <div style={{ position:"absolute", top:"8px", right:"8px",
              background: currentDetected ? GLIGHT : "#fffbeb",
              border:`1px solid ${currentDetected ? GBORDER : "#fde68a"}`,
              borderRadius:"6px", padding:"3px 8px", fontSize:"10px", fontWeight:500,
              color: currentDetected ? "#15803d" : "#92400e" }}>
              {currentDetected ? "✓ detected" : "interpolated"}
            </div>
          )}
        </div>
        {videoTab === "original" && (
          <div style={{ padding:"14px", borderTop:"1px solid #e5e7eb", background:"#f9fafb" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
              <span style={{ fontSize:"11px", fontFamily:"monospace", color:"#6b7280" }}>frame {currentAbsFrame} / {frameEnd}</span>
              <span style={{ fontSize:"11px", color:"#9ca3af" }}>t = {result.timestamps[currentFrameIdx]?.toFixed(3) ?? "—"} s</span>
            </div>
            <div style={{ display:"flex", gap:"6px", alignItems:"center", flexWrap:"wrap", marginBottom:"10px" }}>
              <NavBtn onClick={() => goToFrame(0)} label="⏮" title="First" />
              <NavBtn onClick={() => goToFrame(currentFrameIdx - jumpSize)} label={`−${jumpSize}`} title={`Back ${jumpSize}`} />
              <NavBtn onClick={() => goToFrame(currentFrameIdx - 1)} label="←" title="Prev" />
              <NavBtn onClick={() => goToFrame(currentFrameIdx + 1)} label="→" title="Next" />
              <NavBtn onClick={() => goToFrame(currentFrameIdx + jumpSize)} label={`+${jumpSize}`} title={`Fwd ${jumpSize}`} />
              <NavBtn onClick={() => goToFrame(totalAnalysedFrames - 1)} label="⏭" title="Last" />
              <div style={{ display:"flex", alignItems:"center", gap:"4px", marginLeft:"auto" }}>
                <span style={{ fontSize:"11px", color:"#9ca3af" }}>jump</span>
                <input type="number" min={1} max={totalAnalysedFrames} value={jumpInput}
                  onChange={e => setJumpInput(e.target.value)}
                  onBlur={() => { const v = parseInt(jumpInput); if (!isNaN(v) && v > 0) setJumpSize(v); else setJumpInput(String(jumpSize)); }}
                  style={{ width:"44px", background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", padding:"4px 6px", color:"#111827", fontSize:"11px", textAlign:"center" }} />
                <span style={{ fontSize:"11px", color:"#9ca3af" }}>frames</span>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:"6px" }}>
              {[["x",`${currentX} m`],["y",`${currentY} m`],["|v|",`${currentNetV} m/s`],["vx",`${currentVx} m/s`],["vy",`${currentVy} m/s`],["t",`${result.timestamps[currentFrameIdx]?.toFixed(3)??"—"} s`]].map(([label, val]) => (
                <div key={label} style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:"6px", padding:"5px 8px" }}>
                  <div style={{ fontSize:"9px", color:"#9ca3af", marginBottom:"2px" }}>{label}</div>
                  <div style={{ fontSize:"11px", fontFamily:"monospace", color:"#111827" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Trajectory chart */}
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:"12px", padding:"16px", marginBottom:"16px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
          <div style={{ fontSize:"14px", fontWeight:700, color:"#111827" }}>Trajectory</div>
          <div style={{ display:"flex", gap:"14px", alignItems:"center" }}>
            <span style={{ fontSize:"10px", color:"#9ca3af" }}>scroll to zoom · drag to pan · hover · click to seek</span>
            {zoom !== 1 && (
              <button onClick={() => { setZoom(1); setPan({x:0,y:0}); }} style={{ fontSize:"11px", background:GLIGHT, border:`1px solid ${GBORDER}`, color:"#15803d", borderRadius:"6px", padding:"3px 8px", cursor:"pointer" }}>
                Reset zoom
              </button>
            )}
            <LegendLine color={G} label="tracked" />
            <LegendLine color="#a78bfa" label="ghost" dashed />
          </div>
        </div>
        <canvas
          ref={trajectoryCanvasRef}
          width={W} height={H}
          style={{ width:"100%", borderRadius:"8px", border:"1px solid #f3f4f6", cursor: hoverPoint?"pointer":panning?"grabbing":"crosshair" }}
          onMouseMove={handleCanvasMouseMove}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDownWithPos}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setHoverPoint(null); isPanning.current=false; setPanning(false); }}
        />
        <div style={{ display:"flex", gap:"8px", marginTop:"10px", flexWrap:"wrap", alignItems:"center" }}>
          <Toggle label="Ghost trajectory" value={showGhost} onChange={setShowGhost} disabled={!result.predicted_trajectory} />
          <Toggle label="Strobe view" value={showStrobe} onChange={setShowStrobe} />
          {showStrobe && (
            <div style={{ display:"flex", gap:"12px", alignItems:"center", marginLeft:"8px" }}>
              <label style={{ fontSize:"12px", color:"#374151", display:"flex", alignItems:"center", gap:"6px" }}>
                every
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={strobeIntervalInput}
                  onChange={e => {
                    setStrobeIntervalInput(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) {
                      setStrobeInterval(val);
                    }
                  }}
                  style={{ width:"56px", background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", padding:"4px 6px", color:"#111827", fontSize:"12px", textAlign:"center" }}
                />
                s
              </label>
              <label style={{ fontSize:"12px", color:"#374151", display:"flex", alignItems:"center", gap:"6px", cursor:"pointer" }}>
                <input
                  type="checkbox"
                  checked={showStrobeTimestamps}
                  onChange={e => setShowStrobeTimestamps(e.target.checked)}
                  style={{ cursor:"pointer" }}
                />
                Show timestamps
              </label>
            </div>
          )}
        </div>
      </div>
      
      {/* Sandbox Mode — overlaid on the real video frame */}
      <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:"12px", padding:"16px", marginBottom:"16px", boxShadow:"0 1px 3px rgba(0,0,0,0.06)" }}>
        <SandboxTrajectory
          realTrajectory={{ x_positions_m: xs, y_positions_m: ys }}
          initialParams={{
            v0: result.initial_velocity_ms,
            angleDeg: result.launch_angle_deg,
            g: result.estimated_gravity_ms2,
            dragCoeff: result.drag_coefficient ?? 0,
          }}
          overlay={uploadData ? {
            frameUrl: `${BASE}/frame/${uploadData.video_id}/${analysis?.detections?.[0]?.[0] ?? frameStart}`,
            videoWidthPx: uploadData.width,
            videoHeightPx: uploadData.height,
            pxPerMetre: result.px_per_metre,
          } : undefined}
        />
      </div>

      {/* Tracker badge */}
      {result.tracker_mode && (
        <div style={{ marginBottom:"16px" }}>
          <span style={{ fontSize:"11px", padding:"4px 12px", borderRadius:"20px", fontWeight:500,
            background: result.tracker_mode==="yolo" ? GLIGHT : "#f3f4f6",
            border: result.tracker_mode==="yolo" ? `1px solid ${GBORDER}` : "1px solid #e5e7eb",
            color: result.tracker_mode==="yolo" ? "#15803d" : "#6b7280" }}>
            Tracker: {result.tracker_mode==="yolo" ? "YOLOv8" : "HSV colour"}
          </span>
        </div>
      )}

      {/* Export */}
      <div style={{ display:"flex", gap:"10px" }}>
        <button onClick={handleExportPDF} disabled={exportingPdf} style={{
          background: exportingPdf ? "#86efac" : G, color:"#fff", border:"none",
          padding:"10px 24px", borderRadius:"10px", fontSize:"13px", fontWeight:600,
          cursor: exportingPdf?"not-allowed":"pointer",
          boxShadow: exportingPdf ? "none" : "0 1px 3px rgba(22,163,74,0.3)",
        }}>
          {exportingPdf ? "⏳ Generating…" : "↓ Export PDF"}
        </button>
        <button onClick={handleExportCSV} style={{
          background:"#fff", border:"1px solid #d1d5db", color:"#374151",
          padding:"10px 24px", borderRadius:"10px", fontSize:"13px", fontWeight:500, cursor:"pointer",
        }}>
          ↓ Export CSV
        </button>
      </div>
    </div>
  );
}

function NavBtn({ onClick, label, title }: { onClick: () => void; label: string; title: string }) {
  return (
    <button onClick={onClick} title={title} style={{ background:"#fff", border:"1px solid #d1d5db", color:"#374151", borderRadius:"6px", padding:"5px 10px", fontSize:"12px", cursor:"pointer", fontFamily:"monospace" }}>
      {label}
    </button>
  );
}

function QBadge({ good, label }: { good: boolean; label: string }) {
  return (
    <span style={{ fontSize:"12px", padding:"4px 12px", borderRadius:"20px",
      background: good ? GLIGHT : "#fffbeb",
      border: `1px solid ${good ? GBORDER : "#fde68a"}`,
      color: good ? "#15803d" : "#92400e" }}>
      {label}
    </span>
  );
}

function LegendLine({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span style={{ fontSize:"10px", color:"#6b7280", display:"flex", alignItems:"center", gap:"5px" }}>
      <span style={{ width:"16px", height:"2px", background: dashed ? "transparent" : color, borderTop: dashed ? `2px dashed ${color}` : "none", display:"inline-block" }} />
      {label}
    </span>
  );
}

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!value)} style={{ display:"flex", alignItems:"center", gap:"8px",
      background: value ? GLIGHT : "#f9fafb",
      border: `1px solid ${value ? GBORDER : "#e5e7eb"}`,
      borderRadius:"8px", padding:"7px 14px", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1 }}>
      <div style={{ width:"30px", height:"17px", borderRadius:"9px", background:value?G:"#d1d5db", position:"relative", flexShrink:0 }}>
        <div style={{ width:"11px", height:"11px", borderRadius:"50%", background:"#fff", position:"absolute", top:"3px", left:value?"16px":"3px", transition:"left 0.15s", boxShadow:"0 1px 2px rgba(0,0,0,0.2)" }} />
      </div>
      <span style={{ fontSize:"12px", fontWeight:500, color:value?"#15803d":"#6b7280" }}>{label}</span>
    </button>
  );
}
