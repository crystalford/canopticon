// Skeleton operator screens — the surfaces whose full build lands in
// later phases (Workbench, Ingest, Editorial, Leads, Patterns, Publish).
// Each renders the op shell + header + a short "what this will do" note,
// so the console is navigable end-to-end during the pivot.

import { escapeHtml } from "../../public/layout";
import { opHeader, renderOpPage } from "../layout";

export function renderOpSkeleton(args: {
  title: string;
  activeNav: string;
  coord?: string;
  whatsHere: string;
}): string {
  const body = `
${opHeader(args.title, args.coord ?? "")}
<div class="op-content">
  <div class="card soft" style="padding:24px;max-width:640px">
    <div class="label" style="margin-bottom:8px">In progress</div>
    <p style="font-family:var(--serif);font-size:15.5px;line-height:1.55;color:var(--ink-2);margin:0">${escapeHtml(args.whatsHere)}</p>
  </div>
</div>`;
  return renderOpPage({
    title: args.title,
    body,
    activeNav: args.activeNav,
    fullBleed: true,
  });
}
