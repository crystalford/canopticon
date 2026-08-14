// Narration — speech synthesis, at AUTHORING time only.
//
// Standing rule 1: AI output is an input artifact, never a function. This
// module is called once per scene, from an explicit operator action. What
// it returns is hashed, written to R2, recorded as an Asset, and read
// thereafter. The compiler never calls it. `ttsCalls: 0` on every compile
// report is not an aspiration, it is a structural fact, and this is the
// module that has to stay on the authoring side of that line for it to
// remain true.
//
// WHY A LADDER RATHER THAN A MODEL NAME. The last serious bug in this
// system was an unverified assumption about the shape of a Workers AI
// response: the extraction route assumed `{response: string}`, got
// something else, threw, and the throw was swallowed into the route's own
// designed "declined" outcome — so a hard bug wore the costume of correct
// behaviour for weeks. The lesson is not "be more careful about which
// model name to type". It is that a call into a binding whose contract you
// cannot check locally must report what it actually saw. So: candidates
// are tried in order, the first that yields real bytes wins, the winner is
// recorded on the asset's provenance, and every failure carries a
// description of the value that failed rather than a bare null.

/** Recovered audio, with an account of where it came from. */
export interface SynthesisedAudio {
  bytes: Uint8Array;
  /** Sniffed from the bytes themselves, not assumed from the model. */
  contentType: string;
  extension: string;
  model: string;
  /** How the bytes were recovered from the binding's return value —
   *  "object.audio (base64)", "stream", and so on. Recorded because the
   *  shape is the thing that was unknown. */
  via: string;
}

export interface SynthesisFailure {
  reason: "no-binding" | "call-failed" | "no-audio";
  detail: string;
  /** What the binding actually handed back, described structurally. This
   *  is the field that would have caught the extraction bug in one probe
   *  instead of in weeks of inference. */
  attempts: Array<{ model: string; outcome: string; shape?: string }>;
}

export type SynthesisResult =
  | ({ ok: true } & SynthesisedAudio)
  | ({ ok: false } & SynthesisFailure);

interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

/** Tried in order. The first that hands back bytes wins and is recorded.
 *
 *  Both are Workers AI text-to-speech models with different input names,
 *  which is precisely why this is a list: the cost of being wrong about
 *  one model's parameter name should be "the next candidate runs", not
 *  "narration is silently unavailable". */
export const TTS_CANDIDATES: Array<{
  model: string;
  input: (text: string, voice?: string) => Record<string, unknown>;
}> = [
  {
    model: "@cf/deepgram/aura-1",
    input: (text, voice) => ({ text, speaker: voice || "angus" }),
  },
  {
    model: "@cf/myshell-ai/melotts",
    input: (text) => ({ prompt: text, lang: "en" }),
  },
];

/** THE VOICES THE BINDING ACTUALLY OFFERS.
 *
 *  `@cf/deepgram/aura-1` takes a `speaker`, and these are its documented
 *  ones. Listed here — on the compiler, not in the browser — so the picker
 *  offers what exists rather than what a front end imagined, and so
 *  `POST /v1/tts/probe` and this list can disagree loudly rather than
 *  quietly. An unknown speaker falls back to the model's own default, so a
 *  stale entry costs a different voice rather than a failed film.
 *
 *  The second candidate takes no voice at all. A picker shown while
 *  melotts is answering would be a control that reports rather than acts,
 *  which is why the report says which model spoke. */
export const VOICES: Array<{ id: string; label: string; note: string }> = [
  { id: "angus", label: "Angus", note: "warm, unhurried — the default" },
  { id: "asteria", label: "Asteria", note: "clear and level" },
  { id: "arcas", label: "Arcas", note: "low, close, documentary" },
  { id: "orion", label: "Orion", note: "measured, formal" },
  { id: "luna", label: "Luna", note: "light, quick" },
  { id: "athena", label: "Athena", note: "cool, precise" },
  { id: "zeus", label: "Zeus", note: "heavy, declarative" },
  { id: "hera", label: "Hera", note: "even, reportorial" },
];

/** Speak one scene's narration.
 *
 *  Deliberately takes the binding rather than the Env, so a test can hand
 *  it a fake and so nothing in here can reach for anything else. */
