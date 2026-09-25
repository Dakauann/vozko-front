
export interface AttendantStats {
    user_id: string;
    username: string;
    email: string;
    role: string;
    assigned_count: number;
    responded_count: number;
    response_rate: number;
    avg_response_time_mins: number;
}

export interface WindowBucket {
    label: string;
    count: number;
}

export interface WindowStats {
    total_open: number;
    buckets: WindowBucket[];
}

export interface ResponseTimeBucket {
    label: string;
    count: number;
}

export interface ResponseTimeDistribution {
    buckets: ResponseTimeBucket[];
    total: number;
}

export interface AttendanceStatsResponse {
    attendants: AttendantStats[];
}

export type WindowStatsResponse = WindowStats;

export type ResponseTimeDistributionResponse = ResponseTimeDistribution;

export interface AttendanceStatsParams {
    dateFrom?: string;
    dateTo?: string;
    campaignId?: string;
    campaignType?: string;
}

export interface AttendanceOverviewParams {
    dateFrom?: string;
    dateTo?: string;
    departmentId?: string;
    memberId?: string;
    campaignId?: string;
    campaignType?: string;
    channel?: string;
    includeAi?: boolean;
    rankMetric?: string;
    trendBuckets?: number;
}

export interface OverviewKPIs {
    engaged?: number;
    shell_backlog?: number;
    total_scoped?: number;
    entries_created?: number;
    finished: number;
    ongoing: number;
    pending: number;
    new_leads: number;
    unassigned_backlog: number;
    avg_handle_mins: number | null;
    avg_wait_mins: number | null;
    avg_frt_mins: number | null;
    avg_rating: number | null;
    csat_available: boolean;
    frt_sla_percent: number | null;
    resolution_sla_percent: number | null;
    sla_available: boolean;
}

export interface HourlyPoint {
    hour: number;
    count: number;
}

export interface StatusDistribution {
    finished: number;
    ongoing: number;
    pending: number;
    total: number;
}

export interface DepartmentRow {
    department_id: string;
    department_name: string;
    avg_wait_mins: number | null;
    avg_handle_mins: number | null;
    finished: number;
    finished_human?: number;
    finished_ai?: number;
    finished_system?: number;
    ongoing: number;
    pending: number;
}

export interface MemberRow {
    actor_id: string;
    actor_kind: string;
    display_name: string;
    email?: string;
    presence: string;
    avg_response_mins: number | null;
    rating: number | null;
    resolution_pct: number;
    open: number;
    pending: number;
    resolved: number;
    finished_human?: number;
    finished_ai?: number;
    finished_system?: number;
    total_messages?: number;
    inbound_messages?: number;
    avg_messages?: number | null;
}

export interface OverviewFRT {
    avg_mins: number | null;
    median_mins: number | null;
    human_avg_mins: number | null;
    ai_avg_mins: number | null;
    sample_count: number;
    human_samples: number;
    ai_samples: number;
    available: boolean;
}

export interface OverviewAI {
    sessions: number;
    contained: number;
    handed_off: number;
    abandoned: number;
    open_sessions: number;
    containment_rate: number;
    handoff_rate: number;
    avg_ai_messages: number;
    available: boolean;
}

export interface OverviewQueue {
    enqueued: number;
    connected: number;
    abandoned: number;
    overflow: number;
    queue_full: number;
    cancelled: number;
    avg_asa_mins: number | null;
    abandon_rate: number;
    available: boolean;
}

export interface OverviewOccupancy {
    avg_occupancy_pct: number | null;
    agents_sampled: number;
    online_ms: number;
    on_call_ms: number;
    team_occupancy_pct: number | null;
    team_idle_pct: number | null;
    available: boolean;
}

export interface OverviewLiveAgent {
    user_id: string;
    busy: boolean;
    has_browser: boolean;
    has_branch: boolean;
}

export interface OverviewLive {
    online: number;
    in_call: number;
    free: number;
    idle_rate_pct: number | null;
    busy_rate_pct: number | null;
    agents?: OverviewLiveAgent[];
    has_data: boolean;
    as_of: string;
}

export interface ChannelSlice {
    channel: string;
    count: number;
    pct: number;
}

export interface OverviewMessaging {
    avg_messages_per_conversation: number | null;
    avg_inbound: number | null;
    avg_outbound: number | null;
    avg_template?: number | null;
    template_messages?: number;
    conversations_with_messages: number;
    conversations_with_template?: number;
    avg_messages_all_scoped?: number | null;
    available: boolean;
}

