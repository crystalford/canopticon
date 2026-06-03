// Operator console data access. Reads chat conversations + messages and
// the console queues (leads, recent activity) from D1.

import { all, one, parseJson } from "../lib/d1";

export interface ConversationRow {
  id: string;
  title: string | null;
  pinned: number;
  last_message_at: string | null;
  message_count: number;
  created_at: string;
}

export async function listConversations(
  db: D1Database,
  userId: string,
): Promise<ConversationRow[]> {
  return all<ConversationRow>(
    db,
    `SELECT id, title, pinned, last_message_at, message_count, created_at
       FROM chat_conversations WHERE user_id = ? AND archived = 0
      ORDER BY pinned DESC, last_message_at DESC, created_at DESC LIMIT 100`,
    [userId],
  );
}

export interface MessageRow {
  id: string;
  seq: number;
  role: string;
  content_json: string;
  tool_name: string | null;
  tool_status: string | null;
  created_at: string;
}

export async function getConversation(
  db: D1Database,
  userId: string,
  id: string,
): Promise<ConversationRow | null> {
  return one<ConversationRow>(
    db,
    `SELECT id, title, pinned, last_message_at, message_count, created_at
       FROM chat_conversations WHERE id = ? AND user_id = ?`,
    [id, userId],
  );
}

export async function getMessages(db: D1Database, conversationId: string): Promise<MessageRow[]> {
  return all<MessageRow>(
    db,
    `SELECT id, seq, role, content_json, tool_name, tool_status, created_at
       FROM chat_messages WHERE conversation_id = ? ORDER BY seq ASC`,
    [conversationId],
  );
}

// Content-part shapes inside content_json.
export interface TextPart {
  type: "text";
  text: string;
}
export interface ToolUsePart {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
export interface ToolResultPart {
  type: "tool_result";
  tool_use_id: string;
  output?: string;
  is_error?: boolean;
}
export type ContentPart = TextPart | ToolUsePart | ToolResultPart;

export function parseContent(json: string): ContentPart[] {
  const parsed = parseJson<ContentPart[]>(json, []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function resolveOperatorId(db: D1Database): Promise<string | null> {
  const row = await one<{ id: string }>(db, "SELECT id FROM users ORDER BY created_at LIMIT 1", []);
  return row?.id ?? null;
}
