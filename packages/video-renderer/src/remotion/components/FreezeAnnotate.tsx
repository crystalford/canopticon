// Freeze-and-annotate — render a single video frame as a still and
// overlay an annotation. Phase 0 approximates by holding the OffthreadVideo
// at a specific time. Phase 2 will swap to a real freeze (extract the
// frame via Media Transformations and render as <Img>).

import { OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  clipSrc: string;
  freezeAtS: number;
  holdMs: number;
  annotation: string;
}

export const FreezeAnnotate: React.FC<Props> = ({ clipSrc, freezeAtS, annotation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const url = clipSrc.startsWith("http") ? clipSrc : staticFile(clipSrc);
  // OffthreadVideo's startFrom prop holds at freezeAtS by setting the
  // initial offset and then NOT advancing it (we render the same Sequence
  // frame regardless of the parent timeline).
  const _ = frame; // appease the linter
  void _;
  const startFrom = Math.round(freezeAtS * fps);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <OffthreadVideo
        src={url}
        startFrom={startFrom}
        endAt={startFrom + 1}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
        muted
      />
      {/* Forensic annotation overlay — top-aligned, mono, with crosshair */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 80,
          right: 80,
          padding: "24px 32px",
          backgroundColor: "rgba(224,154,58,0.92)",
          color: "#0c0d10",
          fontFamily: "Inter, sans-serif",
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          borderLeft: "8px solid #0c0d10",
          textShadow: "none",
        }}
      >
        ◤ {annotation}
      </div>
    </div>
  );
};
