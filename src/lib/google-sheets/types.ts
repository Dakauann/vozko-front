export type SheetColumnType =
  | "text"
  | "long_text"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "boolean"
  | "choice"
  | "email"
  | "phone"
  | "url";

export type SheetColumnSource = "input" | "written_at" | "lead_name" | "lead_phone" | "lead_email" | "conversation_link" | "origin";

export interface SheetColumn {
  key: string;
  header: string;
  type: SheetColumnType;
  options?: string[];
  required: boolean;
  instruction?: string;
  source: SheetColumnSource;
  archived: boolean;
}

export type SheetStatus = "active" | "needs_attention";

export interface GoogleSheet {
  id: string;
  title: string;
  tabName: string;
  description?: string;
  timeZone: string;
  url: string;
  status: SheetStatus;
  reason?: string;
  reasonDetail?: string;
  version: number;
  columns: SheetColumn[];
  createdAt: string;
  updatedAt: string;
  lastWrittenAt?: string;
}

export interface GoogleSheetList {
  items: GoogleSheet[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface SheetColumnInput {
  header: string;
  type: SheetColumnType;
  options?: string[];
  required: boolean;
  instruction?: string;
  source: SheetColumnSource;
}

export interface SheetColumnUpdate {
  key: string;
  header?: string;
  instruction?: string;
  required?: boolean;
  archived?: boolean;
  options?: string[];
}

export interface CreateSheetInput {
  title: string;
  tabName?: string;
  description?: string;
  timeZone?: string;
  columns: SheetColumnInput[];
}

export interface SheetProblemRow {
  id: string;
  status: "held" | "failed";
  errorCode: string;
  errorDetail?: string;
  attempts: number;
  origin: "agent" | "workflow" | "copilot" | "manual";
  createdAt: string;
}

export interface SheetHealth {
  sheet: GoogleSheet;
  pending: number;
  inFlight: number;
  held: number;
  failed: number;
  written: number;
  writtenCapped: boolean;
  oldestPendingAt?: string;
  problems: SheetProblemRow[];
}

export interface SheetDataRow {
  id: string;
  values: Record<string, string | number | boolean | null>;
  status: "pending" | "in_flight" | "held" | "failed" | "written";
  rowNumber?: number;
  origin: SheetProblemRow["origin"];
  createdAt: string;
  writtenAt?: string;
  errorCode?: string;
}

export interface SheetRowsPage {
  items: SheetDataRow[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export interface SheetSourceInfo {
  source: Exclude<SheetColumnSource, "input">;
  type: SheetColumnType;
}

export interface SheetCatalog {
  types: SheetColumnType[];
  sources: SheetSourceInfo[];
  defaultTimeZone: string;
  maxHeader: number;
  maxInstruction: number;
  maxOption: number;
  rowErrorCodes: string[];
  attentionReasons: string[];
  writtenRetainDays: number;
}