export interface OverviewReopen {
    reopened_count: number;
    finished_count?: number;
    finished_event_count: number;
    reopen_rate: number | null;
    available: boolean;
}

export interface OverviewFinishedBySource {
    human: number;
    ai: number;
    system: number;
    total: number;
    human_pct?: number | null;
    ai_pct?: number | null;
    system_pct?: number | null;
    available: boolean;
}

export interface StageRow {
    stage_id: string;
    stage_name: string;
    color?: string;
    position: number;
    is_won: boolean;
    is_lost: boolean;
    engaged: number;
    shell: number;
    total: number;
    finished: number;
    ongoing: number;
    pending: number;
    pct_of_funnel: number;
    pct_of_staged: number;
    avg_days_in_stage: number | null;
    oldest_days_in_stage: number | null;
    stuck: number;
    stuck_after_days: number;
    rot_days_set: boolean;
}

export interface StageFunnelGroup {
    funnel_id: string;
    funnel_name: string;
    is_default: boolean;
    engaged: number;
    shell: number;
    total: number;
    stuck: number;
    pct_of_staged: number;
    stages: StageRow[];
}

export interface OverviewStages {
    funnels: StageFunnelGroup[];
    staged_engaged: number;
    staged_shell: number;
    unstaged_engaged: number;
    unstaged_shell: number;
    stuck: number;
    available: boolean;
}

export interface MetricDefinitions {
    period?: string;
    projection?: string;
    standing?: string;
    trend?: string;
    revenue?: string;
    backlog_xray?: string;
    quality?: string;
    team_ranking?: string;
    period_scope: string;
    engaged?: string;
    shell?: string;
    status_mapping: string;
    wait_time: string;
    handle_time: string;
    resolution: string;
    frt?: string;
    ai?: string;
    queue?: string;
    occupancy?: string;
    channel_mix?: string;
    new_leads?: string;
    messaging?: string;
    reopen?: string;
    finished_by_source?: string;
    stages?: string;
    unassigned?: string;
    csat: string;
    sla: string;
}

export interface AttendanceOverview {
    filter?: Record<string, unknown>;
    kpis: OverviewKPIs;
    hourly: HourlyPoint[];
    status_distribution: StatusDistribution;
    by_department: DepartmentRow[];
    by_member: MemberRow[];
    frt: OverviewFRT;
    ai: OverviewAI;
    queue: OverviewQueue;
    occupancy: OverviewOccupancy;
    live: OverviewLive;
    channel_mix: ChannelSlice[];
    messaging: OverviewMessaging;
    reopen: OverviewReopen;
    finished_by_source: OverviewFinishedBySource;
    stages: OverviewStages;
    period: OverviewPeriod;
    projections: MetricProjection[];
    standing: OverviewStanding;
    trend: OverviewTrend;
    revenue: OverviewRevenue;
    backlog_xray: OverviewBacklogXray;
    quality: OverviewQuality;
    team_ranking: OverviewTeamRanking;
    rework: OverviewRework;
    generated_at: string;
    definitions: MetricDefinitions;
}

export type Verdict =
    | "on_track"
    | "at_risk"
    | "off_track"
    | "no_target"
    | "not_projected"
    | "insufficient_data";

export type MetricKind = "count" | "percent" | "minutes" | "money";

export type MetricDirection = "higher" | "lower";

export type MetricCategory = "volume" | "timing" | "quality" | "revenue" | "other";

export const METRIC_CATEGORY_ORDER: readonly MetricCategory[] = [
    "volume",
    "timing",
    "quality",
    "revenue",
    "other",
];

export interface MetricSpec {
    key: string;
    kind: MetricKind;
    direction: MetricDirection;
    cumulative: boolean;
    targetable: boolean;
    category?: MetricCategory;
}

export interface OverviewPeriod {
    start: string;
    end: string;
    timezone: string;
    open_days_total: number;
    open_days_done: number;
    open_days_left: number;
    open_minutes: number;
    elapsed_pct: number;
    available: boolean;
    reason?: string;
}

export interface MetricProjection {
    metric_key: string;
    kind: MetricKind;
    direction: MetricDirection;
    cumulative: boolean;
    actual: number;
    per_open_day: number | null;
    projected: number | null;
    target: number | null;
    attain_pct: number | null;
    verdict: Verdict;
    available: boolean;
    reason?: string;
}

export interface OverviewStanding {
    targets_set: number;
    on_track: number;
    at_risk: number;
    off_track: number;
    on_track_pct: number;
    cluster?: string;
    available: boolean;
    reason?: string;
}

export interface TrendPoint {
    bucket: string;
    value: number;
    partial: boolean;
    projected: boolean;
}

