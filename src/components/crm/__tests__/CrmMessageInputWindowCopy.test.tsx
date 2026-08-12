import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import CrmMessageInput from "../CrmMessageInput";
import { NextIntlClientProvider } from "next-intl";
import type { WindowClosedReason } from "@/lib/conversations/types";
import ptMessages from "@/i18n/messages/pt.json";

/**
 * The composer used to INFER why sending was blocked from whether an expiry
 * accompanied the closed window. That inference shipped a real bug: every
 * clockless channel — unofficial WhatsApp, and every group on it — announced
 * "the 24-hour window is closed" on a channel that has no such window.
 *
 * The server now names the reason. These pin that the composer renders it.
 */

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

function renderClosed(
    windowClosedReason?: WindowClosedReason | null,
    windowExpiresAt: string | null = null,
) {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <CrmMessageInput
                entryType="unofficial_whatsapp"
                entryId="entry-1"
                onSend={vi.fn()}
                onSendMedia={vi.fn()}
                onTyping={vi.fn()}
                windowOpen={false}
                windowExpiresAt={windowExpiresAt}
                windowClosedReason={windowClosedReason}
                translations={composerT}
            />
        </NextIntlClientProvider>,
    );
}

describe("composer window-closed copy", () => {
    // THE regression. A removed number is not a clock, and must never claim one.
    it("names a removed number instead of claiming a 24h window", () => {
        renderClosed("channel_unavailable");

        expect(screen.getByText(reasonCopy.channel_unavailable)).toBeInTheDocument();
        expect(screen.queryByText(composerT.windowClosedDescription)).not.toBeInTheDocument();
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
        ];

        for (const reason of reasons) {
            const { unmount } = renderClosed(reason);
            expect(screen.getByText(reasonCopy[reason])).toBeInTheDocument();
            unmount();
        }
    });

    // Only `expired` reopens on its own, so it is the only reason allowed to
    // tell the operator to wait for the customer.
    it("only the expired reason mentions the 24-hour window", () => {
        const mentions = Object.entries(reasonCopy).filter(([, copy]) =>
            /24\s?h/i.test(copy as string),
        );
        expect(mentions.map(([reason]) => reason)).toEqual(["expired"]);
    });

    // An older server, or a channel that has not adopted the vocabulary: keep
    // the previous behaviour rather than invent a reason.
    it("falls back sensibly when the server names no reason", () => {
        renderClosed(null, null);
        expect(screen.getByText(composerT.windowClosedNoClock)).toBeInTheDocument();

        renderClosed(null, "2026-08-13T12:00:00.000Z");
        expect(screen.getByText(composerT.windowClosedDescription)).toBeInTheDocument();
    });
});
