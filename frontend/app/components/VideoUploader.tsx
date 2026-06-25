"use client";
import { useState } from "react";
import { uploadVideo } from "../lib/api";
import { UploadResponse } from "../types/analysis";

interface Props {
  onUploaded: (data: UploadResponse) => void;
}

export default function VideoUploader({ onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      const data = await uploadVideo(file);
      onUploaded(data);
    } catch {
      setError("Upload failed. Make sure the backend is running on port 8000.");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      {/* Drop zone */}
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: "16px", padding: "56px 32px", borderRadius: "14px", cursor: loading ? "not-allowed" : "pointer",
          border: `2px dashed ${dragging ? "#7F77DD" : "rgba(255,255,255,0.12)"}`,
          background: dragging ? "rgba(127,119,221,0.08)" : "rgba(255,255,255,0.02)",
          transition: "all 0.2s",
        }}
      >
        {/* Icon */}
        <div style={{
          width: "56px", height: "56px", borderRadius: "50%",
          background: "rgba(127,119,221,0.12)", border: "1px solid rgba(127,119,221,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px",
        }}>
          {loading ? "⏳" : "🎬"}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#fff", marginBottom: "6px" }}>
            {loading ? "Uploading…" : "Drop your video here"}
          </div>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)" }}>
            MP4, MOV, AVI · or <span style={{ color: "#7F77DD", textDecoration: "underline" }}>browse files</span>
          </div>
        </div>

        <input
          type="file"
          accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
          onChange={handleFileChange}
          disabled={loading}
          style={{ display: "none" }}
        />
      </label>

      {/* Supported formats note */}
      <div style={{ marginTop: "16px", display: "flex", gap: "8px", justifyContent: "center" }}>
        {["MP4", "MOV", "AVI", "WEBM"].map(fmt => (
          <span key={fmt} style={{
            fontSize: "11px", padding: "3px 8px", borderRadius: "6px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.3)",
          }}>{fmt}</span>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginTop: "16px", background: "rgba(220,50,50,0.1)",
          border: "1px solid rgba(220,50,50,0.3)", borderRadius: "10px",
          padding: "12px 16px", fontSize: "13px", color: "#FF8080",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
