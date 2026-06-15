// Real broadcast clip with surfaced/ducked/muted audio. Phase 0's
// fixture path goes through staticFile() against the bundle. When the
// fixture is missing (the operator hasn't dropped one in yet), render
// a forensic-style placeholder card instead so the build still proves
// out.

import type { Clip } from "@canopticon/shared/video/segment-schema";
import { OffthreadVideo, staticFile } from "remotion";

export const ClipWithCallouts: React.FC<{ clip: Clip }> = ({ clip }) => {
  const url = clip.src.startsWith("http") ? clip.src : staticFile(clip.src);

  return (
    <div style={{ position: "absolute", inset: 0, backgroundColor: "#0c0d10" }}>
      <OffthreadVideo
        src={url}
        startFrom={Math.round(clip.in_s * 30)}
        endAt={Math.round(clip.out_s * 30)}
        muted={clip.audio === "mute"}
        volume={clip.audio === "ducked" ? 0.3 : 1.0}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      {/* Scanline + crosshair chrome — keeps the "machine-vision"
          identity visible even on a plain clip */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 3px, rgba(255,255,255,0.04) 4px)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
