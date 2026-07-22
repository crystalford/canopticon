// Audio mix — narrator VO + ducked broadcast surface audio + music bed.
//
// Per beat:
//   - If beat.vo is non-null: narrate via MiniMax, place at beat.t_in_s
//   - If beat.clip.audio = "surface": surface the broadcast at -3dB,
//     but duck to -15dB whenever a narrator track overlaps
//   - If beat.clip.audio = "ducked": surface at -12dB throughout, no
//     extra dip when VO overlaps
//   - If beat.clip.audio = "mute": clip is silent
//   - Music bed runs at -18dB throughout, with an extra -3dB cut
//     starting at music.drop_at_s
//
// Produced as a single AAC track that the orchestrator muxes into
// the final MP4 alongside the Remotion render's video track.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Segment } from "@canopticon/shared/video/segment-schema";
import { narrate } from "./narrator";

const MUSIC_BED_DIR = "/app/audio-beds"; // bundled in the Container image

export interface MixResult {
  ok: boolean;
  audioPath?: string;
  narrator_seconds?: number;
  error?: string;
}

interface MixArgs {
  segment: Segment;
  /** Resolved clip paths from the orchestrator's pre-pass (clip src
   *  rewritten to local /tmp). Keyed by the ORIGINAL clip.src so we
   *  can resolve per beat. */
  clipPaths: Record<string, string>;
  minimaxApiKey?: string | undefined;
}

