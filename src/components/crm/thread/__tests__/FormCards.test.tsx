import { fireEvent, render as rtlRender, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ConversationMessage } from "@/lib/conversations/types";
import type { ThreadRow } from "@/lib/conversations/thread-rows";

import { MessageBubbleRow } from "../MessageBubbleRow";
import { ThreadRowProvider, type ThreadRowContextValue } from "../thread-context";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: (resource: string) => resource === "whatsapp_form_responses" }),
}));

vi.mock("@/app/actions/conversations", () => ({
  getConversationMediaAction: vi.fn().mockResolvedValue({ url: "https://cdn.test/photo.jpg" }),
}));

vi.mock("@/components/whatsapp-forms/detail/ResponseSheet", () => ({
  ResponseSheet: ({ responseId, onClose }: { responseId: string; onClose: () => void }) => (
    <div role="dialog" aria-label={`response ${responseId}`}>
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  ),
}));

const form = ptMessages.crmConversation.thread.form;
const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 10, minute)).toISOString();

function msg(overrides: Partial<ConversationMessage> & { id: string }): ConversationMessage {
  return {
    entry_id: "entry-1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "+5511999999999",
    to: "+5511888888888",
    text: "",
    sender_name: "Lead",
    read: true,
    read_at: null,
    read_by: null,
    created_at: at(0),
    updated_at: at(0),
    ...overrides,
  };
}

function rowOf(message: ConversationMessage, outgoing: boolean): Extract<ThreadRow, { kind: "message" }> {
  return { kind: "message", key: message.id, message, outgoing, groupPosition: "single", channelRunStart: false, runGap: false };
}

function context(messages: ConversationMessage[]): ThreadRowContextValue {
  return {
    conversation: {
      entry_id: "entry-1",
      entry_type: "whatsapp",
      lead_name: "Lead",
      lead_number: "+5511999999999",
      messages,
      has_more: false,
      unread_count: 0,
      window_open: true,
      window_expires_at: null,
    },
    messagesById: new Map(messages.map((message) => [message.id, message])),
    matchedIds: new Set(),
    currentMatchId: null,
    arrivalStart: () => false,
    canSeekOriginal: false,
    onJumpToMessage: () => {},
    resendingIds: new Set(),
    toolDefinitions: new Map(),
    toolCopy: { ...ptMessages.crmConversation.thread.tool, imageSentTo: (recipient: string) => recipient },
  };
}

function renderRow(message: ConversationMessage, outgoing: boolean, thread: ConversationMessage[] = [message]) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ThreadRowProvider value={context(thread)}>{children}</ThreadRowProvider>
    </NextIntlClientProvider>
  );
  return rtlRender(<MessageBubbleRow row={rowOf(message, outgoing)} />, { wrapper });
}

const sent = msg({
  id: "sent",
  message_type: "operator",
  direction: "OUTBOUND",
  text: "Preencha o formulário abaixo.",
  metadata: { form: { kind: "message", formId: "f1", formName: "Captação", sendId: "s1", cta: "Abrir formulário" } } as never,
});

function responseMessage(overrides: Record<string, unknown> = {}) {
  return msg({
    id: "answer",
    created_at: at(5),
    text: "Nome: Ana; CPF: ••••",
    metadata: {
      form: {
        kind: "response",
        formId: "f1",
        formName: "Captação",
        responseId: "r1",
        match: "token",
        answers: [
          { key: "f_name", prompt: "Nome", value: "Ana", sensitive: false },
          { key: "f_cpf", prompt: "CPF", value: "••••", sensitive: true },
          { key: "f_doc", prompt: "Documento", value: "", sensitive: false, files: [{ name: "rg.pdf", mimeType: "application/pdf" }] },
          { key: "f_city", prompt: "Cidade", value: "Recife", sensitive: false },
        ],
        changed: ["name", "email"],
        conflicts: [],
        ...overrides,
      },
    } as never,
  });
}

describe("FormMessageCard", () => {
  it("shows the body, a disabled call to action and the form name", () => {
    renderRow(sent, true);
    expect(screen.getByText("Preencha o formulário abaixo.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir formulário/ })).toBeDisabled();
    expect(screen.getByText("Captação")).toBeInTheDocument();
    expect(screen.getByText(form.waiting)).toBeInTheDocument();
  });

  it("marks the form as answered once a matched response follows it", () => {
    renderRow(sent, true, [sent, responseMessage()]);
    expect(screen.getByText(form.responded)).toBeInTheDocument();
  });

  it("does not count an unmatched response as the answer", () => {
    renderRow(sent, true, [sent, responseMessage({ match: "unmatched_no_token" })]);
    expect(screen.getByText(form.waiting)).toBeInTheDocument();
  });
});

describe("FormResponseCard", () => {
  it("lists the first answers, keeps masked values as received and counts the saved fields", () => {
    renderRow(responseMessage(), false);
    expect(screen.getByText("Nome:")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("••••")).toBeInTheDocument();
    expect(screen.getByText("rg.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Recife")).toBeNull();
    expect(screen.getByText("+1 resposta")).toBeInTheDocument();
    expect(screen.getByText("2 campos salvos no lead")).toBeInTheDocument();
    expect(screen.queryByText("Nome: Ana; CPF: ••••")).toBeNull();
  });

  it("shows every raw answer with a note when the response matched no send", () => {
    renderRow(responseMessage({ match: "unmatched_unknown_token", changed: [] }), false);
    expect(screen.getByText(form.unmatched)).toBeInTheDocument();
    expect(screen.getByText("Recife")).toBeInTheDocument();
    expect(screen.queryByText(/salvos no lead/)).toBeNull();
  });

  it("opens the shared response sheet for the full answer", () => {
    renderRow(responseMessage(), false);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: form.viewFull }));
    expect(screen.getByRole("dialog", { name: "response r1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("hides the full answer link without a response id", () => {
    renderRow(responseMessage({ responseId: "" }), false);
    expect(screen.queryByRole("button", { name: form.viewFull })).toBeNull();
  });
});

describe("template bubble fallback (F4)", () => {
  it("renders the text of a template message that carries no template metadata", () => {
    renderRow(msg({ id: "buttons", message_type: "template", direction: "OUTBOUND", text: "Escolha uma opção" }), true);
    expect(screen.getByText("Escolha uma opção")).toBeInTheDocument();
  });

  it("keeps the template card and hides the duplicate text when metadata is present", () => {
    renderRow(
      msg({
        id: "tpl",
        message_type: "template",
        direction: "OUTBOUND",
        text: "corpo duplicado",
        metadata: { template_name: "boas_vindas", language: "pt_BR", category: "MARKETING", components: [{ type: "BODY", text: "Olá do template" }] },
      }),
      true,
    );
    expect(screen.getByText("Olá do template")).toBeInTheDocument();
    expect(screen.queryByText("corpo duplicado")).toBeNull();
  });
});
