"use client";
import { useRef, useEffect, useState, useCallback } from "react";
import { PhysicsResult, AnalysisResponse, UploadResponse, CalibrationPoints, FrameRange } from "../types/analysis";

const APP_VERSION = "2.0.0-M2";
const BASE = "http://localhost:8000/api/v1/video";

interface Props {
  result: PhysicsResult;
  analysis?: AnalysisResponse | null;
  uploadData?: UploadResponse | null;
  calibration?: CalibrationPoints | null;
  frameRange?: FrameRange;
  useAirResistance?: boolean;
}

interface HoverPoint {
  idx: number;
  cx: number;
  cy: number;
}

export default function ResultsPanel({ result, analysis, uploadData, calibration, frameRange, useAirResistance }: Props) {
  const trajectoryCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [showGhost, setShowGhost] = useState(true);
  const [showStrobe, setShowStrobe] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [videoTab, setVideoTab] = useState<"original" | "overlay">("original");
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [jumpSize, setJumpSize] = useState(10);
  const [jumpInput, setJumpInput] = useState("10");
  const [hoverPoint, setHoverPoint] = useState<HoverPoint | null>(null);

  // Zoom/pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const [panning, setPanning] = useState(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const frameStart = frameRange?.start_frame ?? 0;
  const frameEnd   = frameRange?.end_frame   ?? (result.timestamps.length - 1);
  const totalAnalysedFrames = result.timestamps.length;
  const fps = uploadData?.fps ?? 30;

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

  // ── Video sync ───────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      const idx = Math.round(video.currentTime * fps) - frameStart;
      setCurrentFrameIdx(Math.max(0, Math.min(totalAnalysedFrames - 1, idx)));
    };
    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [fps, frameStart, totalAnalysedFrames]);

  function goToFrame(newIdx: number) {
    const clamped = Math.max(0, Math.min(totalAnalysedFrames - 1, newIdx));
    setCurrentFrameIdx(clamped);
    if (videoRef.current) videoRef.current.currentTime = (frameStart + clamped) / fps;
  }

  // Prevent page scroll when zooming on canvas
  useEffect(() => {
    const canvas = trajectoryCanvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.max(0.5, Math.min(8, z * delta)));
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  // ── Canvas drawing ───────────────────────────────────────────────
  const W = 800, H = 420;
  const pad = 52;

  const getBounds = useCallback(() => {
    const allX = [...xs, ...(showGhost && result.predicted_trajectory ? result.predicted_trajectory.x_positions_m : [])];
    const allY = [...ys, ...(showGhost && result.predicted_trajectory ? result.predicted_trajectory.y_positions_m : [])];
    return {
      minX: Math.min(...allX), maxX: Math.max(...allX),
      minY: Math.min(...allY), maxY: Math.max(...allY),
    };
  }, [xs, ys, showGhost, result.predicted_trajectory]);

  const toCanvas = useCallback((x: number, y: number, bounds: ReturnType<typeof getBounds>): [number, number] => {
    const { minX, maxX, minY, maxY } = bounds;
    const cx = pad + ((x - minX) / (maxX - minX || 1)) * (W - pad * 2);
    const cy = H - pad - ((y - minY) / (maxY - minY || 1)) * (H - pad * 2);
    // Apply zoom and pan
    return [
      (cx - W / 2) * zoom + W / 2 + pan.x,
      (cy - H / 2) * zoom + H / 2 + pan.y,
    ];
  }, [zoom, pan]);

  const fromCanvas = useCallback((cx: number, cy: number, bounds: ReturnType<typeof getBounds>): [number, number] => {
    const { minX, maxX, minY, maxY } = bounds;
    const ux = (cx - W / 2 - pan.x) / zoom + W / 2;
    const uy = (cy - H / 2 - pan.y) / zoom + H / 2;
    const x = minX + ((ux - pad) / (W - pad * 2)) * (maxX - minX);
    const y = maxY - ((uy - pad) / (H - pad * 2)) * (maxY - minY);
    return [x, y];
  }, [zoom, pan]);

  const drawTrajectory = useCallback(() => {
    const canvas = trajectoryCanvasRef.current;
    if (!canvas || !xs.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    const bounds = getBounds();
    const { minX, maxX, minY, maxY } = bounds;

    // Background
    ctx.fillStyle = "#0d0d1a";
    ctx.fillRect(0, 0, W, H);

    // Grid + numbers
    const xSteps = 7, ySteps = 5;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= ySteps; i++) {
      const yVal = maxY - (i / ySteps) * (maxY - minY);
      const [, gy] = toCanvas(minX, yVal, bounds);
      ctx.beginPath(); ctx.moveTo(pad * zoom, gy); ctx.lineTo(W - pad * zoom, gy); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "10px monospace"; ctx.textAlign = "right";
      ctx.fillText(yVal.toFixed(2), pad - 4, gy + 3);
    }
    for (let i = 0; i <= xSteps; i++) {
      const xVal = minX + (i / xSteps) * (maxX - minX);
      const [gx] = toCanvas(xVal, minY, bounds);
      ctx.beginPath(); ctx.moveTo(gx, pad * zoom); ctx.lineTo(gx, H - pad * zoom); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "10px monospace"; ctx.textAlign = "center";
      ctx.fillText(xVal.toFixed(2), gx, H - pad + 14);
    }
    ctx.fillStyle = "rgba(255,255,255,0.45)"; ctx.font = "11px monospace"; ctx.textAlign = "center";
    ctx.fillText("x (m)", W / 2, H - 6);
    ctx.save(); ctx.translate(14, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText("y (m)", 0, 0); ctx.restore();

    // Zoom level indicator
    if (zoom !== 1) {
      ctx.fillStyle = "rgba(127,119,221,0.8)";
      ctx.font = "11px monospace"; ctx.textAlign = "right";
      ctx.fillText(`${zoom.toFixed(1)}×`, W - 8, 18);
    }

    // Tracked trajectory
    ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
    ctx.beginPath();
    xs.forEach((x, i) => {
      const [cx, cy] = toCanvas(x, ys[i], bounds);
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    // Strobe dots
    if (showStrobe) {
      xs.forEach((x, i) => {
        const [cx, cy] = toCanvas(x, ys[i], bounds);
        ctx.fillStyle = "rgba(127,119,221,0.5)";
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
      });
    }

    // Ghost trajectory
    if (showGhost && result.predicted_trajectory) {
      const gx2 = result.predicted_trajectory.x_positions_m;
      const gy2 = result.predicted_trajectory.y_positions_m;
      ctx.strokeStyle = "rgba(127,119,221,0.7)"; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      gx2.forEach((x, i) => {
        const [cx, cy] = toCanvas(x, gy2[i], bounds);
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
      });
      ctx.stroke(); ctx.setLineDash([]);
    }

    // Start / end labelled points
    function drawLabelledPoint(px: number, py: number, label: string, alignRight: boolean) {
      if (!ctx) return;
      ctx.fillStyle = "#FFD700";
      ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.stroke();
      const lines2 = label.split("\n");
      const lineH2 = 14, boxW2 = 120, boxH2 = lines2.length * lineH2 + 10;
      const bx2 = alignRight ? Math.max(4, px - boxW2 - 12) : Math.min(px + 12, W - boxW2 - 4);
      const by3 = Math.max(4, Math.min(py - boxH2 / 2, H - boxH2 - 4));
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.beginPath(); ctx.roundRect(bx2, by3, boxW2, boxH2, 5); ctx.fill();
      ctx.strokeStyle = "rgba(255,215,0,0.3)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(bx2, by3, boxW2, boxH2, 5); ctx.stroke();
      ctx.fillStyle = "#FFD700"; ctx.font = "bold 10px monospace"; ctx.textAlign = "left";
      lines2.forEach((ln, i) => {
        ctx.fillStyle = i === 0 ? "#FFD700" : "rgba(255,255,255,0.7)";
        ctx.font = i === 0 ? "bold 10px monospace" : "10px monospace";
        ctx.fillText(ln, bx2 + 7, by3 + 13 + i * lineH2);
      });
    }

    const [sx, sy] = toCanvas(xs[0], ys[0], bounds);
    const [ex, ey] = toCanvas(xs[xs.length - 1], ys[ys.length - 1], bounds);
    const startLabel = `START\nt=${result.timestamps[0].toFixed(3)}s\nx=${xs[0].toFixed(3)}m\ny=${ys[0].toFixed(3)}m`;
    const endLabel   = `END\nt=${result.timestamps[n-1].toFixed(3)}s\nx=${xs[n-1].toFixed(3)}m\ny=${ys[n-1].toFixed(3)}m`;
    drawLabelledPoint(sx, sy, startLabel, false);
    drawLabelledPoint(ex, ey, endLabel, true);

    // Current frame dot
    const fi = currentFrameIdx;
    if (fi >= 0 && fi < xs.length) {
      const [bx, by] = toCanvas(xs[fi], ys[fi], bounds);
      ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(bx, by, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
    }

    // Hover tooltip
    if (hoverPoint) {
      const { idx, cx: hx, cy: hy } = hoverPoint;
      // Snap circle
      ctx.strokeStyle = "#7F77DD"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "rgba(127,119,221,0.3)";
      ctx.beginPath(); ctx.arc(hx, hy, 10, 0, Math.PI * 2); ctx.fill();

      // Crosshair lines
      ctx.strokeStyle = "rgba(127,119,221,0.3)"; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(hx, pad); ctx.lineTo(hx, H - pad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, hy); ctx.lineTo(W - pad, hy); ctx.stroke();
      ctx.setLineDash([]);

      // Tooltip box
      const netV = netVelocities[idx] ?? 0;
      const tipLines = [
        `frame ${frameStart + idx}`,
        `t  = ${result.timestamps[idx]?.toFixed(3)} s`,
        `x  = ${xs[idx]?.toFixed(3)} m`,
        `y  = ${ys[idx]?.toFixed(3)} m`,
        `vx = ${vxArr[idx]?.toFixed(3)} m/s`,
        `vy = ${vyArr[idx]?.toFixed(3)} m/s`,
        `|v|= ${netV.toFixed(3)} m/s`,
      ];
      const tipW = 155, tipH = tipLines.length * 16 + 14;
      const tx = hx + 16 + tipW > W ? hx - tipW - 16 : hx + 16;
      const ty = hy - tipH / 2;
      ctx.fillStyle = "rgba(10,10,20,0.92)";
      ctx.beginPath(); ctx.roundRect(tx, ty, tipW, tipH, 6); ctx.fill();
      ctx.strokeStyle = "#7F77DD"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(tx, ty, tipW, tipH, 6); ctx.stroke();
      tipLines.forEach((ln, i) => {
        ctx.fillStyle = i === 0 ? "#AFA9EC" : "rgba(255,255,255,0.8)";
        ctx.font = i === 0 ? "bold 10px monospace" : "10px monospace";
        ctx.textAlign = "left";
        ctx.fillText(ln, tx + 8, ty + 12 + i * 16);
      });

      // Click hint
      ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "9px monospace";
      ctx.fillText("click to seek video", tx + 8, ty + tipH - 4);
    }
  }, [xs, ys, showGhost, showStrobe, result, currentFrameIdx, frameStart, hoverPoint, zoom, pan, getBounds, toCanvas, netVelocities, vxArr, vyArr, n]);

  useEffect(() => { drawTrajectory(); }, [drawTrajectory]);

  // ── Canvas mouse events ──────────────────────────────────────────
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

    // Find nearest point
    let nearest = -1, nearDist = Infinity;
    xs.forEach((x, i) => {
      const [cx, cy] = toCanvas(x, ys[i], bounds);
      const d = Math.hypot(cx - mx, cy - my);
      if (d < nearDist) { nearDist = d; nearest = i; }
    });
    if (nearest >= 0 && nearDist < 30) {
      const [cx, cy] = toCanvas(xs[nearest], ys[nearest], bounds);
      setHoverPoint({ idx: nearest, cx, cy });
    } else {
      setHoverPoint(null);
    }
  }, [xs, ys, getBounds, toCanvas]);

  const didDrag = useRef(false);

  const handleCanvasClick = useCallback(() => {
    if (!didDrag.current && hoverPoint) goToFrame(hoverPoint.idx);
    didDrag.current = false;
  }, [hoverPoint]);

 const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isPanning.current = true;
    setPanning(true);
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    setPanning(false);
  }, []);

  // Current frame data
  const currentAbsFrame = frameStart + currentFrameIdx;
  const currentX        = xs[currentFrameIdx]?.toFixed(3) ?? "—";
  const currentY        = ys[currentFrameIdx]?.toFixed(3) ?? "—";
  const currentVx       = vxArr[currentFrameIdx]?.toFixed(3) ?? "—";
  const currentVy       = vyArr[currentFrameIdx]?.toFixed(3) ?? "—";
  const currentNetV     = netVelocities[currentFrameIdx]?.toFixed(3) ?? "—";
  const detectionSet    = new Set((analysis?.detections ?? []).map(([f]) => f));
  const currentDetected = detectionSet.has(currentAbsFrame);

  const originalVideoUrl = uploadData ? `${BASE}/video/${uploadData.video_id}` : "";
  const overlayVideoUrl  = analysis?.has_overlay ? `${BASE}/overlay/${analysis.video_id}` : "";

  // ── CSV Export ───────────────────────────────────────────────────
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
      `# --- METADATA ---`,
      `# Video: ${uploadData?.filename ?? "unknown"}`,
      `# Resolution: ${uploadData?.width ?? "?"}x${uploadData?.height ?? "?"} @ ${uploadData?.fps ?? "?"}fps`,
      `# Analysed frames: ${frameStart} – ${frameEnd}`,
      `# Tracking mode: ${result.tracker_mode ?? "hsv"}`,
      `# Air resistance: ${useAirResistance ? "yes" : "no"}`,
      `# Calibration: ${result.px_per_metre.toFixed(2)} px/m`,
      ...(calibration ? [`# Cal pt1: (${calibration.x1.toFixed(1)}, ${calibration.y1.toFixed(1)})`,`# Cal pt2: (${calibration.x2.toFixed(1)}, ${calibration.y2.toFixed(1)})`,`# Cal distance: ${calibration.real_world_distance_m} m`] : []),
      `# Detection rate: ${analysis?.detection_rate?.toFixed(1) ?? "?"}%`,
      `#`, `# --- PHYSICS SUMMARY ---`,
      `# Gravity: ${result.estimated_gravity_ms2.toFixed(4)} m/s²`,
      `# Initial velocity: ${result.initial_velocity_ms.toFixed(4)} m/s`,
      `# Launch angle: ${result.launch_angle_deg.toFixed(2)} °`,
      `# Max height: ${maxHeight.toFixed(3)} m`,
      `# Range: ${horizontalRange.toFixed(3)} m`,
      `# Time of flight: ${timeOfFlight.toFixed(3)} s`,
      `# Peak velocity: ${peakVelocity.toFixed(3)} m/s`,
      ...(result.drag_coefficient != null ? [`# Drag coefficient: ${result.drag_coefficient.toFixed(4)}`] : []),
      `#`, `# --- QUALITY ---`,
      `# Points for fit: ${n}`, `# Parabolic fit R²: ${r2.toFixed(4)}`,
      ``, headers.join(","), ...rows,
    ].join("\n");
    const blob = new Blob([lines], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `arclab_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── PDF Export ───────────────────────────────────────────────────
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
        doc.setDrawColor(127,119,221); doc.setLineWidth(0.4);
        doc.line(margin, y, pageW-margin, y); y += 5;
        doc.setLineWidth(0.2); doc.setDrawColor(200,200,200);
      };
      const tableRow = (label: string, value: string, shade: boolean) => {
        checkPage(8);
        if (shade) { doc.setFillColor(245,245,250); doc.rect(margin, y-4, pageW-margin*2, 7, "F"); }
        doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(80,80,80);
        doc.text(label, margin+2, y);
        doc.setFont("helvetica","bold"); doc.setTextColor(30,30,30);
        doc.text(value, pageW-margin-2, y, { align: "right" }); y += 7;
      };
      doc.setFillColor(127,119,221); doc.rect(0,0,pageW,18,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text("ArcLab — Projectile Analysis Report", margin, 12);
      doc.setFontSize(8); doc.setFont("helvetica","normal");
      doc.text(`v${APP_VERSION} · ${new Date().toLocaleString()}`, pageW-margin, 12, { align: "right" });
      y = 26;
      sectionTitle("1. Physics Summary");
      [["Estimated Gravity",`${result.estimated_gravity_ms2.toFixed(4)} m/s²`],["Initial Velocity",`${result.initial_velocity_ms.toFixed(4)} m/s`],["Launch Angle",`${result.launch_angle_deg.toFixed(2)} °`],["Maximum Height",`${maxHeight.toFixed(3)} m`],["Horizontal Range",`${horizontalRange.toFixed(3)} m`],["Time of Flight",`${timeOfFlight.toFixed(3)} s`],["Peak Velocity",`${peakVelocity.toFixed(3)} m/s`],...(result.drag_coefficient != null ? [["Drag Coefficient",result.drag_coefficient.toFixed(4)]] : [])].forEach(([l,v],i) => tableRow(l,v,i%2===0));
      y += 4;
      sectionTitle("2. Experimental Context");
      [["Video File",uploadData?.filename??"—"],["Resolution",`${uploadData?.width??"?"}×${uploadData?.height??"?"} @ ${uploadData?.fps??"?"}fps`],["Analysed Frames",`${frameStart} – ${frameEnd}`],["Tracking Mode",result.tracker_mode==="yolo"?"YOLOv8":"HSV Colour"],["Air Resistance",useAirResistance?"Yes":"No"],["Calibration (px/m)",result.px_per_metre.toFixed(2)],...(calibration?[["Cal Pt 1",`(${calibration.x1.toFixed(1)}, ${calibration.y1.toFixed(1)})`],["Cal Pt 2",`(${calibration.x2.toFixed(1)}, ${calibration.y2.toFixed(1)})`],["Cal Distance",`${calibration.real_world_distance_m} m`]]:[]),["App Version",APP_VERSION],["Export Timestamp",new Date().toISOString()]].forEach(([l,v],i) => tableRow(l,v,i%2===0));
      y += 4;
      sectionTitle("3. Quality Metrics");
      [["Detection Rate",`${analysis?.detection_rate?.toFixed(1)??"?"}%`],["Detected Frames",`${analysis?.detected_frames??"?"} / ${analysis?.total_frames??"?"}`],["Points Used for Fit",String(n)],["Parabolic Fit R²",r2.toFixed(4)]].forEach(([l,v],i) => tableRow(l,v,i%2===0));
      y += 4;
      sectionTitle("4. Trajectory Chart");
      const canvas = trajectoryCanvasRef.current;
      if (canvas) {
        const imgData = canvas.toDataURL("image/png");
        const chartW = pageW - margin*2, chartH = chartW*(H/W);
        checkPage(chartH+4);
        doc.addImage(imgData,"PNG",margin,y,chartW,chartH); y += chartH+6;
      }
      sectionTitle("5. Frame-by-Frame Raw Data");
      const cols = ["Frame","t (s)","x (m)","y (m)","vx (m/s)","vy (m/s)","v (m/s)","Status"];
      const colW = (pageW-margin*2)/cols.length;
      checkPage(10);
      doc.setFillColor(127,119,221); doc.rect(margin,y-4,pageW-margin*2,7,"F");
      doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(8);
      cols.forEach((c,i) => doc.text(c, margin+i*colW+1, y)); y += 5;
      doc.setFont("helvetica","normal");
      result.timestamps.forEach((t,i) => {
        checkPage(6);
        const fi = frameStart+i;
        const detected = detectionSet.has(fi);
        const netV = Math.sqrt((vxArr[i]??0)**2+(vyArr[i]??0)**2);
        if (i%2===0) { doc.setFillColor(245,245,250); doc.rect(margin,y-3,pageW-margin*2,6,"F"); }
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
    { label: "Gravity estimate", value: result.estimated_gravity_ms2.toFixed(2), unit: "m/s²", good: Math.abs(result.estimated_gravity_ms2-9.81)<1.0 },
    { label: "Initial velocity", value: result.initial_velocity_ms.toFixed(2), unit: "m/s", good: true },
    { label: "Launch angle", value: result.launch_angle_deg.toFixed(1), unit: "°", good: true },
    { label: "Frames analysed", value: String(n), unit: "frames", good: true },
    ...(result.drag_coefficient!=null?[{label:"Drag coefficient",value:result.drag_coefficient.toFixed(3),unit:"",good:true}]:[]),
  ];

  return (
    <div>
      {/* Metric cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:"12px", marginBottom:"20px" }}>
        {metrics.map(({ label, value, unit, good }) => (
          <div key={label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"12px", padding:"16px" }}>
            <div style={{ fontSize:"11px", color:"rgba(255,255,255,0.4)", marginBottom:"6px" }}>{label}</div>
            <div style={{ fontSize:"22px", fontWeight:700, fontFamily:"monospace", color:good?"#fff":"#FF8080" }}>
              {value}<span style={{ fontSize:"13px", fontWeight:400, color:"rgba(255,255,255,0.4)", marginLeft:"4px" }}>{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quality badges */}
      {analysis?.detection_rate != null && (
        <div style={{ display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap" }}>
          <QBadge good={analysis.detection_rate>=80} label={`Detection rate: ${analysis.detection_rate.toFixed(1)}% (${analysis.detected_frames}/${analysis.total_frames} frames)`} />
          <QBadge good={r2>=0.98} label={`Parabolic fit R² = ${r2.toFixed(4)}`} />
        </div>
      )}

      {/* ── Full-width video player ── */}
      <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"12px", overflow:"hidden", marginBottom:"16px" }}>
        {/* Tabs */}
        <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          {(["original","overlay"] as const).map(tab => (
            <button key={tab} onClick={() => setVideoTab(tab)} style={{
              flex:1, padding:"10px", fontSize:"12px", fontWeight:600, border:"none", cursor:"pointer",
              background: videoTab===tab ? "rgba(127,119,221,0.15)" : "transparent",
              color: videoTab===tab ? "#AFA9EC" : "rgba(255,255,255,0.35)",
              borderBottom: videoTab===tab ? "2px solid #7F77DD" : "2px solid transparent",
            }}>
              {tab === "original" ? "Original" : "Overlay (annotated)"}
            </button>
          ))}
        </div>

        {/* Video */}
        <div style={{ position:"relative", background:"#0a0a12" }}>
          {videoTab === "original" && originalVideoUrl && (
            <video ref={videoRef} src={originalVideoUrl} controls style={{ width:"100%", display:"block", maxHeight:"500px" }} />
          )}
          {videoTab === "overlay" && (
            overlayVideoUrl
              ? <video src={overlayVideoUrl} controls style={{ width:"100%", display:"block", maxHeight:"500px" }} />
              : <div style={{ padding:"48px", textAlign:"center", color:"rgba(255,255,255,0.25)", fontSize:"13px" }}>No overlay available — re-run analysis to generate one</div>
          )}
          {videoTab === "original" && (
            <div style={{ position:"absolute", top:"8px", right:"8px",
              background: currentDetected ? "rgba(93,202,165,0.2)" : "rgba(255,180,0,0.15)",
              border:`1px solid ${currentDetected?"rgba(93,202,165,0.4)":"rgba(255,180,0,0.3)"}`,
              borderRadius:"6px", padding:"3px 8px", fontSize:"10px",
              color: currentDetected?"#5DCAA5":"#FFB400" }}>
              {currentDetected ? "✓ detected" : "interpolated"}
            </div>
          )}
        </div>

        {/* Frame nav — only original */}
        {videoTab === "original" && (
          <div style={{ padding:"14px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
              <span style={{ fontSize:"11px", fontFamily:"monospace", color:"rgba(255,255,255,0.5)" }}>frame {currentAbsFrame} / {frameEnd}</span>
              <span style={{ fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>t = {result.timestamps[currentFrameIdx]?.toFixed(3) ?? "—"} s</span>
            </div>
            <div style={{ display:"flex", gap:"6px", alignItems:"center", flexWrap:"wrap", marginBottom:"10px" }}>
              <NavBtn onClick={() => goToFrame(0)} label="⏮" title="First" />
              <NavBtn onClick={() => goToFrame(currentFrameIdx - jumpSize)} label={`−${jumpSize}`} title={`Back ${jumpSize}`} />
              <NavBtn onClick={() => goToFrame(currentFrameIdx - 1)} label="←" title="Prev" />
              <NavBtn onClick={() => goToFrame(currentFrameIdx + 1)} label="→" title="Next" />
              <NavBtn onClick={() => goToFrame(currentFrameIdx + jumpSize)} label={`+${jumpSize}`} title={`Fwd ${jumpSize}`} />
              <NavBtn onClick={() => goToFrame(totalAnalysedFrames - 1)} label="⏭" title="Last" />
              <div style={{ display:"flex", alignItems:"center", gap:"4px", marginLeft:"auto" }}>
                <span style={{ fontSize:"11px", color:"rgba(255,255,255,0.35)" }}>jump</span>
                <input type="number" min={1} max={totalAnalysedFrames} value={jumpInput}
                  onChange={e => setJumpInput(e.target.value)}
                  onBlur={() => { const v = parseInt(jumpInput); if (!isNaN(v) && v > 0) setJumpSize(v); else setJumpInput(String(jumpSize)); }}
                  style={{ width:"44px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"6px", padding:"4px 6px", color:"#fff", fontSize:"11px", textAlign:"center" }} />
                <span style={{ fontSize:"11px", color:"rgba(255,255,255,0.35)" }}>frames</span>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:"6px" }}>
              {[["x", `${currentX} m`],["y", `${currentY} m`],["|v|", `${currentNetV} m/s`],["vx", `${currentVx} m/s`],["vy", `${currentVy} m/s`],["t", `${result.timestamps[currentFrameIdx]?.toFixed(3)??"—"} s`]].map(([label, val]) => (
                <div key={label} style={{ background:"rgba(255,255,255,0.03)", borderRadius:"6px", padding:"5px 8px" }}>
                  <div style={{ fontSize:"9px", color:"rgba(255,255,255,0.3)", marginBottom:"2px" }}>{label}</div>
                  <div style={{ fontSize:"11px", fontFamily:"monospace", color:"#fff" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Full-width trajectory chart ── */}
      <div style={{ background:"#0d0d1a", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"12px", padding:"16px", marginBottom:"16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
          <div style={{ fontSize:"13px", fontWeight:600 }}>Trajectory</div>
          <div style={{ display:"flex", gap:"16px", alignItems:"center" }}>
            <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.3)" }}>scroll to zoom · drag to pan · hover for data · click to seek</span>
            {zoom !== 1 && (
              <button onClick={() => { setZoom(1); setPan({ x:0, y:0 }); }} style={{ fontSize:"11px", background:"rgba(127,119,221,0.15)", border:"1px solid rgba(127,119,221,0.3)", color:"#AFA9EC", borderRadius:"6px", padding:"3px 8px", cursor:"pointer" }}>
                Reset zoom
              </button>
            )}
            <LegendDot color="#FFD700" label="tracked" dashed={false} />
            <LegendDot color="rgba(255,255,255,0.8)" label="current" dashed={false} dot />
            {showGhost && result.predicted_trajectory && <LegendDot color="rgba(127,119,221,0.9)" label="ghost" dashed />}
          </div>
        </div>
        <canvas
          ref={trajectoryCanvasRef}
          width={W} height={H}
          style={{ width:"100%", borderRadius:"6px", cursor: hoverPoint ? "pointer" : panning ? "grabbing" : "crosshair" }}
          onMouseMove={handleCanvasMouseMove}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setHoverPoint(null); isPanning.current = false; setPanning(false); }}
        />
        <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
          <Toggle label="Ghost" value={showGhost} onChange={setShowGhost} disabled={!result.predicted_trajectory} />
          <Toggle label="Strobe" value={showStrobe} onChange={setShowStrobe} />
        </div>
      </div>

      {/* Tracker mode badge */}
      {result.tracker_mode && (
        <div style={{ marginBottom:"16px" }}>
          <span style={{ fontSize:"11px", padding:"4px 10px", borderRadius:"20px", fontWeight:500,
            background:result.tracker_mode==="yolo"?"rgba(93,202,165,0.1)":"rgba(255,255,255,0.05)",
            border:result.tracker_mode==="yolo"?"1px solid rgba(93,202,165,0.3)":"1px solid rgba(255,255,255,0.1)",
            color:result.tracker_mode==="yolo"?"#5DCAA5":"rgba(255,255,255,0.4)" }}>
            Tracker: {result.tracker_mode==="yolo"?"YOLOv8":"HSV colour"}
          </span>
        </div>
      )}

      {/* Export buttons */}
      <div style={{ display:"flex", gap:"10px" }}>
        <button onClick={handleExportPDF} disabled={exportingPdf} style={{ background:exportingPdf?"rgba(127,119,221,0.4)":"#7F77DD", color:"#fff", border:"none", padding:"10px 20px", borderRadius:"10px", fontSize:"13px", fontWeight:600, cursor:exportingPdf?"not-allowed":"pointer" }}>
          {exportingPdf ? "⏳ Generating…" : "↓ Export PDF"}
        </button>
        <button onClick={handleExportCSV} style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.6)", padding:"10px 20px", borderRadius:"10px", fontSize:"13px", cursor:"pointer" }}>
          ↓ Export CSV
        </button>
      </div>
    </div>
  );
}

function NavBtn({ onClick, label, title }: { onClick: () => void; label: string; title: string }) {
  return (
    <button onClick={onClick} title={title} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff", borderRadius:"6px", padding:"5px 10px", fontSize:"12px", cursor:"pointer", fontFamily:"monospace" }}>
      {label}
    </button>
  );
}

function QBadge({ good, label }: { good: boolean; label: string }) {
  return (
    <span style={{ fontSize:"12px", padding:"4px 12px", borderRadius:"20px",
      background:good?"rgba(93,202,165,0.1)":"rgba(255,180,0,0.1)",
      border:`1px solid ${good?"rgba(93,202,165,0.3)":"rgba(255,180,0,0.3)"}`,
      color:good?"#5DCAA5":"#FFB400" }}>
      {label}
    </span>
  );
}

function LegendDot({ color, label, dashed, dot }: { color: string; label: string; dashed: boolean; dot?: boolean }) {
  return (
    <span style={{ fontSize:"10px", color, display:"flex", alignItems:"center", gap:"4px" }}>
      {dot
        ? <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:color, display:"inline-block" }} />
        : <span style={{ width:"12px", height:"2px", background:dashed?"transparent":color, borderTop:dashed?`1.5px dashed ${color}`:"none", display:"inline-block" }} />}
      {label}
    </span>
  );
}

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!value)} style={{ display:"flex", alignItems:"center", gap:"6px",
      background:value?"rgba(127,119,221,0.12)":"rgba(255,255,255,0.03)",
      border:`1px solid ${value?"rgba(127,119,221,0.3)":"rgba(255,255,255,0.08)"}`,
      borderRadius:"8px", padding:"6px 12px", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1 }}>
      <div style={{ width:"28px", height:"16px", borderRadius:"8px", background:value?"#7F77DD":"rgba(255,255,255,0.1)", position:"relative", flexShrink:0 }}>
        <div style={{ width:"10px", height:"10px", borderRadius:"50%", background:"#fff", position:"absolute", top:"3px", left:value?"15px":"3px", transition:"left 0.15s" }} />
      </div>
      <span style={{ fontSize:"12px", color:value?"#AFA9EC":"rgba(255,255,255,0.4)" }}>{label}</span>
    </button>
  );
}
