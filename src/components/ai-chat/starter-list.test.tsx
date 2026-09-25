import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { StarterList } from "./starter-list";

const groups = ptMessages.aiChatPage.dock.groups;

function renderList(onPick = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <StarterList
        groups={[
          { key: "attendance", items: ["summary", "backlog"] },
          { key: "agents", items: ["list", "create"] },
        ]}
        initialOpen="agents"
        onPick={onPick}
        disabled={false}
      />
    </NextIntlClientProvider>,
  );
  return onPick;
}

describe("StarterList", () => {
  it("opens only the category of the current page", () => {
    renderList();
    expect(screen.getByRole("button", { name: new RegExp(groups.agents.title) })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: new RegExp(groups.attendance.title) })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(groups.attendance.items.summary)).not.toBeInTheDocument();
    expect(screen.getByText(groups.agents.items.create)).toBeInTheDocument();
  });

  it("switches categories and asks the chosen question", () => {
    const onPick = renderList();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(groups.attendance.title) }));
    expect(screen.queryByText(groups.agents.items.list)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(groups.attendance.items.backlog));
    expect(onPick).toHaveBeenCalledWith(groups.attendance.items.backlog);
  });
});