export async function mixSegmentAudio(args: MixArgs): Promise<MixResult> {
  const workDir = join(tmpdir(), `mix-${args.segment.id}-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  // Step 1: synthesise narrator MP3s per voiced beat.
  const narratorTracks: Array<{ t_in_s: number; mp3Path: string; duration_s: number }> = [];
  let narrator_seconds = 0;
  for (const beat of args.segment.beats) {
    if (!beat.vo) continue;
    // Skip [OPERATOR: ...] placeholder lines — those are review-gate
    // markers, not real narration.
    if (beat.vo.startsWith("[OPERATOR")) continue;
    const n = await narrate({
      text: beat.vo,
      voice_id: args.segment.voice.voice_id,
      apiKey: args.minimaxApiKey,
    });
    if (!n.ok || !n.mp3Path) continue;
    const dur = await durationOf(n.mp3Path);
    narratorTracks.push({ t_in_s: beat.t_in_s, mp3Path: n.mp3Path, duration_s: dur });
    narrator_seconds += dur;
  }

  // Step 2: extract surface-audio segments from each fetched clip
  // (using the clip's local path), aligned to the beat window.
  const surfaceTracks: Array<{ t_in_s: number; wavPath: string; level_db: number }> = [];
  for (const beat of args.segment.beats) {
    if (!beat.clip) continue;
    if (beat.clip.audio === "mute") continue;
    const localPath = args.clipPaths[beat.clip.src];
    if (!localPath) continue;
    const wav = join(workDir, `surface-${beat.t_in_s}.wav`);
    const err = await extractAudio(localPath, wav);
    if (err) continue;
    surfaceTracks.push({
      t_in_s: beat.t_in_s,
      wavPath: wav,
      level_db: beat.clip.audio === "surface" ? -3 : -12,
    });
  }

  // Step 3: music bed (full duration, looped if shorter).
  const bedPath = resolveBedPath(args.segment.music.bed);
  const bedExists = existsSync(bedPath);

  // Step 4: assemble the ffmpeg complex filter graph that combines
  // narrator (priority track, sets the ducking window) + surface
  // (ducked under narrator) + music (-18dB throughout, -3dB extra
  // after drop_at_s if present).
  const finalPath = join(workDir, "final.aac");
  const err = await renderAudioMix({
    duration_s: args.segment.length_s,
    narrator: narratorTracks,
    surface: surfaceTracks,
    bedPath: bedExists ? bedPath : null,
    drop_at_s: args.segment.music.drop_at_s ?? null,
    outPath: finalPath,
  });
  if (err) return { ok: false, error: err };

  return { ok: true, audioPath: finalPath, narrator_seconds };
}

function resolveBedPath(bedName: string): string {
  return join(MUSIC_BED_DIR, `${bedName}.mp3`);
}

async function durationOf(path: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nokey=1:noprint_wrappers=1",
      path,
    ]);
    let out = "";
    child.stdout?.on("data", (b: Buffer) => {
      out += b.toString("utf8");
    });
    child.on("close", () => resolve(Number(out.trim()) || 0));
    child.on("error", () => resolve(0));
  });
}

function extractAudio(videoPath: string, wavPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(
      "ffmpeg",
      ["-y", "-i", videoPath, "-vn", "-ac", "2", "-ar", "32000", "-c:a", "pcm_s16le", wavPath],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("close", (code) => resolve(code === 0 ? null : stderr.slice(-200) || `exit ${code}`));
    child.on("error", (err: Error) => resolve(err.message));
  });
}

interface MixGraphArgs {
  duration_s: number;
  narrator: Array<{ t_in_s: number; mp3Path: string; duration_s: number }>;
  surface: Array<{ t_in_s: number; wavPath: string; level_db: number }>;
  bedPath: string | null;
  drop_at_s: number | null;
  outPath: string;
}

async function renderAudioMix(args: MixGraphArgs): Promise<string | null> {
  // Build the inputs list. Order:
  //   - silence base (matches duration)
  //   - narrator MP3s
  //   - surface WAVs
  //   - music bed (if exists)
  const inputs: string[] = [
    "-f",
    "lavfi",
    "-i",
    `anullsrc=channel_layout=stereo:sample_rate=32000:duration=${args.duration_s}`,
  ];
  for (const n of args.narrator) inputs.push("-i", n.mp3Path);
  for (const s of args.surface) inputs.push("-i", s.wavPath);
  if (args.bedPath) inputs.push("-i", args.bedPath);

  // Build the filter graph. We delay each input to its t_in_s, level
  // it, then amix everything together with a sidechain compressor
  // ducking surface tracks under narrator tracks.
  const filterParts: string[] = [];
  const labels: string[] = ["[0:a]volume=0[base]"]; // silence base
  let inputIdx = 1;

  const narratorLabels: string[] = [];
  for (let i = 0; i < args.narrator.length; i++) {
    const n = args.narrator[i];
    if (!n) continue;
    const delayMs = Math.round(n.t_in_s * 1000);
    const label = `n${i}`;
    filterParts.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=-3dB[${label}]`);
    narratorLabels.push(`[${label}]`);
    inputIdx++;
  }

  const surfaceLabels: string[] = [];
  for (let i = 0; i < args.surface.length; i++) {
    const s = args.surface[i];
    if (!s) continue;
    const delayMs = Math.round(s.t_in_s * 1000);
    const label = `s${i}`;
    filterParts.push(
      `[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${s.level_db}dB[${label}]`,
    );
    surfaceLabels.push(`[${label}]`);
    inputIdx++;
  }

  let bedLabel = "";
  if (args.bedPath) {
    const dropFilter =
      args.drop_at_s != null ? `,volume=enable='gte(t,${args.drop_at_s})':volume=-21dB` : "";
    filterParts.push(
      `[${inputIdx}:a]aloop=loop=-1:size=2e9,atrim=duration=${args.duration_s},volume=-18dB${dropFilter}[bed]`,
    );
    bedLabel = "[bed]";
    inputIdx++;
  }

  // Mix everything together. Narrator at full priority, surface +
  // bed ducked under narrator via sidechaincompress.
  const allLabels = [
    "[base]",
    ...surfaceLabels,
    ...narratorLabels,
    ...(bedLabel ? [bedLabel] : []),
  ];
  filterParts.push(
    `${allLabels.join("")}amix=inputs=${allLabels.length}:duration=longest:dropout_transition=0:normalize=0[out]`,
  );
  const filterGraph = [...labels, ...filterParts].join(";");

  return new Promise((resolve) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        ...inputs,
        "-filter_complex",
        filterGraph,
        "-map",
        "[out]",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        String(args.duration_s),
        args.outPath,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (b: Buffer) => {
      stderr += b.toString("utf8");
    });
    child.on("close", async (code) => {
      if (code === 0) {
        // Sanity check the file actually exists and has bytes.
        try {
          const s = await stat(args.outPath);
          if (s.size > 0) return resolve(null);
        } catch {}
        return resolve("output file empty");
      }
      resolve(stderr.slice(-400) || `exit ${code}`);
    });
    child.on("error", (err: Error) => resolve(err.message));
  });
}