export async function synthesise(
  ai: AiBinding | undefined,
  text: string,
  voice?: string,
): Promise<SynthesisResult> {
  const attempts: Array<{ model: string; outcome: string; shape?: string }> = [];
  if (!ai || typeof ai.run !== "function") {
    return {
      ok: false,
      reason: "no-binding",
      detail: "no AI binding on this environment — narration needs the deployed Worker",
      attempts,
    };
  }
  const line = text.trim();
  if (!line) {
    return { ok: false, reason: "no-audio", detail: "empty narration text", attempts };
  }

  for (const candidate of TTS_CANDIDATES) {
    let out: unknown;
    try {
      out = await ai.run(candidate.model, candidate.input(line, voice));
    } catch (err) {
      attempts.push({
        model: candidate.model,
        outcome: `threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    const bytes = await toBytes(out);
    if (!bytes) {
      attempts.push({
        model: candidate.model,
        outcome: "returned no recoverable audio",
        shape: describeShape(out),
      });
      continue;
    }
    const sniffed = sniff(bytes.bytes);
    return {
      ok: true,
      bytes: bytes.bytes,
      via: bytes.via,
      model: candidate.model,
      contentType: sniffed.contentType,
      extension: sniffed.extension,
    };
  }

  return {
    ok: false,
    reason: attempts.some((a) => a.outcome.startsWith("threw")) ? "call-failed" : "no-audio",
    detail: "no TTS candidate produced audio",
    attempts,
  };
}

/** Pull bytes out of whatever the binding returned.
 *
 *  Workers AI has handed back, across models and dates: a ReadableStream, a
 *  Response, an ArrayBuffer, and an object with a base64 string under
 *  `audio`. All four are handled, and which one it was is reported, because
 *  "it worked" and "it worked THIS way" are different facts and only the
 *  second one survives a model swap. */
export async function toBytes(
  out: unknown,
  depth = 0,
): Promise<{ bytes: Uint8Array; via: string } | null> {
  if (out == null || depth > 2) return null;

  if (out instanceof Uint8Array) return out.length ? { bytes: out, via: "Uint8Array" } : null;
  if (out instanceof ArrayBuffer) {
    return out.byteLength ? { bytes: new Uint8Array(out), via: "ArrayBuffer" } : null;
  }

  if (typeof Response !== "undefined" && out instanceof Response) {
    const buf = await out.arrayBuffer();
    return buf.byteLength ? { bytes: new Uint8Array(buf), via: "Response" } : null;
  }
  if (typeof Blob !== "undefined" && out instanceof Blob) {
    const buf = await out.arrayBuffer();
    return buf.byteLength ? { bytes: new Uint8Array(buf), via: "Blob" } : null;
  }
  if (typeof ReadableStream !== "undefined" && out instanceof ReadableStream) {
    const bytes = await drain(out as ReadableStream<Uint8Array>);
    return bytes.length ? { bytes, via: "ReadableStream" } : null;
  }

  if (typeof out === "string") {
    const bytes = fromBase64(out);
    return bytes?.length ? { bytes, via: "base64 string" } : null;
  }

  if (typeof out === "object") {
    const o = out as Record<string, unknown>;
    for (const key of ["audio", "audio_data", "data", "output", "result", "value"]) {
      if (!(key in o)) continue;
      const inner = await toBytes(o[key], depth + 1);
      if (inner) return { bytes: inner.bytes, via: `object.${key} → ${inner.via}` };
    }
  }
  return null;
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      parts.push(value);
      total += value.length;
    }
  }
  const merged = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    merged.set(part, at);
    at += part.length;
  }
  return merged;
}

/** Base64 (with or without a data: prefix) → bytes. Returns null rather
 *  than throwing, so a model that answered with prose instead of audio is
 *  reported as "no recoverable audio" rather than crashing the route. */
export function fromBase64(input: string): Uint8Array | null {
  const raw = input.startsWith("data:") ? input.slice(input.indexOf(",") + 1) : input;
  const cleaned = raw.replace(/\s+/g, "");
  if (cleaned.length < 32 || !/^[A-Za-z0-9+/_=-]+$/.test(cleaned)) return null;
  const normal = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bin = atob(normal);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  // Chunked: a spread over a few hundred thousand bytes blows the stack.
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

/** What kind of audio this actually is, read from the bytes rather than
 *  assumed from the model. The R2 key's extension follows from this, so a
 *  wav returned by a model documented as mp3 is stored honestly. */
export function sniff(bytes: Uint8Array): { contentType: string; extension: string } {
  const b = bytes;
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) {
    return { contentType: "audio/wav", extension: "wav" };
  }
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) {
    return { contentType: "audio/ogg", extension: "ogg" };
  }
  if (b[0] === 0x66 && b[1] === 0x4c && b[2] === 0x61 && b[3] === 0x43) {
    return { contentType: "audio/flac", extension: "flac" };
  }
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) {
    return { contentType: "audio/mpeg", extension: "mp3" };
  }
  if (b[0] === 0xff && ((b[1] ?? 0) & 0xe0) === 0xe0) {
    return { contentType: "audio/mpeg", extension: "mp3" };
  }
  return { contentType: "application/octet-stream", extension: "bin" };
}

/** A structural description of an unknown value, for a diagnostic that has
 *  to be readable in a probe response committed to a file. */
export function describeShape(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") return `string(${v.length}) ${JSON.stringify(v.slice(0, 80))}`;
  if (typeof v !== "object") return `${typeof v} ${String(v).slice(0, 40)}`;
  if (v instanceof Uint8Array) return `Uint8Array(${v.length})`;
  if (v instanceof ArrayBuffer) return `ArrayBuffer(${v.byteLength})`;
  if (typeof ReadableStream !== "undefined" && v instanceof ReadableStream) {
    return "ReadableStream";
  }
  if (Array.isArray(v)) return `array(${v.length}) of ${v.length ? typeof v[0] : "?"}`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).slice(0, 8);
  const parts = keys.map((k) => {
    const val = o[k];
    if (typeof val === "string") return `${k}: string(${val.length})`;
    if (Array.isArray(val)) return `${k}: array(${val.length})`;
    if (val && typeof val === "object") return `${k}: ${val.constructor?.name ?? "object"}`;
    return `${k}: ${typeof val}`;
  });
  return `{ ${parts.join(", ")}${Object.keys(o).length > keys.length ? ", …" : ""} }`;
}

export async function sha256Hex(bytes: Uint8Array | string): Promise<string> {
  const data = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
