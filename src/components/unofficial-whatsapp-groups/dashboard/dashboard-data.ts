import type {
  AlertLevel,
  CategoryCount,
  DailyPoint,
  GroupGrowth,
  GroupInsight,
  GroupOrigin,
  GroupPerson,
  GroupRef,
  GroupRow,
  GroupSentiment,
  GroupsDashboard,
  JoinTask,
  MembershipSort,
  ResponseTimePoint,
  SentimentTally,
} from "@/lib/unofficial-whatsapp-groups/types";

export function normalizeDashboard(dashboard: GroupsDashboard): GroupsDashboard {
  return {
    ...dashboard,
    groups: { ...dashboard.groups, categories: dashboard.groups?.categories ?? [] },
    dailyVolume: dashboard.dailyVolume ?? [],
    topGroups: dashboard.topGroups ?? [],
    sentimentByGroup: dashboard.sentimentByGroup ?? [],
    responseTime: dashboard.responseTime ?? [],
    growth: dashboard.growth ?? [],
    topGrowing: dashboard.topGrowing ?? [],
    insights: dashboard.insights ?? [],
    themes: (dashboard.themes ?? []).map((theme) => ({ ...theme, groups: theme.groups ?? [] })),
    crossGroupPeople: (dashboard.crossGroupPeople ?? []).map((person) => ({ ...person, groups: person.groups ?? [] })),
    crossGroupTotal: dashboard.crossGroupTotal ?? 0,
    timezone: dashboard.timezone ?? "",
  };
}

export function hasNoGroups(dashboard: GroupsDashboard): boolean {
  return dashboard.groups.groups === 0;
}

export function greetingName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export function sentimentTotal(tally: SentimentTally): number {
  return tally.positive + tally.neutral + tally.negative;
}

export function sumOf<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

interface VolumeStats {
  total: number;
  average: number;
  peak: { day: string; messages: number } | null;
}

export function volumeStats(points: DailyPoint[]): VolumeStats {
  const total = sumOf(points, (point) => point.messages);
  let peak: VolumeStats["peak"] = null;
  for (const point of points) {
    if (point.messages > 0 && (peak === null || point.messages > peak.messages)) peak = { day: point.day, messages: point.messages };
  }
  return { total, average: points.length > 0 ? total / points.length : 0, peak };
}

interface ResponseStats {
  average: number | null;
  samples: number;
  daysAboveGoal: number;
}

export function responseStats(points: ResponseTimePoint[], goalMinutes: number): ResponseStats {
  let samples = 0;
  let weighted = 0;
  let daysAboveGoal = 0;
  for (const point of points) {
    if (point.samples <= 0) continue;
    samples += point.samples;
    weighted += point.avgMinutes * point.samples;
    if (point.avgMinutes > goalMinutes) daysAboveGoal += 1;
  }
  return { average: samples > 0 ? weighted / samples : null, samples, daysAboveGoal };
}

export function growingGroups(groups: GroupGrowth[]): GroupGrowth[] {
  return groups.filter((group) => group.net > 0);
}

export type SentimentGroupOrder = "negative" | "messages";

export const SENTIMENT_GROUP_LIMIT = 10;

function sentimentGroupTotal(group: GroupSentiment): number {
  return group.positive + group.neutral + group.negative;
}

export function rankSentimentByGroup(groups: GroupSentiment[], order: SentimentGroupOrder, limit = SENTIMENT_GROUP_LIMIT): GroupSentiment[] {
  return groups
    .filter((group) => sentimentGroupTotal(group) > 0)
    .map((group) => ({ group, total: sentimentGroupTotal(group) }))
    .sort((a, b) => {
      if (order === "messages") return b.total - a.total || b.group.negative - a.group.negative;
      return b.group.negative / b.total - a.group.negative / a.total || b.group.negative - a.group.negative;
    })
    .slice(0, limit)
    .map((entry) => entry.group);
}

interface CategoryRank {
  category: string;
  count: number;
  share: number | null;
}

export function categoryRanking(categories: CategoryCount[]): CategoryRank[] {
  const counted = categories.filter((category) => category.count > 0);
  const total = sumOf(counted, (category) => category.count);
  return [...counted]
    .sort((a, b) => {
      const aEmpty = a.category.trim() === "";
      const bEmpty = b.category.trim() === "";
      if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
      return b.count - a.count || a.category.localeCompare(b.category);
    })
    .map((category) => ({ category: category.category.trim(), count: category.count, share: total > 0 ? (category.count / total) * 100 : null }));
}

export const CATEGORY_REST_KEY = "__rest__";

export interface CategoryLegendRow extends CategoryRank {
  color: string;
}

export interface CategorySlice {
  key: string;
  category: string;
  count: number;
  color: string;
}

export function categoryComposition(categories: CategoryCount[], palette: readonly string[], rest: string) {
  const ranking = categoryRanking(categories);
  const colored = new Map(
    ranking
      .filter((row) => row.category !== "")
      .slice(0, palette.length)
      .map((row, index) => [row.category, palette[index]] as const),
  );
  const legend: CategoryLegendRow[] = ranking.map((row) => ({ ...row, color: colored.get(row.category) ?? rest }));
  const ring: CategorySlice[] = legend
    .filter((row) => colored.has(row.category))
    .map((row) => ({ key: row.category, category: row.category, count: row.count, color: row.color }));
  const restCount = sumOf(
    legend.filter((row) => !colored.has(row.category)),
    (row) => row.count,
  );
  if (restCount > 0) ring.push({ key: CATEGORY_REST_KEY, category: "", count: restCount, color: rest });
  return { legend, ring, total: sumOf(legend, (row) => row.count) };
}

