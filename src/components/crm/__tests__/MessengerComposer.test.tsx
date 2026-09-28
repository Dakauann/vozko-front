import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { EntryType, WindowTier } from "@/lib/conversations/types";
import CrmMessageInput from "../CrmMessageInput";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

const actions = vi.hoisted(() => ({
    getFacebookThreadStateAction: vi.fn(),
    takeFacebookThreadControlAction: vi.fn(),
}));

vi.mock("@/app/actions/conversations", () => ({ uploadConversationMediaAction: vi.fn() }));
vi.mock("@/app/actions/facebook", () => actions);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));

const composerT = ptMessages.whatsappCampaignsPage.detail.crm.input;
const thread = ptMessages.facebook.thread;

function renderComposer({
    entryType = "facebook",
    windowTier = "standard",
    onSend = vi.fn<(text: string, signed: boolean) => void>(),
    disabled = false,
}: {
    entryType?: EntryType;
    windowTier?: WindowTier;
    onSend?: (text: string, signed: boolean) => void;
    disabled?: boolean;
} = {}) {
    render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <CrmMessageInput
                entryType={entryType}
                entryId="conv-1"
                onSend={onSend}
                onSendMedia={vi.fn()}
                onTyping={vi.fn()}
                windowOpen
                windowExpiresAt="2026-10-05T12:00:00Z"
                windowTier={windowTier}
                translations={composerT}
                disabled={disabled}
            />
        </NextIntlClientProvider>,
    );
    return onSend;
}

beforeEach(() => {
    actions.getFacebookThreadStateAction.mockReset();
    actions.takeFacebookThreadControlAction.mockReset();
    actions.getFacebookThreadStateAction.mockResolvedValue({
        thread: { holder: "vozko", ownerAppId: "", isDefaultRouteApp: true },
    });
});

describe("Messenger composer", () => {
    it("says only a human can reply while the human agent tier is open", () => {
        renderComposer({ windowTier: "human_agent" });
        expect(screen.getByText(/Só uma resposta humana é possível até/)).toBeInTheDocument();
    });

    it("shows no human-only banner on the standard window", () => {
        renderComposer({ windowTier: "standard" });
        expect(screen.queryByText(/Só uma resposta humana/)).not.toBeInTheDocument();
    });

    it("counts characters against the 2000 limit and blocks sending above it", () => {
        const onSend = renderComposer();
        const textarea = screen.getByPlaceholderText(composerT.placeholder);

        fireEvent.change(textarea, { target: { value: "oi" } });
        expect(screen.getByText("2/2000")).toBeInTheDocument();

        fireEvent.change(textarea, { target: { value: "a".repeat(2001) } });
        expect(screen.getByText(/2001 de 2000/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: composerT.sendButton })).toBeDisabled();
        fireEvent.keyDown(textarea, { key: "Enter" });
        expect(onSend).not.toHaveBeenCalled();
    });

    it("does not count characters on channels without a limit", () => {
        renderComposer({ entryType: "whatsapp" });
        fireEvent.change(screen.getByPlaceholderText(composerT.placeholder), { target: { value: "oi" } });
        expect(screen.queryByText("2/2000")).not.toBeInTheDocument();
        expect(actions.getFacebookThreadStateAction).not.toHaveBeenCalled();
    });
});

describe("thread owner banner", () => {
    it("stays hidden while Vozko holds the thread", async () => {
        renderComposer();
        await waitFor(() => expect(actions.getFacebookThreadStateAction).toHaveBeenCalledWith("conv-1"));
        expect(screen.queryByText(thread.heldByBusinessSuite)).not.toBeInTheDocument();
    });

    it("offers to take over a conversation held in Meta Business Suite", async () => {
        actions.getFacebookThreadStateAction.mockResolvedValueOnce({
            thread: { holder: "meta_business_suite", ownerAppId: "263902037430900", isDefaultRouteApp: false },
        });
        actions.takeFacebookThreadControlAction.mockResolvedValue({ ok: true, threadOwnerAppId: "ours" });
        renderComposer();

        expect(await screen.findByText(thread.heldByBusinessSuite)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: thread.takeOver }));

        await waitFor(() => expect(actions.takeFacebookThreadControlAction).toHaveBeenCalledWith("conv-1"));
        await waitFor(() => expect(screen.queryByText(thread.heldByBusinessSuite)).not.toBeInTheDocument());
    });

    it("shows why a take over failed", async () => {
        actions.getFacebookThreadStateAction.mockResolvedValue({
            thread: { holder: "other_app", ownerAppId: "123", isDefaultRouteApp: false },
        });
        actions.takeFacebookThreadControlAction.mockResolvedValue({ error: "nope", code: "facebook_busy" });
        renderComposer();

        fireEvent.click(await screen.findByRole("button", { name: thread.takeOver }));
        expect(await screen.findByText(ptMessages.facebook.errors.facebook_busy)).toBeInTheDocument();
    });

    it("says it could not check the owner instead of assuming Vozko holds it", async () => {
        actions.getFacebookThreadStateAction.mockResolvedValue({ error: "down", code: undefined });
        renderComposer();
        expect(await screen.findByText(/Não foi possível verificar quem atende/)).toBeInTheDocument();
    });
});
