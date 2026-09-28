import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { SendCapItem } from "@/lib/balance/send-cap-types";

import { SendCapUnlockDialog } from "../send-cap-unlock-dialog";

const unlockAction = vi.fn();

vi.mock("@/app/actions/send-caps", () => ({
    adminUnlockSendCapAction: (...args: unknown[]) => unlockAction(...args),
}));

const t = ptMessages.adminSendCaps;

const item: SendCapItem = {
    workspaceId: "ws-1",
    workspaceName: "Acme",
    limit: 1000,
    used: 1000,
    remaining: 0,
    level: "reached",
    updatedBy: "admin-1",
    updatedAt: "2026-09-20T10:00:00Z",
};

function renderDialog(onUnlocked = vi.fn()) {
    render(
        <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
            <SendCapUnlockDialog item={item} onClose={vi.fn()} onUnlocked={onUnlocked} />
        </NextIntlClientProvider>,
    );
    return {
        limit: () => screen.getByPlaceholderText("2000"),
        code: () => screen.getByLabelText(t.unlockDialog.code),
        confirm: () => screen.getByRole("button", { name: t.unlockDialog.confirmRaise }),
    };
}

describe("SendCapUnlockDialog", () => {
    beforeEach(() => {
        unlockAction.mockReset();
    });

    it("keeps the unlock disabled until a new limit and all four digits are in", () => {
        const ui = renderDialog();
        expect(ui.confirm()).toBeDisabled();

        fireEvent.change(ui.limit(), { target: { value: "5000" } });
        fireEvent.change(ui.code(), { target: { value: "12" } });
        expect(ui.confirm()).toBeDisabled();

        fireEvent.change(ui.code(), { target: { value: "12a34" } });
        expect(ui.code()).toHaveValue("1234");
        expect(ui.confirm()).toBeEnabled();
    });

    it("raises the limit with the typed code", async () => {
        unlockAction.mockResolvedValue({ change: { workspaceId: "ws-1", limit: 5000 } });
        const onUnlocked = vi.fn();
        const ui = renderDialog(onUnlocked);

        fireEvent.change(ui.limit(), { target: { value: "5000" } });
        fireEvent.change(ui.code(), { target: { value: "1234" } });
        fireEvent.click(ui.confirm());

        await waitFor(() => expect(onUnlocked).toHaveBeenCalled());
        expect(unlockAction).toHaveBeenCalledWith("ws-1", { kind: "raise", limit: 5000 }, "1234");
    });

    it("shows the translated refusal and clears the code on a wrong code", async () => {
        unlockAction.mockResolvedValue({ change: null, error: { message: "invalid unlock code", code: "invalid_unlock_code" } });
        const onUnlocked = vi.fn();
        const ui = renderDialog(onUnlocked);

        fireEvent.change(ui.limit(), { target: { value: "5000" } });
        fireEvent.change(ui.code(), { target: { value: "9999" } });
        fireEvent.click(ui.confirm());

        expect(await screen.findByRole("alert")).toHaveTextContent(t.errors.invalid_unlock_code);
        expect(ui.code()).toHaveValue("");
        expect(onUnlocked).not.toHaveBeenCalled();
    });

    it("removes the cap when asked, without a limit", async () => {
        unlockAction.mockResolvedValue({ change: { workspaceId: "ws-1", limit: null } });
        const ui = renderDialog();

        fireEvent.click(screen.getByRole("switch", { name: t.unlockDialog.removeCap }));
        fireEvent.change(ui.code(), { target: { value: "1234" } });
        fireEvent.click(screen.getByRole("button", { name: t.unlockDialog.confirmRemove }));

        await waitFor(() => expect(unlockAction).toHaveBeenCalledWith("ws-1", { kind: "remove" }, "1234"));
    });
});
