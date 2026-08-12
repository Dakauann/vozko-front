import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import CrmMessageInput from "../CrmMessageInput";
import { NextIntlClientProvider } from "next-intl";
import ptMessages from "@/i18n/messages/pt.json";

vi.mock("framer-motion", () => {
    const React = require("react");
    return {
        motion: new Proxy(
            {},
            {
                get: (_target: unknown, prop: string) =>
                    React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
                        const {
                            initial: _initial,
                            animate: _animate,
                            exit: _exit,
                            transition: _transition,
                            ...rest
                        } = props;
                        return React.createElement(prop, { ...rest, ref });
                    }),
            },
        ),
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    };
});

vi.mock("@/app/actions/conversations", () => ({
    uploadConversationMediaAction: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({
    useWorkspace: () => ({ can: () => true }),
}));

const composerTranslations = ptMessages.whatsappCampaignsPage.detail.crm.input;
const scheduleAria = ptMessages.scheduledMessages.composer.scheduleAria;

function renderComposer(
    props: Partial<React.ComponentProps<typeof CrmMessageInput>> = {},
) {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <CrmMessageInput
                entryType="whatsapp"
                entryId="entry-1"
                onSend={vi.fn()}
                onSendMedia={vi.fn()}
                onTyping={vi.fn()}
                windowOpen
                windowExpiresAt={null}
                translations={composerTranslations}
                {...props}
            />
        </NextIntlClientProvider>,
    );
}

describe("CrmMessageInput scheduling affordance", () => {
    // Not wired means not offered. An affordance that does nothing is worse
    // than its absence.
    it("hides the clock when the caller has not wired scheduling", () => {
        renderComposer();
        expect(screen.queryByLabelText(scheduleAria)).not.toBeInTheDocument();
    });

    it("shows the clock when scheduling is available and the window is open", () => {
        renderComposer({ onSchedule: vi.fn() });
        expect(screen.getByLabelText(scheduleAria)).toBeInTheDocument();
    });

    /**
     * The backend refuses a schedule on a conversation it cannot reply to, so
     * offering the clock there would be a promise we break. The composer is
     * already disabled in that state for the same reason.
     */
    it("hides the clock when the messaging window is closed", () => {
        renderComposer({ onSchedule: vi.fn(), windowOpen: false });
        expect(screen.queryByLabelText(scheduleAria)).not.toBeInTheDocument();
    });

    /**
     * The clock is reachable on an EMPTY composer. That is the point of the
     * redesign: the dialog owns composition, so this is how an operator starts
     * a scheduled message — not a second step after typing.
     */
    it("stays available on an empty composer", () => {
        const onSchedule = vi.fn();
        renderComposer({ onSchedule });

        const clock = screen.getByLabelText(scheduleAria);
        expect(clock).not.toBeDisabled();

        fireEvent.click(clock);
        expect(onSchedule).toHaveBeenCalledWith(
            expect.objectContaining({ text: "", signed: false }),
        );
    });

    it("is disabled without the send permission", () => {
        renderComposer({ onSchedule: vi.fn(), disabled: true });
        expect(screen.getByLabelText(scheduleAria)).toBeDisabled();
    });

    it("hands the composed draft over and clears the composer", () => {
        const onSchedule = vi.fn();
        const onSend = vi.fn();
        renderComposer({ onSchedule, onSend });

        const textarea = screen.getByPlaceholderText(composerTranslations.placeholder);
        fireEvent.change(textarea, { target: { value: "Bom dia!" } });

        fireEvent.click(screen.getByLabelText(scheduleAria));

        expect(onSchedule).toHaveBeenCalledWith(
            expect.objectContaining({ text: "Bom dia!", signed: false }),
        );
        // Scheduling consumes the draft exactly as sending does; leaving the text
        // behind would invite the operator to send it again immediately.
        expect(textarea).toHaveValue("");
        expect(onSend).not.toHaveBeenCalled();
    });

    it("passes the reply target through so a scheduled reply still quotes", () => {
        const onSchedule = vi.fn();
        renderComposer({
            onSchedule,
            replyToMessage: {
                id: "msg-9",
                from: "lead",
                text: "pergunta",
            } as never,
        });

        fireEvent.change(screen.getByPlaceholderText(composerTranslations.placeholder), {
            target: { value: "resposta" },
        });
        fireEvent.click(screen.getByLabelText(scheduleAria));

        expect(onSchedule).toHaveBeenCalledWith(
            expect.objectContaining({ replyToMessageId: "msg-9" }),
        );
    });
});
