// Remotion composition registry. One entry: the ForensicSegment comp
// that consumes the §7b segment JSON via defaultProps. The renderer
// overrides defaultProps per-request with the actual segment from the
// Worker.

import type { Segment } from "@canopticon/shared/video/segment-schema";
import { Composition } from "remotion";
import { ForensicSegment } from "./ForensicSegment";

const PHASE0_FIXTURE: Segment = {
  id: "remotion-defaultprops-fixture",
  title: "It Looks Like Teslas",
  template: "claim_vs_ground",
  length_s: 70,
  forensic_turn: {
    text: "Same government. Same weeks.",
    needs_human: false,
  },
  beats: [
    {
      t_in_s: 0,
      t_out_s: 4,
      type: "cold_open",
      vo: null,
      clip: null,
      chrome: [],
      source: null,
    },
    {
      t_in_s: 4,
      t_out_s: 9,
      type: "thesis",
      vo: "The data doesn't say that.",
      clip: null,
      chrome: [],
      source: null,
    },
    {
      t_in_s: 9,
      t_out_s: 70,
      type: "tag",
      vo: null,
      clip: null,
      chrome: [],
      source: null,
    },
  ],
  music: { bed: "forensic_low" },
  voice: { provider: "fixture", voice_id: "fixtures/narrator.wav" },
  sources: [],
  variants: ["1080x1920"],
};

export const RemotionRoot = () => {
  return (
    <Composition
      id="ForensicSegment"
      component={ForensicSegment}
      durationInFrames={70 * 30}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ segment: PHASE0_FIXTURE }}
    />
  );
};
