"use client";

// Recording overlay: full-screen beat reader with waveform and three transport
// buttons (Re-record / Skip / Record). Recording itself is wired in a later
// pass — for first launch the UI exists and beat state can be advanced.

import { apiGet, apiPatch } from "@/lib/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Beat {
  id: string;
  beat_number: number;
  cue_label: string | null;
  beat_text: string;
  estimated_seconds: number | null;
  word_count: number | null;
  citation_count: number;
  state: string;
  recording_uri: string | null;
}

export default function RecordingPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const productionId = sp.get("id");
  const [beats, setBeats] = useState<Beat[]>([]);
  const [idx, setIdx] = useState(0);

  async function load() {
    if (!productionId) return;
    const res = await apiGet<{ beats: Beat[] }>(`/v1/productions/${productionId}/beats`);
    setBeats(res.beats);
    const firstUnfinished = res.beats.findIndex((b) => b.state === "pending");
    setIdx(firstUnfinished >= 0 ? firstUnfinished : 0);
  }
  useEffect(() => {
    void load();
  }, [productionId]);

  if (!productionId) {
    return <main className="p-4 font-serif italic text-text-dim">No production id.</main>;
  }
  if (beats.length === 0) {
    return <main className="p-4 font-serif italic text-text-dim">No beats yet.</main>;
  }
  const current = beats[idx];
  if (!current) return null;

  async function setBeatState(state: "good" | "skipped" | "rerecord") {
    if (!current) return;
    await apiPatch(`/v1/productions/beats/${current.id}`, { state });
    if (state === "good" || state === "skipped") {
      if (idx + 1 >= beats.length) {
        router.push("/studio");
        return;
      }
      setIdx(idx + 1);
    }
    await load();
  }

  return (
    <main className="fixed inset-0 z-30 flex flex-col bg-bg-deeper">
      <header className="flex items-center justify-between border-b border-border-soft px-4 py-3">
        <button
          type="button"
          onClick={() => router.push("/studio")}
          className="font-mono text-[10.5px] uppercase tracking-wider text-text-dim"
        >
          ← Back
        </button>
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-cream-bright">
          Beat {current.beat_number} of {beats.length}
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-wider text-signal">● REC</div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8">
        {current.cue_label && (
          <div className="mb-4 font-mono text-[10.5px] uppercase tracking-wider text-amber">
            CUE · {current.cue_label}
          </div>
        )}
        <p className="font-serif text-[26px] leading-relaxed text-cream-bright">
          {current.beat_text}
        </p>
        <div className="mt-6 font-mono text-[10.5px] uppercase tracking-wider text-text-dim">
          {current.word_count ?? "—"} words · {current.estimated_seconds ?? "—"}s ·{" "}
          {current.citation_count} citations
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border-soft p-3">
        <button
          type="button"
          onClick={() => setBeatState("rerecord")}
          className="border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-text-dim"
        >
          Re-record
        </button>
        <button
          type="button"
          onClick={() => setBeatState("good")}
          className="border border-signal bg-signal-glow py-3 font-mono text-[11px] uppercase tracking-wider text-signal"
        >
          ● Record Good
        </button>
        <button
          type="button"
          onClick={() => setBeatState("skipped")}
          className="border border-border py-3 font-mono text-[11px] uppercase tracking-wider text-text-dim"
        >
          Skip
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(8px,1fr))] gap-1 border-t border-border-soft px-4 py-2">
        {beats.map((b, i) => (
          <span
            key={b.id}
            className={`h-2 ${i < idx ? "bg-sage" : i === idx ? "bg-signal" : "bg-border-soft"}`}
          />
        ))}
      </div>
    </main>
  );
}
