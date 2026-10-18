import { validateWorkingHours, type WorkingHoursSpec } from "@/lib/working-hours/types";

export const SMART_PRESETS = ["conservative", "standard", "aggressive"] as const;

export type SmartPreset = (typeof SMART_PRESETS)[number];

export type SmartAction = "continue" | "wait" | "slow_down" | "pause" | "stop" | "complete";

export type SmartProtectiveAction = "slow_down" | "pause" | "stop";

export type SmartPolicy = {
  preset: SmartPreset;
  firstWaveSize: number;
  minWaveSize: number;
  maxWaveSize: number;
  growth: number;
  shrink: number;
  observeWaitMinutes: number;
  maxObserveWaitMinutes: number;
  maxWavesPerDay: number;
  maxSlowWavesAtFloor: number;
  minSample: number;
  failureRateSlow: number;
  failureRateStop: number;
  engagementRateSlow: number;
  onTemplateYellow: SmartProtectiveAction;
  sendHours: WorkingHoursSpec | null;
};

export type SmartFinding = {
  rule: string;
  action: SmartAction;
  observed?: number;
  limit?: number;
  at: string;
};

export type SmartDecision = {
  action: SmartAction;
  findings?: SmartFinding[];
  nextSize?: number;
  waitUntil?: string;
};

export type SmartWaveOutcome = {
  processed: number;
  delivered: number;
  read: number;
  failures?: Record<string, number>;
};

export type SmartWaveState = "released" | "enqueued" | "drained" | "decided";

export type SmartWave = {
  number: number;
  size: number;
  state: SmartWaveState;
  releasedAt: string;
  drainedAt?: string;
  observeUntil?: string;
  decidedAt?: string;
  outcome: SmartWaveOutcome;
  decision: SmartDecision;
};

export type SmartPhase =
  | "not_started"
  | "sending"
  | "observing"
  | "waiting"
  | "held"
  | "paused"
  | "stopped"
  | "completed";

export type SmartProgress = {
  phase: SmartPhase;
  wave?: number;
  until?: string;
  since?: string;
  reason?: SmartDecision;
};

export type SmartDefaults = {
  sendHours: WorkingHoursSpec | null;
  presets: Record<SmartPreset, SmartPolicy>;
};

export type SmartCampaignView = {
  policy: SmartPolicy | null;
  editable: boolean;
  defaults: SmartDefaults;
  progress: SmartProgress;
  waves: SmartWave[];
};

export function presetPolicy(defaults: SmartDefaults, preset: SmartPreset, sendHours: WorkingHoursSpec | null): SmartPolicy {
  return { ...defaults.presets[preset], sendHours };
}

export function canSaveSmartPolicy(policy: SmartPolicy): boolean {
  if (!policy.sendHours) return false;
  const hasOpenDay = Object.values(policy.sendHours.days).some((windows) => (windows ?? []).length > 0);
  return hasOpenDay && validateWorkingHours(policy.sendHours).length === 0;
}

export function failedCount(outcome: SmartWaveOutcome): number {
  return Object.values(outcome.failures ?? {}).reduce((total, n) => total + n, 0);
}

export function failureShare(outcome: SmartWaveOutcome): number {
  return outcome.processed === 0 ? 0 : failedCount(outcome) / outcome.processed;
}

export function readShare(outcome: SmartWaveOutcome): number {
  return outcome.delivered === 0 ? 0 : outcome.read / outcome.delivered;
}

const severity: Record<SmartAction, number> = { continue: 0, complete: 0, wait: 1, slow_down: 2, pause: 3, stop: 4 };

export function holdRules(decision: SmartDecision): SmartFinding[] {
  return (decision.findings ?? [])
    .filter((f) => f.action === "pause" || f.action === "stop")
    .sort((a, b) => severity[b.action] - severity[a.action]);
}
