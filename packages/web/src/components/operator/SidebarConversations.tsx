"use client";

// Conversations list rendered inside the main sidebar, ChatGPT/Claude
// style — so the chat page itself doesn't need its own rail.
//
// Listens for a "conversations-changed" custom event so the chat page
// can poke us to refresh after creating / archiving a conversation.

import { apiDelete, apiGet } from "@/lib/api-client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface Conversation {
  id: string;
  title: string | null;
  pinned: number;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
}

export function SidebarConversations({ onNavigate }: { onNavigate?: () => void }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname() ?? "";
  const params = useSearchParams();
  const activeId = params?.get("c") ?? null;

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<{ conversations: Conversation[] }>("/v1/chat/conversations");
      setConversations(data.conversations ?? []);
    } catch {
      // Silent — sidebar shouldn't crash other screens if chat API is down.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function handler() {
      void refresh();
    }
    window.addEventListener("conversations-changed", handler);
    return () => window.removeEventListener("conversations-changed", handler);
  }, [refresh]);

  // Re-fetch when arriving on /chat — the user might have just sent a message.
  useEffect(() => {
    if (pathname.startsWith("/chat")) void refresh();
  }, [pathname, refresh]);

  async function archive(id: string) {
    try {
      await apiDelete(`/v1/chat/conversations/${id}`);
      await refresh();
    } catch {
      // ignore — refresh will show ground truth
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border-soft">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="font-mono text-[9px] uppercase tracking-wider text-text-faint">
          Conversations
        </div>
        <Link
          href="/chat"
          {...(onNavigate ? { onClick: onNavigate } : {})}
          className="border border-border-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-cream-dim hover:text-cream-bright"
        >
          + New
        </Link>
      </div>
      <ul className="flex-1 overflow-y-auto pb-2">
        {loaded && conversations.length === 0 && (
          <li className="px-4 py-1 font-serif text-[11px] italic text-text-faint">
            No conversations yet.
          </li>
        )}
        {conversations.map((c) => {
          const isActive = activeId === c.id;
          return (
            <li key={c.id} className="group flex items-stretch">
              <Link
                href={`/chat?c=${c.id}`}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                className={`flex flex-1 items-start gap-2 border-l-2 px-4 py-1 font-mono text-[11px] ${
                  isActive
                    ? "border-cream bg-cream-glow text-cream-bright"
                    : "border-transparent text-text-dim hover:border-cream-dim hover:text-cream"
                }`}
                title={c.title ?? "Untitled"}
              >
                <span className="line-clamp-2">{c.title ?? "Untitled"}</span>
              </Link>
              <button
                type="button"
                onClick={() => void archive(c.id)}
                aria-label={`Archive ${c.title ?? "conversation"}`}
                className="px-2 font-mono text-[14px] text-text-faint opacity-0 transition-opacity hover:text-signal group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
