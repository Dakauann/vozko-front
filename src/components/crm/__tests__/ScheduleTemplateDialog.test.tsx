import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { NextIntlClientProvider } from "next-intl";
import ScheduleTemplateDialog from "../ScheduleTemplateDialog";
import type { SchedulingWindow } from "@/lib/scheduled-messages/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import ptMessages from "@/i18n/messages/pt.json";

const scheduleAction = vi.fn();
vi.mock("@/app/actions/scheduled-messages", () => ({
    scheduleMessageAction: (...args: unknown[]) => scheduleAction(...args),
}));

const listTemplates = vi.fn();
vi.mock("@/app/actions/whatsapp-templates", () => ({
    listWhatsAppTemplatesAction: (...args: unknown[]) => listTemplates(...args),
}));

const quoteAction = vi.fn();
vi.mock("@/app/actions/whatsapp-outreach", () => ({
    quoteTemplateSendAction: (...args: unknown[]) => quoteAction(...args),
}));

vi.mock("@/app/actions/pricing", () => ({
    getExchangeRateAction: () => Promise.resolve({ item: { priceMicros: 5_000_000 } }),
}));

const NOW = new Date("2026-08-12T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const copy = ptMessages.scheduledMessages;

const followUp: WhatsAppTemplate = {
    id: "tpl-1",
    externalId: "ext-1",
    name: "follow_up",
    language: "pt_BR",
    category: "UTILITY",
    status: "APPROVED",
    components: [{ type: "BODY", text: "Oi {{1}}, tudo certo?" }],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
};

function closedWindow(): SchedulingWindow {
    return {
        open: false,
        templateLatestAllowedAt: new Date(NOW.getTime() + 30 * DAY).toISOString(),
    };
}

function renderDialog(props: Partial<React.ComponentProps<typeof ScheduleTemplateDialog>> = {}) {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <ScheduleTemplateDialog
                open
                onOpenChange={vi.fn()}
                entryType="whatsapp"
                entryId="entry-1"
                businessPhoneId="bp-1"
                window={closedWindow()}
                initial={{ templateId: "tpl-1", bodyParams: ["Ana"] }}
                onScheduled={vi.fn()}
                {...props}
            />
        </NextIntlClientProvider>,
    );
}

function confirmButton() {
    return screen.getByRole("button", { name: copy.templateDialog.confirm });
}

describe("ScheduleTemplateDialog", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(NOW);
        scheduleAction.mockReset();
        listTemplates.mockReset();
        quoteAction.mockReset();
        listTemplates.mockResolvedValue({ templates: [followUp] });
        quoteAction.mockResolvedValue({
            quote: { category: "UTILITY", priceMicros: 50_000, balanceMicros: 1_000_000, affordable: true },
        });
        scheduleAction.mockResolvedValue({
            scheduledMessage: { id: "sched-1", kind: "template" },
            window: closedWindow(),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("loads the templates of the conversation's own number", async () => {
        renderDialog();
        await waitFor(() => expect(listTemplates).toHaveBeenCalled());
        expect(listTemplates.mock.calls[0][0]).toMatchObject({ businessPhoneId: "bp-1" });
    });

    it("schedules the template with its values while the window is closed", async () => {
        const onScheduled = vi.fn();
        renderDialog({ onScheduled });

        await waitFor(() => expect(confirmButton()).toBeEnabled());
        fireEvent.click(confirmButton());

        await waitFor(() => expect(scheduleAction).toHaveBeenCalled());
        const [entryType, entryId, payload, key] = scheduleAction.mock.calls[0];
        expect(entryType).toBe("whatsapp");
        expect(entryId).toBe("entry-1");
        expect(payload.template).toEqual({ template_id: "tpl-1", body_params: ["Ana"] });
        expect(new Date(payload.scheduled_at).getTime()).toBeGreaterThan(NOW.getTime());
        expect(payload.text).toBeUndefined();
        expect(key).toBeTruthy();
        await waitFor(() => expect(onScheduled).toHaveBeenCalled());
    });

    it("keeps the confirm disabled while a variable is empty", async () => {
        renderDialog({ initial: { templateId: "tpl-1", bodyParams: [""] } });
        await waitFor(() => expect(listTemplates).toHaveBeenCalled());
        expect(confirmButton()).toBeDisabled();
    });

    it("tells the operator the send is charged when it goes out", async () => {
        renderDialog();
        await waitFor(() =>
            expect(screen.getByText(/será cobrado/i)).toBeInTheDocument(),
        );
    });

    it("warns when today's balance would not cover the send", async () => {
        quoteAction.mockResolvedValue({
            quote: { category: "UTILITY", priceMicros: 50_000, balanceMicros: 0, affordable: false },
        });
        renderDialog();
        await waitFor(() =>
            expect(screen.getByText(copy.templateDialog.insufficientNow)).toBeInTheDocument(),
        );
    });

    it("explains a refusal from the send rules", async () => {
        scheduleAction.mockResolvedValue({
            scheduledMessage: null,
            window: null,
            error: { message: "spam", code: "spam_window" },
        });
        renderDialog();

        await waitFor(() => expect(confirmButton()).toBeEnabled());
        fireEvent.click(confirmButton());

        await waitFor(() =>
            expect(screen.getByText(copy.errors.spam_window)).toBeInTheDocument(),
        );
    });

    it("refuses to schedule without the server's template bound", async () => {
        renderDialog({ window: { open: false } });
        await waitFor(() => expect(listTemplates).toHaveBeenCalled());
        expect(confirmButton()).toBeDisabled();
    });
});
