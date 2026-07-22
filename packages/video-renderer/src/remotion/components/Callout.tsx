// Callout — a flashing text box highlighting the phrase the script is
// interrogating. Three emphasis levels: normal (muted), strong (white),
// warning (amber).

import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  text: string;
  emphasis?: "normal" | "strong" | "warning" | undefined;
}

const COLORS = {
  normal: "#8a867c",
  strong: "#faf6ef",
  warning: "#e09a3a",
} as const;

export const Callout: React.FC<Props> = ({ text, emphasis = "normal" }) => {
  const frame = useCurrentFrame();
  // Pulse — fade in over 8 frames, hold, soft pulse every 30 frames
  const opacity = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const pulse = 0.92 + 0.08 * Math.sin((frame / 30) * Math.PI * 2);

  return (
    <div
      style={{
        position: "absolute",
        top: 600,
        left: 80,
        right: 80,
        textAlign: "center",
        opacity,
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "20px 40px",
          backgroundColor: "rgba(12,13,16,0.85)",
          border: `4px solid ${COLORS[emphasis]}`,
          color: COLORS[emphasis],
          fontFamily: "Inter, sans-serif",
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          transform: `scale(${pulse})`,
          textTransform: emphasis === "warning" ? "uppercase" : "none",
        }}
      >
        {text}
      </div>
    </div>
  );
};
