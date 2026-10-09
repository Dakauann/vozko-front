import type { CodedRefusal } from "@/lib/api/coded-error";
import type { VersionedSaveResult } from "@/lib/api/versioned-save";
import type { CreatedLead, LeadDuplicate, LeadRecord, LeadRelationKind } from "@/lib/leads/types";

import {
  createLeadBody,
  leadDraftIssues,
  refusalPath,
  updateLeadBody,
  type CreateLeadBody,
  type LeadSheetDraft,
  type RelativeDraft,
  type UpdateLeadBody,
} from "./sheet";

type Outcome<T> = { result: T; error: null } | { result: null; error: CodedRefusal };

export interface LeadSheetActions {
  create: (body: CreateLeadBody) => Promise<{ lead: CreatedLead; error: null } | { lead: null; error: CodedRefusal }>;
  update: (leadId: string, version: number, body: UpdateLeadBody) => Promise<VersionedSaveResult<"lead", LeadRecord, CodedRefusal>>;
  setOwner: (leadId: string, ownerId: string) => Promise<{ lead: LeadRecord | null; error: CodedRefusal | null }>;
  addRelative: (
    leadId: string,
    input: { kind: LeadRelationKind; relative: CreateLeadBody; copyPrimaryAddress: boolean },
  ) => Promise<Outcome<{ duplicates: LeadDuplicate[] }>>;
  linkRelation: (leadId: string, otherLeadId: string, kind: LeadRelationKind) => Promise<Outcome<unknown>>;
  removeRelation: (relationId: string) => Promise<{ error: CodedRefusal | null }>;
}

export interface LeadSheetAccess {
  addresses: boolean;
  assign: boolean;
}

export interface FollowUpFailure {
  step: "owner" | "relative" | "unlink";
  label?: string;
  error: CodedRefusal;
}

export interface LinkOffer {
  label: string;
  kind: LeadRelationKind;
  leadId: string;
}

export type LeadSheetOutcome =
  | { kind: "invalid"; issues: string[] }
  | { kind: "refused"; error: CodedRefusal; path: string | null }
  | { kind: "conflict"; current: LeadRecord }
  | { kind: "saved"; lead: LeadRecord; duplicates: LeadDuplicate[]; followUpFailures: FollowUpFailure[]; linkOffers: LinkOffer[] };

function relativeBody(relative: RelativeDraft): CreateLeadBody {
  const body: CreateLeadBody = {};
  if (relative.name.trim()) body.name = relative.name.trim();
  if (relative.number.trim()) body.number = relative.number.trim();
  return body;
}

function relativeLabel(relative: RelativeDraft): string {
  return relative.name.trim() || relative.number.trim();
}

function holderOf(error: CodedRefusal): string | null {
  if (error.code !== "lead_identity_taken") return null;
  return error.expected?.leadId?.trim() || null;
}

async function saveRecord(
  base: LeadRecord | null,
  draft: LeadSheetDraft,
  access: LeadSheetAccess,
  actions: LeadSheetActions,
): Promise<LeadSheetOutcome | { lead: LeadRecord; duplicates: LeadDuplicate[] }> {
  if (!base) {
    const created = await actions.create(createLeadBody(draft));
    if (created.error) return { kind: "refused", error: created.error, path: refusalPath(created.error) };
    return { lead: created.lead, duplicates: created.lead.duplicates };
  }
  const body = updateLeadBody(base, draft, { addresses: access.addresses });
  if (Object.keys(body).length === 0) return { lead: base, duplicates: [] };
  const saved = await actions.update(base.id, base.version, body);
  if (saved.status === "conflict") return { kind: "conflict", current: saved.current };
  if (saved.status === "failed") return { kind: "refused", error: saved.error, path: refusalPath(saved.error) };
  return { lead: saved.lead, duplicates: [] };
}

export async function saveLeadSheet({
  base,
  draft,
  access,
  actions,
}: {
  base: LeadRecord | null;
  draft: LeadSheetDraft;
  access: LeadSheetAccess;
  actions: LeadSheetActions;
}): Promise<LeadSheetOutcome> {
  const issues = leadDraftIssues(draft);
  if (issues.length > 0) return { kind: "invalid", issues };

  const saved = await saveRecord(base, draft, access, actions);
  if ("kind" in saved) return saved;

  const leadId = saved.lead.id;
  const duplicates = [...saved.duplicates];
  const followUpFailures: FollowUpFailure[] = [];
  const linkOffers: LinkOffer[] = [];

  if (access.assign && draft.ownerId !== (base?.owner ?? "")) {
    const owner = await actions.setOwner(leadId, draft.ownerId);
    if (owner.error) followUpFailures.push({ step: "owner", error: owner.error });
  }

  for (const relationId of draft.removedRelationIds) {
    const removed = await actions.removeRelation(relationId);
    if (removed.error) followUpFailures.push({ step: "unlink", error: removed.error });
  }

  for (const relative of draft.relatives) {
    if (relative.existingLeadId) {
      const linked = await actions.linkRelation(leadId, relative.existingLeadId, relative.kind);
      if (linked.error) followUpFailures.push({ step: "relative", label: relativeLabel(relative), error: linked.error });
      continue;
    }
    const added = await actions.addRelative(leadId, {
      kind: relative.kind,
      relative: relativeBody(relative),
      copyPrimaryAddress: relative.copyPrimaryAddress,
    });
    if (!added.error) {
      duplicates.push(...added.result.duplicates);
      continue;
    }
    const holder = holderOf(added.error);
    if (holder) linkOffers.push({ label: relativeLabel(relative), kind: relative.kind, leadId: holder });
    else followUpFailures.push({ step: "relative", label: relativeLabel(relative), error: added.error });
  }

  return { kind: "saved", lead: saved.lead, duplicates, followUpFailures, linkOffers };
}
