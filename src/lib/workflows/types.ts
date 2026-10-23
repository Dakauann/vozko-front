import type { NodePin } from "./node-pin";
import type { NodeTestBehavior } from "./node-test-behavior";
import type { RunStepsWindow } from "./run-steps";
import type { TriggerTestInput } from "./test-inputs";

export type WorkflowNodeType =
  | "trigger_first_message"
  | "trigger_message_received"
  | "trigger_webhook"
  | "trigger_call_received"
  | "trigger_form_submitted"
  | "trigger_agent_call"
  | "trigger_birthday"
  | "trigger_stage_added"
  | "action_play_audio"
  | "wait_dtmf"
  | "action_transfer_to_queue"
  | "action_send_text"
  | "action_send_template"
  | "action_send_email"
  | "action_send_carrier"
  | "action_send_platform_email"
  | "action_send_media"
  | "action_send_interactive"
  | "action_send_whatsapp_button"
  | "action_send_form"
  | "action_ai_agent"
  | "action_ai_extract"
  | "action_set_variable"
  | "action_http_request"
  | "action_run_tool"
  | "action_format_date"
  | "action_code"
  | "action_run_workflow"
  | "action_loop"
  | "action_get_current_time"
  | "action_create_calendar_event"
  | "action_reschedule_calendar_event"
  | "action_check_calendar_availability"
  | "action_add_sheet_row"
  | "action_assign_label"
  | "action_assign_member"
  | "action_transfer_department"
  | "action_finish_conversation"
  | "action_move_stage"
  | "action_manage_opportunity"
  | "action_update_lead"
  | "action_consent"
  | "action_reply_to_agent"
  | "wait_duration"
  | "wait_for_reply"
  | "wait_for_event"
  | "wait_schedule"
  | "condition_branch"
  | "condition_ai_classify"
  | "condition_text_match"
  | "condition_filter"
  | "condition_check_label"
  | "condition_check_stage"
  | "condition_check_opportunity"
  | "condition_channel"
  | "condition_consent"
  | "end"
  | "group"
  | "decoration_background";

export type WorkflowTriggerType =
  | "trigger_first_message"
  | "trigger_message_received"
  | "trigger_webhook"
  | "trigger_call_received"
  | "trigger_form_submitted"
  | "trigger_agent_call"
  | "trigger_birthday"
  | "trigger_stage_added";

export type WorkflowType = "messages" | "voice";

export type WorkflowStatus = "draft" | "active" | "paused" | "archived";


export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowNodePosition;
  config: Record<string, unknown>;
  pinned?: NodePin;
  testInputs?: TriggerTestInput[];
}

export interface WorkflowEdge {
  source: string;
  target: string;
  label?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}


export interface Workflow {
  id: string;
  workspaceId: string;
  departmentId?: string | null;
  name: string;
  description?: string;
  status: WorkflowStatus;
  type: WorkflowType;
  triggerType?: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  graph: WorkflowGraph;
  version: number;
  createdAt: string;
  updatedAt: string;
  requiredCampaignVars?: string[];
  publishedVersion?: number | null;
  publishedAt?: string | null;
  hasUnpublishedChanges?: boolean;
  entryPoints?: EntryPoint[];
  handles?: Record<string, HandleDefinition[]>;
}

export type EntryPointKind =
  | "message_received"
  | "first_message"
  | "webhook"
  | "form_submitted"
  | "agent_call"
  | "stage_added"
  | "call_received"
  | "lead_exit"
  | "birthday";

export type EntryReadiness = "ready" | "blocked";

export type EntryBlockReason =
  | "not_published"
  | "paused"
  | "webhook_inactive"
  | "no_webhook"
  | "no_form"
  | "form_inactive"
  | "no_agent_bound"
  | "no_channel"
  | "channel_paused"
  | "no_trigger"
  | "needs_message_trigger";

export type EntryChannelKind =
  | "whatsapp_campaign"
  | "unofficial_whatsapp_campaign"
  | "unofficial_whatsapp_instance"
  | "facebook_page"
  | "instagram_account"
  | "telegram_account"
  | "tiktok_account"
  | "mercadolivre_account"
  | "webchat_widget"
  | "email_inbox"
  | "rcs_sender"
  | "sms_route";

export interface EntryWebhook {
  active: boolean;
  authMode: "none" | "header_token" | "hmac";
  method: string;
}

export interface EntryForm {
  id: string;
  name: string;
  active: boolean;
  missing?: boolean;
}

export interface EntryAgent {
  id: string;
  name: string;
  active: boolean;
}

