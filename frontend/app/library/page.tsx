"use client";
import { useState } from "react";
import Navbar from "../components/Navbar";
import ResultsPanel from "../components/ResultsPanel";
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

export default function LibraryPage() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<SampleVideo | null>(null);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [result, setResult] = useState<PhysicsResult | null>(null);

  async function handleAnalyse(video: SampleVideo) {
    setLoadingId(video.id);
    setError(null);
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
        setUploadData(upload);
        setAnalysis(res);
        setResult(res.result);
        setActive(video);
      } else {
        setError(res.error ?? "Analysis failed.");
      }
    } catch {
      setError("Could not analyse this video. Please try again.");
    } finally {
      setLoadingId(null);
    }
  }

  function reset() {
    setActive(null); setUploadData(null); setAnalysis(null); setResult(null); setError(null);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", color: "#111827", fontFamily: "system-ui, sans-serif" }}>
      <Navbar />
      <main style={{ maxWidth: result ? "1440px" : "900px", margin: "0 auto", padding: "40px 2rem", transition: "max-width 0.25s ease" }}>
        {!result ? (
          <>
            <div style={{ marginBottom: "28px" }}>
              <h1 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "6px" }}>
                Video Library
              </h1>
              <p style={{ fontSize: "14px", color: "#6b7280" }}>
                No video to upload? Pick one below and see the physics results instantly — calibration and frame selection are already set up for you.
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
                    <button
                      onClick={() => handleAnalyse(video)}
                      disabled={loadingId === video.id}
                      style={{
                        width: "100%", background: loadingId === video.id ? "#86efac" : G, color: "#fff", border: "none",
                        padding: "10px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
                        cursor: loadingId === video.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {loadingId === video.id ? "Analysing…" : "Analyse this video →"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h1 style={{ fontSize: "22px", fontWeight: 700 }}>{active?.name}</h1>
                <p style={{ fontSize: "13px", color: "#6b7280" }}>Results from the video library</p>
              </div>
              <button onClick={reset} style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280", fontSize: "13px", cursor: "pointer", padding: "8px 16px", borderRadius: "8px" }}>
                ← Back to library
              </button>
            </div>
            <ResultsPanel
              result={result}
              analysis={analysis}
              uploadData={uploadData}
              calibration={active?.calibration}
              frameRange={active?.frameRange}
              useAirResistance={active?.useAirResistance}
            />
          </>
        )}
      </main>
    </div>
  );
}