export interface TrendSeries {
    metric_key: string;
    kind: MetricKind;
    direction: MetricDirection;
    points: TrendPoint[];
    best_bucket?: string;
    best_value?: number | null;
    window_from?: string;
    window_to?: string;
    prev_closed: number | null;
    delta_pct: number | null;
    available: boolean;
    reason?: string;
}

export interface OverviewTrend {
    series: TrendSeries[];
    unbucketed: number;
    available: boolean;
    reason?: string;
}

export interface RevenueByCurrency {
    currency: string;
    value_cents: number;
    won_count: number;
    avg_ticket_cents: number | null;
    per_open_day_cents: number | null;
    projected_cents: number | null;
    prev_closed_cents: number | null;
    delta_pct: number | null;
}

export interface RevenueOwnerRow {
    owner_id: string;
    currency: string;
    won_count: number;
    value_cents: number;
    avg_ticket_cents: number | null;
}

export type RevenueSource = "human" | "ai" | "workflow" | "unowned";

export interface RevenueSourceRow {
    source: RevenueSource;
    currency: string;
    won_count: number;
    value_cents: number;
}

export interface OverviewRevenue {
    currencies: RevenueByCurrency[];
    by_owner: RevenueOwnerRow[];
    by_source: RevenueSourceRow[];
    won_without_value: number;
    unattributed: number;
    unowned_count: number;
    mixed_currencies: boolean;
    available: boolean;
    reason?: string;
}

export interface XrayBucket {
    key: string;
    label?: string;
    count: number;
    pct: number;
}

export interface XrayDimension {
    dimension: string;
    buckets: XrayBucket[];
    measured: number;
    unknown: number;
    available: boolean;
    reason?: string;
}

export interface RecordField {
    key: string;
    filled: number;
    pct: number;
}

export interface RecordCompleteness {
    fields: RecordField[];
    measured: number;
    fully_filled: number;
    avg_fill_pct: number | null;
    available: boolean;
    reason?: string;
}

export interface Reachability {
    channel: string;
    measured: number;
    window_open: number;
    window_closed: number;
    closed_pct: number;
    available: boolean;
    reason?: string;
}

export interface OverviewBacklogXray {
    total: number;
    origin: XrayDimension;
    assignee: XrayDimension;
    age: XrayDimension;
    tenure: XrayDimension;
    returning: XrayDimension;
    record_completeness: RecordCompleteness;
    reachability: Reachability[];
    available: boolean;
    reason?: string;
}

export interface QualityRow {
    actor_id: string;
    actor_kind: string;
    display_name: string;
    closes: number;
    captured: number;
    durable: number;
    durable_pct: number | null;
    verdict: Verdict | "";
}

export interface OverviewQuality {
    threshold: number;
    rows: QualityRow[];
    adjacent: QualityRow[];
    team: QualityRow;
    enabled_at: string | null;
    not_captured: number;
    available: boolean;
    reason?: string;
}

export type MemberClass =
    | "elite"
    | "solid"
    | "below"
    | "critical"
    | "insufficient_data";

export interface RankedMember extends MemberRow {
    rank_metric_value: number;
    per_open_day: number | null;
    per_online_hour: number | null;
    online_ms: number;
    pct_of_team_avg: number | null;
    revenue_cents: number | null;
    currency?: string;
    avg_ticket_cents: number | null;
    won_count: number;
    class?: MemberClass;
}

export interface TeamTotals {
    members: number;
    open: number;
    pending: number;
    resolved: number;
    rank_metric_value: number;
    per_open_day: number | null;
    per_online_hour: number | null;
    online_ms: number;
    revenue_cents: number | null;
    currency?: string;
    avg_ticket_cents: number | null;
    won_count: number;
}

export interface OverviewTeamRanking {
    rank_metric_key: string;
    min_sample: number;
    team_average: number | null;
    members: RankedMember[];
    adjacent: RankedMember[];
    totals: TeamTotals;
    adjacent_totals: TeamTotals;
    available: boolean;
    reason?: string;
}

export interface ReworkRow {
    actor_id: string;
    actor_kind: string;
    display_name: string;
    finished: number;
    reopened: number;
    reopen_rate: number | null;
    templates: number;
    cost_micros: number;
}

export interface OverviewRework {
    rows: ReworkRow[];
    adjacent: ReworkRow[];
    team: ReworkRow;
    unassigned: ReworkRow;
    currency?: string;
    cost_available: boolean;
    cost_reason?: string;
    available: boolean;
    reason?: string;
}
