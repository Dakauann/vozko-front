import { describe, expect, it } from "vitest";

import {
  SMART_PRESETS,
  canSaveSmartPolicy,
  failureShare,
  holdRules,
  presetPolicy,
  readShare,
  type SmartDefaults,
  type SmartDecision,
  type SmartWaveOutcome,
} from "./smart";

const hours = { timezone: "America/Sao_Paulo", days: { mon: [{ start: "08:00", end: "20:00" }] } };

const defaults: SmartDefaults = {
  sendHours: hours,
  presets: {
    conservative: { preset: "conservative", firstWaveSize: 100, minWaveSize: 50, maxWaveSize: 2000, growth: 1.5, shrink: 0.5, observeWaitMinutes: 180, maxObserveWaitMinutes: 300, maxWavesPerDay: 0, maxSlowWavesAtFloor: 3, minSample: 50, failureRateSlow: 0.05, failureRateStop: 0.1, engagementRateSlow: 0.02, onTemplateYellow: "pause", sendHours: hours },
    standard: { preset: "standard", firstWaveSize: 200, minWaveSize: 50, maxWaveSize: 5000, growth: 2, shrink: 0.5, observeWaitMinutes: 120, maxObserveWaitMinutes: 300, maxWavesPerDay: 0, maxSlowWavesAtFloor: 3, minSample: 50, failureRateSlow: 0.08, failureRateStop: 0.15, engagementRateSlow: 0.03, onTemplateYellow: "pause", sendHours: hours },
    aggressive: { preset: "aggressive", firstWaveSize: 500, minWaveSize: 100, maxWaveSize: 20000, growth: 3, shrink: 0.5, observeWaitMinutes: 60, maxObserveWaitMinutes: 300, maxWavesPerDay: 0, maxSlowWavesAtFloor: 3, minSample: 50, failureRateSlow: 0.1, failureRateStop: 0.2, engagementRateSlow: 0.05, onTemplateYellow: "slow_down", sendHours: hours },
  },
};

describe("smart campaign helpers", () => {
  it("offers the presets from the most careful to the fastest", () => {
    expect(SMART_PRESETS).toEqual(["conservative", "standard", "aggressive"]);
  });

  it("keeps the send hours chosen when switching preset", () => {
    const custom = { timezone: "America/Sao_Paulo", days: { sat: [{ start: "09:00", end: "13:00" }] } };
    const next = presetPolicy(defaults, "aggressive", custom);
    expect(next.firstWaveSize).toBe(500);
    expect(next.sendHours).toBe(custom);
  });

  it("refuses to save without valid send hours", () => {
    expect(canSaveSmartPolicy({ ...defaults.presets.standard, sendHours: null })).toBe(false);
    expect(canSaveSmartPolicy({ ...defaults.presets.standard, sendHours: { timezone: "America/Sao_Paulo", days: {} } })).toBe(false);
    expect(canSaveSmartPolicy(defaults.presets.standard)).toBe(true);
  });

  it("measures failures over the processed contacts and reads over the delivered ones", () => {
    const outcome: SmartWaveOutcome = { processed: 200, delivered: 180, read: 90, failures: { "131026": 12, "131049": 8 } };
    expect(failureShare(outcome)).toBeCloseTo(0.1);
    expect(readShare(outcome)).toBeCloseTo(0.5);
    expect(failureShare({ processed: 0, delivered: 0, read: 0 })).toBe(0);
  });

  it("lists the rules behind a hold, the strongest first", () => {
    const decision: SmartDecision = {
      action: "stop",
      findings: [
        { rule: "template_yellow", action: "pause", at: "2026-10-16T15:56:00Z" },
        { rule: "spam_limit", action: "stop", observed: 1, at: "2026-10-16T16:00:00Z" },
        { rule: "failure_rate_slow", action: "slow_down", observed: 0.09, limit: 0.08, at: "2026-10-16T16:00:00Z" },
      ],
    };
    expect(holdRules(decision).map((f) => f.rule)).toEqual(["spam_limit", "template_yellow"]);
  });
});
