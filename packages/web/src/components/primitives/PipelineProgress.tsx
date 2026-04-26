// Five-segment progress bar for production pipeline (Script → Cohere →
// Record → Edit → Publish). Each segment is `done` / `current` / `pending`.

export type StageState = "done" | "current" | "pending";

export interface PipelineStage {
  label: string;
  state: StageState;
}

const stageStyles: Record<StageState, string> = {
  done: "border-sage bg-sage-glow text-sage",
  current: "border-amber bg-amber-glow text-amber",
  pending: "border-border-soft text-text-faint",
};

export function PipelineProgress({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="flex gap-1">
      {stages.map((stage, idx) => (
        <div
          key={`${stage.label}-${idx}`}
          className={`flex-1 border px-2 py-1 text-center font-mono text-[10px] uppercase ${stageStyles[stage.state]}`}
        >
          {stage.label}
        </div>
      ))}
    </div>
  );
}
