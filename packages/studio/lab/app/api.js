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
};
