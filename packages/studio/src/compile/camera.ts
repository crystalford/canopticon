// THE CAMERA'S OWN DATA — split out from `scene-graph.ts` deliberately.
//
// `FilmState` (`film-state.ts`) needs to carry a `Camera` forward across
// scenes, and `film-state.ts` already imports from `scene-graph.ts` for
// `Element`. But `scene-graph.ts` imports `elementKey` from
// `film-mode.ts`, which imports `advance` from `film-state.ts` — so a
// VALUE import of `CAMERA_STILL` from `scene-graph.ts` into `film-state.ts`
// closes a real runtime cycle: `film-state.ts` → `scene-graph.ts` →
// `film-mode.ts` → `film-state.ts`. ESM evaluates a cycle in whatever
// order the entry point reaches it first, and `EMPTY_FILM` was being
// constructed before `CAMERA_STILL` had a value — measured directly:
// every `FilmState.camera` came out `undefined`, not a type-checking
// problem, a real one at runtime.
//
// `Camera` is plain data with no dependency on the scene graph, the film
// state, or the mode grammar, so it does not need to live in any of
// them. `scene-graph.ts` still owns `observe()` — the transform is a
// property of a `SceneGraph`, not of the camera — and re-exports `Camera`
// and `CAMERA_STILL` from here so nothing that already imports them from
// there has to change.

export interface Camera {
  /** 1 = the frame as composed. >1 pushes in. */
  zoom: number;
  /** Where the camera is looking, in frame coordinates. */
  x: number;
  y: number;
  /** How strongly depth separates under movement, 0..1. */
  parallax: number;
}

export const CAMERA_STILL: Camera = { zoom: 1, x: 0.5, y: 0.5, parallax: 0 };
