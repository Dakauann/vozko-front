import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import { refuseUnhandled } from "@/lib/exhaustive";
import type {
  MercadoLivreAccount,
  MercadoLivreAccountChanges,
  MercadoLivreAccountStatus,
  MercadoLivreAccountUpdateBody,
} from "@/lib/mercadolivre/types";

export function accountStatusTone(status: MercadoLivreAccountStatus): StatusChipTone {
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

export function accountStatusKey(status: MercadoLivreAccountStatus): `status.${Lowercase<MercadoLivreAccountStatus>}` {
  return `status.${status.toLowerCase() as Lowercase<MercadoLivreAccountStatus>}`;
}

export type MercadoLivreAccountNotice =
  | { kind: "reconnect" }
  | { kind: "purge"; purgeAfter: string }
  | { kind: "disconnected" };

function isOff(status: MercadoLivreAccountStatus): boolean {
  return status === "DISCONNECTED" || status === "REVOKED";
}

export function accountNotices(account: MercadoLivreAccount): MercadoLivreAccountNotice[] {
  const notices: MercadoLivreAccountNotice[] = [];
  if (account.needsReconnect) notices.push({ kind: "reconnect" });
  if (isOff(account.status)) {
    notices.push(account.purgeAfter ? { kind: "purge", purgeAfter: account.purgeAfter } : { kind: "disconnected" });
  }
  return notices;
}

export function reconnectable(account: MercadoLivreAccount): boolean {
  return account.needsReconnect || isOff(account.status);
}

const REFERENCE_FIELDS = ["departmentId", "agentId", "workflowId", "pipelineId"] as const;

export function updateBodyOf(changes: MercadoLivreAccountChanges): MercadoLivreAccountUpdateBody {
  const body: MercadoLivreAccountUpdateBody = {};
  for (const field of REFERENCE_FIELDS) {
    const value = changes[field];
    if (value !== undefined) body[field] = value ?? "";
  }
  if (changes.enableAgentResponses !== undefined) body.enableAgentResponses = changes.enableAgentResponses;
  if (changes.enableWorkflow !== undefined) body.enableWorkflow = changes.enableWorkflow;
  if (changes.automationDisclosure !== undefined) body.automationDisclosure = changes.automationDisclosure;
  return body;
}
