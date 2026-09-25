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

export type ChatChartType =
  | "bar"
  | "horizontal_bar"
  | "stacked_bar"
  | "line"
  | "area"
  | "stacked_area"
  | "pie"
  | "donut"
  | "scatter"
  | "radar"
  | "table";

export type ChatValueKind = "text" | "date" | "number" | "percent" | "minutes" | "money";

export interface ChatChartSeries {
  key: string;
  label: string;
  kind: ChatValueKind;
  values: (number | null)[];
}

export interface ChatChart {
  type: ChatChartType;
  title: string;
  subtitle?: string;
  xLabel: string;
  xKind: ChatValueKind;
  categories?: string[];
  xValues?: (number | null)[];
  series: ChatChartSeries[];
}

export const CHART_OTHER_CATEGORY = "__other__";

export interface ChatView {
  surface: "attendance";
  dateFrom?: string;
  dateTo?: string;
  departmentId?: string;
  memberId?: string;
  channel?: string;
  campaignId?: string;
  campaignType?: string;
  includeAi?: boolean;
}

export interface ToolActivity {
  name: string;
  summary: string;
  ok: boolean;
  chart?: ChatChart;
}

export interface ProposalField {
  key: string;
  value: string;
}

export interface PendingAction {
  id: string;
  toolName: string;
  args?: Record<string, unknown>;
  summary?: string;
  fields?: ProposalField[];
}

export interface ChatStreamEvent {
  type:
    | "iteration"
    | "assistant_delta"
    | "reasoning_delta"
    | "reasoning_done"
    | "assistant_done"
    | "tool"
    | "tool_start"
    | "chart"
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
