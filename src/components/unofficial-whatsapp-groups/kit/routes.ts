import type { AnalysisStatus, GroupOrigin, GroupSort, MemberStatus, SetupStep } from "@/lib/unofficial-whatsapp-groups/types";

export const GROUPS_BASE = "/dashboard/unofficial-whatsapp-groups";

const CAMPAIGNS_BASE = "/dashboard/unofficial-whatsapp-campaigns";

export const DETAIL_TABS = ["overview", "members", "messages", "analysis", "campaigns", "settings"] as const;

export type DetailTab = (typeof DETAIL_TABS)[number];

export const DEFAULT_DETAIL_TAB: DetailTab = "overview";

export type MemberStatusFilter = MemberStatus | "all";

export type AnalysisWindow = 7 | 30 | 90 | -1;

export const ANALYSIS_WINDOWS: readonly AnalysisWindow[] = [7, 30, 90, -1];

export const DEFAULT_ANALYSIS_WINDOW: AnalysisWindow = 30;

export const SETUP_STEPS: readonly SetupStep[] = ["description", "admins_only", "promote_numbers"];

const GROUP_SORTS: readonly GroupSort[] = ["recent", "oldest", "name", "name_desc", "members"];

const GROUP_ORIGINS: readonly GroupOrigin[] = ["managed", "external"];

const ALL_GROUPS_ACTIONS = ["discover", "join", "create"] as const;

const MEMBER_STATUS_FILTERS: readonly MemberStatusFilter[] = ["active", "left", "all"];

export interface AllGroupsQuery {
  action?: (typeof ALL_GROUPS_ACTIONS)[number];
  search?: string;
  followed?: boolean;
  origin?: GroupOrigin;
  category?: string;
  instanceId?: string;
  hasAnalysis?: boolean;
  adminsOnly?: boolean;
  sort?: GroupSort;
}

export interface GroupLinkOptions {
  tab?: DetailTab;
  members?: { status?: MemberStatusFilter; search?: string; lead?: boolean };
  setup?: SetupStep[];
}

export interface AnalysesQuery {
  groupId?: string;
  status?: AnalysisStatus;
  action?: "create";
}

export interface AnalysisLinkOptions {
  days?: AnalysisWindow;
  run?: string;
}

export interface PeopleQuery {
  search?: string;
  minGroups?: number;
}

type QueryEntry = [string, string | undefined];

function withQuery(path: string, entries: QueryEntry[]): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value !== undefined) params.set(key, value);
  }
  const text = params.toString();
  return text ? `${path}?${text}` : path;
}

function flag(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "1" : "0";
}

