import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { NextIntlClientProvider } from "next-intl";
import ScheduleMessageDialog from "../ScheduleMessageDialog";
import type { SchedulingWindow } from "@/lib/scheduled-messages/types";
import ptMessages from "@/i18n/messages/pt.json";

const scheduleAction = vi.fn();

vi.mock("@/app/actions/scheduled-messages", () => ({
    scheduleMessageAction: (...args: unknown[]) => scheduleAction(...args),
}));

const uploadAction = vi.fn();
vi.mock("@/app/actions/conversations", () => ({
    uploadConversationMediaAction: (...args: unknown[]) => uploadAction(...args),
}));

const NOW = new Date("2026-08-12T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
const at = (ms: number) => new Date(NOW.getTime() + ms).toISOString();

function openWindow(overrides: Partial<SchedulingWindow> = {}): SchedulingWindow {
    return {
        open: true,
        expiresAt: new Date(NOW.getTime() + 6 * HOUR).toISOString(),
        latestAllowedAt: new Date(NOW.getTime() + 6 * HOUR).toISOString(),
        ...overrides,
    };
}

function renderDialog(
    props: Partial<React.ComponentProps<typeof ScheduleMessageDialog>> = {},
) {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <ScheduleMessageDialog
                open
                onOpenChange={vi.fn()}
                entryType="whatsapp"
                entryId="entry-1"
                window={openWindow()}
                draft={{ text: "Bom dia!", signed: false }}
                onScheduled={vi.fn()}
                {...props}
            />
        </NextIntlClientProvider>,
    );
}

function confirmButton() {
    return screen.getByRole("button", { name: ptMessages.scheduledMessages.dialog.confirm });
}

