"use client";
import { useState } from "react";
import Navbar from "../components/Navbar";
import ResultsPanel from "../components/ResultsPanel";
import AnalysisFlow from "../components/AnalysisFlow";
import { uploadVideo, analyseVideo } from "../lib/api";
import { SAMPLE_VIDEOS, SampleVideo } from "../lib/sampleVideos";
import { UploadResponse, AnalysisResponse, PhysicsResult } from "../types/analysis";

const G = "#2563a8";

async function sampleVideoToFile(url: string, filename: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load sample video.");
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "video/mp4" });
}

type ViewState =
  | { kind: "grid" }
  | { kind: "preview"; video: SampleVideo; uploadData: UploadResponse; analysis: AnalysisResponse; result: PhysicsResult }
  | { kind: "guided"; video: SampleVideo; uploadData: UploadResponse };

export default function LibraryPage() {
  const [view, setView] = useState<ViewState>({ kind: "grid" });
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<"preview" | "guided" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleQuickPreview(video: SampleVideo) {
    setLoadingId(video.id); setLoadingMode("preview"); setError(null);
    try {
      const file = await sampleVideoToFile(video.videoUrl, `${video.id}.mp4`);
      const upload = await uploadVideo(file);
      const res = await analyseVideo(
        upload.video_id,
        video.frameRange,
        video.calibration,
        [], [],
        video.useAirResistance,
        video.method,
      );
      if (res.status === "success" && res.result) {
        setView({ kind: "preview", video, uploadData: upload, analysis: res, result: res.result });
      } else {
        setError(res.error ?? "Analysis failed.");
      }
    } catch {
      setError("Could not analyse this video. Please try again.");
    } finally {
      setLoadingId(null); setLoadingMode(null);
    }
  }

  async function handleTryYourself(video: SampleVideo) {
    setLoadingId(video.id); setLoadingMode("guided"); setError(null);
    try {
      const file = await sampleVideoToFile(video.videoUrl, `${video.id}.mp4`);
      const upload = await uploadVideo(file);
      setView({ kind: "guided", video, uploadData: upload });
    } catch {
      setError("Could not load this video. Please try again.");
    } finally {
      setLoadingId(null); setLoadingMode(null);
    }
  }

  function backToGrid() {
    setView({ kind: "grid" }); setError(null);
  }

  if (view.kind === "guided") {
    return (
      <AnalysisFlow
        initialUpload={view.uploadData}
        intervalHint={view.video.intervalHintText}
        calibrationHint={view.video.calibrationHintText}
        onExit={backToGrid}
        exitLabel="← Back to library"
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", color: "#111827", fontFamily: "system-ui, sans-serif" }}>
      <Navbar />
      <main style={{ maxWidth: view.kind === "preview" ? "1440px" : "900px", margin: "0 auto", padding: "40px 2rem", transition: "max-width 0.25s ease" }}>
        {view.kind === "grid" ? (
          <>
            <div style={{ marginBottom: "28px" }}>
              <h1 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px" }}>
                Video Library
              </h1>
              <p style={{ fontSize: "14px", color: "#6b7280" }}>
                No video to upload? Pick one below — see the results instantly, or walk through calibration and frame selection yourself with guidance along the way.
              </p>
            </div>

            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "#dc2626", marginBottom: "20px" }}>
                {error}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              {SAMPLE_VIDEOS.map(video => (
                <div key={video.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <video src={video.videoUrl} controls muted preload="metadata" style={{ width: "100%", display: "block", background: "#000", maxHeight: "220px" }} />
                  <div style={{ padding: "16px" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px" }}>{video.name}</div>
                    <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "14px" }}>{video.description}</div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        onClick={() => handleTryYourself(video)}
                        disabled={loadingId === video.id}
                        style={{
                          flex: "1 1 auto",
                          background: loadingId === video.id && loadingMode === "guided" ? "#86efac" : G, color: "#fff", border: "none",
                          padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
                          cursor: loadingId === video.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {loadingId === video.id && loadingMode === "guided" ? "Loading…" : "Try it yourself →"}
                      </button>
                      <button
                        onClick={() => handleQuickPreview(video)}
                        disabled={loadingId === video.id}
                        style={{
                          flex: "1 1 auto",
                          background: "#fff", color: G, border: `1px solid ${G}`,
                          padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
                          cursor: loadingId === video.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {loadingId === video.id && loadingMode === "preview" ? "Analysing…" : "Quick preview"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: 700 }}>{view.video.name}</h1>
                <p style={{ fontSize: "13px", color: "#6b7280" }}>Quick preview from the video library</p>
              </div>
              <button onClick={backToGrid} style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280", fontSize: "13px", cursor: "pointer", padding: "8px 16px", borderRadius: "8px" }}>
                ← Back to library
              </button>
            </div>
            <ResultsPanel
              result={view.result}
              analysis={view.analysis}
              uploadData={view.uploadData}
              calibration={view.video.calibration}
              frameRange={view.video.frameRange}
              useAirResistance={view.video.useAirResistance}
            />
          </>
        )}
      </main>
    </div>
  );
}
