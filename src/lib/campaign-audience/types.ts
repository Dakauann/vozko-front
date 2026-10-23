import type { CrmFilter } from "@/lib/crm/board";
import type { Document } from "@/lib/email-design/types";
import type { UnofficialWhatsAppMessageSpec } from "@/lib/unofficial-whatsapp-campaigns/types";

export const AUDIENCE_CHANNELS = ["email", "whatsapp", "unofficial", "carrier"] as const;

export type AudienceChannel = (typeof AUDIENCE_CHANNELS)[number];

export type AudienceSource = "leads" | "list";

export type MissingPolicy = "text" | "exclude";

export type LeadsPick = "filter" | "everyone" | "ids" | "first_n";

export const LITERAL_AUDIENCE_SOURCE = "literal";

export interface AudienceVariable {
  key: string;
  source?: string;
  value?: string;
  missing?: MissingPolicy;
  text?: string;
}

export interface AudienceSelection {
  mode: "all_matching" | "everyone" | "ids" | "first_n";
  limit?: number;
  sort?: { field: string; key?: string; desc?: boolean }[];
  filter?: CrmFilter;
  ids?: string[];
  excludeIds?: string[];
  expectedCount?: number;
  fingerprint?: string;
}

export interface AudienceSpec {
  source: AudienceSource;
  selection?: AudienceSelection;
  listId?: string;
  variables?: AudienceVariable[];
}

export interface ChannelFields {
  templateId?: string;
  businessPhoneId?: string;
  instanceId?: string;
  message?: UnofficialWhatsAppMessageSpec;
  subject?: string;
  document?: Document;
  kind?: string;
  workflowId?: string;
  agentId?: string;
}

export interface ListContext extends ChannelFields {
  variables?: AudienceVariable[];
}

export interface VariableCount {
  key: string;
  name: string;
  header: boolean;
  source?: string;
  value?: string;
  missing: number;
  policy: MissingPolicy | "";
  text?: string;
  fallback?: string;
  suggested: boolean;
  choiceRequired: boolean;
}

export const AUDIENCE_BLOCKERS = [
  "variable_choice_required",
  "variable_source_required",
  "list_variables_missing",
  "list_metadata_missing",
  "leads_metadata_unavailable",
  "template_required",
  "message_required",
] as const;

export type AudienceBlocker = (typeof AUDIENCE_BLOCKERS)[number];

export interface SelectionCount {
  selected: number;
  confirmCount: number;
  fingerprint?: string;
}

export interface ListCount {
  id: string;
  rows: number;
  existing: number;
  new: number;
}

export interface MetadataGap {
  key: string;
  missing: number;
  lines: number[];
}

export interface AudienceCount {
  channel: AudienceChannel;
  source: AudienceSource;
  matched: number;
  withContact: number;
  sendable: number | null;
  out: Record<string, number>;
  outTotal: number;
  requiredVariables: number;
  variables: VariableCount[];
  blockers: AudienceBlocker[];
  selection: SelectionCount | null;
  list: ListCount | null;
  metadataMissing: MetadataGap[];
}

export const VARIABLE_FILLS = ["column", "name", "lead", "fixed", "none"] as const;

export type VariableFill = (typeof VARIABLE_FILLS)[number];

export interface VariableColumn {
  slot: number;
  column?: string;
  field?: string;
  fill: VariableFill;
}

export interface MetadataColumn {
  key: string;
  label: string;
}

export interface SkippedLine {
  line: number;
  reason: string;
  raw: string;
  duplicateOf?: number;
}

export interface ListPreview {
  id: string;
  channel: AudienceChannel;
  contact: "phone" | "email";
  fileName: string;
  lines: number;
  rows: number;
  existing: number;
  new: number;
  header: boolean;
  columns: {
    contact?: string;
    name?: string;
    variables: VariableColumn[];
    metadata: MetadataColumn[];
  };
  variableColumns: number;
  skipped: {
    total: number;
    byReason: Record<string, number>;
    lines: SkippedLine[];
  };
  metadataMissing: MetadataGap[];
  expiresAt: string | null;
}

export interface ListRow {
  id: string;
  line: number;
  contact: string;
  name: string;
  variables: string[];
  metadata: Record<string, unknown>;
  missing: number[];
  metadataMissing: string[];
  existing: boolean;
}

export interface RowPage {
  items: ListRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export interface RowInput {
  contact: string;
  name?: string;
  variables?: string[];
  metadata?: Record<string, unknown>;
}

export interface SavedRow {
  id: string;
  line: number;
  contact: string;
  name: string;
  variables: string[];
  metadata: Record<string, unknown>;
}

export interface RowQuery {
  search: string;
  missingOnly: boolean;
  page: number;
  limit: number;
}

export interface BindableField {
  source: string;
  kind: "lead" | "custom";
  column: string;
  key?: string;
  label?: string;
  type?: string;
}

export interface TemplateSuggestion {
  slot: number;
  source: string;
}

export interface TemplateSuggestions {
  templateId: string;
  suggestions: TemplateSuggestion[];
}

export type SampleFormat = "csv" | "xlsx";

export const AUDIENCE_LEAD_STATUSES = ["ready", "out", "undecided"] as const;

export type AudienceLeadStatus = (typeof AUDIENCE_LEAD_STATUSES)[number];

export interface AudienceLead {
  leadId: string;
  line: number;
  name: string;
  contact: string;
  status: AudienceLeadStatus;
  reason: string;
  missing: string[];
  metadataMissing: string[];
  variables: string[];
}

export interface AudienceLeadQuery {
  status?: AudienceLeadStatus;
  reason?: string;
  variable?: string;
  metadataKey?: string;
  search: string;
  page: number;
  limit: number;
}

export interface AudienceLeadPage {
  items: AudienceLead[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}
