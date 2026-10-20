import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { MercadoLivreMediaUnavailable, MercadoLivreMessageMarks } from "@/components/mercadolivre/mercadolivre-message-marks";
import type { ConversationMessage } from "@/lib/conversations/types";
import { MERCADOLIVRE_MODERATION_REASONS } from "@/lib/mercadolivre/message-metadata";
import ptMessages from "@/i18n/messages/pt.json";

const copy = ptMessages.mercadolivre.thread;

function message(metadata: Record<string, unknown>): ConversationMessage {
  return {
    id: "m-1",
    entry_id: "e-1",
    entry_type: "mercadolivre",
    channel: "mercadolivre",
    message_type: "operator",
    from: "seller",
    to: "buyer",
    text: "Oi",
    sender_name: "Ana",
    read: false,
    read_at: null,
    read_by: null,
    metadata: metadata as unknown as ConversationMessage["metadata"],
    created_at: "2026-10-19T10:00:00Z",
    updated_at: "2026-10-19T10:00:00Z",
  };
}

function renderMarks(metadata: Record<string, unknown>, outgoing: boolean) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <MercadoLivreMessageMarks message={message(metadata)} outgoing={outgoing} />
    </NextIntlClientProvider>,
  );
}

describe("MercadoLivreMessageMarks", () => {
  it("shows nothing for a delivered outbound message", () => {
    const { container } = renderMarks({ mercadolivre_moderation: { status: "available" } }, true);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks an outbound message under review", () => {
    renderMarks({ mercadolivre_moderation: { status: "pending_review" } }, true);
    expect(screen.getByText(copy.moderation.pending_review)).toBeInTheDocument();
  });

  it("marks an outbound message waiting for translation", () => {
    renderMarks({ mercadolivre_moderation: { status: "pending_translation" } }, true);
    expect(screen.getByText(copy.moderation.pending_translation)).toBeInTheDocument();
  });

  it.each(MERCADOLIVRE_MODERATION_REASONS)("explains a block for %s", (reason) => {
    renderMarks({ mercadolivre_moderation: { status: "rejected", reason } }, true);
    expect(screen.getByText(copy.moderation.blocked)).toBeInTheDocument();
    expect(screen.getByText(copy.moderationReason[reason])).toBeInTheDocument();
  });

  it("falls back to the generic reason for an unknown one", () => {
    renderMarks({ mercadolivre_moderation: { status: "moderated", reason: "SOMETHING_NEW" } }, true);
    expect(screen.getByText(copy.moderationReason.unknown)).toBeInTheDocument();
  });

  it("says the state is unknown instead of pretending it was delivered", () => {
    renderMarks({ mercadolivre_moderation: { status: "frozen" } }, true);
    expect(screen.getByText(copy.moderation.unknown)).toBeInTheDocument();
  });

  it("marks an inbound message the Mercado Livre agent relayed", () => {
    renderMarks({ mercadolivre_from_agent: true }, false);
    expect(screen.getByText(copy.fromAgent)).toHaveAttribute("title", copy.fromAgentHint);
  });

  it("does not mark an ordinary inbound message", () => {
    const { container } = renderMarks({ mercadolivre_message_id: "abc" }, false);
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores moderation on inbound messages and the agent flag on outbound ones", () => {
    const { container } = renderMarks({ mercadolivre_moderation: { status: "rejected" }, mercadolivre_from_agent: true }, true);
    expect(screen.queryByText(copy.fromAgent)).not.toBeInTheDocument();
    expect(container).not.toBeEmptyDOMElement();
  });
});

describe("MercadoLivreMediaUnavailable", () => {
  function renderUnavailable(metadata: Record<string, unknown>) {
    return render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <MercadoLivreMediaUnavailable message={message(metadata)} />
      </NextIntlClientProvider>,
    );
  }

  it("names the file that could not be kept", () => {
    renderUnavailable({ mercadolivre_media_unavailable: true, mercadolivre_file_name: "nota.pdf" });
    expect(screen.getByText("Anexo indisponível: nota.pdf")).toBeInTheDocument();
  });

  it("says the attachment is unavailable without a file name", () => {
    renderUnavailable({ mercadolivre_media_unavailable: true });
    expect(screen.getByText(copy.mediaUnavailable)).toBeInTheDocument();
  });
});
