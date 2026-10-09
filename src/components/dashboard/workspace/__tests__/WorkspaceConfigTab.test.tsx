import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

const geocoding = vi.hoisted(() => ({
  getGeocodingSettingsAction: vi.fn(),
  updateGeocodingSettingsAction: vi.fn(),
}));

vi.mock("@/app/actions/geocoding-settings", () => geocoding);

vi.mock("@/app/actions/workspace-config", () => ({
  updateWorkspaceConfigAction: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("framer-motion", () => {
  const passthrough = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        const Component = React.forwardRef(
          (props: Record<string, unknown>, ref: React.Ref<HTMLElement>) =>
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

function renderTab(ownerSettings: boolean, managerSettings = ownerSettings) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <WorkspaceConfigTab workspaceId="ws-1" config={null} onConfigChange={() => undefined} ownerSettings={ownerSettings} managerSettings={managerSettings} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  geocoding.getGeocodingSettingsAction.mockReset();
  geocoding.getGeocodingSettingsAction.mockResolvedValue({
    settings: {
      provider: "",
      enabled: false,
      monthlyCeiling: 0,
      dailyShare: 0,
      usedThisCycle: 0,
      usedToday: 0,
      exhausted: "",
      availableProviders: ["opencage"],
      attribution: "IBGE, CNEFE 2022",
      canChangeProvider: true,
      canChangeCeiling: false,
    },
    error: null,
  });
});

describe("WorkspaceConfigTab", () => {
  it("shows the owner the attendance settings and no send rules", async () => {
    renderTab(true);

    expect(await screen.findByRole("button", { name: new RegExp(t.geocoding.title) })).toBeInTheDocument();
    expect(screen.getByText(t.configTab.sections.attendance)).toBeInTheDocument();
    expect(screen.getByText(t.configTab.description)).toBeInTheDocument();
    expect(screen.queryByText("Envios")).not.toBeInTheDocument();
    expect(screen.queryByText(/Política de envios/)).not.toBeInTheDocument();
  });

  it("shows a workspace admin how lead addresses become positions, without the owner's attendance settings", async () => {
    renderTab(false, true);

    expect(await screen.findByRole("button", { name: new RegExp(t.geocoding.title) })).toBeInTheDocument();
    expect(screen.getByText(t.configTab.sections.leads)).toBeInTheDocument();
    expect(screen.queryByText(t.configTab.sections.attendance)).not.toBeInTheDocument();
    expect(screen.getByText(t.configTab.managerDescription)).toBeInTheDocument();
    expect(screen.queryByText("Envios")).not.toBeInTheDocument();
  });

  it("shows the owner how lead addresses become positions", async () => {
    renderTab(true);

    expect(await screen.findByRole("button", { name: new RegExp(t.geocoding.title) })).toBeInTheDocument();
    expect(screen.getByText(t.configTab.sections.leads)).toBeInTheDocument();
  });
});
