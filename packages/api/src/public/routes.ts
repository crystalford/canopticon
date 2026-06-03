// Public site routes. Server-rendered HTML, no JS required to read.
// Mounted at `/` in the Worker root (packages/api/src/index.ts).
//
// Phase 1 only: home + skeleton placeholders for the five primary
// destinations. Phase 2 wires each in to D1.

import { Hono } from "hono";
import type { Env } from "../env";
import { htmlResponse } from "./layout";
import { renderHome } from "./render/home";
import { renderNotFound, renderPlaceholder } from "./render/placeholder";
import { STYLES_CSS, stylesHash } from "./styles";

const app = new Hono<{ Bindings: Env }>();

// Styles. Long cache; the hash query string busts on content change.
app.get("/styles.css", () => {
  return new Response(STYLES_CSS, {
    headers: {
      "content-type": "text/css; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "x-styles-hash": stylesHash(),
    },
  });
});

app.get("/", () => htmlResponse(renderHome()));

app.get("/topics", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Topics",
      description: "Subject pillars — explore by what's happening, not who's running it.",
      activeNav: "/topics",
      whatsHere:
        "The topic hubs land in Phase 2: each one is a signed overview plus every relevant report, person, pattern, and gap pulled live from D1.",
    }),
  ),
);

app.get("/investigations", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Investigations",
      description: "Signed analysis — the figure cut across the facts.",
      activeNav: "/investigations",
      whatsHere:
        "Investigations are the public face of each research thread. The index and detail surfaces land in Phase 2.",
    }),
  ),
);

app.get("/record", () =>
  htmlResponse(
    renderPlaceholder({
      title: "The Record",
      description: "People, organizations, programs — the standing reference.",
      activeNav: "/record",
      whatsHere:
        "The record is the reference layer. Each entity page shows claims, relations, patterns, and gaps. Lands in Phase 2.",
    }),
  ),
);

app.get("/patterns", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Patterns",
      description: "What the whole corpus reveals — signed.",
      activeNav: "/patterns",
      whatsHere:
        "Patterns are operator-signed insights that emerge across documents (no single document contains them). Lands in Phase 4 alongside the weighting model.",
    }),
  ),
);

app.get("/library", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Library",
      description: "The raw research the rest is built on.",
      activeNav: "/library",
      whatsHere:
        "Sixty-five seed reports plus everything ingested afterward. Lands in Phase 2; seed corpus imports in Phase 5.",
    }),
  ),
);

app.get("/about", () =>
  htmlResponse(
    renderPlaceholder({
      title: "About",
      description: "What Canopticon is and how it works.",
      activeNav: "/about",
      whatsHere: "About copy lands once the core surfaces are real (Phase 2 trailing).",
    }),
  ),
);

app.get("/methodology", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Methodology",
      description: "How facts get grounded, how analysis gets signed, where the line is.",
      activeNav: "/methodology",
      whatsHere: "Methodology page lands with the core surfaces in Phase 2.",
    }),
  ),
);

app.get("/sources", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Sources",
      description: "Every external document the claims rest on.",
      activeNav: "/sources",
      whatsHere: "Sources index lands in Phase 2 alongside the record.",
    }),
  ),
);

app.get("/search", () =>
  htmlResponse(
    renderPlaceholder({
      title: "Search",
      description: "Find a claim, entity, or piece.",
      activeNav: "/search",
      whatsHere: "Search lands after the core surfaces are real — Phase 3 stretch.",
    }),
  ),
);

// 404 handling lives at the parent (Worker) level so /v1/* misses can
// return JSON while /* misses get the styled HTML page. See index.ts.

export default app;
export { renderNotFound };
