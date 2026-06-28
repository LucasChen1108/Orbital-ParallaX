"use client";
import { useState } from "react";
import { uploadVideo } from "../lib/api";
import { UploadResponse } from "../types/analysis";

const G = "#2563a8";

interface Props {
  onUploaded: (data: UploadResponse) => void;
}

export default function VideoUploader({ onUploaded }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setLoading(true); setError(null);
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
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <label
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: "16px", padding: "56px 32px", borderRadius: "14px",
          cursor: loading ? "not-allowed" : "pointer",
          border: `2px dashed ${dragging ? G : "#d1d5db"}`,
          background: dragging ? "#eff6ff" : "#f9fafb",
          transition: "all 0.2s",
        }}
      >
        <div style={{
          width: "64px", height: "64px", borderRadius: "50%",
          background: "#eff6ff", border: `1px solid #bfdbfe`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px",
        }}>
          {loading ? "⏳" : "🎬"}
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111827", marginBottom: "6px" }}>
            {loading ? "Uploading…" : "Drop your video here"}
          </div>
          <div style={{ fontSize: "13px", color: "#6b7280" }}>
            MP4, MOV, AVI · or{" "}
            <span style={{ color: G, textDecoration: "underline", fontWeight: 500 }}>browse files</span>
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

      <div style={{ marginTop: "14px", display: "flex", gap: "8px", justifyContent: "center" }}>
        {["MP4", "MOV", "AVI", "WEBM"].map(fmt => (
          <span key={fmt} style={{
            fontSize: "11px", padding: "3px 10px", borderRadius: "6px",
            background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#6b7280",
          }}>{fmt}</span>
        ))}
      </div>

      {error && (
        <div style={{
          marginTop: "16px", background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "#dc2626",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
