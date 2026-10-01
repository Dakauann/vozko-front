export const CALL_DIRECTIONS = ["inbound", "outbound"] as const;
export const CALL_CHANNELS = ["phone", "whatsapp"] as const;
export const CALL_RESULTS = ["answered", "unanswered"] as const;
export const CALL_OUTCOMES = ["in_progress", "answered", "missed", "no_answer", "busy", "declined", "cancelled", "failed"] as const;
export const TIMELINE_KINDS = [
  "started",
  "answered",
  "transfer_requested",
  "transfer_connected",
  "transfer_returned",
  "transfer_unanswered",
  "transfer_cancelled",
  "caller_left",
  "ended",
  "recording_ready",
] as const;

export type CallDirection = (typeof CALL_DIRECTIONS)[number];
export type CallChannel = (typeof CALL_CHANNELS)[number];
export type CallResult = (typeof CALL_RESULTS)[number];
export type CallOutcome = (typeof CALL_OUTCOMES)[number];
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

export interface CallPerson {
  id: string;
  name: string;
}

export interface CallContact {
  number: string;
  leadId?: string;
  name?: string;
}

export interface CallCharge {
  amountMicros: number;
  settled: boolean;
}

export interface CallSummary {
  callId: string;
  direction: CallDirection;
  channel: CallChannel;
  outcome: CallOutcome;
  endReason?: string;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  talkSeconds: number;
  ringSeconds: number;
  contact: CallContact;
  placedBy?: CallPerson;
  answeredBy?: CallPerson;
  transfers: number;
  charge?: CallCharge;
}

export interface CallListPage {
  items: CallSummary[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CallTimelineEntry {
  kind: TimelineKind;
  at: string;
  actor?: CallPerson;
  target?: CallPerson;
  queueId?: string;
  queueName?: string;
  notes?: string;
  reason?: string;
}

export interface CallRecording {
  url: string;
  durationSec: number;
}

export interface CallDetail extends CallSummary {
  handlers: CallPerson[];
  timeline: CallTimelineEntry[];
  recording?: CallRecording;
}

export interface CallListFilters {
  page: number;
  pageSize: number;
  direction?: CallDirection;
  channel?: CallChannel;
  result?: CallResult;
  memberId?: string;
  from?: string;
  to?: string;
  number?: string;
}