export interface EntryChannel {
  kind: EntryChannelKind;
  id: string;
  name: string;
  workflowEnabled: boolean;
  bound: boolean;
}

export interface EntryLeadExit {
  source: "template" | "campaign";
  id?: string;
  name: string;
  language?: string;
  button: string;
}

export interface EntryPointDetails {
  webhook?: EntryWebhook;
  forms?: EntryForm[];
  anyForm?: boolean;
  agents?: EntryAgent[];
  channels?: EntryChannel[];
  leadExits?: EntryLeadExit[];
}

export interface EntryPoint {
  kind: EntryPointKind;
  nodeId?: string;
  readiness: EntryReadiness;
  reason?: EntryBlockReason;
  details?: EntryPointDetails;
  lastReceivedAt?: string;
  lastOutcome?: WebhookDeliveryOutcome;
  lastReason?: string;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  type: WorkflowType;
  publishedAt: string;
  publishedBy?: string;
  createdAt: string;
  graph?: WorkflowGraph;
  handles?: Record<string, HandleDefinition[]>;
}


export type RunStatus =
  | "running"
  | "waiting"
  | "completed"
  | "error"
  | "cancelled";

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workspaceId: string;
  entryId: string;
  entryType: string;
  status: RunStatus;
  triggerNodeId?: string;
  currentNodeId?: string;
  state: Record<string, unknown>;
  wakeAt?: number;
  waitReason?: string;
  retryCount: number;
  error?: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  triggerType?: string;
  startedBy?: string;
  workflowVersion?: number;
  agentResult?: Record<string, unknown>;
  triggerData?: Record<string, unknown>;
}

export type RunStepStatus =
  | "executed"
  | "failed"
  | "skipped"
  | "cancelled"
  | "waiting"
  | "gate";

export type RunErrorKind =
  | "config"
  | "timeout"
  | "http_status"
  | "transport"
  | "script"
  | "panic"
  | "guard"
  | "gate"
  | "validation"
  | "cancelled"
  | "internal"
  | "handled";

export interface RunHttpExchange {
  method: string;
  url: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  status?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  latencyMs: number;
  tlsFallback?: boolean;
  redirects?: number;
  egressRefusal?: string;
  error?: string;
  truncated?: boolean;
}

export interface RunScriptLog {
  level: string;
  message: string;
}

export interface WorkflowRunLog {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: RunStepStatus | string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  executedAt: string;
  attempt: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs: number;
  branch?: string;
  errorKind?: RunErrorKind | string;
  errorChain?: string[];
  stack?: string;
  scriptLogs?: RunScriptLog[];
  http?: RunHttpExchange[];
  pinned?: boolean;
  simulated?: boolean;
  notice?: string;
  unresolvedRefs?: string[];
}

export interface RunDetail {
  run: WorkflowRun;
  logs: WorkflowRunLog[];
  steps?: RunStepsWindow;
}

export type WebhookDeliveryOutcome =
  | "accepted"
  | "duplicate"
  | "already_running"
  | "ignored"
  | "rejected";

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  workflowId: string;
  workspaceId: string;
  receivedAt: string;
  outcome: WebhookDeliveryOutcome;
  reason?: string;
  httpStatus: number;
  entryResolution?: string;
  entryId?: string;
  entryType?: string;
  runId?: string;
  latencyMs: number;
  payloadKeys?: string[];
}


export type RuntimeAlertKind =
  | "workflow_called_inactive"
  | "node_failing"
  | "webhook_rejecting"
  | "run_stuck"
  | "agent_tool_failing"
  | "inbound_lookup_failed";

export type RuntimeAlertFixAction =
  | "publish"
  | "open_run"
  | "open_node"
  | "view_deliveries"
  | "open_agent"
  | "open_conversation";

export interface RuntimeAlert {
  id: string;
  kind: RuntimeAlertKind;
  severity: "high" | "medium";
  fixAction: RuntimeAlertFixAction;
  status: "open" | "resolved";
  workflowId?: string;
  nodeId?: string;
  agentId?: string;
  subject?: string;
  runId?: string;
  entryId?: string;
  entryType?: string;
  sample?: string;
  resolvedAt?: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export interface ConversationWorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowVersion?: number;
  entryId: string;
  entryType: string;
  status: RunStatus;
  triggerType?: string;
  startedBy?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  waitReason?: string;
  currentNodeId?: string;
  currentNodeType?: string;
  currentNodeName?: string;
}

export interface CreateWorkflowPayload {
  name: string;
  description?: string;
  type: WorkflowType;
  triggerType?: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  graph: WorkflowGraph;
}

