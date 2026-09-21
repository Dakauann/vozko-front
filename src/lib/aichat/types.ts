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

export interface ToolActivity {
  name: string;
  summary: string;
  ok: boolean;
}

export interface PendingAction {
  id: string;
  toolName: string;
  args?: Record<string, unknown>;
  summary?: string;
}

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
    name?: string;
    summary?: string;
    ok?: boolean;
    id?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    actionId?: string;
    tool?: string;
    content?: string;
    status?: string;
    error?: string;
  };
}
