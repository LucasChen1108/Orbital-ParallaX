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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
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

  return (
    <div>
      <h2>Step 1 — Upload Video</h2>
      <input
        type="file"
        accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
        onChange={handleFileChange}
        disabled={loading}
      />
      {loading && <p>Uploading...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}