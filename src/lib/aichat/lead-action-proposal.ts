import { isLeadSendAction, leadActionSkipRows, type LeadActionPreview } from "@/lib/leads/actions";
import {
  countedRows,
  sendChannelOf,
  parseReasonCounts,
  parseSendPart,
  parseSendQuote,
  type SendPart,
  type SendQuote,
  type SendSkipRow,
} from "@/lib/leads/sends";

import type { ProposalPreview } from "./types";

export const LEAD_ACTION_PROPOSAL_KIND = "lead_action";

export const LEAD_ACTION_PROPOSAL_STAGES = ["prepare", "start", "cancel"] as const;

export type LeadActionProposalStage = (typeof LEAD_ACTION_PROPOSAL_STAGES)[number];

export interface LeadActionProposal {
  stage: LeadActionProposalStage;
  action: string;
  mode?: string;
  previewId?: string;
  matched: number;
  selected: number;
  eligible: number;
  partial: boolean;
  skipped: Record<string, number>;
  counted: Record<string, number>;
  quote?: SendQuote;
  parts: SendPart[];
}

export interface LeadActionProposalCounts {
  selected: number;
  eligible: number;
  skipped: SendSkipRow[];
  counted: SendSkipRow[];
}

type Json = Record<string, unknown>;

function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isStage(value: unknown): value is LeadActionProposalStage {
  return typeof value === "string" && (LEAD_ACTION_PROPOSAL_STAGES as readonly string[]).includes(value);
}

function optionalText(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  return typeof value === "string" ? value : null;
}

function partsOf(value: unknown): SendPart[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const parts = value.map(parseSendPart);
  return parts.every((part): part is SendPart => part !== null) ? parts : null;
}

export function parseLeadActionProposal(value: unknown): LeadActionProposal | null {
  if (!isJson(value) || !isStage(value.stage)) return null;
  if (typeof value.action !== "string" || value.action.trim() === "") return null;
  const { matched, selected, eligible } = value;
  if (!isCount(matched) || !isCount(selected) || !isCount(eligible)) return null;
  if (value.partial !== undefined && typeof value.partial !== "boolean") return null;
  const mode = optionalText(value.mode);
  const previewId = optionalText(value.previewId);
  const skipped = parseReasonCounts(value.skipped);
  const counted = parseReasonCounts(value.counted);
  const parts = partsOf(value.parts);
  const quote = value.quote === undefined || value.quote === null ? undefined : parseSendQuote(value.quote);
  if (mode === null || previewId === null || !skipped || !counted || !parts || quote === null) return null;
  const proposal: LeadActionProposal = {
    stage: value.stage,
    action: value.action,
    matched,
    selected,
    eligible,
    partial: value.partial === true,
    skipped,
    counted,
    parts,
  };
  if (mode !== undefined) proposal.mode = mode;
  if (previewId !== undefined) proposal.previewId = previewId;
  if (quote !== undefined) proposal.quote = quote;
  return proposal;
}

export function withFinishedCount(proposal: LeadActionProposal, preview: LeadActionPreview): LeadActionProposal {
  if (preview.id !== proposal.previewId) return proposal;
  const { matched, selected, eligible, skipped } = preview.result;
  return { ...proposal, matched, selected, eligible, skipped, partial: false };
}

export function leadActionProposalCounts(proposal: LeadActionProposal): LeadActionProposalCounts {
  return {
    selected: proposal.selected,
    eligible: proposal.eligible,
    skipped: leadActionSkipRows(proposal.action, proposal.skipped),
    counted: countedRows(proposal.counted),
  };
}

export function showsQuoteFacts(proposal: LeadActionProposal): boolean {
  if (!proposal.quote) return false;
  return proposal.stage !== "start" || proposal.eligible === proposal.quote.count;
}

const OFFICIAL_QUOTE_FIELDS = ["estimatedCost", "balance", "capRemaining"];
const UNOFFICIAL_QUOTE_FIELDS = ["dailyCap", "estimatedDays"];

function countFields(proposal: LeadActionProposal): string[] {
  if (proposal.stage === "start") return ["recipients", "skipped", "counted"];
  return isLeadSendAction(proposal.action) ? [] : ["changes", "skipped"];
}

function quoteFields(proposal: LeadActionProposal): string[] {
  if (!proposal.quote || !isLeadSendAction(proposal.action)) return [];
  const facts = sendChannelOf(proposal.action) === "official" ? OFFICIAL_QUOTE_FIELDS : UNOFFICIAL_QUOTE_FIELDS;
  return ["parts", "budget", ...(showsQuoteFacts(proposal) ? facts : [])];
}

export function fieldsShownByLeadActionPreview(preview: ProposalPreview | undefined): ReadonlySet<string> {
  const proposal = preview?.kind === LEAD_ACTION_PROPOSAL_KIND ? parseLeadActionProposal(preview.data) : null;
  if (!proposal) return new Set();
  if (proposal.stage === "cancel") return new Set(["entries"]);
  return new Set([...countFields(proposal), ...quoteFields(proposal)]);
}
