export const QUEUE_STRATEGIES = ["longest_idle", "round_robin", "fewest_calls", "random"] as const;

export type QueueStrategy = (typeof QUEUE_STRATEGIES)[number];

export const DEFAULT_HOLD_PRESET = "piano_calmo";

export interface HoldMusicRef {
    presetId?: string;
    mediaId?: string;
}

export interface CallQueue {
    id: string;
    name: string;
    strategy: QueueStrategy;
    departmentId?: string;
    memberUserIds: string[];
    ringSeconds: number;
    maxWaitSeconds: number;
    wrapUpSeconds: number;
    holdMusic: HoldMusicRef;
    createdAt: string;
    updatedAt: string;
}

export interface CallQueuePayload {
    name: string;
    strategy: QueueStrategy;
    departmentId?: string;
    memberUserIds?: string[];
    ringSeconds: number;
    maxWaitSeconds: number;
    wrapUpSeconds: number;
    holdMusic: HoldMusicRef;
}

export interface HoldPreset {
    id: string;
    name: string;
    mood: string;
}

export interface QueueTarget {
    id: string;
    name: string;
    waiting: number;
    ready: number;
}

export interface RoutingSettings {
    holdMusic: HoldMusicRef;
}

export function holdMusicKey(ref: HoldMusicRef): string {
    if (ref.mediaId) return `media:${ref.mediaId}`;
    return `preset:${ref.presetId || DEFAULT_HOLD_PRESET}`;
}

export function holdMusicFromKey(key: string): HoldMusicRef {
    const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
    if (kind === "media" && id) return { mediaId: id };
    return { presetId: id || DEFAULT_HOLD_PRESET };
}

export const AGENT_STATES = ["free", "ringing", "on_call", "wrap_up", "offline"] as const;

export type AgentState = (typeof AGENT_STATES)[number];

export interface WaitingCaller {
    callId: string;
    remoteNumber: string;
    waitingSeconds: number;
}

export interface QueueAgent {
    userId: string;
    name?: string;
    state: AgentState;
}

export interface QueueLive {
    id: string;
    name: string;
    waiting: WaitingCaller[];
    longestWaitSeconds: number;
    agents: QueueAgent[];
    counts: { free: number; ringing: number; onCall: number; wrapUp: number; offline: number };
}

export interface QueueStats {
    queueId: string;
    offered: number;
    answered: number;
    abandoned: number;
    timedOut: number;
    averageAnswerSeconds: number;
    serviceLevel: number;
    serviceLevelTargetSeconds: number;
}
