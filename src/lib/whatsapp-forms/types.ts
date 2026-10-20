export const FIELD_KINDS = [
  "short_text",
  "email",
  "phone",
  "number",
  "long_text",
  "single_choice_radio",
  "single_choice_dropdown",
  "multi_choice_checkbox",
  "multi_choice_chips",
  "date",
  "date_range",
  "opt_in",
  "photo",
  "document",
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

export const DISPLAY_KINDS = ["heading", "subheading", "paragraph", "caption", "image", "link"] as const;
export type DisplayKind = (typeof DISPLAY_KINDS)[number];

export const CATEGORIES = [
  "SIGN_UP",
  "SIGN_IN",
  "APPOINTMENT_BOOKING",
  "LEAD_GENERATION",
  "CONTACT_US",
  "CUSTOMER_SUPPORT",
  "SURVEY",
  "OTHER",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const BINDING_TARGETS = [
  "name",
  "email",
  "birth_date",
  "address.zip",
  "address.city",
  "address.state",
  "custom_field",
  "consent_whatsapp",
] as const;
export type BindingTarget = (typeof BINDING_TARGETS)[number];

export const PUBLICATION_STATUSES = ["creating", "draft", "published", "throttled", "blocked", "deprecated", "failed"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const SEND_ORIGINS = [
  "inbox",
  "template_start",
  "template_scheduled",
  "template_bulk",
  "template",
  "campaign",
  "workflow",
  "elo",
] as const;
export type SendOrigin = (typeof SEND_ORIGINS)[number];

export const SEND_STATUSES = ["prepared", "sent", "failed", "responded"] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export const MATCH_RESULTS = ["token", "context", "unmatched_no_token", "unmatched_unknown_token", "unmatched_sender"] as const;
export type MatchResult = (typeof MATCH_RESULTS)[number];

export const APPLY_STATUSES = ["pending", "applied", "partial", "skipped"] as const;
export type ApplyStatus = (typeof APPLY_STATUSES)[number];

export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "boolean", "select", "multiselect"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const AUTOMATION_USES = ["trigger", "node"] as const;
export type AutomationUse = (typeof AUTOMATION_USES)[number];

export type MatchFilter = "" | "matched" | "unmatched";

export interface Option {
  id: string;
  title: string;
  description?: string;
}

export interface Binding {
  target: BindingTarget;
  customFieldKey?: string;
}

export interface Condition {
  fieldKey: string;
  value: string;
  negate?: boolean;
}

export interface Field {
  key: string;
  kind: FieldKind;
  question?: string;
  label: string;
  help?: string;
  required: boolean;
  sensitive: boolean;
  options?: Option[];
  min?: number;
  max?: number;
  pattern?: string;
  minDate?: string;
  maxDate?: string;
  mimeTypes?: string[];
  termsUrl?: string;
  binding?: Binding;
}

export interface Display {
  kind: DisplayKind;
  text?: string;
  mediaId?: string;
  url?: string;
}

export interface Block {
  key: string;
  display?: Display;
  field?: Field;
  visibleIf?: Condition;
}

export interface Branch {
  optionId: string;
  next: string;
}

export interface Route {
  next?: string;
  branchOn?: string;
  branches?: Branch[];
}

export interface Screen {
  key: string;
  title: string;
  blocks: Block[];
  route: Route;
  submitLabel: string;
}

export interface Document {
  schema: number;
  categories: Category[];
  screens: Screen[];
}

export interface Problem {
  screen?: string;
  block?: string;
  property?: string;
  code: string;
  limit?: number;
  message?: string;
}

export interface Version {
  id: string;
  workspaceId: string;
  formId: string;
  number: number;
  document: Document;
  flowVersion?: string;
  compilerVersion?: string;
  hash?: string;
  problems?: Problem[];
  createdBy?: string;
  createdAt: string;
}

export interface Form {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  kind: "built" | "external";
  draftVersionId: string;
  publishedVersionId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface PublicationBrief {
  metaWabaId: string;
  status: PublicationStatus;
  versionId: string;
}

export interface FormSummary {
  form: Form;
  publications: PublicationBrief[];
  sent: number;
  responses: number;
  lastResponseAt?: string;
}

export interface Publication {
  id: string;
  workspaceId: string;
  formId: string;
  wabaId: string;
  metaWabaId: string;
  metaFlowId?: string;
  metaName: string;
  versionId: string;
  status: PublicationStatus;
  problems?: Problem[];
  lastError?: string;
  previewUrl?: string;
  previewExpiresAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormDetail {
  form: Form;
  draft: Version;
  published?: Version;
  publications: Publication[];
}

export interface Outcome {
  metaWabaId: string;
  status: PublicationStatus;
  problems?: Problem[];
  error?: string;
  code?: string;
}

export interface PublishResult {
  outcomes: Outcome[];
  form: FormDetail;
}

export interface Preview {
  previewUrl: string;
  expiresAt: string;
}

export interface SendableForm {
  formId: string;
  name: string;
  versionId: string;
  metaFlowId: string;
  firstScreen: string;
}

export interface FormAutomation {
  workflowId: string;
  name: string;
  active: boolean;
  use: AutomationUse;
}

export interface SendCopy {
  header?: string;
  body: string;
  footer?: string;
  cta: string;
}

export interface Send {
  id: string;
  workspaceId: string;
  formId: string;
  versionId: string;
  publicationId: string;
  origin: SendOrigin;
  originRef?: string;
  entryId?: string;
  entryType?: string;
  conversationId?: string;
  leadId?: string;
  businessPhoneId: string;
  contactNumber: string;
  messageId?: string;
  templateId?: string;
  workflowRunId?: string;
  sentBy?: string;
  status: SendStatus;
  failureReason?: string;
  createdAt: string;
  sentAt?: string;
  respondedAt?: string;
}

export interface AnswerFile {
  id: string;
  name: string;
  mimeType: string;
  sha256?: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface Answer {
  key: string;
  kind: FieldKind;
  text?: string;
  optionIds?: string[];
  checked?: boolean;
  range?: DateRange;
  files?: AnswerFile[];
}

export interface AnswerProblem {
  key: string;
  code: string;
}

export interface Answers {
  values: Record<string, Answer>;
  unknown?: Record<string, unknown>;
  problems?: AnswerProblem[];
}

export interface FileOutcome {
  key: string;
  fileId: string;
  mediaId?: string;
  problem?: string;
}

export interface ApplyReport {
  changed?: string[];
  conflicts?: string[];
  refused?: string[];
  consent?: string;
  files?: FileOutcome[];
  resumed?: string;
  triggered?: boolean;
}

export interface Response {
  id: string;
  workspaceId: string;
  formId?: string;
  versionId?: string;
  sendId?: string;
  origin?: SendOrigin;
  match: MatchResult;
  inboundMessageId: string;
  conversationId?: string;
  entryId?: string;
  entryType?: string;
  leadId?: string;
  businessPhoneId: string;
  contactNumber: string;
  answers: Answers;
  applyStatus: ApplyStatus;
  report: ApplyReport;
  submittedAt: string;
  createdAt: string;
}

export interface ResponseRow extends Response {
  leadName?: string;
}

export interface ResponseDetail {
  response: Response;
  form: { id: string; name: string };
  version: Version;
  leadName?: string;
  revealed: boolean;
}

export interface Page<T> {
  items: T[];
  next?: string;
}

export interface OriginStat {
  origin: SendOrigin;
  sent: number;
  responses: number;
}

export interface DayStat {
  day: string;
  sent: number;
  responses: number;
}

export interface Stats {
  sends: Partial<Record<SendStatus, number>>;
  delivered: number;
  read: number;
  responses: number;
  medianSecondsToRespond?: number;
  byOrigin: OriginStat[];
  byDay: DayStat[];
}

export type Distribution = Record<string, number>;

export interface Limits {
  labels: Partial<Record<FieldKind, number>>;
  options: Partial<Record<FieldKind, [number, number]>>;
  displayText: Partial<Record<DisplayKind, number>>;
  help: number;
  optionTitle: number;
  optionDescription: number;
  submitLabel: number;
  componentsPerScreen: number;
  imagesPerScreen: number;
  linksPerScreen: number;
  optInsPerScreen: number;
  pickersPerScreen: number;
  routeBranches: number;
  uploads: number;
  uploadSizeKb: number;
  imageBytes: number;
  textInputMaxChars: number;
  textAreaMaxChars: number;
  documentMimeTypes: string[];
}

export interface BindingOption {
  target: BindingTarget;
  fieldKinds: FieldKind[];
}

export interface CustomFieldOption {
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  fieldKinds: FieldKind[];
}

export interface Starter {
  key: string;
  name: string;
  description: string;
  document: Document;
}

export interface Options {
  fieldKinds: FieldKind[];
  displayKinds: DisplayKind[];
  categories: Category[];
  limits: Limits;
  bindings: BindingOption[];
  customFields: CustomFieldOption[];
  starters: Starter[];
  flowJsonVersion: string;
}
