import { LEAD_FIELD, type LeadRecord, type LeadUpdateEvent } from "@/lib/leads/types";
import { isNewerVersion } from "@/lib/leads/version";

export interface LeadCarrier {
  lead_id?: string;
  lead_version?: number;
  lead_name: string;
  lead_number: string;
  lead_picture?: string;
  blocked?: boolean;
}

export type LeadPatch = Partial<Pick<LeadCarrier, "lead_name" | "lead_number" | "lead_picture" | "blocked">> & {
  lead_version: number;
};

export interface LeadPresence {
  shown: boolean;
  version?: number;
}

export type LeadUpdatePlan = "ignore" | "advance" | "refetch";

const FIELDS_SHOWN_WITH_CONVERSATIONS: ReadonlySet<string> = new Set([
  LEAD_FIELD.name,
  LEAD_FIELD.number,
  LEAD_FIELD.profilePicture,
  LEAD_FIELD.blocked,
]);

function changes(carrier: LeadCarrier, patch: LeadPatch): boolean {
  return (Object.keys(patch) as (keyof LeadPatch)[]).some((key) => carrier[key] !== patch[key]);
}

export function patchLead<T extends LeadCarrier>(carrier: T, leadId: string, patch: LeadPatch): T {
  if (!leadId || carrier.lead_id !== leadId) return carrier;
  if (isNewerVersion(carrier.lead_version, patch.lead_version) || !changes(carrier, patch)) return carrier;
  return { ...carrier, ...patch };
}

export type CarrierFilter<T> = (carrier: T) => boolean;

const everyCarrier = () => true;

export function patchLeadList<T extends LeadCarrier>(
  carriers: T[],
  leadId: string,
  patch: LeadPatch,
  only: CarrierFilter<T> = everyCarrier,
): T[] {
  let changed = false;
  const next = carriers.map((carrier) => {
    const patched = only(carrier) ? patchLead(carrier, leadId, patch) : carrier;
    if (patched !== carrier) changed = true;
    return patched;
  });
  return changed ? next : carriers;
}

export function patchLeadColumns<T extends LeadCarrier, C extends { entries: T[] }>(
  columns: Map<string, C>,
  leadId: string,
  patch: LeadPatch,
  only: CarrierFilter<T> = everyCarrier,
): Map<string, C> {
  let next: Map<string, C> | null = null;
  for (const [key, column] of columns) {
    const entries = patchLeadList(column.entries, leadId, patch, only);
    if (entries === column.entries) continue;
    next ??= new Map(columns);
    next.set(key, { ...column, entries });
  }
  return next ?? columns;
}

export function leadPresence(carriers: Iterable<LeadCarrier | null | undefined>, leadId: string): LeadPresence {
  let shown = false;
  let version: number | undefined;
  for (const carrier of carriers) {
    if (!carrier || !leadId || carrier.lead_id !== leadId) continue;
    shown = true;
    if (isNewerVersion(carrier.lead_version, version)) version = carrier.lead_version;
  }
  return version === undefined ? { shown } : { shown, version };
}

export function planLeadUpdate(presence: LeadPresence, event: LeadUpdateEvent): LeadUpdatePlan {
  if (!presence.shown || !Number.isFinite(event.version)) return "ignore";
  if (!isNewerVersion(event.version, presence.version)) return "ignore";
  const touchesShownField = event.fields.some((field) => FIELDS_SHOWN_WITH_CONVERSATIONS.has(field));
  const isNextVersion = presence.version !== undefined && event.version === presence.version + 1;
  return !touchesShownField && isNextVersion ? "advance" : "refetch";
}

export function leadPatchFromRecord(record: LeadRecord, fields: readonly string[]): LeadPatch {
  const named = new Set(fields);
  return {
    lead_version: record.version,
    ...(named.has(LEAD_FIELD.name) ? { lead_name: record.name ?? "" } : {}),
    ...(named.has(LEAD_FIELD.blocked) ? { blocked: record.blocked } : {}),
    ...(named.has(LEAD_FIELD.number) ? { lead_number: record.number } : {}),
    ...(named.has(LEAD_FIELD.profilePicture) ? { lead_picture: record.profilePictureUrl ?? "" } : {}),
  };
}

export interface SubscribedLead {
  lead_id?: string;
  lead_version?: number;
  lead_name?: string;
  lead_number?: string;
  lead_picture?: string;
  blocked?: boolean;
}

export interface LeadReread {
  leadId: string;
  fields: readonly string[];
}

function subscribeCarries(answer: SubscribedLead, field: string): boolean {
  if (field === LEAD_FIELD.name) return true;
  if (field === LEAD_FIELD.number) return Boolean(answer.lead_number);
  if (field === LEAD_FIELD.profilePicture) return Boolean(answer.lead_picture);
  if (field === LEAD_FIELD.blocked) return typeof answer.blocked === "boolean";
  return !FIELDS_SHOWN_WITH_CONVERSATIONS.has(field);
}

export function vouchSubscribedLead<A extends SubscribedLead>(answer: A, reread: LeadReread | undefined): A {
  if (!reread || reread.leadId !== answer.lead_id) return answer;
  if (reread.fields.every((field) => subscribeCarries(answer, field))) return answer;
  return { ...answer, lead_version: undefined };
}

export function subscribedLeadPatch(answer: SubscribedLead): LeadPatch | null {
  if (!answer.lead_id || answer.lead_version === undefined) return null;
  return {
    lead_version: answer.lead_version,
    lead_name: answer.lead_name ?? "",
    ...(answer.lead_number ? { lead_number: answer.lead_number } : {}),
    ...(answer.lead_picture ? { lead_picture: answer.lead_picture } : {}),
    ...(typeof answer.blocked === "boolean" ? { blocked: answer.blocked } : {}),
  };
}

export function mergeSubscribedLead<T extends LeadCarrier>(carrier: T, answer: SubscribedLead): T {
  const patch = subscribedLeadPatch(answer);
  if (answer.lead_id && answer.lead_id === carrier.lead_id) {
    return patch ? patchLead(carrier, answer.lead_id, patch) : carrier;
  }
  const shown: T = {
    ...carrier,
    lead_id: answer.lead_id ?? carrier.lead_id,
    lead_name: answer.lead_name || carrier.lead_name,
    lead_number: answer.lead_number || carrier.lead_number,
    lead_picture: answer.lead_picture || carrier.lead_picture,
  };
  return answer.lead_id ? { ...shown, lead_version: answer.lead_version, ...patch } : shown;
}
