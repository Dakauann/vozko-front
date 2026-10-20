import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const crm = vi.hoisted(() => ({ viewersByEntry: new Map(), typingByEntry: new Map() }));

vi.mock("@/contexts/crm-context", () => ({ useOptionalCrm: () => crm }));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "user-ana" }));
vi.mock("@/components/ui/tooltip-wrapper", () => ({
  default: ({ children, content }: { children: React.ReactNode; content: string }) => <span data-tooltip={content}>{children}</span>,
}));

import { ConversationViewers } from "../ConversationViewers";

function renderViewers() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ConversationViewers entryId="e1" entryType="whatsapp" />
    </NextIntlClientProvider>,
  );
}

describe("ConversationViewers", () => {
  it("shows the teammates viewing the conversation, never yourself", () => {
    crm.viewersByEntry = new Map([
      [
        "whatsapp-e1",
        [
          { user_id: "user-ana", name: "Ana" },
          { user_id: "user-bruno", name: "Bruno Lima" },
        ],
      ],
    ]);
    renderViewers();
    expect(screen.getByRole("img", { name: "Bruno Lima está vendo" })).toHaveTextContent("BL");
    expect(screen.queryByRole("img", { name: "Ana está vendo" })).toBeNull();
  });

  it("shows nothing when nobody else is there", () => {
    crm.viewersByEntry = new Map([["whatsapp-e1", [{ user_id: "user-ana", name: "Ana" }]]]);
    const { container } = renderViewers();
    expect(container).toBeEmptyDOMElement();
  });
});
