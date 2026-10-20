import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import { refuseUnhandled } from "@/lib/exhaustive";
import type {
  TiktokAccount,
  TiktokAccountChanges,
  TiktokAccountStatus,
  TiktokAccountUpdateBody,
} from "@/lib/tiktok/types";

export function accountStatusTone(status: TiktokAccountStatus): StatusChipTone {
  switch (status) {
    case "CONNECTED":
      return "healthy";
    case "NEEDS_RECONNECT":
    case "REVOKED":
      return "fault";
    case "DISCONNECTED":
      return "muted";
    default:
      return refuseUnhandled(status, "fault");
  }
}

export function accountStatusKey(status: TiktokAccountStatus): `status.${Lowercase<TiktokAccountStatus>}` {
  return `status.${status.toLowerCase() as Lowercase<TiktokAccountStatus>}`;
}

export type TiktokAccountNotice =
  | { kind: "reconnect"; purgeAfter?: string }
  | { kind: "disconnected"; purgeAfter?: string }
  | { kind: "reconnectSoon"; reconnectBy?: string }
  | { kind: "webhooks" }
  | { kind: "messaging"; refused: boolean };

export function isConnected(account: TiktokAccount): boolean {
  return account.status === "CONNECTED";
}

export function needsReconnect(account: TiktokAccount): boolean {
  return account.status === "NEEDS_RECONNECT" || account.status === "REVOKED";
}

export function reconnectable(account: TiktokAccount): boolean {
  return !isConnected(account) || account.reconnectSoon;
}

export function canModerateComments(account: TiktokAccount): boolean {
  return isConnected(account) && account.capabilities.canManageComments;
}

export function canReadComments(account: TiktokAccount): boolean {
  return isConnected(account) && account.capabilities.canReadComments;
}

export function canReadVideos(account: TiktokAccount): boolean {
  return isConnected(account) && account.capabilities.canReadVideos;
}

function messagingOff(account: TiktokAccount): boolean {
  return !account.capabilities.canReceiveMessages || !account.capabilities.canSendMessages;
}

function withPurge<K extends "reconnect" | "disconnected">(kind: K, purgeAfter: string | undefined) {
  return purgeAfter ? { kind, purgeAfter } : { kind };
}

export function accountNotices(account: TiktokAccount): TiktokAccountNotice[] {
  if (needsReconnect(account)) return [withPurge("reconnect", account.purgeAfter)];
  if (account.status === "DISCONNECTED") return [withPurge("disconnected", account.purgeAfter)];
  const notices: TiktokAccountNotice[] = [];
  if (account.reconnectSoon) {
    notices.push(account.reconnectBy ? { kind: "reconnectSoon", reconnectBy: account.reconnectBy } : { kind: "reconnectSoon" });
  }
  if (!account.webhooksHealthy) notices.push({ kind: "webhooks" });
  if (messagingOff(account)) notices.push({ kind: "messaging", refused: Boolean(account.statusReason) });
  return notices;
}

const REFERENCE_FIELDS = ["departmentId", "agentId", "workflowId", "pipelineId"] as const;

const FLAG_FIELDS = ["enableAgentResponses", "enableWorkflow", "enableAnalysis", "enableAutoStaging", "enableAutoMemory"] as const;

export function updateBodyOf(changes: TiktokAccountChanges): TiktokAccountUpdateBody {
  const body: TiktokAccountUpdateBody = {};
  for (const field of REFERENCE_FIELDS) {
    const value = changes[field];
    if (value !== undefined) body[field] = value ?? "";
  }
  for (const field of FLAG_FIELDS) {
    const value = changes[field];
    if (value !== undefined) body[field] = value;
  }
  if (changes.automationDisclosure !== undefined) body.automationDisclosure = changes.automationDisclosure;
  return body;
}

export type CommentManageBlock = "permission" | "capability";

export function commentManageBlock(account: TiktokAccount, canUpdate: boolean): CommentManageBlock | null {
  if (!canUpdate) return "permission";
  if (!canModerateComments(account)) return "capability";
  return null;
}
