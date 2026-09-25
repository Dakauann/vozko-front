export type ChatRole = "user" | "assistant" | "system" | "tool";

export interface ChatThread {
  id: string;
  title: string;
  model: string;
  lastMessageAt?: string | null;
  createdAt: string;
}

export interface ChatAttachment {
  mediaId: string;
  name: string;
  kind: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: ChatAttachment[];
  proposal?: StoredProposal;
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

export type ActionKind =
  | "connect_whatsapp_business"
  | "connect_unofficial_whatsapp"
  | "connect_instagram"
  | "connect_telegram"
  | "top_up_balance"
  | "manage_subscription";

export type CapabilityBlocker = "no_permission" | "at_limit" | "no_subscription" | "unavailable" | "needs_official_whatsapp";

export interface CapabilityStatus {
  capability: string;
  count: number;
  usage?: { used: number; total: number };
  canAdd: boolean;
  blocker?: CapabilityBlocker;
}

export interface ActionCard {
  kind: ActionKind;
  status?: CapabilityStatus;
  balanceMicros: number;
  subscriptionActive: boolean;
}

export interface ToolActivity {
  name: string;
  summary: string;
  ok: boolean;
  chart?: ChatChart;
  card?: ActionCard;
}

export interface ProposalField {
  key: string;
  value: string;
}

export type ProposalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ProposalPreview {
  kind: string;
  data: unknown;
}

export interface StoredProposal {
  id: string;
  toolName: string;
  fields: ProposalField[];
  preview?: ProposalPreview;
  status: ProposalStatus;
}

export interface PendingAction {
  id: string;
  toolName: string;
  args?: Record<string, unknown>;
  summary?: string;
  fields?: ProposalField[];
  preview?: ProposalPreview;
  status?: ProposalStatus;
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
    | "action_card"
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
    fields?: ProposalField[];
    preview?: ProposalPreview;
    actionId?: string;
    tool?: string;
    content?: string;
    status?: string;
    error?: string;
  };
}
