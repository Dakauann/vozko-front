export interface TelephonyOverviewParams {
  dateFrom?: string;
  dateTo?: string;
  direction?: string;
  callType?: string;
  agentId?: string;
  memberId?: string;
  serviceLevelSeconds?: number;
}

export interface TelephonyKPIs {
  total_calls: number;
  answered: number;
  failed: number;
  abandoned: number;
  connect_rate: number | null;
  inbound: number;
  outbound: number;
  avg_ring_mins: number | null;
  avg_talk_mins: number | null;
  avg_handle_mins: number | null;
  avg_aht_mins: number | null;
  avg_hold_mins: number | null;
  avg_acw_mins: number | null;
  human_crm_calls: number;
  trunk_inbound: number;
  trunk_outbound: number;
  service_level_pct: number | null;
  service_level_seconds: number;
  answered_within_sl: number;
  cdr_abandon_rate: number | null;
  short_abandons: number;
  transfers: number;
}

export interface TelephonyHourlyPoint {
  hour: number;
  count: number;
}

export interface TelephonyTypeSlice {
  type: string;
  count: number;
  pct: number;
}

export interface TelephonyDirectionSlice {
  direction: string;
  count: number;
  pct: number;
}

export interface TelephonyDisposition {
  code: string;
  label?: string;
  count: number;
  pct: number;
}

export interface TelephonyQueue {
  enqueued: number;
  connected: number;
  abandoned: number;
  overflow: number;
  queue_full: number;
  cancelled?: number;
  avg_asa_mins: number | null;
  max_wait_mins?: number | null;
  service_level_pct?: number | null;
  service_level_seconds?: number;
  abandon_rate: number;
  available: boolean;
}

export interface TelephonyOccupancy {
  avg_occupancy_pct: number | null;
  team_occupancy_pct: number | null;
  team_idle_pct: number | null;
  agents_sampled: number;
  available: boolean;
}

export interface TelephonyLiveAgent {
  user_id: string;
  busy: boolean;
  has_browser: boolean;
  has_branch: boolean;
}

export interface TelephonyLive {
  online: number;
  in_call: number;
  free: number;
  idle_rate_pct: number | null;
  busy_rate_pct: number | null;
  agents?: TelephonyLiveAgent[];
  has_data: boolean;
  as_of: string;
}

export interface TelephonyMemberRow {
  user_id: string;
  total_calls: number;
  answered: number;
  failed: number;
  abandoned: number;
  connect_rate: number;
  avg_talk_mins: number | null;
  avg_ring_mins: number | null;
  avg_handle_mins: number | null;
  within_sl: number;
  service_level_pct?: number | null;
  occupancy_pct?: number | null;
  idle_pct?: number | null;
}

export interface TelephonyOverview {
  kpis: TelephonyKPIs;
  hourly: TelephonyHourlyPoint[];
  by_type: TelephonyTypeSlice[];
  by_direction: TelephonyDirectionSlice[];
  dispositions?: TelephonyDisposition[];
  queue: TelephonyQueue;
  occupancy: TelephonyOccupancy;
  live: TelephonyLive;
  by_member?: TelephonyMemberRow[];
  sla_available?: boolean;
  definitions?: Record<string, string>;
}

export type SeatState = "offline" | "free" | "ringing" | "on_call" | "wrap_up";

export interface HumanSeat {
  user_id: string;
  username?: string;
  state: SeatState;
  has_browser: boolean;
  has_branch: boolean;
  since?: string;
}

export interface AISeat {
  agent_id: string;
  name?: string;
  active: number;
  max: number;
  available: boolean;
}

export interface BoardCapacity {
  used: number;
  max: number;
  pct: number;
}

export interface TelephonyBoard {
  workspace_id: string;
  rev: number;
  as_of: string;
  capacity: BoardCapacity;
  humans: HumanSeat[];
  ai: AISeat[];
  queue: { depth: number; available: boolean };
  online: number;
  free: number;
  in_call: number;
  ringing: number;
  idle_pct?: number | null;
}
