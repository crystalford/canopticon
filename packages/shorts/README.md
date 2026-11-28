# Shorts

Makes a short vertical video from an essay's or paper's **figure plan**: the
skeleton's moves, one figure each, written in the piece's front matter
(`figure_plan`, checked by `packages/api/scripts/build-content.mjs`).

The piece is the only source. Its title and short version open the video;
each move becomes one shot that draws its figure while its line is spoken
(captions are timed to that line); its formula closes the video, which then
loops back to the first frame.

Separate from the publication: it reads the built content and writes a file.
Nothing deploys, schedules or calls it; a person runs it.

```
node packages/api/scripts/build-content.mjs               # build the content
node packages/shorts/plan.mjs <slug> spec.json             # the plan → the player's spec
node packages/shorts/stills.mjs spec.json frames/          # one frame per shot, to look at first
node packages/shorts/render.mjs spec.json out.mp4          # the video
```

Needs Playwright's Chromium (already on the workspace image) and ffmpeg.

## Figure kinds

| kind | data | drawn as |
| --- | --- | --- |
| `chain` | `make\|do\|end` | cue words, each lit as it is said |
| `compare` | `Label\|value \|\| Label\|value` (+ `hot`) | rows; the hot row glows and the rest step back |
| `steps` | `a \|\| b \|\| c` | numbered steps, each lit as it is said |
| `loop` | (the piece's `cycle`) | the steps around a ring, closing back to the first |
| `quote` | words from the piece | the words, large |

`player.html` is the v13 look: dark ground, light pooled behind what is
being said, rack focus at each cut, blur dissolves, motion blur, bloom and
grain in the render. No amber.
