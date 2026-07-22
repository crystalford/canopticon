// The Phase 0 composition. Renders the §7b segment JSON into a
// 1080×1920 vertical short by laying out each beat as a Remotion
// Sequence, then dispatching each beat's chrome[] to the appropriate
// component.
//
// Visual language: forensic / dossier — dark paper background, mono
// captions, amber accents on key data, strict typographic restraint.
// This isn't the final visual identity — it's the "all six techniques
// are visible" target for the Phase 0 render spike.

import type { Beat, Chrome, Segment } from "@canopticon/shared/video/segment-schema";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { AnimatedChart } from "./components/AnimatedChart";
import { Callout } from "./components/Callout";
import { Caption } from "./components/Caption";
import { ClipWithCallouts } from "./components/ClipWithCallouts";
import { DataCallout } from "./components/DataCallout";
import { FreezeAnnotate } from "./components/FreezeAnnotate";
import { LowerThird } from "./components/LowerThird";
import { SideBySide } from "./components/SideBySide";

export const ForensicSegment: React.FC<{ segment: Segment }> = ({ segment }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#0c0d10" }}>
      {segment.beats.map((beat, i) => (
        <Sequence
          key={`${beat.t_in_s}-${i}`}
          from={Math.round(beat.t_in_s * fps)}
          durationInFrames={Math.max(1, Math.round((beat.t_out_s - beat.t_in_s) * fps))}
        >
          <BeatLayer beat={beat} />
        </Sequence>
      ))}
      {/* Persistent station ID watermark — top right, mono, muted */}
      <div
        style={{
          position: "absolute",
          top: 36,
          right: 44,
          fontFamily: "Inter, sans-serif",
          fontSize: 22,
          letterSpacing: "0.08em",
          color: "#8a867c",
          textTransform: "uppercase",
        }}
      >
        canopticon · {segment.id}
      </div>
    </AbsoluteFill>
  );
};

const BeatLayer: React.FC<{ beat: Beat }> = ({ beat }) => {
  return (
    <AbsoluteFill>
      {beat.clip ? <ClipWithCallouts clip={beat.clip} /> : null}
      {beat.chrome.map((chrome, i) => (
        <ChromeLayer key={`chrome-${i}`} chrome={chrome} />
      ))}
      {beat.vo ? (
        <div
          style={{
            position: "absolute",
            bottom: 240,
            left: 80,
            right: 80,
            color: "#faf6ef",
            fontFamily: "Georgia, serif",
            fontSize: 48,
            lineHeight: 1.3,
            textAlign: "center",
            textShadow: "0 2px 10px rgba(0,0,0,0.8)",
          }}
        >
          {beat.vo}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const ChromeLayer: React.FC<{ chrome: Chrome }> = ({ chrome }) => {
  switch (chrome.kind) {
    case "caption":
      return <Caption text={chrome.text} words={chrome.words} />;
    case "lower_third":
      return (
        <LowerThird
          speaker={chrome.speaker}
          role={chrome.role}
          network={chrome.network}
          timestampLabel={chrome.timestamp_label}
        />
      );
    case "callout":
      return <Callout text={chrome.text} emphasis={chrome.emphasis} />;
    case "data_callout":
      return (
        <DataCallout
          label={chrome.label}
          value={chrome.value}
          units={chrome.units}
          annotation={chrome.annotation}
        />
      );
    case "animated_chart":
      return (
        <AnimatedChart title={chrome.title} chartType={chrome.chart_type} points={chrome.points} />
      );
    case "side_by_side":
      return (
        <SideBySide
          leftLabel={chrome.left_label}
          rightLabel={chrome.right_label}
          leftSrc={chrome.left_src}
          rightSrc={chrome.right_src}
        />
      );
    case "freeze_annotate":
      return (
        <FreezeAnnotate
          clipSrc={chrome.clip_src}
          freezeAtS={chrome.freeze_at_s}
          holdMs={chrome.hold_ms}
          annotation={chrome.annotation}
        />
      );
    default:
      return null;
  }
};
