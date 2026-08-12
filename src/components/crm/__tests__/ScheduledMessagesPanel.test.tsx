import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { NextIntlClientProvider } from "next-intl";
import type { ScheduledMessage } from "@/lib/scheduled-messages/types";
import ScheduledMessagesPanel from "../ScheduledMessagesPanel";
import ptMessages from "@/i18n/messages/pt.json";

const cancelAction = vi.fn().mockResolvedValue({});

vi.mock("@/app/actions/scheduled-messages", () => ({
    cancelScheduledMessageAction: (id: string) => cancelAction(id),
}));

function message(overrides: Partial<ScheduledMessage> = {}): ScheduledMessage {
    return {
        id: "sched-1",
        workspaceId: "ws-1",
        entryId: "entry-1",
        entryType: "whatsapp",
        createdByUserId: "user-1",
        text: "Bom dia!",
        signed: false,
        scheduledAt: "2026-08-13T17:30:00.000Z",
        status: "pending",
        createdAt: "2026-08-12T12:00:00.000Z",
        updatedAt: "2026-08-12T12:00:00.000Z",
        ...overrides,
    };
}

function renderPanel(
    messages: ScheduledMessage[],
    props: Partial<React.ComponentProps<typeof ScheduledMessagesPanel>> = {},
) {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <ScheduledMessagesPanel
                messages={messages}
                canManage
                onChanged={vi.fn()}
                onReuse={vi.fn()}
                {...props}
            />
        </NextIntlClientProvider>,
    );
}

describe("ScheduledMessagesPanel", () => {
    beforeEach(() => {
        cancelAction.mockClear();
    });

    it("renders nothing when there is nothing waiting", () => {
        const { container } = renderPanel([]);
        expect(container).toBeEmptyDOMElement();
    });

    // Delivered messages are already in the history above. Listing them here
    // would make the panel a second, worse transcript.
    it("hides messages that already went out or were cancelled", () => {
        const { container } = renderPanel([
            message({ id: "a", status: "sent" }),
            message({ id: "b", status: "canceled" }),
        ]);
        expect(container).toBeEmptyDOMElement();
    });

    it("shows a pending message with its content", () => {
        renderPanel([message()]);
        expect(screen.getByText("Bom dia!")).toBeInTheDocument();
    });

    /**
     * The one that matters most.
     *
     * `dispatch_interrupted` means the process died between calling the provider
     * and recording the result — the message may well have ARRIVED. Rendering it
     * as a plain failure would invite the operator to send it a second time,
     * which is the one outcome the whole feature is built to avoid.
     */
    it("tells the operator an interrupted delivery is unconfirmed, not failed", () => {
        renderPanel([message({ status: "failed", failureReason: "dispatch_interrupted" })]);

        const copy = ptMessages.scheduledMessages.failures.dispatch_interrupted;
        expect(screen.getByText(copy)).toBeInTheDocument();
        // It must not read like the definite failures.
        expect(screen.queryByText(ptMessages.scheduledMessages.failures.provider_error))
            .not.toBeInTheDocument();
    });

    it("gives each failure reason its own copy", () => {
        const reasons = ["window_closed", "entry_unavailable", "provider_error"] as const;

        for (const reason of reasons) {
            const { unmount } = renderPanel([
                message({ status: "failed", failureReason: reason }),
            ]);
            expect(
                screen.getByText(ptMessages.scheduledMessages.failures[reason]),
            ).toBeInTheDocument();
            unmount();
        }
    });

    // Cancel can LOSE the race with the dispatcher. Refetching rather than
    // optimistically removing is what stops the UI hiding a message the
    // customer just received.
    it("refetches after a cancel instead of removing the row optimistically", async () => {
        const onChanged = vi.fn();
        renderPanel([message()], { onChanged });

        fireEvent.click(screen.getByLabelText(ptMessages.scheduledMessages.panel.cancel));

        await vi.waitFor(() => expect(onChanged).toHaveBeenCalled());
        expect(cancelAction).toHaveBeenCalledWith("sched-1");
    });

    it("hides the cancel action without the send permission", () => {
        renderPanel([message()], { canManage: false });
        expect(
            screen.queryByLabelText(ptMessages.scheduledMessages.panel.cancel),
        ).not.toBeInTheDocument();
    });

    // A message already handed to a dispatcher cannot be pulled back.
    it("offers no cancel for a message that is already sending", () => {
        renderPanel([message({ status: "sending" })]);
        expect(
            screen.queryByLabelText(ptMessages.scheduledMessages.panel.cancel),
        ).not.toBeInTheDocument();
    });

    it("offers a retry for a failed message, carrying its content back", () => {
        const onReuse = vi.fn();
        const failed = message({ status: "failed", failureReason: "provider_error" });
        renderPanel([failed], { onReuse });

        fireEvent.click(screen.getByText(ptMessages.scheduledMessages.panel.reuse));
        expect(onReuse).toHaveBeenCalledWith(failed);
    });

    it("labels a media-only message rather than showing an empty row", () => {
        renderPanel([message({ text: undefined, mediaId: "med-1", mediaType: "image" })]);
        expect(screen.getByText(ptMessages.scheduledMessages.panel.mediaOnly)).toBeInTheDocument();
    });
});