function nonEmpty(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function oneOf<T extends string>(options: readonly T[], value: string | null): T | undefined {
  return value !== null && (options as readonly string[]).includes(value) ? (value as T) : undefined;
}

function readFlag(value: string | null): boolean | undefined {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return undefined;
}

export const groupsRoutes = {
  root: GROUPS_BASE,
  numbers: "/dashboard/unofficial-whatsapp",
  all(query: AllGroupsQuery = {}): string {
    return withQuery(`${GROUPS_BASE}/all`, [
      ["action", query.action],
      ["search", nonEmpty(query.search)],
      ["followed", flag(query.followed)],
      ["origin", query.origin],
      ["category", query.category],
      ["instanceId", nonEmpty(query.instanceId)],
      ["hasAnalysis", flag(query.hasAnalysis)],
      ["adminsOnly", query.adminsOnly ? "1" : undefined],
      ["sort", query.sort],
    ]);
  },
  group(groupId: string, options: GroupLinkOptions = {}): string {
    const members = options.members;
    const tab = options.tab ?? (members ? "members" : undefined);
    return withQuery(`${GROUPS_BASE}/${encodeURIComponent(groupId)}`, [
      ["tab", tab && tab !== DEFAULT_DETAIL_TAB ? tab : undefined],
      ["members", members?.status],
      ["msearch", nonEmpty(members?.search)],
      ["lead", members?.lead ? "1" : undefined],
      ["setup", options.setup && options.setup.length > 0 ? options.setup.join(",") : undefined],
    ]);
  },
  analyses(query: AnalysesQuery = {}): string {
    return withQuery(`${GROUPS_BASE}/analyses`, [
      ["groupId", nonEmpty(query.groupId)],
      ["status", query.status],
      ["action", query.action],
    ]);
  },
  analysis(analysisId: string, options: AnalysisLinkOptions = {}): string {
    return withQuery(`${GROUPS_BASE}/analyses/${encodeURIComponent(analysisId)}`, [
      ["days", options.days !== undefined && options.days !== DEFAULT_ANALYSIS_WINDOW ? String(options.days) : undefined],
      ["run", nonEmpty(options.run)],
    ]);
  },
  people(query: PeopleQuery = {}): string {
    return withQuery(`${GROUPS_BASE}/people`, [
      ["search", nonEmpty(query.search)],
      ["minGroups", query.minGroups !== undefined ? String(query.minGroups) : undefined],
    ]);
  },
  newCampaign(instanceId: string, groupIds: string[]): string {
    const ids = [...new Set(groupIds.map((id) => id.trim()).filter(Boolean))];
    return withQuery(`${CAMPAIGNS_BASE}/new`, [
      ["audience", "groups"],
      ["instanceId", instanceId],
      ["groups", ids.join(",")],
    ]);
  },
  lead(leadId: string): string {
    return `/dashboard/leads/${encodeURIComponent(leadId)}`;
  },
  campaign(campaignId: string): string {
    return `${CAMPAIGNS_BASE}/${encodeURIComponent(campaignId)}`;
  },
};

export function parseDetailTab(value: string | null | undefined): DetailTab {
  return oneOf(DETAIL_TABS, value ?? null) ?? DEFAULT_DETAIL_TAB;
}

export function parseAllGroupsQuery(params: URLSearchParams): AllGroupsQuery {
  const query: AllGroupsQuery = {};
  const action = oneOf(ALL_GROUPS_ACTIONS, params.get("action"));
  if (action) query.action = action;
  const search = nonEmpty(params.get("search") ?? undefined);
  if (search) query.search = search;
  const followed = readFlag(params.get("followed"));
  if (followed !== undefined) query.followed = followed;
  const origin = oneOf(GROUP_ORIGINS, params.get("origin"));
  if (origin) query.origin = origin;
  if (params.has("category")) query.category = (params.get("category") ?? "").trim();
  const instanceId = nonEmpty(params.get("instanceId") ?? undefined);
  if (instanceId) query.instanceId = instanceId;
  const hasAnalysis = readFlag(params.get("hasAnalysis"));
  if (hasAnalysis !== undefined) query.hasAnalysis = hasAnalysis;
  if (readFlag(params.get("adminsOnly"))) query.adminsOnly = true;
  const sort = oneOf(GROUP_SORTS, params.get("sort"));
  if (sort) query.sort = sort;
  return query;
}

export function parseGroupLinkMembers(params: URLSearchParams): GroupLinkOptions["members"] {
  const status = oneOf(MEMBER_STATUS_FILTERS, params.get("members"));
  const search = nonEmpty(params.get("msearch") ?? undefined);
  const lead = readFlag(params.get("lead")) === true;
  if (!status && !search && !lead) return undefined;
  return {
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
    ...(lead ? { lead } : {}),
  };
}

export function parseSetupSteps(value: string | null): SetupStep[] {
  if (!value) return [];
  const steps = value
    .split(",")
    .map((step) => step.trim())
    .filter((step): step is SetupStep => (SETUP_STEPS as readonly string[]).includes(step));
  return [...new Set(steps)];
}

export function parseAnalysisWindow(value: string | null): AnalysisWindow {
  if (value === "all") return -1;
  const parsed = Number(value);
  return (ANALYSIS_WINDOWS as readonly number[]).includes(parsed) && value !== null && value.trim() !== ""
    ? (parsed as AnalysisWindow)
    : DEFAULT_ANALYSIS_WINDOW;
}