describe("ScheduleMessageDialog", () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(NOW);
        scheduleAction.mockReset();
        uploadAction.mockReset();
        uploadAction.mockResolvedValue({ mediaId: "med-9", mediaUrl: "", filename: "nota.pdf" });
        scheduleAction.mockResolvedValue({
            scheduledMessage: { id: "sched-1" },
            window: openWindow(),
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // The dialog OWNS composition now. A draft prefills the editor; it is not
    // a read-only preview of something the composer holds.
    it("prefills an editable message field from the draft", () => {
        renderDialog();
        expect(screen.getByLabelText(ptMessages.scheduledMessages.dialog.messageLabel))
            .toHaveValue("Bom dia!");
    });

    // The whole reason the clock no longer needs a draft: this is where an
    // operator starts a message.
    it("lets the operator write from scratch on an empty draft", () => {
        renderDialog({ draft: { text: "", signed: false } });

        const field = screen.getByLabelText(ptMessages.scheduledMessages.dialog.messageLabel);
        expect(field).toHaveValue("");
        expect(confirmButton()).toBeDisabled();

        fireEvent.change(field, { target: { value: "escrito no dialog" } });
        expect(confirmButton()).not.toBeDisabled();
    });

    it("offers quick presets for the common times", () => {
        renderDialog();
        for (const key of ["1h", "3h", "tomorrow", "custom"] as const) {
            expect(
                screen.getByRole("button", { name: ptMessages.scheduledMessages.dialog.presets[key] }),
            ).toBeInTheDocument();
        }
    });

    // A preset the window cannot hold is disabled and says why, rather than
    // vanishing — an option that disappears reads as a bug.
    it("disables a preset that falls outside the window", () => {
        renderDialog({ window: openWindow({ expiresAt: at(2 * HOUR), latestAllowedAt: at(2 * HOUR) }) });
        expect(
            screen.getByRole("button", { name: ptMessages.scheduledMessages.dialog.presets.tomorrow }),
        ).toBeDisabled();
    });

    // An expiry means a clock. Its absence on an OPEN window means the channel
    // has none, and inventing a deadline is a lie the operator plans around.
    it("says plainly when the channel has no 24-hour window", () => {
        renderDialog({ window: { open: true } });
        expect(
            screen.getByText(ptMessages.scheduledMessages.dialog.descriptionNoWindow),
        ).toBeInTheDocument();
    });

    it("describes the window when the channel has one", () => {
        renderDialog();
        expect(
            screen.getByText(ptMessages.scheduledMessages.dialog.description),
        ).toBeInTheDocument();
    });

    // A default the window cannot hold would open the dialog already invalid.
    it("opens with a valid default time", () => {
        renderDialog();
        expect(confirmButton()).not.toBeDisabled();
    });

    it("refuses a time past the window and says which boundary was hit", async () => {
        renderDialog();

        // 6h window; 23:00 local on the same day is outside it.
        fireEvent.change(screen.getByLabelText(ptMessages.scheduledMessages.dialog.timeLabel), {
            target: { value: "23:59" },
        });

        expect(
            await screen.findByText(ptMessages.scheduledMessages.errors.past_window),
        ).toBeInTheDocument();
        expect(confirmButton()).toBeDisabled();
        expect(scheduleAction).not.toHaveBeenCalled();
    });

    // The whole point of the client-side rule: refuse locally rather than let
    // the operator submit something the server will reject.
    it("does not submit a time it knows the server would refuse", () => {
        renderDialog();

        fireEvent.change(screen.getByLabelText(ptMessages.scheduledMessages.dialog.timeLabel), {
            target: { value: "23:59" },
        });
        fireEvent.click(confirmButton());

        expect(scheduleAction).not.toHaveBeenCalled();
    });

    it("sends the whole composed draft", async () => {
        const onScheduled = vi.fn();
        renderDialog({
            draft: {
                text: "Bom dia!",
                mediaId: "med-1",
                mediaType: "image",
                mediaName: "foto.jpg",
                replyToMessageId: "msg-9",
                signed: true,
            },
            onScheduled,
        });

        fireEvent.click(confirmButton());

        await vi.waitFor(() => expect(scheduleAction).toHaveBeenCalled());
        const [entryType, entryId, payload, key] = scheduleAction.mock.calls[0];
        expect(entryType).toBe("whatsapp");
        expect(entryId).toBe("entry-1");
        expect(payload).toMatchObject({
            text: "Bom dia!",
            media_id: "med-1",
            media_type: "image",
            reply_to_message_id: "msg-9",
            signed: true,
        });
        expect(key).toBeTruthy();
        await vi.waitFor(() => expect(onScheduled).toHaveBeenCalled());
    });

    /**
     * A retry is the SAME intention, so it must carry the SAME key: the server
     * then returns the first result instead of scheduling a second message to
     * the customer. One key per dialog-open, not per click, is what buys that.
     */
    it("reuses one idempotency key across a failed submit and its retry", async () => {
        scheduleAction.mockResolvedValueOnce({
            scheduledMessage: null,
            window: null,
            error: { message: "boom", code: "invalid_request" },
        });

        renderDialog();

        fireEvent.click(confirmButton());
        await screen.findByText(ptMessages.scheduledMessages.errors.invalid_request);

        fireEvent.click(confirmButton());
        await vi.waitFor(() => expect(scheduleAction).toHaveBeenCalledTimes(2));

        const [, , , firstKey] = scheduleAction.mock.calls[0];
        const [, , , retryKey] = scheduleAction.mock.calls[1];
        expect(retryKey).toBe(firstKey);
    });

    // The in-flight guard is the other half: while a submit is outstanding the
    // button is not clickable at all, so a double-click cannot even reach the
    // server twice.
    it("blocks a second submit while the first is in flight", async () => {
        let release: (value: unknown) => void = () => {};
        scheduleAction.mockReturnValueOnce(
            new Promise((resolve) => {
                release = resolve;
            }),
        );

        renderDialog();
        fireEvent.click(confirmButton());

        expect(
            screen.getByRole("button", { name: ptMessages.scheduledMessages.dialog.scheduling }),
        ).toBeDisabled();

        release({ scheduledMessage: { id: "sched-1" }, window: openWindow() });
        await vi.waitFor(() => expect(scheduleAction).toHaveBeenCalledTimes(1));
    });

    // Clock skew, or a dialog left open past the boundary. The server's answer
    // is authoritative and gets adopted rather than re-derived locally.
    it("surfaces a server refusal and adopts the boundary it reports", async () => {
        scheduleAction.mockResolvedValueOnce({
            scheduledMessage: null,
            window: null,
            error: {
                message: "past window",
                code: "past_window",
                window: { open: true, expiresAt: new Date(NOW.getTime() + HOUR).toISOString() },
            },
        });

        renderDialog();
        fireEvent.click(confirmButton());

        expect(
            await screen.findByText(ptMessages.scheduledMessages.errors.past_window),
        ).toBeInTheDocument();
    });

    it("surfaces a closed window refused by the server", async () => {
        scheduleAction.mockResolvedValueOnce({
            scheduledMessage: null,
            window: null,
            error: { message: "closed", code: "window_closed", window: { open: false } },
        });

        renderDialog();
        fireEvent.click(confirmButton());

        expect(
            await screen.findByText(ptMessages.scheduledMessages.errors.window_closed),
        ).toBeInTheDocument();
    });


    /**
     * "ANY kind of message" — the dialog attaches its own media rather than
     * only carrying what the composer happened to hold.
     */
    describe("attachments", () => {
        function attach(file: File) {
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            Object.defineProperty(input, "files", { value: [file], configurable: true });
            fireEvent.change(input);
            return input;
        }

        it("accepts every media kind the send path supports", () => {
            renderDialog({ draft: { text: "", signed: false } });
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;

            for (const kind of ["image/", "video/", "audio/", ".pdf"]) {
                expect(input.accept).toContain(kind);
            }
        });

        it("uploads a document and lets it be scheduled with no text at all", async () => {
            renderDialog({ draft: { text: "", signed: false } });
            expect(confirmButton()).toBeDisabled();

            attach(new File(["x"], "nota.pdf", { type: "application/pdf" }));

            await vi.waitFor(() => expect(uploadAction).toHaveBeenCalled());
            const [, , , mediaType] = uploadAction.mock.calls[0];
            expect(mediaType).toBe("document");

            await vi.waitFor(() => expect(confirmButton()).not.toBeDisabled());

            fireEvent.click(confirmButton());
            await vi.waitFor(() => expect(scheduleAction).toHaveBeenCalled());
            const [, , payload] = scheduleAction.mock.calls[0];
            expect(payload).toMatchObject({ media_id: "med-9", media_type: "document", text: "" });
        });

        it("classifies an image as an image", async () => {
            renderDialog({ draft: { text: "", signed: false } });
            attach(new File(["x"], "foto.jpg", { type: "image/jpeg" }));

            await vi.waitFor(() => expect(uploadAction).toHaveBeenCalled());
            expect(uploadAction.mock.calls[0][3]).toBe("image");
        });

        // A voice note carries no caption on any of these channels, so the
        // editor is disabled and the payload's text is empty.
        it("drops the caption for audio", async () => {
            renderDialog({ draft: { text: "algum texto", signed: false } });
            attach(new File(["x"], "audio.ogg", { type: "audio/ogg" }));

            await vi.waitFor(() => expect(uploadAction).toHaveBeenCalled());
            await vi.waitFor(() =>
                expect(
                    screen.getByLabelText(ptMessages.scheduledMessages.dialog.messageLabel),
                ).toBeDisabled(),
            );

            await vi.waitFor(() => expect(confirmButton()).not.toBeDisabled());
            fireEvent.click(confirmButton());
            await vi.waitFor(() => expect(scheduleAction).toHaveBeenCalled());
            expect(scheduleAction.mock.calls[0][2]).toMatchObject({ text: "", media_type: "audio" });
        });

        // Submitting mid-upload would schedule a message whose attachment has
        // no id yet — a text-only send the operator did not ask for.
        it("blocks submitting while the upload is still in flight", async () => {
            let release: (v: unknown) => void = () => {};
            uploadAction.mockReturnValueOnce(new Promise((r) => { release = r; }));

            renderDialog({ draft: { text: "com anexo", signed: false } });
            attach(new File(["x"], "grande.pdf", { type: "application/pdf" }));

            await vi.waitFor(() => expect(confirmButton()).toBeDisabled());

            release({ mediaId: "med-9" });
            await vi.waitFor(() => expect(confirmButton()).not.toBeDisabled());
        });

        it("surfaces an upload failure instead of scheduling a broken message", async () => {
            uploadAction.mockResolvedValueOnce({ mediaId: null, error: "" });

            renderDialog({ draft: { text: "", signed: false } });
            attach(new File(["x"], "ruim.pdf", { type: "application/pdf" }));

            expect(
                await screen.findByText(ptMessages.scheduledMessages.dialog.uploadFailed),
            ).toBeInTheDocument();
            expect(confirmButton()).toBeDisabled();
        });
    });
});
