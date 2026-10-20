import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import ConversationHeader from "../ConversationHeader";
import ConversationStatusControl from "../ConversationStatusControl";

const header = ptMessages.crmConversationHeader;
const windowCopy = ptMessages.liveChat.conversationWindow;

function renderHeader(props: Partial<React.ComponentProps<typeof ConversationHeader>> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ConversationHeader
        name="Ana"
        number="5511999990000"
        entryType="whatsapp"
        badges={null}
        status={<span>status-control</span>}
        actions={<button type="button">pop-out</button>}
        onBack={vi.fn()}
        {...props}
      />
    </NextIntlClientProvider>,
  );
}

describe("ConversationHeader", () => {
  it("offers a localized close button in the side pane that leaves the conversation", () => {
    const onClose = vi.fn();
    renderHeader({ onClose });

    fireEvent.click(screen.getByRole("button", { name: header.close }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has no close button where the conversation is the main view", () => {
    renderHeader();
    expect(screen.queryByRole("button", { name: header.close })).toBeNull();
  });

  it("always keeps the status control in the row, whatever the width", () => {
    const { container } = renderHeader();
    const status = screen.getByText("status-control");
    expect(status.closest(".vz-conversation-header-actions")).toBeNull();
    expect(status.closest(".vz-conversation-header-more")).toBeNull();
    expect(container.querySelector(".vz-conversation-header")).not.toBeNull();
  });

  it("puts the secondary actions behind a localized more button for narrow widths", () => {
    renderHeader();
    const more = screen.getByRole("button", { name: header.more });
    expect(more.closest(".vz-conversation-header-more")).not.toBeNull();
    expect(screen.getByText("pop-out").closest(".vz-conversation-header-actions")).not.toBeNull();
  });
});

function renderStatus(props: Partial<React.ComponentProps<typeof ConversationStatusControl>> = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ConversationStatusControl status="new" canChange onChange={vi.fn()} {...props} />
    </NextIntlClientProvider>,
  );
}

describe("ConversationStatusControl", () => {
  it("lets the operator finish the conversation from the menu", () => {
    const onChange = vi.fn();
    renderStatus({ onChange });

    fireEvent.click(screen.getByRole("button", { name: header.status.manage }));
    fireEvent.click(screen.getByRole("button", { name: windowCopy.markFinished }));

    expect(onChange).toHaveBeenCalledWith("finished");
  });

  it("explains that a finished conversation only reopens with a customer message", () => {
    renderStatus({ status: "finished" });

    fireEvent.click(screen.getByRole("button", { name: header.status.manage }));

    expect(screen.getByText(header.status.reopensOnMessage)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: windowCopy.markOngoing })).toBeNull();
  });

  it("shows the status without a menu to someone who may not change it", () => {
    renderStatus({ canChange: false });
    expect(screen.queryByRole("button", { name: header.status.manage })).toBeNull();
  });
});