export const CATEGORY_FILTER_ALL = "__all__";
export const CATEGORY_FILTER_NONE = "__none__";

export function categoryFilterParam(value: string): string | undefined {
  if (value === CATEGORY_FILTER_ALL) return undefined;
  if (value === CATEGORY_FILTER_NONE) return "";
  return value;
}

export type OriginFilter = GroupOrigin | "all";

export function membershipFilterActive(filters: { search: string; origin: OriginFilter; category: string }): boolean {
  return filters.search.trim() !== "" || filters.origin !== "all" || filters.category !== CATEGORY_FILTER_ALL;
}

export type InsightFilter = "all" | AlertLevel;

export const INSIGHT_FILTERS: readonly InsightFilter[] = ["all", "high", "medium", "low"];

export function insightCounts(insights: GroupInsight[]): Record<InsightFilter, number> {
  const counts: Record<InsightFilter, number> = { all: insights.length, high: 0, medium: 0, low: 0 };
  for (const insight of insights) counts[insight.alertLevel] += 1;
  return counts;
}

export function filterInsights(insights: GroupInsight[], filter: InsightFilter): GroupInsight[] {
  return filter === "all" ? insights : insights.filter((insight) => insight.alertLevel === filter);
}

export type AttentionKey = "disconnected" | "failedJoins" | "highAlert" | "negative" | "noPoster" | "losingMembers" | "silent";

export type AttentionMark = "fault" | "warning" | "muted";

export interface AttentionLine {
  key: AttentionKey;
  mark: AttentionMark;
  count: number;
  groups: GroupRef[];
}

function refOf(row: GroupRow): GroupRef {
  return { groupId: row.group.id, subject: row.group.subject };
}

function groupLine(key: AttentionKey, mark: AttentionMark, rows: GroupRow[]): AttentionLine {
  return { key, mark, count: rows.length, groups: rows.map(refOf) };
}

function netOf(row: GroupRow): number {
  return row.activity.joins - row.activity.leaves;
}

export function attentionLines({
  rows,
  connections,
  joins,
}: {
  rows: GroupRow[];
  connections: { connected: number; total: number };
  joins: JoinTask[];
}): AttentionLine[] {
  const lines: AttentionLine[] = [
    { key: "disconnected", mark: "warning", count: Math.max(0, connections.total - connections.connected), groups: [] },
    { key: "failedJoins", mark: "fault", count: joins.filter((task) => task.status === "failed").length, groups: [] },
    groupLine(
      "highAlert",
      "fault",
      rows.filter((row) => (row.summary?.highAlertPct ?? 0) > 0).sort((a, b) => (b.summary?.highAlertPct ?? 0) - (a.summary?.highAlertPct ?? 0)),
    ),
    groupLine(
      "negative",
      "warning",
      rows.filter((row) => row.summary?.sentiment === "negative").sort((a, b) => (a.summary?.positivity ?? 0) - (b.summary?.positivity ?? 0)),
    ),
    groupLine(
      "noPoster",
      "warning",
      rows.filter((row) => !row.numbers.some((seat) => seat.canPost)),
    ),
    groupLine(
      "losingMembers",
      "warning",
      rows.filter((row) => netOf(row) < 0).sort((a, b) => netOf(a) - netOf(b)),
    ),
    groupLine(
      "silent",
      "muted",
      rows.filter((row) => row.activity.messages === 0),
    ),
  ];
  return lines.filter((line) => line.count > 0);
}

export const PEOPLE_PAGE_SIZE = 10;
export const DEFAULT_MIN_GROUPS = 2;
export const MIN_GROUP_OPTIONS = [2, 3, 5, 10] as const;

export interface PeoplePage {
  items: GroupPerson[];
  totalItems: number;
  totalPages: number;
}

export function payloadPeoplePage(
  people: GroupPerson[],
  total: number,
  query: { search: string; minGroups: number; page: number },
): PeoplePage | null {
  if (query.search.trim() !== "" || query.minGroups !== DEFAULT_MIN_GROUPS) return null;
  const totalItems = Math.max(total, people.length);
  const start = (query.page - 1) * PEOPLE_PAGE_SIZE;
  const end = start + PEOPLE_PAGE_SIZE;
  const coversPage = people.length >= Math.min(end, totalItems);
  if (query.page < 1 || !coversPage) return null;
  return { items: people.slice(start, end), totalItems, totalPages: Math.ceil(totalItems / PEOPLE_PAGE_SIZE) };
}

export type SortDirection = "asc" | "desc";

export interface MembershipSortState {
  key: MembershipSort;
  direction: SortDirection;
}

export const DEFAULT_MEMBERSHIP_SORT: MembershipSortState = { key: "members", direction: "desc" };

export const MEMBERSHIP_SORTS: readonly MembershipSort[] = ["members", "name", "joins", "leaves", "churn", "net", "growth", "messages"];

export function toggleMembershipSort(current: MembershipSortState, key: MembershipSort): MembershipSortState {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: key === "name" ? "asc" : "desc" };
}

export function isMembershipSort(key: string): key is MembershipSort {
  return (MEMBERSHIP_SORTS as readonly string[]).includes(key);
}
