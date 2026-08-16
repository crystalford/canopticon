/* The Worker, from the browser. One place that knows the shape of a
 * request, so a route rename is one edit and not eleven. */
const base = "/v1";

async function j(path, init) {
  const res = await fetch(base + path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    // A film made by the previous engine is not an error to swallow — the
    // caller offers to re-read it, so the details have to survive.
    err.status = res.status;
    err.legacy = Boolean(body.legacy);
    err.body = body;
    throw err;
  }
  return body;
}

const post = (path, payload) =>
  j(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

export const api = {
  films: () => j("/films"),
  film: (id) => j(`/film/${id}`),
  cut: (id) => j(`/film/${id}/cut`),
  voices: () => j("/voices"),
  create: (payload) => post("/film", payload),
  reread: (id, payload) => post(`/film/${id}/reread`, payload ?? {}),
  settings: (id, payload) => post(`/film/${id}/settings`, payload),
  narrate: (id, voice) => post(`/film/${id}/narrate`, { voice }),
  job: (id, job) => j(`/film/${id}/narrate/${job}`),

  /** SPEAK IT, AND WAIT FOR IT.
   *
   *  `POST /narrate` answers 202 and does the work in `waitUntil`, which is
   *  correct — a dozen TTS and ASR calls do not fit in a request. But every
   *  caller treated the 202 as completion: the film opened, its cut had no
   *  voice yet because none had been recorded, and it played silent with no
   *  indication that anything was still happening. The recording landed in
   *  R2 minutes later and the operator had no way to know.
   *
   *  So the wait lives here, once, and both callers use it. It resolves
   *  with the job's own report — including its per-span failures, which
   *  must reach a human rather than a log nobody reads. */
  narrateAndWait: async (id, voice, onProgress) => {
    const { job, spans } = await post(`/film/${id}/narrate`, { voice });
    onProgress?.({ state: "running", spoken: 0, spans });
    for (let tick = 0; ; tick++) {
      // A short span takes a few seconds; a long film takes minutes. Back
      // off so a slow film does not become a poll storm.
      await new Promise((r) => setTimeout(r, Math.min(4000, 900 + tick * 250)));
      const state = await j(`/film/${id}/narrate/${job}`).catch(() => null);
      if (!state) continue;
      onProgress?.(state);
      if (state.state === "done") return state;
      if (state.state === "failed") throw new Error(state.error || "narration failed");
    }
  },
};
