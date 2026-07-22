// Side-by-side — two media tiles stacked vertically (the 9:16 frame
// doesn't have horizontal room for a 50/50 split that reads). Labels
// in mono, content in the middle. Used for the forensic turn: claim
// on top, contradicting receipt below.

import { Img, OffthreadVideo, staticFile } from "remotion";

interface Props {
  leftLabel: string;
  rightLabel: string;
  leftSrc: string;
  rightSrc: string;
}

function isVideo(src: string): boolean {
  return /\.(mp4|webm|mov)$/i.test(src);
}

const Tile: React.FC<{ label: string; src: string }> = ({ label, src }) => {
  const url = src.startsWith("http") ? src : staticFile(src);
  return (
    <div
      style={{
        flex: 1,
        margin: 20,
        display: "flex",
        flexDirection: "column",
        border: "3px solid #e09a3a",
        backgroundColor: "rgba(12,13,16,0.6)",
      }}
    >
      <div
        style={{
          padding: "12px 24px",
          backgroundColor: "#0c0d10",
          color: "#e09a3a",
          fontFamily: "Inter, sans-serif",
          fontSize: 22,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {isVideo(src) ? (
          <OffthreadVideo
            src={url}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            muted
          />
        ) : (
          <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </div>
    </div>
  );
};

export const SideBySide: React.FC<Props> = ({ leftLabel, rightLabel, leftSrc, rightSrc }) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 200,
        bottom: 200,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Tile label={leftLabel} src={leftSrc} />
      <Tile label={rightLabel} src={rightSrc} />
    </div>
  );
};
