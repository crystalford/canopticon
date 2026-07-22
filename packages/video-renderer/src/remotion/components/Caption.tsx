// Kinetic caption — text overlay with word-level highlight when timings
// are provided. Phase 0 uses precomputed word timings from the segment
// JSON; Phase 2 wires WhisperX so the timings come for free.

import { useCurrentFrame, useVideoConfig } from "remotion";

interface WordTiming {
  text: string;
  t_in_ms: number;
  t_out_ms: number;
}

interface Props {
  text: string;
  words?: WordTiming[] | undefined;
}

export const Caption: React.FC<Props> = ({ text, words }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tMs = (frame / fps) * 1000;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 320,
        left: 100,
        right: 100,
        fontFamily: "Inter, sans-serif",
        fontSize: 64,
        fontWeight: 700,
        textAlign: "center",
        color: "#faf6ef",
        textShadow: "0 4px 24px rgba(0,0,0,0.9)",
        letterSpacing: "-0.02em",
        lineHeight: 1.15,
      }}
    >
      {words && words.length > 0
        ? words.map((w, i) => {
            const active = tMs >= w.t_in_ms && tMs <= w.t_out_ms;
            return (
              <span
                key={`w-${i}`}
                style={{
                  display: "inline-block",
                  margin: "0 8px",
                  color: active ? "#e09a3a" : "#faf6ef",
                  transition: "color 80ms linear",
                }}
              >
                {w.text}
              </span>
            );
          })
        : text}
    </div>
  );
};
