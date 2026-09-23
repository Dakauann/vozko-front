import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import type { WorkspaceConfig } from "@/lib/workspace/workspace-config/types";

import ptMessages from "@/i18n/messages/pt.json";

const updateWorkspaceConfigAction = vi.fn();

vi.mock("@/app/actions/workspace-config", () => ({
  updateWorkspaceConfigAction: (...args: unknown[]) =>
    updateWorkspaceConfigAction(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

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

import { OutcomeCaptureCard } from "../OutcomeCaptureCard";

const t = ptMessages.workspaceSettings.outcomeCapture;

function config(overrides: Partial<WorkspaceConfig> = {}): WorkspaceConfig {
  return {
    id: "cfg-1",
    workspaceId: "ws-1",
    campaignSpamProtectionDays: 3,
    skipAdminAssignment: false,
    autoCloseEnabled: true,
    autoCloseIdleAfterHours: 24,
    autoCloseMaxAgeEnabled: true,
    autoCloseMaxAgeAfterHours: 168,
    rouletteMode: "online",
    rouletteLastSeenWindowHours: 48,
    rouletteRescueEnabled: true,
    rouletteRescueAfterMinutes: 15,
    updatedBy: "u1",
    updatedAt: "2026-09-23T00:00:00Z",
    createdAt: "2026-09-01T00:00:00Z",
    ...overrides,
  } as WorkspaceConfig;
}

function renderCard(overrides: Partial<WorkspaceConfig> = {}) {
  const onConfigChange = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <OutcomeCaptureCard
        workspaceId="ws-1"
        config={config(overrides)}
        onConfigChange={onConfigChange}
      />
    </NextIntlClientProvider>,
  );
  return { onConfigChange };
}

describe("OutcomeCaptureCard", () => {
  beforeEach(() => {
    updateWorkspaceConfigAction.mockReset();
    updateWorkspaceConfigAction.mockResolvedValue({ config: config(), error: null });
  });

  it("renders the add and save controls with visible labels", () => {
    renderCard();

    expect(screen.getByRole("button", { name: t.addOutcome })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.save })).toBeInTheDocument();
  });

  it("adds an outcome row when the add control is used", () => {
    renderCard();

    expect(screen.queryByPlaceholderText(t.labelPlaceholder)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.addOutcome }));

    expect(screen.getByPlaceholderText(t.labelPlaceholder)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(t.codePlaceholder)).toBeInTheDocument();
  });

  it("adds an outcome row from the empty state itself", () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(t.emptyCatalogue) }));
    expect(screen.getByPlaceholderText(t.labelPlaceholder)).toBeInTheDocument();
  });

  it("derives the code from the label when the operator leaves it blank", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: t.addOutcome }));

    const label = screen.getByPlaceholderText(t.labelPlaceholder);
    fireEvent.change(label, { target: { value: "Venda fechada" } });

    const code = screen.getByPlaceholderText(t.codePlaceholder);
    fireEvent.blur(code);

    expect(code).toHaveValue("venda_fechada");
  });

  it("refuses to enable capture with no durable outcome", () => {
    renderCard();

    fireEvent.click(screen.getByLabelText(t.enabled));
    expect(screen.getByText(t.issues.empty)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.save })).toBeDisabled();
  });

  it("saves the catalogue it was given", async () => {
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: t.addOutcome }));
    fireEvent.change(screen.getByPlaceholderText(t.labelPlaceholder), {
      target: { value: "Venda fechada" },
    });
    fireEvent.change(screen.getByPlaceholderText(t.codePlaceholder), {
      target: { value: "sale" },
    });

    fireEvent.click(screen.getByRole("button", { name: t.save }));

    await vi.waitFor(() => {
      expect(updateWorkspaceConfigAction).toHaveBeenCalledTimes(1);
    });
    const [workspaceId, payload] = updateWorkspaceConfigAction.mock.calls[0];
    expect(workspaceId).toBe("ws-1");
    expect(payload.outcomeCapture.outcomes).toEqual([
      { code: "sale", label: "Venda fechada", isDurable: true, position: 1 },
    ]);
  });

  it("keeps the saved policy after the server echoes it back", () => {
    renderCard({
      outcomeCapture: {
        enabled: true,
        enabledAt: "2026-09-01T00:00:00Z",
        requireOnFinish: true,
        durableThreshold: 30,
        outcomes: [
          { code: "sale", label: "Venda fechada", isDurable: true, position: 1 },
        ],
      },
    });

    expect(screen.getByDisplayValue("Venda fechada")).toBeInTheDocument();
    expect(screen.getByDisplayValue("sale")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.save })).toBeDisabled();
  });
});
