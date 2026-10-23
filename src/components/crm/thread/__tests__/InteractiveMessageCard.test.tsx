import { fireEvent, render as rtlRender, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { InteractiveChoice } from "@/lib/conversations/interactive-message";
import type { ConversationMessage, InteractiveContent } from "@/lib/conversations/types";
import type { ThreadRow } from "@/lib/conversations/thread-rows";

import { MessageBubbleRow } from "../MessageBubbleRow";
import { ThreadRowProvider, type ThreadRowContextValue } from "../thread-context";

vi.mock("framer-motion", () => import("@/test/framer-motion-stub"));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));
vi.mock("@/app/actions/conversations", () => ({ getConversationMediaAction: vi.fn() }));

const copy = ptMessages.crmConversation.thread.interactive;

function prompt(interactive: InteractiveContent, overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: "m-1",
    entry_id: "entry-1",
    entry_type: "unofficial_whatsapp",
    channel: "unofficial_whatsapp",
    message_type: "ai_response",
    direction: "OUTBOUND",
    from: "business",
    to: "contact",
    text: interactive.body,
    sender_name: "",
    read: false,
    read_at: null,
    read_by: null,
    interactive,
    created_at: "2026-10-23T16:32:03Z",
    updated_at: "2026-10-23T16:32:03Z",
    ...overrides,
  };
}

function choice(optionId: string, title: string): ConversationMessage {
  return {
    id: "r-1",
    entry_id: "entry-1",
    entry_type: "unofficial_whatsapp",
    channel: "unofficial_whatsapp",
    message_type: "user_message",
    direction: "INBOUND",
    from: "contact",
    to: "business",
    text: title,
    sender_name: "Ana",
    read: true,
    read_at: null,
    read_by: null,
    reply_to_message_id: "m-1",
    interactive_reply: { kind: "option", option_id: optionId, title },
    created_at: "2026-10-23T16:32:32Z",
    updated_at: "2026-10-23T16:32:32Z",
  };
}

function renderBubble(message: ConversationMessage, options: { others?: ConversationMessage[]; onChooseOption?: (choice: InteractiveChoice) => void } = {}) {
  const all = [message, ...(options.others ?? [])];
  const context: ThreadRowContextValue = {
    conversation: { entry_id: "entry-1", entry_type: "unofficial_whatsapp", lead_name: "", lead_number: "", messages: all, has_more: false, unread_count: 0, window_open: true, window_expires_at: null },
    messagesById: new Map(all.map((m) => [m.id, m])),
    matchedIds: new Set(),
    currentMatchId: null,
    arrivalStart: () => false,
    canSeekOriginal: false,
    onJumpToMessage: () => {},
    resendingIds: new Set(),
    toolDefinitions: new Map(),
    toolCopy: { ...ptMessages.crmConversation.thread.tool, imageSentTo: (recipient: string) => recipient },
    onChooseOption: options.onChooseOption,
  };
  const row: Extract<ThreadRow, { kind: "message" }> = {
    kind: "message",
    key: message.id,
    message,
    outgoing: message.direction === "OUTBOUND",
    groupPosition: "single",
    channelRunStart: false,
    runGap: false,
  };
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC">
        <ThreadRowProvider value={context}>{children}</ThreadRowProvider>
      </NextIntlClientProvider>
    );
  }
  const view = rtlRender(<MessageBubbleRow row={row} />, { wrapper: Wrapper });
  return view.container.querySelector<HTMLElement>("[data-bubble]")!;
}

const JABAQUARA: InteractiveContent = {
  kind: "list",
  body: "Para seguir com seu atendimento, selecione alguma das opções abaixo",
  footer: "Cartão de Todos",
  button_label: "Ver opções",
  sections: [
    {
      title: "Atendimento",
      rows: [
        { id: "beneficios", title: "Saber sobre beneficios", description: "Rede credenciada" },
        { id: "agendar", title: "Agendar consulta" },
        { id: "outros", title: "Outros" },
      ],
    },
  ],
};