export interface UpdateWorkflowPayload {
  name: string;
  description?: string;
  type: WorkflowType;
  triggerType?: WorkflowTriggerType;
  triggerConfig?: Record<string, unknown>;
  graph: WorkflowGraph;
  revision: number;
}

export interface StartRunPayload {
  entryId: string;
  entryType: string;
  message?: string;
}


export interface WorkflowListMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export type WorkflowListResponse = PagedResponse<Workflow>;

export interface PagedResponse<T> {
  data?: T[];
  items?: T[];
  meta?: Partial<WorkflowListMeta>;
}

export type RunListResponse = PagedResponse<WorkflowRun>;


export type NodeCategory =
  | "trigger"
  | "action"
  | "ai"
  | "messaging"
  | "logic"
  | "wait"
  | "condition"
  | "end"
  | "visual";

export type WorkflowNodeScope = "shared" | "whatsapp" | "voice";

export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface FieldRule {
  field: string;
  values: string[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  options?: ConfigFieldOption[];
  optionsSource?: string;
  min?: number;
  max?: number;
  step?: number;
  visibleWhen?: FieldRule;
  requiredWhen?: FieldRule;
}

export interface HandleDefinition {
  id: string;
  label: string;
  optional?: boolean;
}

export interface OutputKeyDefinition {
  key: string;
  description: string;
}

export interface LintIssue {
  code: string;
  severity: "blocking" | "advisory" | "info";
  nodeId?: string;
  field?: string;
  edgeRef?: string;
  path?: string;
  message: string;
  hint?: string;
}

export interface NodeDefinition {
  type: WorkflowNodeType;
  category: NodeCategory;
  scopes?: WorkflowNodeScope[];
  label: string;
  description: string;
  icon: string;
  outputs?: HandleDefinition[];
  dynamicHandles?: boolean;
  outputKeys?: OutputKeyDefinition[];
  defaultConfig: Record<string, unknown>;
  configSchema: ConfigField[] | null;
  resizable?: boolean;
  channelLimits?: Record<string, ChannelInteractiveLimits>;
  testBehavior?: NodeTestBehavior;
}

export interface ChannelInteractiveLimits {
  maxOptionsButtons: number;
  maxOptionsList: number;
  maxLabelRunes: number;
  maxPayloadBytes: number;
  supportsDescriptions: boolean;
}


export type TestMode = "direct" | "mock" | "execute_until";

export type DependencySource =
  | "previous_node"
  | "specific_node"
  | "trigger"
  | "ai"
  | "system"
  | "custom"
  | "agent_variable"
  | "caller";

export interface MockFieldSpec {
  key: string;
  display_name: string;
  source: DependencySource;
  source_node?: string;
  hint?: string;
  optional?: boolean;
}

export interface NodeAnalysis {
  node_id: string;
  node_type: WorkflowNodeType;
  node_label: string;
  test_mode: TestMode;
  mock_fields: MockFieldSpec[];
  can_run_direct: boolean;
  has_ai_deps: boolean;
  message: string;
  trigger?: unknown;
}

export interface TestNodePayload {
  mockedState?: Record<string, unknown>;
  triggerVars?: Record<string, unknown>;
  skipExecution?: boolean;
  confirmRealCalls?: boolean;
  trigger?: TestNodeTrigger;
}

export interface TestNodeTrigger {
  nodeId: string;
  input: unknown;
}

type BuilderMessageRole = "user" | "assistant" | "tool" | "system";

export interface BuilderSessionMessage {
  role: BuilderMessageRole;
  text: string;
  tool?: string;
  ok?: boolean;
  at: string;
}

export interface BuilderSession {
  id: string;
  workspaceId: string;
  workflowId?: string;
  mode: string;
  model?: string;
  title: string;
  messages?: BuilderSessionMessage[];
  messageCount: number;
  valid: boolean;
  startedAt: string;
  endedAt?: string;
}

export interface TestNodeResult {
  node_id: string;
  node_type: WorkflowNodeType;
  success: boolean;
  error?: string;
  interpolated_config: Record<string, unknown>;
  execution_output?: Record<string, unknown>;
  execution_duration_ms: number;
  state_after?: Record<string, unknown>;
  pinned?: boolean;
  step?: WorkflowRunLog;
  upstream_steps?: WorkflowRunLog[];
}


export function isInteractivePromptType(nodeType: string): boolean {
  return (
    nodeType === "action_send_interactive" ||
    nodeType === "action_send_whatsapp_button"
  );
}
