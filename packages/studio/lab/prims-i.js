/* CANOPTICON — DATA becomes reachable.
 *
 * Twenty-four primitives in this palette consume DATA. Until this file,
 * nothing produced any. Every one of them synthesised a fixed array at the
 * top of its own module and drew that — `counter` is hardcoded to count to
 * 41 and print "RENEWALS SINCE 2003" underneath. They were not instruments,
 * they were pictures of instruments, and no essay could reach them.
 *
 *   data_series → chart_cartesian → …
 *   —  → DATA   →    GEOMETRY
 *
 * This matters most on exactly the kind of essay that most needs it. An
 * institutional investigation IS its arithmetic: $750 million to $1.1
 * billion, a $282,345.84 grant, 7,000 people, and a chronology from 2017 to
 * 2026. Run one through the reader and 29% of its sentences carry a figure.
 *
 * THE FIGURES ARE VERBATIM. `series` carries the exact substrings lifted
 * out of the prose, and every consumer prints `f.text` rather than
 * reformatting `f.value`. A chart may scale by the parsed magnitude; it may
 * never LABEL by it. $282,345.84 does not become $282.3K on its way to the
 * screen, because on a financial investigation the digits are the finding.
 */

/** Parse the wire format written by src/compile/figures.ts.
 *
 *  "$750 million@money|7,000 people@count|2017@year"
 *
 *  Duplicated here on purpose: the Lab is a static page with no build step,
 *  so it cannot import the compiler's module. `tests/figures.test.ts` runs
 *  THIS function's source against the compiler's serialiser to prove the
 *  two halves cannot drift apart. */
function parseSeries(series) {
  if (!series || !series.trim()) return [];
  const MULT = { m: 1e6, million: 1e6, b: 1e9, billion: 1e9, trillion: 1e12 };
  return series
    .split("|")
    .map((part) => {
      const at = part.lastIndexOf("@");
      const text = at < 0 ? part : part.slice(0, at);
      const kind = at < 0 ? "count" : part.slice(at + 1);
      const num = Number.parseFloat(text.replace(/[$,+\s]/g, ""));
      const suffix = /(million|billion|trillion|m|b)\s*\+?$/i.exec(text.trim());
      const mult = suffix ? (MULT[suffix[1].toLowerCase()] ?? 1) : 1;
      return { text, kind, value: Number.isNaN(num) ? Number.NaN : num * mult };
    })
    .filter((f) => f.text !== "");
}

/** What a DATA consumer should draw. Reads the upstream payload when the
 *  executor supplies one, and falls back to the primitive's own synthetic
 *  array when it doesn't — so every existing consumer keeps working
 *  standalone in the Lab exactly as before. That fallback is the whole
 *  reason this could be added without migrating all 122. */
function upstreamData(upstream, fallback) {
  const d = upstream && upstream.data;
  if (Array.isArray(d) && d.length > 0) return d;
  return fallback.map((v, i) => ({ text: String(v), kind: "count", value: v }));
}

window.parseSeries = parseSeries;
window.upstreamData = upstreamData;

/* ── the source ─────────────────────────────────────────────────────── */
reg(
  "data_series",
  "F · DATA",
  "— → DATA",
  {
    series: { s: "$750 million@money|$1.1 billion@money|$912.3M@money" },
    caption: { s: "TOTAL SPEND" },
    reveal: { v: 1, lo: 0.05, hi: 1 },
  },
  (p) => ({
    frame(ctx, w, h, t) {
      const figs = parseSeries(p.series);
      bg(ctx, w, h);

      // The plate is a legible reading of the figures on its own, so a
      // scene that stops here still says something. A source primitive
      // that rendered nothing would be a data structure wearing a costume.
      const n = Math.max(1, Math.ceil(figs.length * p.reveal));
      const shown = figs.slice(0, n);
      const rowH = Math.min(h / Math.max(3, shown.length + 1), h * 0.34);
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      shown.forEach((f, i) => {
        const y = rowH * 0.9 + i * rowH;
        const size = Math.min(rowH * 0.62, (w * 0.86) / Math.max(6, f.text.length * 0.56));
        ctx.font = `600 ${size}px "Space Grotesk",sans-serif`;
        ctx.fillStyle = f.kind === "money" ? EMB : INK;
        ctx.fillText(f.text, w * 0.07, y);
        ctx.font = '500 9px "JetBrains Mono",monospace';
        ctx.fillStyle = "rgba(155,163,170,.62)";
        ctx.fillText(f.kind.toUpperCase(), w * 0.07, y + size * 0.62);
      });

      lab(ctx, `${p.caption} · ${figs.length} FIGURES · DATA OUT`, 10, h - 14);
      // The payload. Verbatim text travels with every value so no consumer
      // downstream has to reconstruct a number it was never given.
      return { data: shown };
    },
  }),
  "Carries the figures lifted verbatim out of the prose. The palette's only DATA source — every chart, counter and flow in family F consumes this type and, until it existed, none of them could be reached from an essay.",
);
