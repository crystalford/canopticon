#!/usr/bin/env node
/* Bundle the Studio into ONE openable file.
 *
 * WHY THIS EXISTS. The Studio is a static page served from the Worker, and
 * the Worker is only reachable from a browser with network access to
 * Cloudflare. The operator works from a phone as often as not, and a
 * sandbox that cannot reach production cannot hand back anything openable
 * at all — so every product change was, in practice, a change nobody could
 * look at until a deploy landed.
 *
 * This inlines every script and stylesheet named by index.html, in the
 * order index.html names them, into a single self-contained HTML file that
 * runs by double-clicking it. No server, no build step, no dependencies.
 * Everything that needs the compiler correctly reports that it cannot
 * reach it — which is the honest behaviour and exactly what the offline
 * example film is for.
 *
 *   node packages/studio/scripts/bundle-studio.mjs [outPath]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LAB = resolve(dirname(fileURLToPath(import.meta.url)), "..", "lab");
const OUT = resolve(process.argv[2] || join(LAB, "Canopticon-Studio.html"));

const html = readFileSync(join(LAB, "index.html"), "utf8");

/** Anything inside a <script> or <style> is read as markup by the parser,
 *  so a literal `</script>` in a string would end the block early. */
const guard = (src) => src.replace(/<\/(script|style)/gi, "<\\/$1");

let out = html
  .replace(/<link rel="stylesheet" href="([^"]+)">/g, (_m, href) =>
    href.startsWith("http")
      ? _m
      : `<style>\n/* ${href} */\n${guard(readFileSync(join(LAB, href), "utf8"))}\n</style>`,
  )
  .replace(/<script src="([^"]+)"><\/script>/g, (_m, src) =>
    src.startsWith("http")
      ? _m
      : `<script>\n/* ${src} */\n${guard(readFileSync(join(LAB, src), "utf8"))}\n</script>`,
  );

// A bundled copy is a snapshot, and a snapshot that does not say when it
// was taken is the thing that gets confused with the live product.
out = out.replace(
  "</body>",
  `<div class="proto-note">Self-contained snapshot of Canopticon Studio — every script inlined,
  runs with no server. Anything that needs the compiler says so on the control.</div>
</body>`,
);

writeFileSync(OUT, out);
const kb = (out.length / 1024).toFixed(0);
console.log(`bundled → ${OUT} (${kb}KB, no external scripts)`);
