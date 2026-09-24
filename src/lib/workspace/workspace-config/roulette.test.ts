import { describe, expect, it } from "vitest";

import type { WorkspaceConfig } from "./types";
import { handOffRules } from "./roulette";

const config = (over: Partial<WorkspaceConfig>): WorkspaceConfig => ({ ...(over as WorkspaceConfig) });

describe("handOffRules", () => {
  it("reads an unconfigured workspace with the backend defaults", () => {
    expect(handOffRules(null)).toEqual({ mode: "online", windowHours: 48, skipAdmins: false, rescue: null });
  });

  it("describes the online roulette, where rescue never runs", () => {
    expect(
      handOffRules(config({ rouletteMode: "online", skipAdminAssignment: true, rouletteRescueEnabled: true })),
    ).toEqual({ mode: "online", windowHours: 48, skipAdmins: true, rescue: null });
  });

  it("describes the last-seen roulette with its window and rescue", () => {
    expect(
      handOffRules(
        config({
          rouletteMode: "last_seen",
          rouletteLastSeenWindowHours: 24,
          rouletteRescueEnabled: true,
          rouletteRescueAfterMinutes: 10,
          workingHours: { timezone: "America/Sao_Paulo", days: {} },
        }),
      ),
    ).toEqual({ mode: "last_seen", windowHours: 24, skipAdmins: false, rescue: { afterMinutes: 10, workingHoursOnly: true } });
  });

  it("has no rescue when it is switched off", () => {
    expect(handOffRules(config({ rouletteMode: "last_seen", rouletteRescueEnabled: false })).rescue).toBeNull();
  });

  it("clamps out-of-range values the way the server does", () => {
    const rules = handOffRules(config({ rouletteMode: "last_seen", rouletteLastSeenWindowHours: 0, rouletteRescueAfterMinutes: 5000 }));
    expect(rules.windowHours).toBe(48);
    expect(rules.rescue?.afterMinutes).toBe(1440);
  });
});
