/* The Worker, from the browser. One place that knows the shape of a
 * request, so a route rename is one edit and not eleven. */
const base = "/v1";

async function j(path, init) {
  const res = await fetch(base + path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
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
  settings: (id, payload) => post(`/film/${id}/settings`, payload),
  narrate: (id, voice) => post(`/film/${id}/narrate`, { voice }),
  job: (id, job) => j(`/film/${id}/narrate/${job}`),
};
