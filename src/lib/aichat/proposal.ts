import type { Approval, PendingAction, ProposalField, StoredProposal } from "./types";

export interface ProposalDictionary {
  label: (key: string, tool?: string) => string;
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

export function proposalRows(fields: ProposalField[] | undefined, dict: ProposalDictionary, tool?: string): ProposalRow[] {
  return (fields ?? [])
    .filter((f) => f.key.trim() !== "" && f.value.trim() !== "")
    .map((f) => ({ key: f.key, label: dict.label(f.key, tool), value: plainValue(f.value, dict) }));
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
    choices: stored.choices,
    status: stored.status,
  };
}

type CardInput = { key: string };

function inputsFilled(inputs: CardInput[] | undefined, values: Record<string, string>): boolean {
  return (inputs ?? []).every((input) => (values[input.key] ?? "").trim() !== "");
}

function inputsPayload(inputs: CardInput[] | undefined, values: Record<string, string>): Record<string, string> | undefined {
  if (!inputs || inputs.length === 0) return undefined;
  return Object.fromEntries(inputs.map((input) => [input.key, values[input.key] ?? ""]));
}

export function approvalReady(pending: PendingAction, secrets: Record<string, string>, choices: Record<string, string>): boolean {
  return inputsFilled(pending.secrets, secrets) && inputsFilled(pending.choices, choices);
}

export function approvalPayload(pending: PendingAction, secrets: Record<string, string>, choices: Record<string, string>): Approval {
  const approval: Approval = {};
  const sentSecrets = inputsPayload(pending.secrets, secrets);
  const sentChoices = inputsPayload(pending.choices, choices);
  if (sentSecrets) approval.secrets = sentSecrets;
  if (sentChoices) approval.choices = sentChoices;
  return approval;
}

export function isOpenProposal(action: PendingAction | null | undefined): boolean {
  return !!action && (action.status === undefined || action.status === "pending");
}

export function expireOpen(action: PendingAction | null | undefined): PendingAction | null {
  if (!action) return null;
  return isOpenProposal(action) ? { ...action, status: "expired" } : action;
}
