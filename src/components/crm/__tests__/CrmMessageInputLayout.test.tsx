import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";

import CrmMessageInput from "../CrmMessageInput";

vi.mock("@/app/actions/conversations", () => ({ uploadConversationMediaAction: vi.fn() }));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ can: () => true }) }));
vi.mock("@/contexts/crm-context", async () => {
  const { crmShowing, subscribedConversation } = await import("@/test/composer-media-limits");
  const crm = crmShowing(subscribedConversation("entry-1", "whatsapp"));
  return { useOptionalCrm: () => crm };
});

const composerTranslations = ptMessages.whatsappCampaignsPage.detail.crm.input;
const stylesheet = readFileSync(resolve(__dirname, "../../../app/globals.css"), "utf8");

function containerBlocks(name: string): { minWidthPx: number; body: string }[] {
  const blocks: { minWidthPx: number; body: string }[] = [];
  const opening = new RegExp(String.raw`@container ${name} \(min-width: ([\d.]+)rem\) \{`, "g");
  for (const match of stylesheet.matchAll(opening)) {
    let depth = 1;
    let index = (match.index ?? 0) + match[0].length;
    const start = index;
    while (depth > 0 && index < stylesheet.length) {
      if (stylesheet[index] === "{") depth += 1;
      if (stylesheet[index] === "}") depth -= 1;
      index += 1;
    }
    blocks.push({ minWidthPx: Number(match[1]) * 16, body: stylesheet.slice(start, index - 1) });
  }
  return blocks;
}

function boxAreasAt(widthPx: number): string {
  const base = /\.vz-composer-box \{[^}]*grid-template-areas:([^;]*);/.exec(stylesheet)?.[1] ?? "";
  const applying = containerBlocks("composer").filter((block) => widthPx >= block.minWidthPx);
  return applying.reduce((areas, block) => /\.vz-composer-box \{[^}]*grid-template-areas:([^;]*);/.exec(block.body)?.[1] ?? areas, base);
}

function rowsOf(areas: string): string[][] {
  return [...areas.matchAll(/"([^"]*)"/g)].map((row) => row[1].trim().split(/\s+/));
}

function renderComposer() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmMessageInput
        entryType="whatsapp"
        entryId="entry-1"
        onSend={vi.fn()}
        onSendMedia={vi.fn()}
        onTyping={vi.fn()}
        onSchedule={vi.fn()}
        windowOpen
        windowExpiresAt={null}
        translations={composerTranslations}
      />
    </NextIntlClientProvider>,
  );
}

describe("composer layout by its own width", () => {
  it("measures its own width, so a narrow floating window lays it out like a phone", () => {
    const { container } = renderComposer();
    const root = container.querySelector(".vz-composer");
    expect(root).not.toBeNull();
    expect(stylesheet).toMatch(/\.vz-composer \{[^}]*container: composer \/ inline-size;/);
  });

  it("groups the textarea and the tools into the areas the container query arranges", () => {
    renderComposer();
    const box = document.querySelector(".vz-composer-box") as HTMLElement;
    const field = box.querySelector(".vz-composer-field") as HTMLElement;
    const start = box.querySelector(".vz-composer-tools-start") as HTMLElement;
    const end = box.querySelector(".vz-composer-tools-end") as HTMLElement;
    expect(field).toContainElement(screen.getByPlaceholderText(composerTranslations.placeholder));
    expect(start).toContainElement(screen.getByLabelText(composerTranslations.attachFile));
    expect(start).toContainElement(screen.getByLabelText(ptMessages.scheduledMessages.composer.scheduleAria));
    expect(end).toContainElement(screen.getByRole("switch", { name: ptMessages.crmComposer.signLabel }));
    const mic = screen.getByLabelText(composerTranslations.recording);
    expect(box).not.toContainElement(mic);
  });

  it.each([
    [320, [["field", "field"], ["start", "end"]]],
    [420, [["field", "field"], ["start", "end"]]],
    [600, [["start", "field", "end"]]],
    [900, [["start", "field", "end"]]],
  ])("at %i px gives the textarea the room it needs", (width, rows) => {
    expect(rowsOf(boxAreasAt(width))).toEqual(rows);
  });

  it("lets the tools wrap instead of squeezing the textarea, and never hides the send button", () => {
    renderComposer();
    const start = document.querySelector(".vz-composer-tools-start") as HTMLElement;
    expect(start.className).toContain("flex-wrap");
    expect(screen.getByLabelText(composerTranslations.recording).className).toContain("flex-shrink-0");
  });
});
