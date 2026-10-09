import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

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

function renderTab() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <WorkspaceConfigTab workspaceId="ws-1" config={null} onConfigChange={() => undefined} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("WorkspaceConfigTab", () => {
  it("shows the owner the attendance settings and no send rules", () => {
    renderTab();

    expect(screen.getByText(t.configTab.sections.attendance)).toBeInTheDocument();
    expect(screen.getByText(t.configTab.description)).toBeInTheDocument();
    expect(screen.queryByText("Envios")).not.toBeInTheDocument();
    expect(screen.queryByText(/Política de envios/)).not.toBeInTheDocument();
  });

  it("has no address localisation card, since positions come only from the IBGE reference", () => {
    renderTab();

    expect(screen.queryByText("Localização de endereços")).not.toBeInTheDocument();
    expect(screen.queryByText(/provedor externo/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Leads")).not.toBeInTheDocument();
  });
});
