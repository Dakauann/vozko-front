import type {
  GroupCampaign,
  GroupMember,
  ListMembersParams,
  MemberAction,
  NumberSeat,
  ParticipantTotal,
  SeriesSibling,
  SetupStep,
  SetupWarning,
  UpdateGroupPayload,
  WorkspaceGroup,
} from "@/lib/unofficial-whatsapp-groups/types";

import type { KpiMark } from "../kit/format";
import { DEFAULT_DETAIL_TAB, type DetailTab, type GroupLinkOptions, type MemberStatusFilter } from "../kit/routes";

export function tabSearch(current: string, tab: DetailTab): string {
  const params = new URLSearchParams(current);
  if (tab === DEFAULT_DETAIL_TAB) params.delete("tab");
  else params.set("tab", tab);
  const text = params.toString();
  return text ? `?${text}` : "";
}

export const HEADLINE_CHARS = 160;

export function headline(description: string | undefined): string {
  const first = (description ?? "").split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
  if (first.length <= HEADLINE_CHARS) return first;
  return `${first.slice(0, HEADLINE_CHARS - 1).trimEnd()}…`;
}

export function hasAdminSeat(seats: NumberSeat[]): boolean {
  return seats.some((seat) => seat.admin);
}

interface SeatTally {
  connected: number;
  admin: number;
  posting: number;
  offline: number;
}

export function seatTally(seats: NumberSeat[]): SeatTally {
  return {
    connected: seats.filter((seat) => seat.connected).length,
    admin: seats.filter((seat) => seat.admin).length,
    posting: seats.filter((seat) => seat.canPost).length,
    offline: seats.filter((seat) => !seat.connected).length,
  };
}

export function seatsMark(seats: NumberSeat[]): KpiMark | undefined {
  const tally = seatTally(seats);
  if (tally.posting === 0) return "fault";
  if (tally.offline > 0) return "warning";
  return undefined;
}

export type MemberLeadFilter = "all" | "with" | "without";

export interface MemberFilters {
  status: MemberStatusFilter;
  lead: MemberLeadFilter;
  adminsOnly: boolean;
  inOtherOnly: boolean;
  search: string;
}

export const DEFAULT_MEMBER_FILTERS: MemberFilters = {
  status: "active",
  lead: "all",
  adminsOnly: false,
  inOtherOnly: false,
  search: "",
};

export function memberQuery(filters: MemberFilters, page: number, pageSize: number): ListMembersParams {
  const search = filters.search.trim();
  return {
    page,
    pageSize,
    ...(filters.status === "all" ? {} : { status: filters.status }),
    ...(filters.lead === "all" ? {} : { leadLinked: filters.lead === "with" }),
    ...(filters.adminsOnly ? { adminsOnly: true } : {}),
    ...(filters.inOtherOnly ? { inOtherOnly: true } : {}),
    ...(search ? { search } : {}),
  };
}

export function isFiltered(filters: MemberFilters): boolean {
  return (
    filters.status !== DEFAULT_MEMBER_FILTERS.status ||
    filters.lead !== DEFAULT_MEMBER_FILTERS.lead ||
    filters.adminsOnly ||
    filters.inOtherOnly ||
    filters.search.trim() !== ""
  );
}

type MemberLink = GroupLinkOptions["members"];

export function memberFiltersFromLink(link: MemberLink): MemberFilters {
  return {
    ...DEFAULT_MEMBER_FILTERS,
    status: link?.status ?? DEFAULT_MEMBER_FILTERS.status,
    search: link?.search?.trim() ?? "",
    lead: link?.lead ? "with" : DEFAULT_MEMBER_FILTERS.lead,
  };
}

export function memberLinkOf(filters: MemberFilters): MemberLink {
  const search = filters.search.trim();
  const status = filters.status !== DEFAULT_MEMBER_FILTERS.status ? filters.status : undefined;
  const lead = filters.lead === "with";
  if (!status && !search && !lead) return undefined;
  return {
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
    ...(lead ? { lead } : {}),
  };
}

export function memberLinkSignature(link: MemberLink): string {
  return [link?.status ?? "", link?.search?.trim() ?? "", link?.lead ? "1" : ""].join("|");
}

export function withMemberLink(current: string, link: MemberLink): string {
  const params = new URLSearchParams(current);
  params.delete("members");
  params.delete("msearch");
  params.delete("lead");
  if (link?.status) params.set("members", link.status);
  if (link?.search?.trim()) params.set("msearch", link.search.trim());
  if (link?.lead) params.set("lead", "1");
  const text = params.toString();
  return text ? `?${text}` : "";
}

const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 15;

export function parsePhoneList(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of text.split(/[\n,;]+/)) {
    const entry = raw.trim();
    if (!entry) continue;
    const digits = entry.replace(/\D/g, "");
    const ok = digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
    const bucket = ok ? valid : invalid;
    const value = ok ? digits : entry;
    if (!bucket.includes(value)) bucket.push(value);
  }
  return { valid, invalid };
}

const ADMIN_REFUSALS = ["not an admin of this group", "none of your connected numbers is in this group"];

export function isAdminRefusal(error: string | undefined): boolean {
  if (!error) return false;
  const text = error.toLowerCase();
  return ADMIN_REFUSALS.some((refusal) => text.includes(refusal));
}

interface MemberGrants {
  update: boolean;
  remove: boolean;
  addLeads: boolean;
}

interface MemberMenu {
  promote: boolean;
  demote: boolean;
  remove: boolean;
  addLead: boolean;
}

