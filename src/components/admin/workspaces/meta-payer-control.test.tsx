import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { WorkspaceConfig } from "@/lib/workspace/workspace-config/types";

import { MetaPayerControl } from "./meta-payer-control";

const updateAction = vi.fn();
const toast = vi.fn();

vi.mock("@/app/actions/workspace-config", () => ({
    adminUpdateWorkspaceConfigAction: (...args: unknown[]) => updateAction(...args),
}));

vi.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast }),
}));

const t = ptMessages.adminWorkspaceDetail.config.metaPayer;

const config = {
    id: "cfg-1",
    workspaceId: "ws-1",
    campaignSpamProtectionDays: 0,
    metaPayer: "vozko",
} as WorkspaceConfig;

function renderControl(current: WorkspaceConfig | null, onSaved = vi.fn()) {
    render(
        <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
            <MetaPayerControl workspaceId="ws-1" config={current} onSaved={onSaved} />
        </NextIntlClientProvider>,
    );
    return onSaved;
}

describe("MetaPayerControl", () => {
    beforeEach(() => {
        updateAction.mockReset();
        toast.mockReset();
    });

    it("shows the current payer and the hint", () => {
        renderControl(config);
        expect(screen.getByText(t.title)).toBeInTheDocument();
        expect(screen.getByText(t.description)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.vozko })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: t.client })).toHaveAttribute("aria-pressed", "false");
    });

    it("saves the new payer through the admin config action", async () => {
        const saved = { ...config, metaPayer: "client" } as WorkspaceConfig;
        updateAction.mockResolvedValue({ config: saved });
        const onSaved = renderControl(config);

        fireEvent.click(screen.getByRole("button", { name: t.client }));

        await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
        expect(updateAction).toHaveBeenCalledWith("ws-1", { metaPayer: "client" });
        expect(toast).toHaveBeenCalledWith({ title: t.success });
    });

    it("shows the backend error on a rejected value instead of succeeding", async () => {
        updateAction.mockResolvedValue({ config: null, error: "metaPayer must be vozko or client" });
        const onSaved = renderControl(config);

        fireEvent.click(screen.getByRole("button", { name: t.client }));

        expect(await screen.findByText("metaPayer must be vozko or client")).toBeInTheDocument();
        expect(onSaved).not.toHaveBeenCalled();
        expect(toast).not.toHaveBeenCalled();
    });

    it("fails closed when the saved config does not carry the requested payer", async () => {
        updateAction.mockResolvedValue({ config });
        const onSaved = renderControl(config);

        fireEvent.click(screen.getByRole("button", { name: t.client }));

        expect(await screen.findByText(t.notSaved)).toBeInTheDocument();
        expect(onSaved).not.toHaveBeenCalled();
    });

    it("selects nothing when the payer is unknown", () => {
        renderControl({ ...config, metaPayer: undefined });
        expect(screen.getByText(t.notSet)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: t.vozko })).toHaveAttribute("aria-pressed", "false");
    });
});
