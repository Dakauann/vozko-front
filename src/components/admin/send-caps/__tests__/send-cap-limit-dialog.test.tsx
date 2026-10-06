import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { SendCapItem } from "@/lib/balance/send-cap-types";

import { SendCapLimitDialog } from "../send-cap-limit-dialog";

const setAction = vi.fn();

vi.mock("@/app/actions/send-caps", () => ({
    adminSetSendCapAction: (...args: unknown[]) => setAction(...args),
}));

vi.mock("@/app/actions/workspace", () => ({
    adminListAllWorkspacesAction: vi.fn().mockResolvedValue({ workspaces: [{ id: "ws-9", name: "Nova" }], meta: {} }),
}));

const t = ptMessages.adminSendCaps;

const item: SendCapItem = {
    workspaceId: "ws-1",
    workspaceName: "Acme",
    limit: 1000,
    used: 900,
    remaining: 100,
    level: "near",
    updatedBy: "admin-1",
    updatedAt: "2026-09-20T10:00:00Z",
    cycleDay: 1,
    cycleStart: "2026-10-01T03:00:00Z",
    renewsAt: "2026-11-01T03:00:00Z",
};

function renderDialog(canUnlock: boolean, onUnlockInstead = vi.fn(), onSaved = vi.fn()) {
    render(
        <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
            <SendCapLimitDialog
                item={item}
                canUnlock={canUnlock}
                onClose={vi.fn()}
                onSaved={onSaved}
                onUnlockInstead={onUnlockInstead}
            />
        </NextIntlClientProvider>,
    );
    return {
        limit: () => screen.getByDisplayValue(/^\d*$/),
        save: () => screen.getByRole("button", { name: t.actions.save }),
    };
}

describe("SendCapLimitDialog", () => {
    beforeEach(() => {
        setAction.mockReset();
    });

    it("lowers the limit through the plain set action", async () => {
        setAction.mockResolvedValue({ change: { workspaceId: "ws-1", limit: 400 } });
        const onSaved = vi.fn();
        const ui = renderDialog(false, vi.fn(), onSaved);

        fireEvent.change(ui.limit(), { target: { value: "400" } });
        fireEvent.click(ui.save());

        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(setAction).toHaveBeenCalledWith("ws-1", 400);
    });

    it("never raises through the plain set action and routes allowlisted admins to the unlock", () => {
        const onUnlockInstead = vi.fn();
        const ui = renderDialog(true, onUnlockInstead);

        fireEvent.change(ui.limit(), { target: { value: "1500" } });

        expect(ui.save()).toBeDisabled();
        expect(screen.getByText(t.limitDialog.raiseNeedsUnlock)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: t.actions.unlock }));
        expect(onUnlockInstead).toHaveBeenCalledWith(item);
        expect(setAction).not.toHaveBeenCalled();
    });

    it("tells admins off the allowlist that raising is not theirs to do", () => {
        const ui = renderDialog(false);

        fireEvent.change(ui.limit(), { target: { value: "1500" } });

        expect(ui.save()).toBeDisabled();
        expect(screen.getByText(t.limitDialog.raiseForbidden)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: t.actions.unlock })).not.toBeInTheDocument();
    });
});

describe("SendCapLimitDialog creating a cap", () => {
    beforeEach(() => {
        setAction.mockReset();
    });

    it("creates the cap on the chosen cycle day", async () => {
        setAction.mockResolvedValue({ change: { workspaceId: "ws-9", limit: 300, cycleDay: 15 } });
        const onSaved = vi.fn();
        render(
            <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
                <SendCapLimitDialog item={null} canUnlock={false} onClose={vi.fn()} onSaved={onSaved} onUnlockInstead={vi.fn()} />
            </NextIntlClientProvider>,
        );

        fireEvent.change(screen.getByPlaceholderText(t.limitDialog.searchPlaceholder), { target: { value: "No" } });
        fireEvent.click(await screen.findByRole("option", { name: "Nova" }));
        fireEvent.change(screen.getByPlaceholderText("5000"), { target: { value: "300" } });
        const day = screen.getByLabelText(t.limitDialog.cycleDay);
        expect(day).toHaveValue("1");
        fireEvent.change(day, { target: { value: "15" } });
        fireEvent.click(screen.getByRole("button", { name: t.actions.save }));

        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(setAction).toHaveBeenCalledWith("ws-9", 300, 15);
    });

    it("refuses a day outside the month", async () => {
        render(
            <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
                <SendCapLimitDialog item={null} canUnlock={false} onClose={vi.fn()} onSaved={vi.fn()} onUnlockInstead={vi.fn()} />
            </NextIntlClientProvider>,
        );
        fireEvent.change(screen.getByPlaceholderText(t.limitDialog.searchPlaceholder), { target: { value: "No" } });
        fireEvent.click(await screen.findByRole("option", { name: "Nova" }));
        fireEvent.change(screen.getByPlaceholderText("5000"), { target: { value: "300" } });
        fireEvent.change(screen.getByLabelText(t.limitDialog.cycleDay), { target: { value: "0" } });
        expect(screen.getByRole("button", { name: t.actions.save })).toBeDisabled();
    });
});
