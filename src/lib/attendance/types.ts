
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

/** Filter for GET /attendance/overview */
export interface AttendanceOverviewParams {
    dateFrom?: string;
    dateTo?: string;
    departmentId?: string;
    memberId?: string;
    campaignId?: string;
    campaignType?: string;
    channel?: string;
    includeAi?: boolean;
}

export interface OverviewKPIs {
    /** Engaged conversations (scoped entries with ≥1 message). Primary universe. */
    engaged?: number;
    /** Scoped entries with zero messages (campaign shells). */
    shell_backlog?: number;
    /** engaged + shell_backlog */
    total_scoped?: number;
    /** Entries created in range (including shells). */
    entries_created?: number;
    finished: number;
    ongoing: number;
    pending: number;
    /**
     * Leads created in the period.
     *
     * The one KPI here that counts CRM contacts rather than conversations, so it
     * includes people imported or pushed by an integration who have not been
     * messaged yet. It answers to the date range only, because a lead has no
     * department, assignee or channel until it has a conversation.
     */
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
    /** Primary: avg over engaged (has messages) only. */
    avg_messages_per_conversation: number | null;
    avg_inbound: number | null;
    avg_outbound: number | null;
    /** Avg template (HSM) messages per conversation that has any message. */
    avg_template?: number | null;
    /** Total WhatsApp template messages in the scoped period. */
    template_messages?: number;
    conversations_with_messages: number;
    /** Conversations that received at least one template message. */
    conversations_with_template?: number;
    /** Dual denom: avg including zero-message shells. */
    avg_messages_all_scoped?: number | null;
    available: boolean;
}

export interface OverviewReopen {
    reopened_count: number;
    /** Engaged finished (same as kpis.finished), rate denominator. */
    finished_count?: number;
    /** Telemetry: conversation_events finished in range (may include out-of-scope shells). */
    finished_event_count: number;
    reopen_rate: number | null;
    available: boolean;
}

/** Split of scoped finished conversations by close_source (monthly review). */
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

/**
 * One stage's share of the period.
 *
 * `engaged` is the headline everywhere on this page; `shell` is campaign and
 * import rows parked in the stage that were never messaged, reported beside it
 * and never summed into it.
 */
export interface StageRow {
    stage_id: string;
    stage_name: string;
    /** The stage's own kanban colour, when the workspace picked one. */
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
    /** Share of this funnel's engaged conversations. */
    pct_of_funnel: number;
    /** Share of every staged engaged conversation in scope. */
    pct_of_staged: number;
    /**
     * Days the OPEN conversations here have been sitting, measured against now
     * rather than the period end. Null when nothing here is open: 0 would read
     * as "everyone arrived today".
     */
    avg_days_in_stage: number | null;
    oldest_days_in_stage: number | null;
    /** Open conversations past `stuck_after_days`. */
    stuck: number;
    stuck_after_days: number;
    /** True when the threshold is the stage's own, false when it is the default. */
    rot_days_set: boolean;
}

/** One funnel (pipeline) and the stages it owns. `funnel_id` is empty for the
 * single bucket of stages belonging to no funnel, which always sorts last. */
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

/** Where the period's conversations are sitting, grouped by owning funnel. */
export interface OverviewStages {
    funnels: StageFunnelGroup[];
    staged_engaged: number;
    staged_shell: number;
    /** Scoped minus staged: conversations carrying no stage at all. */
    unstaged_engaged: number;
    unstaged_shell: number;
    stuck: number;
    available: boolean;
}

export interface MetricDefinitions {
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
    /** Where the scoped conversations are sitting, grouped by funnel. */
    stages: OverviewStages;
    definitions: MetricDefinitions;
}
