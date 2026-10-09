import type { CrmFilter } from "@/lib/crm/board";

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
  url?: string;
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
  running?: boolean;
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

export type StudioProjectKind = "image" | "video";

export const CHAT_MODES = ["ask", "edit", "full"] as const;

export type ChatMode = (typeof CHAT_MODES)[number];

export interface StudioView {
  surface: "studio";
  projectId: string;
  projectKind: StudioProjectKind;
}

export interface LeadsView {
  surface: "leads";
  leadFilter?: CrmFilter;
  selectedLeads?: number;
}

export type ChatView = AttendanceView | StudioView | LeadsView;

export interface AttendanceView {
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

export type OfferKind =
  | "connect_whatsapp_business"
  | "connect_unofficial_whatsapp"
  | "connect_instagram"
  | "connect_facebook"
  | "connect_telegram"
  | "create_webchat"
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

export interface OfferCard {
  kind: OfferKind;
  status?: CapabilityStatus;
  balanceMicros: number;
  subscriptionActive: boolean;
}

export interface NavigationCard {
  kind: "open_screen";
  destination: { screen: string; params?: Record<string, string> };
}

export interface CallCard {
  kind: "place_call";
  call: { phoneNumber: string; trunkId?: string; trunkName?: string };
}

export interface AdReadinessCard {
  kind: "ad_readiness";
  adAccountId: string;
}

export interface ConnectAdAccountCard {
  kind: "connect_ad_account";
}

export interface AskCard {
  kind: "ask";
  question: { text: string; options: string[] };
}

export type ActionCard = OfferCard | NavigationCard | CallCard | AdReadinessCard | ConnectAdAccountCard | AskCard;

export type ActionKind = ActionCard["kind"];

export interface ToolSubject {
  kind: string;
  key: string;
  label: string;
}

export interface ToolActivity {
  name: string;
  summary: string;
  ok: boolean;
  subject?: ToolSubject;
  chart?: ChatChart;
  card?: ActionCard;
  image?: ChatMedia;
}

export type ChatMediaKind = "image" | "audio" | "video";

export interface ChatMedia {
  kind?: ChatMediaKind;
  url: string;
  mediaId: string;
  alt: string;
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

export interface SecretField {
  key: string;
  label: string;
}

export type ChoiceKind = "image_model" | "music_model" | "voice_model";

export interface ChoiceField {
  key: string;
  kind: ChoiceKind;
  default?: string;
}

export interface Approval {
  secrets?: Record<string, string>;
  choices?: Record<string, string>;
}

export interface StoredProposal {
  id: string;
  toolName: string;
  fields: ProposalField[];
  preview?: ProposalPreview;
  secrets?: SecretField[];
  choices?: ChoiceField[];
  status: ProposalStatus;
}

export interface PendingAction {
  id: string;
  toolName: string;
  args?: Record<string, unknown>;
  summary?: string;
  fields?: ProposalField[];
  preview?: ProposalPreview;
  secrets?: SecretField[];
  choices?: ChoiceField[];
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
    | "image"
    | "tool_proposal"
    | "awaiting_approval"
    | "screen_command"
    | "done"
    | "error";
  payload?: {
    text?: string;
    name?: string;
    summary?: string;
    ok?: boolean;
    changed?: string;
    id?: string;
    toolName?: string;
    args?: Record<string, unknown>;
    fields?: ProposalField[];
    preview?: ProposalPreview;
    secrets?: SecretField[];
    choices?: ChoiceField[];
    actionId?: string;
    tool?: string;
    content?: string;
    status?: string;
    error?: string;
    subject?: ToolSubject;
  };
}
