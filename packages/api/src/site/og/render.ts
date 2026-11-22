// SVG → PNG for the share card, inside the Worker: resvg compiled to
// WebAssembly and the three Geist faces the card uses, vendored under fonts/
// (SIL Open Font License, fonts/OFL.txt). Imported only by the /card route,
// and only when a card is not already in R2 — a page view never runs it.
//
// The fonts are named by family ("Geist") and picked by font-weight in the
// SVG: resvg matches the weight, not the face's own name ("Geist Medium"
// silently falls back to Regular).

import { Resvg, initWasm } from "@resvg/resvg-wasm";
import wasm from "@resvg/resvg-wasm/index_bg.wasm";
import medium from "./fonts/Geist-Medium.ttf";
import regular from "./fonts/Geist-Regular.ttf";
import semibold from "./fonts/Geist-SemiBold.ttf";

let ready: Promise<void> | null = null;

export async function renderPng(svg: string): Promise<Uint8Array> {
  ready ??= initWasm(wasm).catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  const resvg = new Resvg(svg, {
    font: {
      fontBuffers: [new Uint8Array(regular), new Uint8Array(medium), new Uint8Array(semibold)],
      loadSystemFonts: false,
      defaultFontFamily: "Geist",
    },
  });
  const png = resvg.render().asPng();
  resvg.free();
  return png;
}
