import type { PendingAction, ProposalField, SecretField, StoredProposal } from "./types";

export interface ProposalDictionary {
  label: (key: string) => string;
  yes: string;
  no: string;
}

export interface ProposalRow {
  key: string;
  label: string;
  value: string;
}

export function humanizeFieldKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function proposalRows(fields: ProposalField[] | undefined, dict: ProposalDictionary): ProposalRow[] {
  return (fields ?? [])
    .filter((f) => f.key.trim() !== "" && f.value.trim() !== "")
    .map((f) => ({ key: f.key, label: dict.label(f.key), value: plainValue(f.value, dict) }));
}

function plainValue(value: string, dict: ProposalDictionary): string {
  if (value === "true") return dict.yes;
  if (value === "false") return dict.no;
  return value;
}

export function pendingFromStored(stored: StoredProposal | undefined): PendingAction | null {
  if (!stored) return null;
  return {
    id: stored.id,
    toolName: stored.toolName,
    fields: stored.fields,
    preview: stored.preview,
    secrets: stored.secrets,
    status: stored.status,
  };
}

export function secretsFilled(secrets: SecretField[] | undefined, values: Record<string, string>): boolean {
  return (secrets ?? []).every((s) => (values[s.key] ?? "").trim() !== "");
}

export function secretsPayload(secrets: SecretField[] | undefined, values: Record<string, string>): Record<string, string> | undefined {
  if (!secrets || secrets.length === 0) return undefined;
  return Object.fromEntries(secrets.map((s) => [s.key, values[s.key] ?? ""]));
}

export function isOpenProposal(action: PendingAction | null | undefined): boolean {
  return !!action && (action.status === undefined || action.status === "pending");
}

export function expireOpen(action: PendingAction | null | undefined): PendingAction | null {
  if (!action) return null;
  return isOpenProposal(action) ? { ...action, status: "expired" } : action;
}