const BUTTONS: InteractiveContent = {
  kind: "buttons",
  header: { type: "text", text: "Matrícula" },
  body: "Quer continuar a matrícula?",
  footer: "Responda abaixo",
  buttons: [
    { kind: "reply", id: "sim", title: "Sim" },
    { kind: "reply", id: "nao", title: "Não" },
  ],
};

describe("a list message drawn the WhatsApp way", () => {
  it("keeps body and footer in the bubble and attaches the list button under a hairline", () => {
    const bubble = renderBubble(prompt(JABAQUARA));
    expect(within(bubble).getByText(JABAQUARA.body)).toBeInTheDocument();
    const footer = within(bubble).getByText("Cartão de Todos");
    expect(footer.className).toContain("text-muted-foreground");

    const actions = bubble.querySelector<HTMLElement>("[data-interactive-actions]")!;
    expect(actions).toBe(bubble.lastElementChild);
    expect(actions.className).toContain("border-t");
    expect(actions.className).toContain("border-black/[0.08]");
    expect(actions.className).toContain("dark:border-white/10");
    const opener = within(actions).getByRole("button", { name: "Ver opções" });
    expect(opener.className).toContain("text-[#0b6ea8]");
    expect(opener.className).toContain("dark:text-[#8fd0f7]");
    expect(opener).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a sheet titled with the button label that lists every row, read only for operators", () => {
    renderBubble(prompt(JABAQUARA));
    fireEvent.click(screen.getByRole("button", { name: "Ver opções" }));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: "Ver opções" })).toBeInTheDocument();
    expect(within(sheet).getByText("Atendimento")).toBeInTheDocument();
    expect(within(sheet).getByText("Rede credenciada")).toBeInTheDocument();
    expect(within(sheet).getByText(copy.sheetReadOnly)).toBeInTheDocument();
    const rows = within(sheet).getAllByRole("radio");
    expect(rows).toHaveLength(3);
    rows.forEach((row) => {
      expect(row).toBeDisabled();
      expect(row).toHaveAttribute("aria-checked", "false");
    });
  });

  it("marks the row the contact chose", () => {
    renderBubble(prompt(JABAQUARA), { others: [choice("agendar", "Agendar consulta")] });
    fireEvent.click(screen.getByRole("button", { name: "Ver opções" }));

    const chosen = screen.getByRole("radio", { name: /Agendar consulta/ });
    expect(chosen).toHaveAttribute("aria-checked", "true");
    expect(within(chosen).getByText(copy.chosen)).toBeInTheDocument();
    expect(chosen.querySelector("[data-radio-checked='true']")?.className).toContain("border-primary");
    expect(screen.getByRole("radio", { name: /Outros/ })).toHaveAttribute("aria-checked", "false");
  });

  it("lets the simulator answer as the contact by tapping a row", () => {
    const onChooseOption = vi.fn();
    renderBubble(prompt(JABAQUARA), { onChooseOption });
    fireEvent.click(screen.getByRole("button", { name: "Ver opções" }));
    fireEvent.click(screen.getByRole("radio", { name: /Saber sobre beneficios/ }));
    expect(onChooseOption).toHaveBeenCalledWith({ kind: "list", id: "beneficios", title: "Saber sobre beneficios" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("reply buttons drawn the WhatsApp way", () => {
  it("shows the header, the body and the footer, then one full-width row per button", () => {
    const bubble = renderBubble(prompt(BUTTONS));
    expect(within(bubble).getByText("Matrícula").className).toContain("font-semibold");
    expect(within(bubble).getByText("Quer continuar a matrícula?")).toBeInTheDocument();
    expect(within(bubble).getByText("Responda abaixo")).toBeInTheDocument();

    const actions = bubble.querySelector<HTMLElement>("[data-interactive-actions]")!;
    expect(actions.className).toContain("divide-y");
    expect(actions.className).toContain("dark:divide-white/10");
    const yes = within(actions).getByRole("button", { name: "Sim" });
    expect(yes).toBeDisabled();
    expect(yes).toHaveAttribute("title", copy.choiceHint);
    expect(yes.className).toContain("justify-center");
    expect(within(actions).getAllByRole("button")).toHaveLength(2);
  });

  it("sends the tapped button as a choice when the thread accepts one", () => {
    const onChooseOption = vi.fn();
    renderBubble(prompt(BUTTONS), { onChooseOption });
    fireEvent.click(screen.getByRole("button", { name: "Não" }));
    expect(onChooseOption).toHaveBeenCalledWith({ kind: "button", id: "nao", title: "Não" });
  });

  it("puts the outgoing bubble in WhatsApp's colors in both themes", () => {
    const bubble = renderBubble(prompt(BUTTONS));
    expect(bubble.className).toContain("bg-[#d9fdd3]");
    expect(bubble.className).toContain("dark:bg-[#005c4b]");
  });
});

describe("links, templates and media headers", () => {
  it("draws a link button as an external link row", () => {
    const bubble = renderBubble(prompt({ kind: "cta_url", body: "Acompanhe seu pedido", buttons: [{ kind: "url", title: "Ver pedido", url: "https://exemplo.com/pedido" }] }));
    const link = within(bubble).getByRole("link", { name: "Ver pedido" });
    expect(link).toHaveAttribute("href", "https://exemplo.com/pedido");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("draws a template with its media header and every kind of button through the same rows", () => {
    const bubble = renderBubble(
      prompt(
        {
          kind: "template",
          template_name: "boas_vindas",
          header: { type: "image", media_url: "https://cdn.exemplo.com/h.jpg" },
          body: "Olá Ana",
          footer: "Equipe",
          buttons: [
            { kind: "reply", title: "Quero" },
            { kind: "url", title: "Site", url: "https://exemplo.com" },
            { kind: "phone", title: "Ligar", phone: "+5511999990000" },
            { kind: "copy_code", title: "" },
          ],
        },
        { message_type: "template", channel: "whatsapp", entry_type: "whatsapp" },
      ),
    );
    expect(within(bubble).getByRole("img", { name: "Imagem" })).toHaveAttribute("src", "https://cdn.exemplo.com/h.jpg");
    expect(within(bubble).getByText("Olá Ana")).toBeInTheDocument();
    const actions = bubble.querySelector<HTMLElement>("[data-interactive-actions]")!;
    expect(within(actions).getByRole("button", { name: "Quero" })).toBeDisabled();
    expect(within(actions).getByRole("link", { name: "Site" })).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: "Ligar" })).toBeInTheDocument();
    expect(within(actions).getByRole("button", { name: copy.copyCode })).toBeInTheDocument();
    expect(within(bubble).getByTitle("boas_vindas")).toBeInTheDocument();
  });

  it("names a media header that has no file yet", () => {
    const bubble = renderBubble(prompt({ ...BUTTONS, header: { type: "document" } }));
    expect(bubble.querySelector("[data-interactive-media='document']")?.textContent).toBe("Documento");
  });
});

describe("the contact's choice", () => {
  it("quotes the prompt and keeps the chosen row's description under the title", () => {
    const bubble = renderBubble(choice("beneficios", "Saber sobre beneficios"), { others: [prompt(JABAQUARA)] });
    expect(within(bubble).getByText("Saber sobre beneficios")).toBeInTheDocument();
    expect(within(bubble).getByText("Rede credenciada")).toBeInTheDocument();
    expect(within(bubble).getByRole("button", { name: new RegExp(JABAQUARA.body.slice(0, 20)) })).toBeInTheDocument();
    expect(bubble.querySelector("[data-interactive-actions]")).toBeNull();
  });
});
