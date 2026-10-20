import type {
  EntryBlockReason,
  EntryChannel,
  EntryChannelKind,
  EntryPoint,
  EntryPointDetails,
  EntryPointKind,
} from "./types";

export const ENTRY_POINT_KINDS: readonly EntryPointKind[] = [
  "message_received",
  "first_message",
  "webhook",
  "form_submitted",
  "agent_call",
  "campaign_sent",
  "stage_added",
  "no_reply",
  "call_received",
  "manual",
  "lead_exit",
];

export const ENTRY_BLOCK_REASONS: readonly EntryBlockReason[] = [
  "not_published",
  "paused",
  "webhook_inactive",
  "no_webhook",
  "no_form",
  "form_inactive",
  "no_agent_bound",
  "no_channel",
  "channel_paused",
  "no_trigger",
];

const CHANNEL_ROUTES: Record<EntryChannelKind, string> = {
  whatsapp_campaign: "/dashboard/whatsapp-campaigns",
  unofficial_whatsapp_campaign: "/dashboard/unofficial-whatsapp-campaigns",
  unofficial_whatsapp_instance: "/dashboard/unofficial-whatsapp",
  facebook_page: "/dashboard/facebook-pages",
  instagram_account: "/dashboard/instagram-accounts",
  telegram_account: "/dashboard/telegram-accounts",
  tiktok_account: "/dashboard/tiktok-accounts",
  mercadolivre_account: "/dashboard/mercadolivre-accounts",
  webchat_widget: "/dashboard/webchat",
};

export const ENTRY_CHANNEL_KINDS = Object.keys(CHANNEL_ROUTES) as EntryChannelKind[];

const FORMS_ROUTE = "/dashboard/whatsapp-forms";
const AGENTS_ROUTE = "/dashboard/agents";
const INLINE_KINDS = new Set<EntryPointKind>(["webhook", "agent_call"]);
export const MAX_SHOWN_CHANNELS = 10;

export type EntryPointFix =
  | { kind: "publish" }
  | { kind: "resume" }
  | { kind: "open_node"; nodeId: string }
  | { kind: "link"; href: string };

export interface EntryPointCopy {
  labelKey: string;
  ready: boolean;
  reasonKey: string | null;
  inlineKey: string | null;
  fix: EntryPointFix | null;
  fixKey: string | null;
}

function isKnownKind(kind: unknown): kind is EntryPointKind {
  return ENTRY_POINT_KINDS.includes(kind as EntryPointKind);
}

function isKnownReason(reason: unknown): reason is EntryBlockReason {
  return ENTRY_BLOCK_REASONS.includes(reason as EntryBlockReason);
}

export function channelHref(channel: Pick<EntryChannel, "kind" | "id">): string | null {
  const route = CHANNEL_ROUTES[channel.kind];
  return route ? `${route}/${encodeURIComponent(channel.id)}` : null;
}

function formFix(details: EntryPointDetails | undefined): EntryPointFix {
  const form = details?.forms?.find((candidate) => !candidate.missing && candidate.id);
  return { kind: "link", href: form ? `${FORMS_ROUTE}/${encodeURIComponent(form.id)}` : FORMS_ROUTE };
}

function agentFix(details: EntryPointDetails | undefined): EntryPointFix {
  const agents = details?.agents ?? [];
  const agent = agents.find((candidate) => !candidate.active && candidate.id) ?? agents.find((candidate) => candidate.id);
  return { kind: "link", href: agent ? `${AGENTS_ROUTE}/${encodeURIComponent(agent.id)}` : AGENTS_ROUTE };
}

function channelFix(details: EntryPointDetails | undefined): EntryPointFix | null {
  const channels = details?.channels ?? [];
  const target = channels.find((candidate) => candidate.bound && !candidate.workflowEnabled) ?? channels.find((candidate) => !candidate.workflowEnabled);
  const href = target ? channelHref(target) : null;
  return href ? { kind: "link", href } : null;
}

function fixOf(reason: EntryBlockReason, entry: EntryPoint): Pick<EntryPointCopy, "fix" | "fixKey"> {
  switch (reason) {
    case "not_published":
      return { fix: { kind: "publish" }, fixKey: "fixes.publish" };
    case "paused":
      return { fix: { kind: "resume" }, fixKey: "fixes.resume" };
    case "webhook_inactive":
    case "no_webhook":
      return entry.nodeId ? { fix: { kind: "open_node", nodeId: entry.nodeId }, fixKey: "fixes.openWebhook" } : { fix: null, fixKey: null };
    case "no_form":
    case "form_inactive":
      return { fix: formFix(entry.details), fixKey: "fixes.openForm" };
    case "no_agent_bound":
      return { fix: agentFix(entry.details), fixKey: "fixes.openAgent" };
    case "channel_paused": {
      const fix = channelFix(entry.details);
      return { fix, fixKey: fix ? "fixes.openChannel" : null };
    }
    case "no_channel":
    case "no_trigger":
      return { fix: null, fixKey: null };
  }
}

export function entryPointCopy(entry: EntryPoint): EntryPointCopy {
  const kind = isKnownKind(entry.kind) ? entry.kind : null;
  const labelKey = kind ? `kinds.${kind}` : "kinds.unknown";
  if (entry.readiness === "ready") {
    return { labelKey, ready: true, reasonKey: null, inlineKey: null, fix: null, fixKey: null };
  }
  const reason = isKnownReason(entry.reason) ? entry.reason : null;
  const fix = reason ? fixOf(reason, entry) : { fix: null, fixKey: null };
  return {
    labelKey,
    ready: false,
    reasonKey: reason ? `reasons.${reason}` : "reasons.unknown",
    inlineKey: kind && INLINE_KINDS.has(kind) ? `inline.${kind}` : null,
    ...fix,
  };
}

export function entryPointsByNode(entries: readonly EntryPoint[] | undefined): Map<string, EntryPoint> {
  const byNode = new Map<string, EntryPoint>();
  for (const entry of entries ?? []) if (entry.nodeId) byNode.set(entry.nodeId, entry);
  return byNode;
}

export function shownChannels(details: EntryPointDetails | undefined): EntryChannel[] {
  return (details?.channels ?? []).slice(0, MAX_SHOWN_CHANNELS);
}
