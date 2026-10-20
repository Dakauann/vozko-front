import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { WorkspaceConfig } from "@/lib/workspace/workspace-config/types";

const update = vi.fn();

vi.mock("@/app/actions/workspace-config", () => ({
  updateWorkspaceConfigAction: (...args: unknown[]) => update(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/hooks/use-assignable-members", () => ({
  memberDisplayName: (m: { username?: string; userId: string }) => m.username ?? m.userId,
  useAssignableMembers: () => ({
    members: [
      { userId: "ana", username: "Ana", departments: [{ id: "d1", name: "Vendas" }] },
      { userId: "bob", username: "Bob" },
    ],
    names: new Map(),
    loading: false,
    pending: false,
    failed: false,
    reload: vi.fn(),
  }),
}));

vi.mock("framer-motion", () => {
  const passthrough = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<HTMLElement>) =>
          React.createElement(tag, { ...props, ref }),
        );
        Component.displayName = `motion.${tag}`;
        return Component;
      },
    },
  );
  return { motion: passthrough, AnimatePresence: ({ children }: { children?: React.ReactNode }) => children };
});

import { WorkspaceConfigTab } from "../WorkspaceConfigTab";

const t = ptMessages.workspaceSettings;
const base = { workspaceId: "ws-1", rouletteMode: "online", rouletteStrategy: "round_robin" } as WorkspaceConfig;

function renderCard(config: WorkspaceConfig) {
  const onConfigChange = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <WorkspaceConfigTab workspaceId="ws-1" config={config} onConfigChange={onConfigChange} />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByText(t.distribution.label));
  return onConfigChange;
}

function strategyGroup() {
  return within(screen.getByRole("radiogroup", { name: t.roulette.strategyLabel }));
}

describe("roulette strategy settings", () => {
  beforeEach(() => update.mockReset());

  it("offers every strategy, each with its explainer", () => {
    renderCard(base);

    const radios = strategyGroup().getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false", "false", "false", "false", "false"]);
    for (const key of ["round_robin", "priority", "weighted", "least_busy", "longest_idle", "random", "claim"] as const) {
      expect(strategyGroup().getByRole("button", { name: `Saiba mais sobre ${ptMessages.explainers.settings[STRATEGY_IDS[key]].name}` })).toBeTruthy();
    }
  });

  it("saves a strategy that needs no list right away", async () => {
    update.mockResolvedValue({ config: { ...base, rouletteStrategy: "least_busy" } });
    renderCard(base);

    fireEvent.click(strategyGroup().getByRole("radio", { name: new RegExp(t.roulette.strategies.least_busy.label) }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("ws-1", { rouletteStrategy: "least_busy" }));
  });

  it("asks for the list before switching to priority, then saves both together", async () => {
    update.mockResolvedValue({ config: { ...base, rouletteStrategy: "priority" } });
    renderCard(base);

    fireEvent.click(strategyGroup().getByRole("radio", { name: new RegExp(t.roulette.strategies.priority.label) }));

    expect(update).not.toHaveBeenCalled();
    expect(screen.getByText(t.roulette.recipients.title)).toBeTruthy();
    const save = screen.getAllByRole("button", { name: t.roulette.save })[0];
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Incluir Ana" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Nível de Ana" }), { target: { value: "2" } });
    fireEvent.click(save);

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("ws-1", {
        rouletteRecipients: [{ userId: "ana", tier: 2, weight: 1 }],
        rouletteStrategy: "priority",
      }),
    );
  });

  it("switches straight to weighted when a list already exists", async () => {
    const withList = { ...base, rouletteRecipients: [{ userId: "bob", tier: 1, weight: 4 }] } as WorkspaceConfig;
    update.mockResolvedValue({ config: { ...withList, rouletteStrategy: "weighted" } });
    renderCard(withList);

    fireEvent.click(strategyGroup().getByRole("radio", { name: new RegExp(t.roulette.strategies.weighted.label) }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("ws-1", { rouletteStrategy: "weighted" }));
  });

  it("saves the open conversation limit, empty meaning no limit", async () => {
    update.mockResolvedValue({ config: { ...base, rouletteMaxOpenPerMember: 6 } });
    renderCard(base);

    const field = screen.getByRole("spinbutton", { name: t.roulette.capacity.label });
    fireEvent.change(field, { target: { value: "6" } });
    fireEvent.click(within(field.closest("div")!.parentElement!).getByRole("button", { name: t.roulette.save }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("ws-1", { rouletteMaxOpenPerMember: 6 }));
  });
});

const STRATEGY_IDS = {
  round_robin: "rouletteRoundRobin",
  priority: "roulettePriority",
  weighted: "rouletteWeighted",
  least_busy: "rouletteLeastBusy",
  longest_idle: "rouletteLongestIdle",
  random: "rouletteRandom",
  claim: "rouletteClaim",
} as const;
