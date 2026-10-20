import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import CrmMessageInput from "../CrmMessageInput";
import type { EntryType } from "@/lib/conversations/types";
import ptMessages from "@/i18n/messages/pt.json";

vi.mock("@/app/actions/conversations", () => ({ uploadConversationMediaAction: vi.fn() }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));

const composerT = ptMessages.whatsappCampaignsPage.detail.crm.input;

function renderOpen(entryType: EntryType) {
    render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <CrmMessageInput
                entryType={entryType}
                entryId="entry-1"
                onSend={vi.fn()}
                onSendMedia={vi.fn()}
                onTyping={vi.fn()}
                windowOpen
                windowExpiresAt="2026-10-20T12:00:00.000Z"
                translations={composerT}
            />
        </NextIntlClientProvider>,
    );
    return screen.getByRole("textbox");
}

describe("composer text limit", () => {
    it("blocks an Instagram text over 1000 bytes even when it has fewer characters", () => {
        const box = renderOpen("instagram");
        fireEvent.change(box, { target: { value: "é".repeat(600) } });
        expect(screen.getByText("Texto longo demais: 1200 de 1000 bytes permitidos neste canal. Acentos e emojis ocupam mais de um byte.")).toBeInTheDocument();
    });

    it("names the characters Mercado Livre refuses, live, and blocks the send", () => {
        const box = renderOpen("mercadolivre");
        fireEvent.change(box, { target: { value: "Total 10€ “ok”" } });
        expect(screen.getByText("Este canal não aceita estes caracteres: € “ ”. Troque ou remova para enviar.")).toBeInTheDocument();
        expect(screen.getByText("14/350")).toBeInTheDocument();
        fireEvent.change(box, { target: { value: "Olá, obrigado 😀" } });
        expect(screen.queryByText(/Este canal não aceita/)).not.toBeInTheDocument();
    });

    it("keeps counting Messenger text in characters", () => {
        const box = renderOpen("facebook");
        fireEvent.change(box, { target: { value: "é".repeat(2001) } });
        expect(screen.getByText("Texto longo demais: 2001 de 2000 caracteres permitidos neste canal.")).toBeInTheDocument();
    });
});
