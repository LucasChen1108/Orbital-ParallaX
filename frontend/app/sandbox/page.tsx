"use client";
import Navbar from "../components/Navbar";
import SandboxTrajectory from "../components/SandboxTrajectory";

export default function SandboxPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", color: "#111827", fontFamily: "system-ui, sans-serif" }}>
      <Navbar />
      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 2rem" }}>
        <div style={{ marginBottom: "28px" }}>
          <h1 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px", color: "#111827" }}>
            Sandbox Mode
          </h1>
          <p style={{ fontSize: "14px", color: "#6b7280" }}>
            Explore projectile motion freely — adjust gravity, velocity, launch angle, and drag to see how each one shapes the trajectory.
          </p>
        </div>
        <div style={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "32px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <SandboxTrajectory />
        </div>
      </main>
    </div>
  );
}
