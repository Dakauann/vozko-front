
export type WorkflowNodeType =
  | "trigger_first_message"
  | "trigger_message_received"
  | "trigger_webhook"
  // Actions
  | "action_send_text"
  | "action_send_template"
  | "action_send_email"
  | "action_send_media"
  | "action_send_interactive"
  // Retired wire value for the interactive prompt. The backend normalizes it on
  // read, so it only reaches the client from a graph held in memory from before
  // a save; the editor still recognises it so such a graph renders correctly.
  | "action_send_whatsapp_button"
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
  | "action_schedule_meeting"
  | "action_reschedule_meeting"
  | "action_check_calendar_availability"
  | "action_assign_label"
  | "action_assign_member"
  | "action_transfer_department"
  | "action_finish_conversation"
  // Control flow
  | "wait_duration"
  | "wait_for_reply"
  | "wait_for_event"
  | "wait_schedule"
  | "condition_branch"
  | "condition_ai_classify"
  | "condition_text_match"
  | "condition_filter"
  | "condition_check_label"
  | "condition_channel"
  | "end"
  // Visual
  | "group"
  | "decoration_background";

export type WorkflowTriggerType =
  | "trigger_first_message"
  | "trigger_message_received"
  | "trigger_webhook";

export type WorkflowType = "messages";

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
  currentNodeId: string;
  state: Record<string, unknown>;
  wakeAt?: string;
  waitReason?: string;
  retryCount: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface WorkflowRunLog {
  id: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
  executedAt: string;
}

export interface RunDetail {
  run: WorkflowRun;
  logs: WorkflowRunLog[];
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
}

export interface StartRunPayload {
  entryId: string;
  entryType: string;
}


export interface WorkflowListMeta {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface WorkflowListResponse {
  data?: Workflow[];
  items?: Workflow[];
  meta?: Partial<WorkflowListMeta>;
}

export interface RunListResponse {
  data?: WorkflowRun[];
  items?: WorkflowRun[];
  meta?: Partial<WorkflowListMeta>;
}


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

export type WorkflowNodeScope = "shared" | "whatsapp";

export interface ConfigFieldOption {
  value: string;
  label: string;
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

// LintIssue mirrors the backend workflow.LintIssue, the single source of truth
// for what is wrong with a graph (the same rules `activate` enforces).
export interface LintIssue {
  code: string;
  severity: "blocking" | "advisory";
  nodeId?: string;
  field?: string;
  edgeRef?: string;
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
  // Base/static output handles (config-independent). Dynamic nodes also resolve a
  // fuller, config-dependent set from the backend (see dynamicHandles).
  outputs?: HandleDefinition[];
  // True when this node type's handles depend on its config (ai_agent tool routes,
  // text_match cases). The editor learns which types are dynamic from THIS flag ,
  // not a hardcoded list, and resolves their handles via /workflows/resolve-handles.
  dynamicHandles?: boolean;
  outputKeys?: OutputKeyDefinition[];
  defaultConfig: Record<string, unknown>;
  configSchema: ConfigField[] | null;
  resizable?: boolean;
  // Per-channel rendering limits, keyed by entry type. Only the interactive
  // prompt node sets this: one option list is rendered by several channels with
  // different caps, so the editor needs the numbers to tell the author which
  // options a given channel will actually show.
  channelLimits?: Record<string, ChannelInteractiveLimits>;
}

// What one channel will render for a single-choice prompt. Mirrors the
// backend's channel.InteractiveLimits.
export interface ChannelInteractiveLimits {
  maxOptionsButtons: number;
  maxOptionsList: number;
  // 0 means the provider documents no label limit.
  maxLabelRunes: number;
  // Bounds the option id. Bytes, not characters.
  maxPayloadBytes: number;
  // Only WhatsApp list rows have a description slot.
  supportsDescriptions: boolean;
}


export type TestMode = "direct" | "mock" | "execute_until";

export type DependencySource =
  | "previous_node"
  | "specific_node"
  | "trigger"
  | "ai"
  | "system"
  | "custom";

export interface MockFieldSpec {
  key: string;
  display_name: string;
  source: DependencySource;
  source_node?: string;
  hint?: string;
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
}

export interface TestNodePayload {
  mockedState?: Record<string, unknown>;
  triggerVars?: Record<string, unknown>;
  skipExecution?: boolean;
}

export type BuilderMessageRole = "user" | "assistant" | "tool" | "system";

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
}


/** The interactive prompt node, under either its current or its retired wire
 *  value. Used wherever the editor branches on "is this the options node". */
export function isInteractivePromptType(nodeType: string): boolean {
  return (
    nodeType === "action_send_interactive" ||
    nodeType === "action_send_whatsapp_button"
  );
}
