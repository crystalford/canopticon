// Chat — one continuous, never-resetting conversational stream.
//
// P0 ships a stub; the new design (sticky bottom composer, suggestion
// chips, type-colored result chips) lands in P3. The existing /v1/chat
// SSE backend + the /op/chat.js client module stay intact and will be
// reused. For P0 the surface tells the operator it's coming.

import { emptyState, renderOpPage } from "../layout";

export async function renderChatScreen(
  _env: { DB: D1Database },
  _activeConversationId?: string,
): Promise<string> {
  const body = emptyState({
    iconName: "chat",
    title: "Chat reskin lands in P3.",
    body: "The single never-resetting stream against the graph — natural-language questions answered from claims/entities/patterns, with type-colored result chips and a sticky bottom composer. The SSE backend at /v1/chat already streams. P3 wires the new design.",
    action: { href: "/op", label: "Back to Feed" },
  });

  return renderOpPage({
    title: "Chat",
    sub: "ask and command the graph",
    body,
    activeNav: "/op/chat",
  });
}
