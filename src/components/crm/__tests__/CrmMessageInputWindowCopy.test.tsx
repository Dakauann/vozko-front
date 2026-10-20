import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import CrmMessageInput from "../CrmMessageInput";
import { NextIntlClientProvider } from "next-intl";
import type { EntryType, WindowClosedReason } from "@/lib/conversations/types";
import ptMessages from "@/i18n/messages/pt.json";


vi.mock("framer-motion", () => {
    const React = require("react");
    return {
        motion: new Proxy(
            {},
            {
                get: (_t: unknown, prop: string) =>
                    React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
                        const { initial: _i, animate: _a, exit: _e, transition: _tr, ...rest } = props;
                        return React.createElement(prop, { ...rest, ref });
                    }),
            },
        ),
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    };
});

vi.mock("@/app/actions/conversations", () => ({ uploadConversationMediaAction: vi.fn() }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));

const composerT = ptMessages.whatsappCampaignsPage.detail.crm.input;
const reasonCopy = ptMessages.conversationWindow.closed;
const byChannel = ptMessages.conversationWindow.closedByChannel;
const mercadoLivreDetail = ptMessages.conversationWindow.closedDetail.mercadolivre;

function renderClosed(
    windowClosedReason?: WindowClosedReason | null,
    windowExpiresAt: string | null = null,
    entryType: EntryType = "webchat",
    windowClosedDetail: string | null = null,
) {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <CrmMessageInput
                entryType={entryType}
                entryId="entry-1"
                onSend={vi.fn()}
                onSendMedia={vi.fn()}
                onTyping={vi.fn()}
                windowOpen={false}
                windowExpiresAt={windowExpiresAt}
                windowClosedReason={windowClosedReason}
                windowClosedDetail={windowClosedDetail}
                translations={composerT}
            />
        </NextIntlClientProvider>,
    );
}

describe("composer window-closed copy", () => {
    it("names a removed number instead of claiming a 24h window", () => {
        renderClosed("channel_unavailable", null, "unofficial_whatsapp");

        expect(screen.getByText(byChannel.unofficial_whatsapp.channel_unavailable)).toBeInTheDocument();
        expect(screen.queryByText(composerT.windowClosedDescription)).not.toBeInTheDocument();
    });

    it("names the disconnected account on channels without a number, and stays neutral elsewhere", () => {
        const { unmount } = renderClosed("channel_unavailable", null, "mercadolivre");
        expect(screen.getByText(byChannel.mercadolivre.channel_unavailable)).toBeInTheDocument();
        unmount();

        renderClosed("channel_unavailable", null, "webchat");
        expect(screen.getByText(reasonCopy.channel_unavailable)).toBeInTheDocument();
        expect(reasonCopy.channel_unavailable).not.toMatch(/número|WhatsApp/);
    });

    it("explains a Mercado Livre block by its substatus", () => {
        renderClosed("provider_blocked", null, "mercadolivre", "blocked_by_mediation");
        expect(screen.getByText(mercadoLivreDetail.blocked_by_mediation)).toBeInTheDocument();
        expect(screen.queryByText(reasonCopy.provider_blocked)).not.toBeInTheDocument();
    });

    it("falls back to the generic block copy for a substatus it does not know", () => {
        renderClosed("provider_blocked", null, "mercadolivre", "blocked_by_something_new");
        expect(screen.getByText(reasonCopy.provider_blocked)).toBeInTheDocument();
    });

    it("renders distinct copy for every reason the server can send", () => {
        const reasons: WindowClosedReason[] = [
            "expired",
            "no_inbound",
            "contact_blocked",
            "session_down",
            "account_restricted",
            "reply_revoked",
            "channel_unavailable",
            "provider_blocked",
            "budget_exhausted",
        ];

        for (const reason of reasons) {
            const { unmount } = renderClosed(reason);
            expect(screen.getByText(reasonCopy[reason])).toBeInTheDocument();
            unmount();
        }
    });

    it("only the expired reason mentions the 24-hour window", () => {
        const mentions = Object.entries(reasonCopy).filter(([, copy]) =>
            /24\s?h/i.test(copy as string),
        );
        expect(mentions.map(([reason]) => reason)).toEqual(["expired"]);
    });

    it("falls back sensibly when the server names no reason", () => {
        renderClosed(null, null);
        expect(screen.getByText(composerT.windowClosedNoClock)).toBeInTheDocument();

        renderClosed(null, "2026-08-13T12:00:00.000Z");
        expect(screen.getByText(composerT.windowClosedDescription)).toBeInTheDocument();
    });

    it("falls back to the generic closed copy for a reason it does not know yet", () => {
        renderClosed("reason_from_a_newer_backend" as WindowClosedReason, null);
        expect(screen.getByText(composerT.windowClosedNoClock)).toBeInTheDocument();
        for (const copy of Object.values(reasonCopy)) {
            expect(screen.queryByText(copy)).not.toBeInTheDocument();
        }
    });
});
