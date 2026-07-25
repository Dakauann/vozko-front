import type {
  ActiveConversation,
  ConversationMessage,
} from "@/lib/conversations/types";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import CrmConversationView from "../CrmConversationView";

vi.mock("framer-motion", () => {
  const React = require("react");
  return {
    motion: new Proxy(
      {},
      {
        get: (_target: unknown, prop: string) =>
          React.forwardRef(
            (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
              const {
                initial: _initial,
                animate: _animate,
                exit: _exit,
                transition: _transition,
                whileHover: _whileHover,
                whileTap: _whileTap,
                ...rest
              } = props;
              return React.createElement(prop, { ...rest, ref });
            },
          ),
      },
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock("@/app/actions/conversations", () => ({
  getConversationMediaAction: vi.fn().mockResolvedValue({ url: "" }),
}));

vi.mock("@/app/actions/agents", () => ({
  getAgentToolsAction: vi.fn().mockResolvedValue({
    tools: [
      {
        name: "manage_entry_stage",
        displayName: "Gerenciar Etapa atual do Lead",
        description: "Move o lead para uma etapa do kanban.",
        displayDescription: "Move o lead para uma etapa do kanban.",
        parameters: {
          target_tag_name: {
            type: "string",
            description: "Nome da etapa destino.",
            displayName: "Etapa Destino",
            displayDescription: "Nome da etapa destino.",
          },
        },
        required: ["target_tag_name"],
        visibility: ["messaging"],
        category: "agent_utility",
        requiresConfig: false,
      },
    ],
    error: null,
  }),
}));

vi.mock("@/components/crm/ConversationAnalysisPanel", () => ({
  default: () => null,
}));

vi.mock("@/components/crm/TemplateBubble", () => ({
  default: ({ metadata }: { metadata: unknown }) => (
    <div data-testid="template-bubble">{JSON.stringify(metadata)}</div>
  ),
}));

vi.mock("@/components/ui/tooltip-wrapper", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));


function makeMsg(
  overrides: Partial<ConversationMessage> & { id: string },
): ConversationMessage {
  return {
    entry_id: "entry-1",
    entry_type: "whatsapp",
    channel: "whatsapp",
    message_type: "user_message",
    from: "+5511999999999",
    to: "+5511888888888",
    text: "Hello",
    sender_name: "Lead User",
    read: false,
    read_at: null,
    read_by: null,
    created_at: "2025-12-01T10:00:00Z",
    updated_at: "2025-12-01T10:00:00Z",
    ...overrides,
  };
}

const LEAD_NUMBER = "+5511999999999";

function makeConversation(
  overrides: Partial<ActiveConversation> & { messages: ConversationMessage[] },
): ActiveConversation {
  return {
    entry_id: "entry-1",
    entry_type: "whatsapp",
    lead_name: "Test Lead",
    lead_number: LEAD_NUMBER,
    has_more: false,
    unread_count: 0,
    window_open: true,
    window_expires_at: null,
    ...overrides,
  };
}

const defaultTranslations = {
  noConversationSelected: "No conversation selected",
  noConversationDescription: "Select a conversation to start",
  loadingMore: "Loading more...",
};


describe("CrmConversationView rendering", () => {
  it("shows empty state when no conversation", () => {
    render(
      <CrmConversationView
        conversation={null as unknown as ActiveConversation}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("No conversation selected")).toBeInTheDocument();
  });

  it("renders user messages as incoming (left-aligned)", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          message_type: "user_message",
          text: "Hi there",
          to: "+5511888888888",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  it("renders operator messages as outgoing with Operador badge", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          message_type: "operator",
          text: "Operator reply",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("Operator reply")).toBeInTheDocument();
    expect(screen.getByText("Operador")).toBeInTheDocument();
  });

  it("renders AI response with AI badge", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          message_type: "ai_response",
          text: "AI answer",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("AI answer")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("renders system messages centered", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          message_type: "system",
          text: "Call started",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("Call started")).toBeInTheDocument();
  });

  it("renders tool messages as centered automation events", async () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          message_type: "tool_call",
          text: "[Tool Call] manage_entry_stage: map[target_tag_name:prospectando]",
        }),
        makeMsg({
          id: "msg-2",
          message_type: "tool_result",
          text: '[Tool Result] O lead já está na tag "prospectando". Nenhuma alteração necessária.',
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(await screen.findByText("Ação do agente")).toBeInTheDocument();
    expect(
      await screen.findByText("Gerenciar Etapa atual do Lead"),
    ).toBeInTheDocument();
    expect(screen.getByText("Etapa Destino: prospectando")).toBeInTheDocument();
    expect(
      screen.getByText("Resultado: Gerenciar Etapa atual do Lead"),
    ).toBeInTheDocument();
  });

  it("renders multiple messages grouped by date", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          created_at: "2025-12-01T10:00:00Z",
          text: "Day 1 message",
        }),
        makeMsg({
          id: "msg-2",
          created_at: "2025-12-02T10:00:00Z",
          text: "Day 2 message",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("Day 1 message")).toBeInTheDocument();
    expect(screen.getByText("Day 2 message")).toBeInTheDocument();
  });

  it("shows sender name for incoming messages", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          message_type: "user_message",
          sender_name: "John Doe",
          to: "+5511888888888",
          text: "Hello from John",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("does not show sender name for outgoing messages", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          message_type: "operator",
          sender_name: "Agent Smith",
          text: "Outgoing msg",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("Outgoing msg")).toBeInTheDocument();
    expect(screen.queryByText("Agent Smith")).not.toBeInTheDocument();
  });

  it("renders WhatsApp channel label", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          channel: "whatsapp",
          text: "WhatsApp message",
          to: "+5511888888888",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
  });

  it("renders voice channel label", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          channel: "voice",
          text: "Voice message",
          to: "+5511888888888",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("Voz")).toBeInTheDocument();
  });

  it("renders reply button when onReply is provided", () => {
    const onReply = vi.fn();
    const conv = makeConversation({
      messages: [makeMsg({ id: "msg-1", text: "Hello", to: "+5511888888888" })],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
        onReply={onReply}
      />,
    );
    const replyButtons = screen.getAllByLabelText("Responder");
    expect(replyButtons.length).toBeGreaterThan(0);
  });

  it("renders loading indicator when loadingHistory is true", () => {
    const conv = makeConversation({
      messages: [makeMsg({ id: "msg-1", text: "msg" })],
      has_more: true,
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        loadingHistory={true}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("Loading more...")).toBeInTheDocument();
  });

  it("renders quoted reply bubble when reply_to_message_id matches", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({ id: "msg-1", text: "Original message" }),
        makeMsg({
          id: "msg-2",
          text: "Reply text",
          reply_to_message_id: "msg-1",
          message_type: "operator",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("Original message")).toBeInTheDocument();
    expect(screen.getByText("Reply text")).toBeInTheDocument();
  });

  it("renders 'Mensagem original não disponível' for missing reply", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-2",
          text: "Reply to missing",
          reply_to_message_id: "msg-nonexistent",
          message_type: "operator",
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(
      screen.getByText("Mensagem original não disponível"),
    ).toBeInTheDocument();
  });

  it("renders Template badge for template messages", () => {
    const conv = makeConversation({
      messages: [
        makeMsg({
          id: "msg-1",
          message_type: "template",
          text: "",
          metadata: {
            template_name: "welcome",
            language: "pt_BR",
            category: "MARKETING",
            components: [],
          },
        }),
      ],
    });
    render(
      <CrmConversationView
        conversation={conv}
        isTyping={false}
        translations={defaultTranslations as never}
      />,
    );
    expect(screen.getByText("Template")).toBeInTheDocument();
  });
});
