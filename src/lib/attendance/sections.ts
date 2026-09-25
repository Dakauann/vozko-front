import type { AttendanceOverview, AttendanceOverviewParams } from "./types";

export const ATTENDANCE_SECTIONS = ["summary", "trend", "stages", "backlog", "team", "rework", "live"] as const;

export type AttendanceSection = (typeof ATTENDANCE_SECTIONS)[number];

export type SummarySection = Pick<
  AttendanceOverview,
  | "filter"
  | "kpis"
  | "hourly"
  | "status_distribution"
  | "frt"
  | "ai"
  | "channel_mix"
  | "messaging"
  | "reopen"
  | "finished_by_source"
  | "quality"
  | "revenue"
  | "period"
  | "projections"
  | "standing"
  | "generated_at"
  | "definitions"
>;

export type TrendSection = Pick<AttendanceOverview, "trend">;
export type StagesSection = Pick<AttendanceOverview, "stages">;
export type BacklogSection = Pick<AttendanceOverview, "backlog_xray">;
export type TeamSection = Pick<AttendanceOverview, "by_department" | "by_member" | "team_ranking">;
export type ReworkSection = Pick<AttendanceOverview, "rework">;
export type LiveSection = Pick<AttendanceOverview, "queue" | "occupancy" | "live">;

export interface AttendanceSectionPayloads {
  summary: SummarySection;
  trend: TrendSection;
  stages: StagesSection;
  backlog: BacklogSection;
  team: TeamSection;
  rework: ReworkSection;
  live: LiveSection;
}

export type SectionQueryParams = Record<string, string>;

export {
  SectionError as AttendanceSectionError,
  sectionRetryDelay,
  shouldRetrySection,
} from "@/lib/analytics/section-query";

export function sectionQueryParams(
  section: AttendanceSection,
  params: AttendanceOverviewParams,
): SectionQueryParams {
  const query: Record<string, string | undefined> = {
    date_from: params.dateFrom,
    date_to: params.dateTo,
    department_id: params.departmentId,
    member_id: params.memberId,
    campaign_id: params.campaignId,
    campaign_type: params.campaignType,
    channel: params.channel,
  };
  if (section === "team") {
    query.rank_metric = params.rankMetric;
    query.include_ai = params.includeAi === undefined ? undefined : String(params.includeAi);
  }
  if (section === "trend" && params.trendBuckets !== undefined) {
    query.trend_buckets = String(params.trendBuckets);
  }

  const out: SectionQueryParams = {};
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") out[key] = value;
  }
  return out;
}

export function attendanceSectionKey(
  workspaceId: string,
  section: AttendanceSection,
  params: AttendanceOverviewParams,
) {
  return ["attendance-section", workspaceId, section, sectionQueryParams(section, params)] as const;
}

export function attendanceSectionsKey(workspaceId: string) {
  return ["attendance-section", workspaceId] as const;
}

