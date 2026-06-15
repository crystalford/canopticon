// Animated chart — frame-by-frame interpolated line or bar. Two points
// in / two points out for Phase 0 (the tariff cliff: 100% → 6.1%). The
// chart is a single SVG path, no chart library — keeps the render
// CPU-cheap, no library Chrome has to evaluate.

import { interpolate, useCurrentFrame } from "remotion";

interface Point {
  label: string;
  value: number;
}

interface Props {
  title: string;
  chartType?: "line" | "bar" | undefined;
  points: Point[];
}

const W = 900;
const H = 600;
const PAD_X = 80;
const PAD_Y = 80;

export const AnimatedChart: React.FC<Props> = ({ title, chartType = "line", points }) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });

  const maxV = Math.max(...points.map((p) => p.value), 1);
  const stepX = points.length > 1 ? (W - PAD_X * 2) / (points.length - 1) : 0;

  const animated = points.map((p, i) => ({
    ...p,
    cx: PAD_X + i * stepX,
    cy: PAD_Y + (1 - p.value / maxV) * (H - PAD_Y * 2),
    revealed: i / points.length <= reveal,
  }));

  return (
    <div
      style={{
        position: "absolute",
        top: 400,
        left: 90,
        right: 90,
        textAlign: "center",
        opacity: reveal,
      }}
    >
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 32,
          color: "#faf6ef",
          letterSpacing: "0.04em",
          marginBottom: 30,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={title}>
        <title>{title}</title>
        <rect width={W} height={H} fill="rgba(12,13,16,0.5)" />
        {chartType === "line" ? (
          <polyline
            points={animated
              .filter((p) => p.revealed)
              .map((p) => `${p.cx},${p.cy}`)
              .join(" ")}
            stroke="#e09a3a"
            strokeWidth={6}
            fill="none"
          />
        ) : (
          animated
            .filter((p) => p.revealed)
            .map((p, i) => (
              <rect
                key={`b-${i}`}
                x={p.cx - 60}
                y={p.cy}
                width={120}
                height={H - PAD_Y - p.cy}
                fill="#e09a3a"
              />
            ))
        )}
        {animated
          .filter((p) => p.revealed)
          .map((p, i) => (
            <g key={`pt-${i}`}>
              <circle cx={p.cx} cy={p.cy} r={12} fill="#faf6ef" />
              <text
                x={p.cx}
                y={p.cy - 30}
                fill="#faf6ef"
                fontFamily="Georgia, serif"
                fontSize={36}
                fontWeight={700}
                textAnchor="middle"
              >
                {p.value}
              </text>
              <text
                x={p.cx}
                y={H - 30}
                fill="#8a867c"
                fontFamily="Inter, sans-serif"
                fontSize={22}
                textAnchor="middle"
              >
                {p.label}
              </text>
            </g>
          ))}
      </svg>
    </div>
  );
};
