// Chat — one continuous, never-resetting conversational stream against
// the graph. Design's §2 spec: sticky bottom composer, suggestion chips,
// type-colored result chips, date separators, no-history-reset.
//
// The /v1/chat SSE backend stays unchanged. /op/chat.js consumes the
// stream and appends DOM with the design's class names.

import { renderMarkdown } from "../../cms/lib/render-post";
import { escapeAttr, escapeHtml } from "../../public/layout";
import {
  type ContentPart,
  type ConversationRow,
  getConversation,
  getMessages,
  listConversations,
  parseContent,
  resolveOperatorId,
} from "../data";
import { icon, renderOpPage } from "../layout";

const SUGGESTIONS = [
  "What contradicts the last piece I ingested?",
  "Show me Brookfield's coverage gaps",
  "Patterns across the financial-network chain",
  "What's missing from the carbon-pricing record?",
];

function dateLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function timeLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(11, 16); // HH:MM
}

interface ChatBootstrap {
  conversationId: string | null;
}

function renderUserMsg(text: string, time: string): string {
  if (!text.trim()) return "";
  return `<div class="chat-msg user">
  <div class="chat-q">${escapeHtml(text)}</div>
  ${time ? `<div class="chat-r-t">${escapeHtml(time)}</div>` : ""}
</div>`;
}

function renderAssistantMsg(parts: ContentPart[], time: string): string {
  const textBits = parts.filter(
    (p): p is Extract<ContentPart, { type: "text" }> => p.type === "text",
  );
  const toolBits = parts.filter(
    (p): p is Extract<ContentPart, { type: "tool_use" }> => p.type === "tool_use",
  );
  if (textBits.length === 0 && toolBits.length === 0) return "";

  const textHtml = textBits.length
    ? textBits.map((t) => `<div class="chat-r-text">${renderMarkdown(t.text)}</div>`).join("")
    : "";
  const chipsHtml = toolBits.length
    ? `<div class="chat-chips">${toolBits
        .map(
          (t) =>
            `<span class="chat-chip"><span class="cc-label">tool</span><span class="cc-val">${escapeHtml(t.name)}</span></span>`,
        )
        .join("")}</div>`
    : "";

  return `<div class="chat-msg system">
  <div class="chat-r">
    ${textHtml}
    ${chipsHtml}
    ${time ? `<div class="chat-r-t">${escapeHtml(time)}</div>` : ""}
  </div>
</div>`;
}

function renderHistory(
  messages: Array<{ role: string; content_json: string; created_at: string }>,
): string {
  if (messages.length === 0) {
    return `<div class="studio-empty" style="padding:80px 20px;text-align:center">
  <div class="se-1" style="font-family:var(--serif);font-size:18px;color:var(--ink-3);margin-bottom:8px">Start a conversation.</div>
  <div class="se-2" style="font-size:13px;color:var(--mute);max-width:480px;margin:0 auto;line-height:1.5">Ask the graph anything. Patterns, contradictions, what contradicts a claim, what's missing — one continuous stream, never resets.</div>
</div>`;
  }
  let lastDay = "";
  const blocks: string[] = [];
  for (const m of messages) {
    const day = dateLabel(m.created_at);
    if (day !== lastDay) {
      blocks.push(`<div class="chat-date">${escapeHtml(day)}</div>`);
      lastDay = day;
    }
    const time = timeLabel(m.created_at);
    if (m.role === "user") {
      const parts = parseContent(m.content_json);
      const text = parts
        .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
        .map((p) => p.text)
        .join("\n")
        .trim();
      const block = renderUserMsg(text, time);
      if (block) blocks.push(block);
    } else if (m.role === "assistant") {
      const block = renderAssistantMsg(parseContent(m.content_json), time);
      if (block) blocks.push(block);
    }
  }
  return blocks.join("");
}

export async function renderChatScreen(
  env: { DB: D1Database },
  activeConversationId?: string,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const conversations = userId ? await listConversations(env.DB, userId) : [];

  let active: ConversationRow | null = null;
  if (userId && activeConversationId) {
    active = await getConversation(env.DB, userId, activeConversationId);
  } else if (conversations.length > 0) {
    active = conversations[0] ?? null;
  }

  const messages = active && userId ? await getMessages(env.DB, active.id) : [];
  const historyHtml = renderHistory(messages);

  const sugChips = SUGGESTIONS.map(
    (s) =>
      `<button class="chat-sg" type="button" data-sg="${escapeAttr(s)}">${escapeHtml(s)}</button>`,
  ).join("");

  const bootstrap: ChatBootstrap = { conversationId: active?.id ?? null };

  const body = `
<div class="chat-wrap">
  <div class="chat-stream" id="chat-scroll">
    ${historyHtml}
  </div>
  <div class="chat-foot">
    <div class="chat-suggest">${sugChips}</div>
    <form id="chat-form" class="chat-input-bar">
      <span class="cib-prompt mono">›</span>
      <input id="chat-input" class="cib-input" type="text" placeholder="Ask the graph — questions become claims; commands become ingest" autocomplete="off" />
      <button id="chat-send" class="cib-send" type="submit" aria-label="Send">
        ${icon("arrow")}
      </button>
      <span id="chat-status" class="mono" style="font-size:11px;color:var(--mute);margin-left:6px"></span>
    </form>
  </div>
</div>`;

  return renderOpPage({
    title: "Chat",
    sub: active
      ? active.title || "New conversation"
      : "single never-resetting stream against the graph",
    body,
    activeNav: "/op/chat",
    fullBleed: true,
    clientScript: "/op/chat.js",
    bootstrap: { id: "chat-bootstrap", data: bootstrap },
  });
}
