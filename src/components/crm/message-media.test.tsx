import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pending = vi.hoisted(() => ({ resolve: (_value: { url: string } | null) => {} }));

vi.mock("@/app/actions/conversations", () => ({
  getConversationMediaAction: () =>
    new Promise((resolve) => {
      pending.resolve = resolve;
    }),
}));

import { MessageMedia } from "./message-media";

const layout = { width: 1600, height: 1200, thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI" };

function frameOf(container: HTMLElement) {
  const frame = container.querySelector<HTMLElement>("[data-media-frame]");
  if (!frame) throw new Error("no frame rendered");
  return { width: frame.style.width, ratio: frame.style.aspectRatio };
}

describe("MessageMedia", () => {
  it("reserves the photo's real shape before, during and after loading", async () => {
    const { container } = render(
      <MessageMedia type="image" mediaId="m1" entryType="whatsapp" entryId="e1" layout={layout} />,
    );
    const loading = frameOf(container);
    expect(loading).toEqual({ width: "280px", ratio: "280 / 210" });

    await act(async () => pending.resolve({ url: "https://cdn/p.jpg" }));
    expect(frameOf(container)).toEqual(loading);

    const img = container.querySelector<HTMLImageElement>('img[alt="Imagem"]');
    expect(img?.className).toContain("opacity-0");
    fireEvent.load(img!);
    expect(img?.className).toContain("opacity-100");
    expect(frameOf(container)).toEqual(loading);

    fireEvent.error(img!);
    expect(frameOf(container)).toEqual(loading);
  });

  it("shows the blurred preview while the photo is still on its way", () => {
    const { container } = render(<MessageMedia type="image" url="https://cdn/p.jpg" layout={layout} />);
    const preview = container.querySelector<HTMLImageElement>('img[aria-hidden="true"]');
    expect(preview?.src).toMatch(/^data:image\/png;base64,/);
  });

  it("uses one fixed box for older photos without a known size", () => {
    const { container } = render(<MessageMedia type="image" url="https://cdn/old.jpg" />);
    expect(frameOf(container)).toEqual({ width: "240px", ratio: "240 / 240" });
  });

  it("keeps a missing file in the same box instead of collapsing the bubble", async () => {
    const { container } = render(
      <MessageMedia type="image" mediaId="m2" entryType="whatsapp" entryId="e1" layout={layout} />,
    );
    await act(async () => pending.resolve(null));
    expect(frameOf(container)).toEqual({ width: "280px", ratio: "280 / 210" });
    expect(container.textContent).toContain("Mídia não disponível");
  });
});
