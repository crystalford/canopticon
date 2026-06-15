// MiniMax voice clone training — wraps the t2a_v2/voice_clone endpoint.
//
// Flow (from the operator's perspective):
//   1. Operator visits /voice, records 5+ minutes of audio in browser
//   2. Browser POSTs WAV blob to /voice/upload → R2
//   3. Operator clicks Train → /voice/train calls MiniMax with the R2
//      sample URLs, gets a voice_id, stores in D1 voice_profile
//   4. The editorial brain emits segments with voice.voice_id pointing
//      at the trained clone
//   5. The Container's narrator.ts reads voice_id, calls MiniMax TTS

const MINIMAX_CLONE_URL = "https://api.minimaxi.chat/v1/voice_clone";

export interface CloneResult {
  ok: boolean;
  voice_id?: string;
  error?: string;
}

interface CloneArgs {
  apiKey: string;
  /** Public HTTPS URLs MiniMax can fetch the samples from. Worker
   *  generates these as signed R2 URLs (24h TTL). */
  sample_urls: string[];
  /** A short label for the clone — e.g. "canopticon-narrator-2026-06". */
  custom_voice_id: string;
}

export async function trainVoiceClone(args: CloneArgs): Promise<CloneResult> {
  try {
    const res = await fetch(MINIMAX_CLONE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voice_id: args.custom_voice_id,
        audio_urls: args.sample_urls,
        // Auto-enables both fast inference + quality clone.
        accuracy: "hd",
        model: "speech-02-hd",
      }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `minimax clone ${res.status}: ${text.slice(0, 300)}`,
      };
    }
    const data = (await res.json()) as { voice_id?: string; base_resp?: { status_code: number } };
    if (!data.voice_id) {
      return { ok: false, error: `minimax clone returned no voice_id: ${JSON.stringify(data)}` };
    }
    return { ok: true, voice_id: data.voice_id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
