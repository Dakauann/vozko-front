import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import type { StarterGroup } from "./starter-groups";
import { StarterList } from "./starter-list";

const groups = ptMessages.aiChatPage.dock.groups;

function renderList(list: StarterGroup[], featured: StarterGroup["key"], onPick = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <StarterList groups={list} initialOpen={featured} onPick={onPick} disabled={false} />
    </NextIntlClientProvider>,
  );
  return onPick;
}

const general: StarterGroup[] = [
  { key: "attendance", items: ["summary", "backlog"], live: false },
  { key: "agents", items: ["list", "create"], live: false },
];

describe("StarterList", () => {
  it("features the questions of the current page without a click", () => {
    renderList(general, "agents");
    const featured = screen.getByRole("region", { name: groups.agents.title });
    expect(within(featured).getByRole("button", { name: groups.agents.items.create })).toBeInTheDocument();
    expect(screen.queryByText(groups.attendance.items.summary)).not.toBeInTheDocument();
  });

  it("keeps the other subjects as topics that reveal their questions when chosen", () => {
    const onPick = renderList(general, "agents");
    const topic = screen.getByRole("button", { name: groups.attendance.title });
    expect(topic).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(topic);
    expect(topic).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: groups.attendance.items.backlog }));
    expect(onPick).toHaveBeenCalledWith(groups.attendance.items.backlog);
    fireEvent.click(topic);
    expect(screen.queryByText(groups.attendance.items.backlog)).not.toBeInTheDocument();
  });

  it("lights the card where Elo works live on the screen", () => {
    renderList([{ key: "studioImage", items: ["compose", "review"], live: true }, ...general], "studioImage");
    const featured = screen.getByRole("region", { name: groups.studioImage.title });
    expect(featured).toHaveAttribute("data-live", "true");
    expect(featured.querySelector(".vz-ai-ring")).not.toBeNull();
  });

  it("does not light a card that only suggests questions", () => {
    renderList(general, "agents");
    expect(screen.getByRole("region", { name: groups.agents.title })).toHaveAttribute("data-live", "false");
  });
});
