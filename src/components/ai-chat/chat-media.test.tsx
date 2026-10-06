import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

const studio = vi.hoisted(() => ({ allowed: true, open: vi.fn() }));

vi.mock("@/hooks/use-access", () => ({
  useAccess: () => ({ decideScreen: () => ({ status: studio.allowed ? "allowed" : "denied" }) }),
}));

vi.mock("@/hooks/use-open-in-studio", () => ({
  useOpenInStudio: () => ({ open: studio.open, opening: null }),
}));

import ptMessages from "@/i18n/messages/pt.json";

import { dispatchStreamEvent } from "@/hooks/use-chat-stream";
import type { ChatMessage } from "@/lib/aichat/types";

import { ChatMediaView } from "./chat-media";
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
    expect(segments).toContainEqual({ kind: "media", media: image });
    expect(segments.findIndex((s) => s.kind === "media")).toBeLessThan(segments.findIndex((s) => s.kind === "text"));
  });

  it("offers a download of the generated image", () => {
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ChatMediaView media={image} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole("button", { name: ptMessages.mediaGeneration.download })).toBeTruthy();
  });

  it("puts the image back in the composer to edit it", () => {
    const onEdit = vi.fn();
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ChatMediaView media={image} onEdit={onEdit} />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: ptMessages.aiChatPage.image.edit }));
    expect(onEdit).toHaveBeenCalledWith(image);
  });

  it("shows the images the user attached in their message", () => {
    renderBubble({
      id: "u-1",
      role: "user",
      content: "use o logo",
      createdAt: "2026-10-04T12:00:00Z",
      attachments: [{ mediaId: "m-2", name: "logo.png", kind: "image", url: "https://cdn.example.com/logo.png" }],
    } as UIMessage);
    expect(screen.getByRole("img", { name: "logo.png" }).getAttribute("src")).toBe("https://cdn.example.com/logo.png");
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
    renderBubble({ ...base, segments: [{ kind: "tool", name: "generate_image", summary: "", ok: true, running: true, frame: "story" }] });
    const bar = screen.getByRole("progressbar", { name: ptMessages.mediaGeneration.generating.image });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar.closest("[aria-busy]")?.className).toContain("aspect-[9/16]");
  });

  it("becomes the failure when the generation fails", () => {
    renderBubble({ ...base, segments: [{ kind: "tool", name: "generate_image", summary: "error", ok: false, frame: "square" }] });
    expect(screen.getByRole("alert")).toHaveTextContent(ptMessages.mediaGeneration.failed.image);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("gives way to the image once it arrives", () => {
    renderBubble({
      ...base,
      segments: [
        { kind: "tool", name: "generate_image", summary: "ok", ok: true, frame: "square" },
        { kind: "media", media: image },
      ],
    });
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByAltText(image.alt)).toBeTruthy();
  });
});

describe("generated sound and video in the chat", () => {
  const base = { id: "a-2", role: "assistant", content: "", createdAt: "2026-10-06T12:00:00Z" } as const;
  const music = { kind: "audio" as const, url: "https://cdn.example.com/samba.m4a", mediaId: "m-3", alt: "samba leve para a padaria" };
  const video = { kind: "video" as const, url: "https://cdn.example.com/spot.mp4", mediaId: "m-4", alt: "vídeo da padaria" };

  it("plays generated music in an accessible audio player", () => {
    const { container } = renderBubble({ ...base, segments: [{ kind: "media", media: music }] });
    expect(screen.getByRole("group", { name: music.alt })).toBeTruthy();
    expect(screen.getByRole("button", { name: ptMessages.mediaPlayer.play })).toBeTruthy();
    expect(container.querySelector("audio")?.getAttribute("src")).toBe(music.url);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("plays a rendered video muted, with controls and a sound toggle", () => {
    const { container } = renderBubble({ ...base, segments: [{ kind: "media", media: video }] });
    const player = container.querySelector("video") as HTMLVideoElement;
    expect(player.muted).toBe(true);
    expect(player.controls).toBe(true);
    expect(player.getAttribute("preload")).toBe("metadata");
    expect(screen.getByRole("button", { name: ptMessages.mediaPlayer.unmute })).toBeTruthy();
    expect(screen.getByRole("button", { name: ptMessages.mediaGeneration.download })).toBeTruthy();
  });

  it("keeps the kind of the media after the thread is reloaded", () => {
    const stored = {
      id: "msg-2",
      role: "assistant",
      content: "",
      tools: [{ name: "generate_music", summary: "ok", ok: true, image: music }],
    } as unknown as ChatMessage;
    expect(hydrate(stored).segments).toContainEqual({ kind: "media", media: music });
  });

  it("holds an audio frame while the music is generated", () => {
    renderBubble({ ...base, segments: [{ kind: "tool", name: "generate_music", summary: "", ok: true, running: true, frame: "audio" }] });
    expect(screen.getByRole("progressbar", { name: ptMessages.mediaGeneration.generating.music })).toBeTruthy();
  });

  it("shows the failure of a video that could not be built", () => {
    renderBubble({ ...base, segments: [{ kind: "tool", name: "render_video", summary: "error", ok: false, frame: "story" }] });
    expect(screen.getByRole("alert")).toHaveTextContent(ptMessages.mediaGeneration.failed.video);
  });
});

describe("opening a generated media in the studio", () => {
  function renderMedia(media: typeof image & { kind?: "image" | "audio" | "video" }) {
    return render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ChatMediaView media={media} />
      </NextIntlClientProvider>,
    );
  }

  it("opens the image or the video in the studio", () => {
    studio.allowed = true;
    renderMedia({ ...image, kind: "video" });
    fireEvent.click(screen.getByRole("button", { name: ptMessages.studio.openFromMedia.action }));
    expect(studio.open).toHaveBeenCalledWith({ ...image, kind: "video" });
  });

  it("hides the action from people who cannot edit in the studio", () => {
    studio.allowed = false;
    renderMedia(image);
    expect(screen.queryByRole("button", { name: ptMessages.studio.openFromMedia.action })).toBeNull();
  });
});
