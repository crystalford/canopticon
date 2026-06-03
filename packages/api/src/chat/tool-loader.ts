// Chat tool-loader: the seam-enforcing assembly point. CMS tools are
// always available. Graph tools are gated on env.GRAPH_ENABLED so the
// operator can turn the graph compartment off and still write/publish
// through chat.
//
// When graph tools are disabled, the chat agent's system prompt is
// extended with a one-line note so the model knows not to reach for
// substrate operations.

import { CMS_TOOLS } from "../cms/tools/index.ts";
import { PIECE_TOOLS } from "../cms/tools/pieces.ts";
import type { Env } from "../env.ts";
import { TOOLS as GRAPH_TOOLS } from "../graph/tools/index.ts";
import type { ToolDef } from "../graph/tools/index.ts";
import { STUDIO_TOOLS } from "../studio/tools/index.ts";

export interface LoadedTools {
  tools: ToolDef[];
  toolsByName: Record<string, ToolDef>;
  graphEnabled: boolean;
  studioEnabled: boolean;
}

export function loadTools(env: Env): LoadedTools {
  const graphEnabled = env.GRAPH_ENABLED === "true";
  const studioEnabled = env.STUDIO_ENABLED === "true";
  // PIECE_TOOLS are the new PROBE publishing path; CMS_TOOLS (posts)
  // stay for back-compat with existing chat history until they're
  // retired in a cleanup pass.
  const tools: ToolDef[] = [...PIECE_TOOLS, ...CMS_TOOLS];
  if (graphEnabled) tools.push(...GRAPH_TOOLS);
  if (studioEnabled) tools.push(...STUDIO_TOOLS);
  const toolsByName: Record<string, ToolDef> = Object.fromEntries(tools.map((t) => [t.name, t]));
  return { tools, toolsByName, graphEnabled, studioEnabled };
}

export function toolDefinitionsForModel(tools: ToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
