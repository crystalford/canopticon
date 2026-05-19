"use client";

// Recording overlay — full-screen one-beat-at-a-time reader. Uses
// MediaRecorder for capture; uploads per take to the studio backend.
// Pause/resume is first-class: an operator can leave for days and come
// back to the same beat.

import { apiGet, apiUpload } from "@/lib/api-client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Beat {
  id: string;
  beat_index: number;
  role: string;
  cue: string | null;
  beat_text: string;
  next_preview: string | null;
  target_seconds: number;
  recorded: number;
}

interface Production {
  id: string;
  title: string;
  state: string;
}

export default function RecordPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productionId = params?.id ?? "";

  const [production, setProduction] = useState<Production | null>(null);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [idx, setIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  async function load() {
    const r = await apiGet<{ production: Production; beats: Beat[] }>(
      `/v1/studio/productions/${productionId}`,
    );
    setProduction(r.production);
    setBeats(r.beats);
    const firstUnrecorded = r.beats.findIndex((b) => b.recorded === 0);
    setIdx(firstUnrecorded >= 0 ? firstUnrecorded : 0);
  }
  useEffect(() => {
    if (productionId) void load();
  }, [productionId]);

  const current = beats[idx];

  async function startRecording() {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        for (const t of stream.getTracks()) t.stop();
      };
      rec.start();
      mediaRecorderRef.current = rec;
      startTimeRef.current = Date.now();
      setRecording(true);
    } catch (err) {
      alert(`Microphone access denied: ${(err as Error).message}`);
    }
  }

  function stopRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = mediaRecorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(null);
        return;
      }
      rec.addEventListener(
        "stop",
        () => {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType });
          resolve(blob);
        },
        { once: true },
      );
      rec.stop();
      setRecording(false);
    });
  }

  async function markGoodAndNext() {
    if (!current) return;
    const blob = await stopRecording();
    if (!blob) return;
    const durationMs = Date.now() - startTimeRef.current;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("audio", blob, `take.webm`);
      form.append("duration_ms", String(durationMs));
      await apiUpload(`/v1/studio/beats/${current.id}/audio`, form);
      await load();
      // Advance to next unrecorded
      const next = beats.findIndex((b, i) => i > idx && b.recorded === 0);
      setIdx(next >= 0 ? next : Math.min(idx + 1, beats.length - 1));
    } finally {
      setUploading(false);
    }
  }

  async function retake() {
    await stopRecording();
    chunksRef.current = [];
  }

  if (!production || !current) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          color: "var(--ink-mute)",
        }}
      >
        Loading…
      </div>
    );
  }

  const recordedCount = beats.filter((b) => b.recorded === 1).length;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--paper)",
        color: "var(--ink)",
      }}
    >
      <header
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid var(--rule)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-mute)" }}>
            STUDIO · {production.title}
          </div>
          <div style={{ fontSize: 14, color: "var(--ink-3)" }}>
            Beat {idx + 1} / {beats.length} · {recordedCount} recorded
          </div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {recording && (
            <span
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--signal)",
                animation: "pulse 1s infinite",
              }}
            >
              ● REC
            </span>
          )}
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => router.push("/studio")}
          >
            Exit
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: 6, padding: "12px 24px" }}>
        {beats.map((b, i) => (
          <span
            key={b.id}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background:
                i === idx
                  ? "var(--signal)"
                  : b.recorded
                    ? "var(--ink-3)"
                    : "var(--rule)",
            }}
          />
        ))}
      </div>

      <main
        style={{
          flex: 1,
          padding: "48px 24px",
          maxWidth: 800,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {current.cue && (
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-mute)",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: 1.5,
            }}
          >
            {current.cue} · {current.role} · ~{current.target_seconds}s
          </div>
        )}
        <p
          style={{
            fontFamily: "var(--serif, var(--sans))",
            fontSize: 32,
            lineHeight: 1.55,
            color: "var(--ink)",
          }}
        >
          {current.beat_text}
        </p>
        {current.next_preview && (
          <p
            style={{
              marginTop: 36,
              fontSize: 14,
              fontStyle: "italic",
              color: "var(--ink-mute)",
            }}
          >
            Next: {current.next_preview}
          </p>
        )}
      </main>

      <footer
        style={{
          padding: "20px 24px",
          borderTop: "1px solid var(--rule)",
          display: "flex",
          gap: 12,
          justifyContent: "center",
        }}
      >
        {!recording && !uploading && (
          <button
            type="button"
            className="btn signal-primary"
            onClick={() => void startRecording()}
          >
            ● Record
          </button>
        )}
        {recording && (
          <>
            <button type="button" className="btn ghost" onClick={() => void retake()}>
              Retake
            </button>
            <button
              type="button"
              className="btn primary"
              onClick={() => void markGoodAndNext()}
            >
              Mark good · Next
            </button>
          </>
        )}
        {uploading && (
          <span className="mono" style={{ color: "var(--ink-mute)" }}>
            Uploading…
          </span>
        )}
        {!recording && !uploading && idx > 0 && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => setIdx(Math.max(0, idx - 1))}
          >
            ← Prev beat
          </button>
        )}
        {!recording && !uploading && idx < beats.length - 1 && (
          <button
            type="button"
            className="btn ghost"
            onClick={() => setIdx(Math.min(beats.length - 1, idx + 1))}
          >
            Next beat →
          </button>
        )}
      </footer>
    </div>
  );
}
