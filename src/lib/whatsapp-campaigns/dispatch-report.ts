export const DISPATCH_REPORT_SECTIONS = ["summary", "daily", "failures", "tags", "campaigns"] as const;

export type DispatchReportSection = (typeof DISPATCH_REPORT_SECTIONS)[number];

export const ALL_CAMPAIGNS = "all";

export interface DispatchFunnel {
  base: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
  awaitingDelivery: number;
  pending: number;
  notEligible: number;
  trackedSince: string | null;
}

export interface DispatchReportSummary {
  campaignId: string;
  campaignName: string;
  templateName: string;
  campaignCreatedAt: string | null;
  funnel: DispatchFunnel;
}

export interface DispatchDay {
  day: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
}

export interface DispatchReportDaily {
  from: string;
  to: string;
  timezone: string;
  days: DispatchDay[];
}

export interface DispatchFailureReason {
  code: number;
  count: number;
}

export interface DispatchReportFailures {
  reasons: DispatchFailureReason[];
}

export interface DispatchTag {
  labelId: string;
  name: string;
  color: string;
  count: number;
}

export interface DispatchReportTags {
  tags: DispatchTag[];
}

export interface CampaignFunnel {
  campaignId: string;
  campaignName: string;
  base: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  failed: number;
}

export interface DispatchReportCampaigns {
  campaigns: CampaignFunnel[];
}

export interface DispatchReportPayloads {
  summary: DispatchReportSummary;
  daily: DispatchReportDaily;
  failures: DispatchReportFailures;
  tags: DispatchReportTags;
  campaigns: DispatchReportCampaigns;
}

export interface DispatchReportParams {
  campaignId?: string;
  departmentId?: string;
  dateFrom: string;
  dateTo: string;
}

export function dispatchReportQuery(params: DispatchReportParams): Record<string, string> {
  const query: Record<string, string> = {
    date_from: params.dateFrom,
    date_to: params.dateTo,
  };
  if (params.campaignId) query.campaign_id = params.campaignId;
  else if (params.departmentId) query.department_id = params.departmentId;
  return query;
}

export function dispatchReportPath(section: DispatchReportSection): string {
  return `/attendance/campaigns/${section}`;
}

export function dispatchReportsKey(workspaceId: string) {
  return ["dispatch-report", workspaceId] as const;
}

export function dispatchReportSectionKey(
  workspaceId: string,
  section: DispatchReportSection | "outcomes",
  params: DispatchReportParams,
) {
  return [
    ...dispatchReportsKey(workspaceId),
    params.campaignId ?? ALL_CAMPAIGNS,
    section,
    dispatchReportQuery(params),
  ] as const;
}

export type FunnelStageKey = "base" | "sent" | "delivered" | "read" | "replied" | "interested";

export interface FunnelStage {
  key: FunnelStageKey;
  value: number | null;
  pctOfBase: number | null;
  pctOfPrevious: number | null;
}

export function ratio(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return (part / whole) * 100;
}

export function funnelStages(funnel: DispatchFunnel, interested?: number | null): FunnelStage[] {
  const values: [FunnelStageKey, number | null][] = [
    ["base", funnel.base],
    ["sent", funnel.sent],
    ["delivered", funnel.delivered],
    ["read", funnel.read],
    ["replied", funnel.replied],
  ];
  if (interested !== undefined) values.push(["interested", interested]);
  return values.map(([key, value], index) => ({
    key,
    value,
    pctOfBase: ratio(value, funnel.base),
    pctOfPrevious: index === 0 ? null : ratio(value, values[index - 1][1]),
  }));
}

export const DISPATCH_REPORT_MAX_DAYS = 92;

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) / DAY_MS;
}

function dayString(dayNum: number): string {
  return new Date(dayNum * DAY_MS).toISOString().slice(0, 10);
}

export function clampToReportWindow(from: string, to: string): { from: string; to: string; clamped: boolean } {
  const earliest = dayNumber(to) - (DISPATCH_REPORT_MAX_DAYS - 1);
  const clamped = dayNumber(from) < earliest;
  return { from: clamped ? dayString(earliest) : from, to, clamped };
}
