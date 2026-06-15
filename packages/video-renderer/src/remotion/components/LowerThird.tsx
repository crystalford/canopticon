// Lower-third — broadcaster chyron. Speaker name + role + network + a
// timestamp label. Slides in from the left over the first 6 frames.

import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
  speaker: string;
  role?: string | undefined;
  network?: string | undefined;
  timestampLabel?: string | undefined;
}

export const LowerThird: React.FC<Props> = ({ speaker, role, network, timestampLabel }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slide = spring({ frame, fps, config: { damping: 200 } });
  const x = interpolate(slide, [0, 1], [-100, 0]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 160,
        left: 80,
        right: 80,
        transform: `translateX(${x}%)`,
      }}
    >
      <div
        style={{
          display: "inline-block",
          backgroundColor: "#0c0d10",
          color: "#faf6ef",
          padding: "16px 24px",
          fontFamily: "Inter, sans-serif",
          fontSize: 36,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          borderLeft: "6px solid #e09a3a",
        }}
      >
        {speaker}
        {role ? (
          <span style={{ color: "#8a867c", fontWeight: 400, marginLeft: 16 }}>{role}</span>
        ) : null}
      </div>
      {(network || timestampLabel) && (
        <div
          style={{
            backgroundColor: "rgba(0,0,0,0.7)",
            color: "#8a867c",
            padding: "8px 24px",
            fontFamily: "Inter, sans-serif",
            fontSize: 22,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            display: "inline-block",
          }}
        >
          {[network, timestampLabel].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
};
