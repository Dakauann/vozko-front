import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { NoteImage } from "@/lib/conversations/notes";

import { NoteImages } from "../NoteImages";

const THUMBHASH = "1QcSHQRnh493V4dIh4eXh1h4kJUI";
const galleryT = ptMessages.crmConversation.thread.gallery;

function image(id: string, overrides: Partial<NoteImage> = {}): NoteImage {
  return { id, url: `https://cdn/${id}.png`, mime_type: "image/png", ...overrides };
}

function show(images: NoteImage[] | undefined) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <NoteImages noteId="note-1" images={images} />
    </NextIntlClientProvider>,
  );
}

describe("NoteImages", () => {
  it("renders nothing for a note without images", () => {
    const { container } = show([]);
    expect(container).toBeEmptyDOMElement();
    expect(show(undefined).container).toBeEmptyDOMElement();
  });

  it("reserves the frame of a single image from its dimensions and shows the thumbhash until it loads", () => {
    show([image("img-1", { width: 1600, height: 900, thumbhash: THUMBHASH })]);

    const open = screen.getByRole("button", { name: "Abrir imagem 1 de 1" });
    const frame = open.parentElement as HTMLElement;
    expect(frame.style.width).toBe("280px");
    expect(frame.style.aspectRatio).toBe("280 / 158");
    const pictures = open.querySelectorAll("img");
    expect(pictures[0].getAttribute("src")).toMatch(/^data:image\/png/);
    expect(pictures[1]).toHaveAttribute("src", "https://cdn/img-1.png");
    expect(pictures[1]).toHaveClass("opacity-0");

    fireEvent.load(pictures[1]);
    expect(pictures[1]).toHaveClass("opacity-100");
    expect(open.querySelectorAll("img")).toHaveLength(1);
  });

  it("lays several images out as labelled thumbnails in their order", () => {
    show([image("a"), image("b"), image("c")]);

    expect(screen.getByRole("group", { name: "3 imagens da nota" })).toBeInTheDocument();
    const thumbs = screen.getAllByRole("button", { name: /Abrir imagem/ });
    expect(thumbs.map((thumb) => thumb.getAttribute("aria-label"))).toEqual([
      "Abrir imagem 1 de 3",
      "Abrir imagem 2 de 3",
      "Abrir imagem 3 de 3",
    ]);
    expect(thumbs.map((thumb) => thumb.querySelector("img")?.getAttribute("src"))).toEqual([
      "https://cdn/a.png",
      "https://cdn/b.png",
      "https://cdn/c.png",
    ]);
  });

  it("opens the chosen image full size and steps through the note's images only", () => {
    show([image("a"), image("b")]);

    fireEvent.click(screen.getByRole("button", { name: "Abrir imagem 2 de 2" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("2 de 2")).toBeInTheDocument();
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", "https://cdn/b.png");

    fireEvent.click(within(dialog).getByRole("button", { name: galleryT.previous }));
    expect(within(dialog).getByText("1 de 2")).toBeInTheDocument();
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", "https://cdn/a.png");

    fireEvent.click(within(dialog).getByRole("button", { name: galleryT.close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a quiet mark instead of a broken picture when the file is gone", () => {
    show([image("gone")]);
    const open = screen.getByRole("button", { name: "Abrir imagem 1 de 1" });
    fireEvent.error(open.querySelector("img")!);
    expect(open.querySelector('img[src="https://cdn/gone.png"]')).toBeNull();
    expect(open.querySelector("svg")).not.toBeNull();
  });
});