export function memberMenu(member: GroupMember, grants: MemberGrants): MemberMenu {
  if (member.ourNumber) return { promote: false, demote: false, remove: false, addLead: false };
  const inGroup = member.status === "active";
  return {
    promote: inGroup && grants.update && member.role === "member",
    demote: inGroup && grants.update && member.role === "admin",
    remove: inGroup && grants.remove && member.role !== "superadmin",
    addLead: grants.addLeads && !member.leadId,
  };
}

export function bulkTargets(members: GroupMember[], action: MemberAction): string[] {
  const grants = { update: true, remove: true, addLeads: false };
  return members
    .filter((member) => {
      const menu = memberMenu(member, grants);
      if (action === "promote") return menu.promote;
      if (action === "demote") return menu.demote;
      if (action === "remove") return menu.remove;
      return false;
    })
    .map((member) => member.jid);
}

const DELIVERED_ENTRIES = new Set(["SENT", "DELIVERED", "READ"]);
const FAILED_ENTRIES = new Set(["FAILED", "NOT_ELIGIBLE_POSSIBLE_SPAM", "SKIPPED_NOT_ON_WHATSAPP"]);

export const GROUP_CAMPAIGNS_LIMIT = 100;

interface CampaignTally {
  total: number;
  running: number;
  delivered: number;
  failed: number;
  capped: boolean;
}

export function campaignTally(campaigns: GroupCampaign[]): CampaignTally {
  return {
    total: campaigns.length,
    running: campaigns.filter((campaign) => campaign.campaignStatus === "RUNNING").length,
    delivered: campaigns.filter((campaign) => DELIVERED_ENTRIES.has(campaign.entryStatus)).length,
    failed: campaigns.filter((campaign) => FAILED_ENTRIES.has(campaign.entryStatus) || campaign.entryStatus.startsWith("SKIPPED")).length,
    capped: campaigns.length >= GROUP_CAMPAIGNS_LIMIT,
  };
}

export function knownCampaignTally(state: { loading: boolean; error: string | null; campaigns: GroupCampaign[] }): CampaignTally | null {
  if (state.error) return null;
  if (state.loading && state.campaigns.length === 0) return null;
  return campaignTally(state.campaigns);
}

export function campaignTotalLabel(tally: CampaignTally, num: (value: number) => string): string {
  return tally.capped ? `${num(tally.total)}+` : num(tally.total);
}

export function canCreateNextInSeries(group: Pick<WorkspaceGroup, "origin">, permissions: { create: boolean }): boolean {
  return permissions.create && group.origin === "managed";
}

export function seriesMemberTotal(series: SeriesSibling[]): number {
  return series.reduce((sum, sibling) => sum + Math.max(0, sibling.members), 0);
}

const SERIES_SUFFIX = /\s*#\d+$/;

export function seriesBaseName(subject: string): string {
  return subject.trim().replace(SERIES_SUFFIX, "").trim();
}

export const SUBJECT_MAX_CHARS = 25;
export const DESCRIPTION_MAX_CHARS = 512;

interface WhatsAppDraft {
  subject: string;
  description: string;
  imageUrl?: string;
  applyToSeries: boolean;
}

export function whatsAppPatch(group: Pick<WorkspaceGroup, "subject" | "description">, draft: WhatsAppDraft): UpdateGroupPayload {
  const subject = draft.subject.trim();
  const description = draft.description.trim();
  const patch: UpdateGroupPayload = {
    ...(subject && subject !== group.subject.trim() ? { subject } : {}),
    ...(description !== (group.description ?? "").trim() ? { description } : {}),
    ...(draft.imageUrl ? { imageUrl: draft.imageUrl } : {}),
  };
  if (draft.applyToSeries && Object.keys(patch).length > 0) patch.applyToSeries = true;
  return patch;
}

type DraftProblem = "required" | "tooLong";

export function whatsAppDraftProblems(draft: Pick<WhatsAppDraft, "subject" | "description">): { subject?: DraftProblem; description?: DraftProblem } {
  const subject = Array.from(draft.subject.trim()).length;
  const description = Array.from(draft.description.trim()).length;
  return {
    ...(subject === 0 ? { subject: "required" as const } : subject > SUBJECT_MAX_CHARS ? { subject: "tooLong" as const } : {}),
    ...(description > DESCRIPTION_MAX_CHARS ? { description: "tooLong" as const } : {}),
  };
}

export const GROUP_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const GROUP_PHOTO_BYTES = 5 * 1024 * 1024;

export function groupPhotoProblem(file: { type: string; size: number }): "type" | "size" | null {
  if (!(GROUP_PHOTO_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size <= 0 || file.size > GROUP_PHOTO_BYTES) return "size";
  return null;
}

export function topTalkers(participants: ParticipantTotal[], limit: number): ParticipantTotal[] {
  return participants
    .filter((participant) => participant.messages > 0)
    .sort((a, b) => b.messages - a.messages)
    .slice(0, Math.max(0, limit));
}

export function leaveConfirmed(typed: string, subject: string): boolean {
  const expected = subject.trim();
  return expected !== "" && typed.trim() === expected;
}

export function setupWarningsFor(steps: SetupStep[], stored: SetupWarning[]): SetupWarning[] {
  return steps.map((step) => stored.find((warning) => warning.step === step) ?? { step, reason: "" });
}

export function outstandingSetupWarnings(
  warnings: SetupWarning[],
  group: Pick<WorkspaceGroup, "description" | "announce">,
  seats: NumberSeat[],
): SetupWarning[] {
  return warnings.filter((warning) => {
    if (warning.step === "description") return !group.description?.trim();
    if (warning.step === "admins_only") return !group.announce;
    if (warning.step === "promote_numbers") return seats.length === 0 || !seats.every((seat) => seat.admin);
    return true;
  });
}
