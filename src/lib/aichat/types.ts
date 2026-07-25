export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatThread {
  id: string;
  title: string;
  model: string;
  lastMessageAt?: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  model?: string;
  /** Persisted assistant-turn activity, replayed on reload. */
  reasoning?: string;
  tools?: ToolActivity[];
  createdAt: string;
}

export interface ChatThreadList {
  items: ChatThread[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ChatMessageList {
  items: ChatMessage[];
  total: number;
  page: number;
  pageSize: number;
}

/** One tool the copilot ran during a turn (read tools execute immediately). */
export interface ToolActivity {
  name: string;
  summary: string;
  ok: boolean;
}

/** A mutating tool call awaiting explicit user approval. */
export interface PendingAction {
  id: string;
  toolName: string;
  args?: Record<string, unknown>;
  summary?: string;
}

/**
 * SSE frame shape emitted by the copilot stream/approve/reject endpoints. Every
 * frame is `{ type, payload }`; the payload fields depend on the type.
 */
export interface ChatStreamEvent {
  type:
    | "iteration"
    | "assistant_delta"
    | "reasoning_delta"
    | "reasoning_done"
    | "assistant_done"
    | "tool"
    | "tool_proposal"
    | "awaiting_approval"
    | "done"
    | "error";
  payload?: {
    text?: string;
    // tool events
    name?: string;
    summary?: string;
    ok?: boolean;
    // tool_proposal (a PendingAction) / awaiting_approval
    id?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    actionId?: string;
    tool?: string;
    // done
    content?: string;
    status?: string;
    // error
    error?: string;
  };
}
