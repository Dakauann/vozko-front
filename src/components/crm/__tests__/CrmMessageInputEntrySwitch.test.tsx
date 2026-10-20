import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import CrmMessageInput from "../CrmMessageInput";
import ptMessages from "@/i18n/messages/pt.json";

vi.mock("@/app/actions/conversations", () => ({
    uploadConversationMediaAction: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({
    useWorkspace: () => ({ can: () => true }),
}));

const composerTranslations = ptMessages.whatsappCampaignsPage.detail.crm.input;

function composerFor(entryId: string, onTyping = vi.fn()) {
    return (
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <CrmMessageInput
                entryType="whatsapp"
                entryId={entryId}
                onSend={vi.fn()}
                onSendMedia={vi.fn()}
                onTyping={onTyping}
                windowOpen
                windowExpiresAt={null}
                translations={composerTranslations}
            />
        </NextIntlClientProvider>
    );
}

describe("CrmMessageInput across conversations", () => {
    it("starts empty when the operator switches to another conversation, so a reply never reaches the wrong customer", () => {
        const { rerender } = render(composerFor("entry-1"));
        fireEvent.change(screen.getByPlaceholderText(composerTranslations.placeholder), {
            target: { value: "Seu boleto vence amanhã" },
        });

        rerender(composerFor("entry-2"));

        expect(screen.getByPlaceholderText(composerTranslations.placeholder)).toHaveValue("");
    });

    it("tells the previous conversation the operator stopped typing when leaving it mid sentence", () => {
        const firstTyping = vi.fn();
        const { rerender } = render(composerFor("entry-1", firstTyping));
        fireEvent.change(screen.getByPlaceholderText(composerTranslations.placeholder), {
            target: { value: "Olá" },
        });

        rerender(composerFor("entry-2", vi.fn()));

        expect(firstTyping).toHaveBeenLastCalledWith(false);
    });

    it("keeps the text while the same conversation re-renders", () => {
        const { rerender } = render(composerFor("entry-1"));
        fireEvent.change(screen.getByPlaceholderText(composerTranslations.placeholder), {
            target: { value: "Olá" },
        });

        rerender(composerFor("entry-1"));

        expect(screen.getByPlaceholderText(composerTranslations.placeholder)).toHaveValue("Olá");
    });
});
