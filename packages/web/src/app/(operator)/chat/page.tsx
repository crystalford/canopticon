"use client";

// Chat / Intake — the daily operator entry point.
//
// Layout: message thread + composer. Conversations live in the main
// sidebar (see SidebarConversations) so we don't render a second rail.
//
// Agent loop runs server-side; client streams `tool_call`, `tool_result`,
// `awaiting_confirm`, `message_delta`, `done`, `error` SSE events and
// renders them in real time.

import {
  ApprovalCard,
  Card,
  FileDrop,
  Markdown,
  MetadataStrip,
  type PendingUpload,
} from "@/components/primitives";
import { apiGet, apiPost, apiUpload, postSse } from "@/lib/api-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  output?: string;
  is_error?: boolean;
}

interface Message {
  id: string;
  seq: number;
  role: "user" | "assistant" | "tool" | "system";
  content_json: string;
  tool_name: string | null;
  tool_use_id: string | null;
  tool_status: string | null;
  side_effects: string;
  created_at: string;
}

interface SideEffect {
  kind: string;
  id: string;
  summary: string;
}

interface StreamingState {
  toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    status: "running" | "awaiting" | "success" | "error";
    output?: string;
    sideEffects?: SideEffect[];
  }>;
  text: string;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<main className="p-4 text-text-dim">Loading…</main>}>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialPrompt = params?.get("prompt") ?? "";
  const activeId = params?.get("c") ?? null;

  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState(initialPrompt);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [pendingFileIds, setPendingFileIds] = useState<string[]>([]);
  const [streaming, setStreaming] = useState<StreamingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const notifyConversationsChanged = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("conversations-changed"));
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    const data = await apiGet<{ messages: Message[] }>(`/v1/chat/conversations/${id}`);
    setMessages(data.messages);
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    void loadConversation(activeId);
  }, [activeId, loadConversation]);

  const setActiveId = useCallback(
    (id: string | null) => {
      router.push(id ? `/chat?c=${id}` : "/chat");
    },
    [router],
  );

  async function newConversation(): Promise<string> {
    const { id } = await apiPost<{ id: string }>("/v1/chat/conversations");
    notifyConversationsChanged();
    setActiveId(id);
    return id;
  }

  async function handleFiles(files: File[]) {
    let conversationId = activeId;
    if (!conversationId) conversationId = await newConversation();
    const newPending: PendingUpload[] = files.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      size_bytes: f.size,
      status: "uploading",
    }));
    setPending((p) => [...p, ...newPending]);
    const form = new FormData();
    for (const f of files) form.append("file", f);
    if (conversationId) form.append("conversation_id", conversationId);
    try {
      const res = await apiUpload<{ files: Array<{ file_id: string; classification: string }> }>(
        "/v1/uploads",
        form,
      );
      setPendingFileIds((ids) => [...ids, ...res.files.map((f) => f.file_id)]);
      setPending((p) =>
        p.map((row) =>
          newPending.find((n) => n.id === row.id) ? { ...row, status: "ready" } : row,
        ),
      );
    } catch (e) {
      setPending((p) =>
        p.map((row) =>
          newPending.find((n) => n.id === row.id) ? { ...row, status: "error" } : row,
        ),
      );
      setError((e as Error).message);
    }
  }

  async function send() {
    setError(null);
    if (!composer.trim() && pendingFileIds.length === 0) return;

    let conversationId = activeId;
    try {
      if (!conversationId) {
        conversationId = await newConversation();
      }
    } catch (e) {
      setError(`Could not create conversation: ${(e as Error).message}`);
      return;
    }
    const text = composer;
    setComposer("");
    const attached = pendingFileIds;
    setPendingFileIds([]);

    const initialStream: StreamingState = { toolCalls: [], text: "" };
    setStreaming(initialStream);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await postSse({
        path: `/v1/chat/conversations/${conversationId}/messages`,
        body: { text, attached_file_ids: attached },
        signal: controller.signal,
        onEvent: (e) => {
          const data = e.data as Record<string, unknown> | undefined;
          if (e.event === "message_delta" && data) {
            setStreaming((s) => ({
              ...(s ?? initialStream),
              text: (s?.text ?? "") + String(data.text ?? ""),
            }));
          } else if (e.event === "tool_call" && data) {
            setStreaming((s) => ({
              ...(s ?? initialStream),
              toolCalls: [
                ...(s?.toolCalls ?? []),
                {
                  id: String(data.tool_use_id),
                  name: String(data.name),
                  input: (data.input as Record<string, unknown>) ?? {},
                  status: data.confirm ? "awaiting" : "running",
                },
              ],
            }));
          } else if (e.event === "tool_result" && data) {
            setStreaming((s) => {
              if (!s) return s;
              return {
                ...s,
                toolCalls: s.toolCalls.map((c) =>
                  c.id === String(data.tool_use_id)
                    ? {
                        ...c,
                        status: data.error ? "error" : "success",
                        output: String(data.output ?? data.error ?? ""),
                        sideEffects: (data.side_effects as SideEffect[] | undefined) ?? [],
                      }
                    : c,
                ),
              };
            });
          } else if (e.event === "awaiting_confirm" && data) {
            setStreaming((s) => {
              if (!s) return s;
              return {
                ...s,
                toolCalls: s.toolCalls.map((c) =>
                  c.id === String(data.tool_use_id) ? { ...c, status: "awaiting" } : c,
                ),
              };
            });
          } else if (e.event === "error" && data) {
            setError(String(data.message ?? "agent error"));
          }
        },
        onClose: async (reason, err) => {
          if (reason === "stream_end" || reason === "abort") {
            setStreaming(null);
            if (conversationId) await loadConversation(conversationId);
            notifyConversationsChanged();
          } else if (reason === "error") {
            setStreaming(null);
            setError(`Stream failed: ${err?.message ?? "unknown error"}`);
          }
        },
      });
    } catch (e) {
      setStreaming(null);
      setError(`Send failed: ${(e as Error).message}`);
    }
  }

  async function confirmTool(toolUseId: string, edited: Record<string, unknown>) {
    if (!activeId) return;
    try {
      await apiPost(`/v1/chat/conversations/${activeId}/tool/${toolUseId}/confirm`, {
        input: edited,
      });
      // After confirm, re-trigger the agent so it continues the turn.
      await postSse({
        path: `/v1/chat/conversations/${activeId}/messages`,
        body: { text: "(continue)", attached_file_ids: [] },
        onEvent: () => {},
        onClose: async () => {
          if (activeId) await loadConversation(activeId);
        },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const isEmpty = !activeId && messages.length === 0;

  return (
    <main className="flex h-[calc(100vh-7rem)] flex-col gap-3 md:h-[calc(100vh-8rem)]">
      {/* Messages thread */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto pr-2">
          {isEmpty ? (
            <WelcomeCard onStarter={(p) => setComposer(p)} />
          ) : messages.length === 0 && !streaming ? (
            <p className="font-serif italic text-text-dim">
              No messages yet. Say hi or paste a URL.
            </p>
          ) : (
            <MessageThread messages={messages} streaming={streaming} onConfirm={confirmTool} />
          )}
        </div>

        {/* Composer */}
        <div className="mt-2 border-t border-border-soft pt-2">
          <FileDrop onFiles={handleFiles} pending={pending} compact />
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Paste a URL, drop a file, or describe what you want. Cmd+Enter to send."
            className="mt-2 h-20 w-full resize-y border border-border-soft bg-bg-deeper px-3 py-2 font-serif text-[14px] text-text focus:border-cream-dim focus:outline-none"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-faint">
              Workers AI · free tier · Llama 3.3 70B
            </span>
            <button
              type="button"
              onClick={send}
              disabled={!!streaming || (!composer.trim() && pendingFileIds.length === 0)}
              className="border border-amber bg-amber/10 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-amber hover:bg-amber/20 disabled:opacity-40"
            >
              {streaming ? "Thinking…" : "Send"}
            </button>
          </div>
          {error && <p className="mt-1 font-mono text-[11px] text-signal">{error}</p>}
        </div>
      </section>
    </main>
  );
}

function WelcomeCard({ onStarter }: { onStarter: (prompt: string) => void }) {
  const starters = [
    {
      label: "Seed example content",
      prompt: "Please seed example content so I can see what the app looks like with real data.",
    },
    {
      label: "Walk me through the app",
      prompt: "What can I do here? Give me a tour of the 6 screens and what they're for.",
    },
    {
      label: "Help me ingest a URL",
      prompt:
        "I'll paste a URL next. When I do, fetch it, grade it as a source, and propose entities and claims.",
    },
    {
      label: "Show recent activity",
      prompt: "Search the substrate for whatever the most recent additions are and summarize.",
    },
  ];
  return (
    <Card className="mx-auto mt-6 max-w-2xl">
      <MetadataStrip>Chat · intake</MetadataStrip>
      <h2 className="mt-1 font-sans text-2xl font-extrabold uppercase tracking-tight text-cream-bright">
        Welcome.
      </h2>
      <p className="mt-2 font-serif text-[14px] text-text-dim">
        This is your daily entry point. Paste URLs, drop files, ask questions. The agent runs on
        Cloudflare Workers AI (free), and routes the 18 forensic roles through Llama 4 Scout /
        QwQ-32B. Anthropic is an opt-in escape hatch per role.
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {starters.map((s) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => onStarter(s.prompt)}
              className="border border-border-soft bg-bg-deeper px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-cream-dim hover:border-cream-dim hover:text-cream-bright"
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MessageThread({
  messages,
  streaming,
  onConfirm,
}: {
  messages: Message[];
  streaming: StreamingState | null;
  onConfirm: (toolUseId: string, edited: Record<string, unknown>) => void;
}) {
  const rendered = useMemo(() => groupForRender(messages), [messages]);

  return (
    <ol className="flex flex-col gap-3">
      {rendered.map((m) => (
        <li key={m.id}>
          <RenderedMessage m={m} onConfirm={onConfirm} />
        </li>
      ))}
      {streaming && (
        <li>
          <StreamingPreview streaming={streaming} onConfirm={onConfirm} />
        </li>
      )}
    </ol>
  );
}

function RenderedMessage({
  m,
  onConfirm,
}: {
  m: Message;
  onConfirm: (toolUseId: string, edited: Record<string, unknown>) => void;
}) {
  const blocks = safeParseBlocks(m.content_json);
  if (m.role === "user") {
    const text = blocks
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n");
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] border-l-2 border-cream-dim bg-bg-deeper px-3 py-2 font-serif text-[14px] text-cream">
          {text || <em className="text-text-faint">(empty)</em>}
        </div>
      </div>
    );
  }
  if (m.role === "tool") {
    const callBlock = blocks.find((b) => b.type === "tool_use");
    const resultBlock = blocks.find((b) => b.type === "tool_result");
    if (m.tool_status === "pending" && callBlock) {
      return (
        <ApprovalCard
          title={`Confirm: ${callBlock.name ?? m.tool_name}`}
          description="The agent staged this write. Edit fields below if needed, then confirm."
          input={(callBlock.input as Record<string, unknown>) ?? {}}
          onConfirm={(edited) => onConfirm(String(callBlock.id ?? m.tool_use_id ?? ""), edited)}
        />
      );
    }
    return (
      <details className="border border-border-soft px-3 py-2">
        <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-text-dim">
          <span className={m.tool_status === "error" ? "text-signal" : "text-sage"}>●</span>{" "}
          {m.tool_name}
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-text-dim">
          {resultBlock?.output ?? "(no output)"}
        </pre>
      </details>
    );
  }
  // assistant
  const text = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
  return (
    <Card>
      <Markdown source={text} />
    </Card>
  );
}

function StreamingPreview({
  streaming,
  onConfirm,
}: {
  streaming: StreamingState;
  onConfirm: (toolUseId: string, edited: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-2">
      {streaming.toolCalls.map((tc) => {
        if (tc.status === "awaiting") {
          return (
            <ApprovalCard
              key={tc.id}
              title={`Confirm: ${tc.name}`}
              description="The agent staged this write. Edit fields below if needed, then confirm."
              input={tc.input}
              onConfirm={(edited) => onConfirm(tc.id, edited)}
            />
          );
        }
        return (
          <details key={tc.id} className="border border-border-soft px-3 py-2">
            <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-text-dim">
              <span
                className={
                  tc.status === "error"
                    ? "text-signal"
                    : tc.status === "success"
                      ? "text-sage"
                      : "text-amber"
                }
              >
                ●
              </span>{" "}
              {tc.name}
              {tc.status === "running" && <span className="ml-2 italic">running…</span>}
            </summary>
            {tc.output && (
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-text-dim">
                {tc.output}
              </pre>
            )}
            {tc.sideEffects && tc.sideEffects.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {tc.sideEffects.map((se, i) => (
                  <li
                    key={i}
                    className="border border-border-soft bg-bg-deeper px-2 py-0.5 font-mono text-[10px] text-cream-dim"
                  >
                    {se.kind}: {se.summary}
                  </li>
                ))}
              </ul>
            )}
          </details>
        );
      })}
      {streaming.text && (
        <Card>
          <Markdown source={streaming.text} />
        </Card>
      )}
    </div>
  );
}

function groupForRender(messages: Message[]): Message[] {
  // System messages are hidden in the UI; everything else preserved in order.
  return messages.filter((m) => m.role !== "system");
}

function safeParseBlocks(json: string): ContentBlock[] {
  try {
    const parsed = JSON.parse(json) as ContentBlock[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
