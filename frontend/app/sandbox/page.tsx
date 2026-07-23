"use client";
import { useState } from "react";
import Navbar from "../components/Navbar";
import SandboxTrajectory from "../components/SandboxTrajectory";

const PRESETS = [
  { label: "Earth, no drag", v0: 15, angleDeg: 45, g: 9.81, dragCoeff: 0 },
  { label: "Moon gravity", v0: 15, angleDeg: 45, g: 1.62, dragCoeff: 0 },
  { label: "Mars gravity", v0: 15, angleDeg: 45, g: 3.71, dragCoeff: 0 },
  { label: "Heavy air drag", v0: 15, angleDeg: 45, g: 9.81, dragCoeff: 0.08 },
];

export default function SandboxPage() {
  const [presetParams, setPresetParams] = useState(PRESETS[0]);
  const [key, setKey] = useState(0); // force a clean remount when a preset is picked

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", color: "#111827", fontFamily: "system-ui, sans-serif" }}>
      <Navbar />
      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 2rem" }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px" }}>
            Sandbox Mode
          </h1>
          <p style={{ fontSize: "14px", color: "#6b7280", maxWidth: "640px" }}>
            Explore projectile motion freely — drag the sliders to change gravity, launch velocity, angle, and air resistance. The dashed purple curve updates live.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setPresetParams(p); setKey(k => k + 1); }}
              style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "20px", cursor: "pointer", background: "#fff", border: "1px solid #e9d5ff", color: "#7c3aed", fontWeight: 500 }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <SandboxTrajectory key={key} initialParams={presetParams} />
        </div>

        <div style={{ marginTop: "20px", padding: "16px 20px", background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: "12px", fontSize: "13px", color: "#581c87", lineHeight: 1.6 }}>
          <strong>Try this:</strong> drag the launch angle from 70° toward 90°. Range collapses fast while max height barely moves — that's <code>range = v0²·sin(2θ)/g</code> heading to zero as θ→90°, while height (<code>v0²·sin²θ/(2g)</code>) keeps climbing. A steep, narrow arc versus a low, wide one.
        </div>
      </main>
    </div>
  );
}
