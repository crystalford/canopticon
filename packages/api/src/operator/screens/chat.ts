// Operator chat screen. Server-renders the conversation list + the
// active conversation's message history, then attaches a small client
// module (/op/chat.js) that handles sending + the SSE stream.
//
// The chat endpoint at /v1/chat/conversations/:id/messages keeps its
// existing SSE shape (message_delta / tool_call / tool_result /
// awaiting_confirm / done / error). The client appends to the DOM as
// events arrive.

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
import { renderOpPage } from "../layout";

export async function renderChatScreen(
  env: { DB: D1Database },
  activeConversationId?: string,
): Promise<string> {
  const userId = await resolveOperatorId(env.DB);
  const conversations = userId ? await listConversations(env.DB, userId) : [];

  // Resolve the active conversation: explicit param, else the most
  // recent, else none (new-conversation state).
  let active: ConversationRow | null = null;
  if (userId && activeConversationId) {
    active = await getConversation(env.DB, userId, activeConversationId);
  } else if (conversations.length > 0) {
    active = conversations[0] ?? null;
  }

  const messages = active && userId ? await getMessages(env.DB, active.id) : [];
  const historyHtml = messages.map(renderMessage).filter(Boolean).join("");

  const listHtml = conversations.length
    ? conversations
        .map(
          (c) =>
            `<a href="/op/chat/${escapeAttr(c.id)}" class="${active?.id === c.id ? "is-active" : ""}">${escapeHtml(c.title || "New conversation")}</a>`,
        )
        .join("")
    : `<p class="mono" style="font-size:11px;color:var(--ink-mute);padding:8px 10px">No conversations yet.</p>`;

  const body = `
<div class="op-chat-wrap">
  <aside class="op-chat-list">
    <div class="row between" style="margin-bottom:12px;padding:0 10px">
      <span class="label">Conversations</span>
      <a href="/op/chat?new=1" class="op-link">+ New</a>
    </div>
    ${listHtml}
  </aside>
  <section class="op-chat-main">
    <div class="op-header">
      <div>
        <div class="op-header-title">${escapeHtml(active?.title || "New conversation")}</div>
        <div class="op-header-coord">Workers AI · Llama 3.3 70B</div>
      </div>
    </div>
    <div class="op-chat-scroll" id="chat-scroll">
      ${historyHtml || emptyChat()}
    </div>
    <div class="op-composer">
      <form id="chat-form">
        <textarea id="chat-input" placeholder="Ask anything. Paste a URL, drop notes, draft a piece. Enter to send · Shift+Enter for newline."></textarea>
        <div class="row">
          <span class="mono" style="font-size:11px;color:var(--ink-mute)" id="chat-status"></span>
          <button type="submit" class="btn accent" id="chat-send">Send</button>
        </div>
      </form>
    </div>
  </section>
</div>`;

  return renderOpPage({
    title: "Chat",
    body,
    activeNav: "/op/chat",
    fullBleed: true,
    clientScript: "/op/chat.js",
    bootstrap: {
      id: "chat-bootstrap",
      data: { conversationId: active?.id ?? null },
    },
  });
}

function emptyChat(): string {
  return `<div style="max-width:560px;margin:60px auto;text-align:center;color:var(--ink-3)">
  <p style="font-family:var(--serif);font-size:18px;margin-bottom:8px">Start a conversation.</p>
  <p style="font-size:14px;line-height:1.5">Drop a document and say "save this as a piece," ask the substrate a question, or draft an investigation. The agent has tools for ingestion, the record, and publishing.</p>
</div>`;
}

function renderMessage(m: { role: string; content_json: string }): string {
  const parts = parseContent(m.content_json);
  if (m.role === "user") {
    const text = parts
      .filter((p): p is Extract<ContentPart, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("\n")
      .trim();
    if (!text) return "";
    return `<div class="op-msg user"><div class="bubble">${escapeHtml(text)}</div></div>`;
  }
  if (m.role === "assistant") {
    const blocks: string[] = [];
    for (const part of parts) {
      if (part.type === "text" && part.text.trim()) {
        blocks.push(`<div class="bubble">${renderMarkdown(part.text)}</div>`);
      } else if (part.type === "tool_use") {
        blocks.push(toolChip(part.name, "ok"));
      }
    }
    if (blocks.length === 0) return "";
    return `<div class="op-msg assistant">${blocks.join("")}</div>`;
  }
  if (m.role === "tool") {
    // tool result row — render compactly as a chip with a checkmark.
    return "";
  }
  return "";
}

function toolChip(name: string, state: "ok" | "err" | "pending"): string {
  return `<div class="op-toolchip ${state}"><span class="dot"></span>${escapeHtml(name)}</div>`;
}
