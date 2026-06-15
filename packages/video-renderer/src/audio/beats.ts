// Beat detection — librosa.beat.beat_track over the music bed (or the
// broadcast audio when no bed is configured). Returns the timestamps,
// in seconds, where the orchestrator can snap cut points to land on
// the beat.
//
// Per the handoff §6 / Research B: "moderate-tempo, sync the *turn* to
// a beat or silence, don't beat-cut every line." So the orchestrator
// uses these to nudge the forensic_turn beat (and the cold_open) into
// alignment, not to beat-cut everywhere.

import { spawn } from "node:child_process";

export interface BeatTrack {
  ok: boolean;
  tempo_bpm?: number;
  beats_s?: number[];
  error?: string;
}

export async function detectBeats(audioPath: string): Promise<BeatTrack> {
  // Inline python script — short enough that we don't need a separate
  // .py file. Reads the audio, calls librosa.beat.beat_track, prints
  // JSON to stdout. The Container's Dockerfile installs librosa.
  const script = `
import sys, json, warnings
warnings.filterwarnings("ignore")
import librosa
y, sr = librosa.load(sys.argv[1], sr=None, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
print(json.dumps({"tempo_bpm": float(tempo), "beats_s": [float(b) for b in beats]}))
`;
  return new Promise((resolve) => {
    const child = spawn("python3", ["-c", script, audioPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b: Buffer) => {
      stdout += b.toString("utf8");
    });
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        return resolve({ ok: false, error: stderr.slice(-300) || `exit ${code}` });
      }
      try {
        const parsed = JSON.parse(stdout.trim()) as {
          tempo_bpm: number;
          beats_s: number[];
        };
        resolve({ ok: true, tempo_bpm: parsed.tempo_bpm, beats_s: parsed.beats_s });
      } catch (e) {
        resolve({ ok: false, error: (e as Error).message });
      }
    });
    child.on("error", (err: Error) => resolve({ ok: false, error: err.message }));
  });
}

/** Snap a target time (seconds) to the nearest beat within `windowS`
 *  seconds. If no beat is inside the window, returns the original
 *  target — beat-sync is a *nudge*, not a hard constraint. */
export function snapToBeat(targetS: number, beats: number[], windowS = 0.4): number {
  if (!beats.length) return targetS;
  let best = targetS;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const b of beats) {
    const d = Math.abs(b - targetS);
    if (d < bestDelta && d <= windowS) {
      bestDelta = d;
      best = b;
    }
  }
  return best;
}
