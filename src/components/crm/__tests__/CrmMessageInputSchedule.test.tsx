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
const scheduleTemplateAria = ptMessages.scheduledMessages.composer.scheduleTemplateAria;

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
    it("hides the clock when the caller has not wired scheduling", () => {
        renderComposer();
        expect(screen.queryByLabelText(scheduleAria)).not.toBeInTheDocument();
    });

    it("shows the clock when scheduling is available and the window is open", () => {
        renderComposer({ onSchedule: vi.fn() });
        expect(screen.getByLabelText(scheduleAria)).toBeInTheDocument();
    });

    it("hides the clock when the messaging window is closed", () => {
        renderComposer({ onSchedule: vi.fn(), windowOpen: false });
        expect(screen.queryByLabelText(scheduleAria)).not.toBeInTheDocument();
    });

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

    it("offers a template schedule once the window has closed", () => {
        const onScheduleTemplate = vi.fn();
        renderComposer({ onSchedule: vi.fn(), onScheduleTemplate, windowOpen: false });

        const clock = screen.getByLabelText(scheduleTemplateAria);
        expect(clock).not.toBeDisabled();
        fireEvent.click(clock);
        expect(onScheduleTemplate).toHaveBeenCalled();
    });

    it("keeps the free-text clock while the window is open", () => {
        renderComposer({ onSchedule: vi.fn(), onScheduleTemplate: vi.fn() });

        expect(screen.getByLabelText(scheduleAria)).toBeInTheDocument();
        expect(screen.queryByLabelText(scheduleTemplateAria)).not.toBeInTheDocument();
    });

    it("offers no template schedule to someone who may not send templates", () => {
        renderComposer({ onSchedule: vi.fn(), windowOpen: false });
        expect(screen.queryByLabelText(scheduleTemplateAria)).not.toBeInTheDocument();
    });

    it("disables the template schedule without the send permission", () => {
        renderComposer({ onScheduleTemplate: vi.fn(), windowOpen: false, disabled: true });
        expect(screen.getByLabelText(scheduleTemplateAria)).toBeDisabled();
    });
});
