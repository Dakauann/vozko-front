import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import type { WorkspaceConfig } from "@/lib/workspace/workspace-config/types";

import ptMessages from "@/i18n/messages/pt.json";

let mockConfig: WorkspaceConfig | null = null;

vi.mock("@/hooks/use-workspace-config", () => ({
  useWorkspaceConfig: () => ({ config: mockConfig, loaded: true }),
}));

import { HandOffRulesSummary } from "../HandOffRulesSummary";

const t = ptMessages.handOffRules;

function renderSummary() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <HandOffRulesSummary workspaceId="ws-1" />
    </NextIntlClientProvider>,
  );
}

describe("HandOffRulesSummary", () => {
  it("states the workspace's roulette so the builder knows who will receive it", () => {
    mockConfig = {
      rouletteMode: "last_seen",
      rouletteLastSeenWindowHours: 24,
      skipAdminAssignment: true,
      rouletteRescueEnabled: true,
      rouletteRescueAfterMinutes: 10,
      workingHours: { timezone: "America/Sao_Paulo", days: {} },
    } as WorkspaceConfig;

    renderSummary();

    expect(screen.getByText(t.title)).toBeTruthy();
    expect(screen.getByText(t.lastSeen.replace("{hours}", "24"))).toBeTruthy();
    expect(screen.getByText(t.adminsSkipped)).toBeTruthy();
    expect(screen.getByText(t.rescueWorkingHours.replace("{minutes}", "10"))).toBeTruthy();
    expect(screen.getByText(t.queue)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.settingsLink }).getAttribute("href")).toBe("/pt/dashboard/workspace");
  });

  it("says there is no rescue with the online roulette", () => {
    mockConfig = { rouletteMode: "online", skipAdminAssignment: false } as WorkspaceConfig;

    renderSummary();

    expect(screen.getByText(t.online)).toBeTruthy();
    expect(screen.getByText(t.adminsIncluded)).toBeTruthy();
    expect(screen.getByText(t.noRescue)).toBeTruthy();
  });

  it("shows nothing it cannot back with the workspace's settings", () => {
    mockConfig = null;

    const { container } = renderSummary();

    expect(container.innerHTML).toBe("");
  });
});
