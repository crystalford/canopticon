// Data callout — the BIG NUMBER treatment. The figure is the figure;
// the label is the ground. Large value count-up in the first 12 frames.

import { interpolate, useCurrentFrame } from "remotion";

interface Props {
  label: string;
  value: string;
  units?: string | undefined;
  annotation?: string | undefined;
}

export const DataCallout: React.FC<Props> = ({ label, value, units, annotation }) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(reveal, [0, 1], [0.88, 1]);
  // Try to count up if the value parses as a number; otherwise just
  // fade in.
  const parsed = Number(value.replace(/[,\s]/g, ""));
  const display = Number.isFinite(parsed) ? Math.round(parsed * reveal).toLocaleString() : value;

  return (
    <div
      style={{
        position: "absolute",
        top: 500,
        left: 80,
        right: 80,
        textAlign: "center",
        opacity: reveal,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 28,
          color: "#8a867c",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          marginBottom: 16,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 280,
          fontWeight: 700,
          color: "#e09a3a",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {display}
      </div>
      {units ? (
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 32,
            color: "#faf6ef",
            letterSpacing: "0.04em",
            marginTop: 16,
          }}
        >
          {units}
        </div>
      ) : null}
      {annotation ? (
        <div
          style={{
            fontFamily: "Georgia, serif",
            fontStyle: "italic",
            fontSize: 24,
            color: "#8a867c",
            marginTop: 24,
          }}
        >
          {annotation}
        </div>
      ) : null}
    </div>
  );
};
