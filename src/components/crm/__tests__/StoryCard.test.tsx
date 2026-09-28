import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { StoryCard } from "@/components/crm/MetaMessageParts";
import ptMessages from "@/i18n/messages/pt.json";

const meta = ptMessages.crmConversation.meta;

function renderCard(props: { mediaUrl?: string; text?: string; mention?: boolean }) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <StoryCard prefix="instagram" mention={props.mention ?? true} mediaUrl={props.mediaUrl} text={props.text} />
    </NextIntlClientProvider>,
  );
}

describe("StoryCard", () => {
  it("shows the live story from the Meta URL", () => {
    const { container } = renderCard({ mediaUrl: "https://cdn/story" });
    expect(screen.getByText(meta.storyMention)).toBeTruthy();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn/story");
  });

  it("falls back to video, then to an expired notice", () => {
    const { container } = renderCard({ mediaUrl: "https://cdn/story" });
    fireEvent.error(container.querySelector("img")!);
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe("https://cdn/story");
    fireEvent.error(video!);
    expect(screen.getByText(meta.storyUnavailable)).toBeTruthy();
  });

  it("explains a story without a URL and keeps the reply text", () => {
    renderCard({ mention: false, text: "que lindo" });
    expect(screen.getByText(meta.storyReply)).toBeTruthy();
    expect(screen.getByText(meta.storyUnavailable)).toBeTruthy();
    expect(screen.getByText("que lindo")).toBeTruthy();
  });
});
