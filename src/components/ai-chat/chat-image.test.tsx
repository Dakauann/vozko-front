import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { dispatchStreamEvent } from "@/hooks/use-chat-stream";
import type { ChatMessage } from "@/lib/aichat/types";

import { ChatImageView } from "./chat-image";
import { hydrate, MessageBubble, useBubbleLabels, type UIMessage } from "./message-list";

const image = { url: "https://cdn.example.com/card.jpg", mediaId: "m-1", alt: "um card promocional" };

describe("generated images in the chat", () => {
  it("delivers a streamed image to the conversation", () => {
    const onImage = vi.fn();
    dispatchStreamEvent({ type: "image", payload: image as never }, { onImage });
    expect(onImage).toHaveBeenCalledWith(image);
  });

  it("keeps the image after the thread is reloaded", () => {
    const stored = {
      id: "msg-1",
      role: "assistant",
      content: "Aqui está.",
      tools: [{ name: "generate_image", summary: "ok", ok: true, image }],
    } as unknown as ChatMessage;
    const segments = hydrate(stored).segments ?? [];
    expect(segments).toContainEqual({ kind: "image", image });
    expect(segments.findIndex((s) => s.kind === "image")).toBeLessThan(segments.findIndex((s) => s.kind === "text"));
  });

  it("offers a download of the generated image", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ChatImageView image={image} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: ptMessages.imageGeneration.download })).toBeTruthy();
  });
});

function Bubble({ message }: { message: UIMessage }) {
  const labels = useBubbleLabels();
  return <MessageBubble message={message} live onApprove={vi.fn()} onReject={vi.fn()} labels={labels} />;
}

function renderBubble(message: UIMessage) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <Bubble message={message} />
    </NextIntlClientProvider>,
  );
}

describe("an image being generated in the chat", () => {
  const base = { id: "a-1", role: "assistant", content: "", createdAt: "2026-10-02T12:00:00Z" } as const;

  it("holds the place of the image with an estimated percentage", () => {
    renderBubble({ ...base, segments: [{ kind: "tool", name: "generate_image", summary: "", ok: true, running: true, aspect: "story" }] });
    const bar = screen.getByRole("progressbar", { name: ptMessages.imageGeneration.generating });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar.closest("[aria-busy]")?.className).toContain("aspect-[9/16]");
  });

  it("becomes the failure when the generation fails", () => {
    renderBubble({ ...base, segments: [{ kind: "tool", name: "generate_image", summary: "error", ok: false, aspect: "square" }] });
    expect(screen.getByRole("alert")).toHaveTextContent(ptMessages.imageGeneration.failed);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("gives way to the image once it arrives", () => {
    renderBubble({
      ...base,
      segments: [
        { kind: "tool", name: "generate_image", summary: "ok", ok: true, aspect: "square" },
        { kind: "image", image },
      ],
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByAltText(image.alt)).toBeTruthy();
  });
});
