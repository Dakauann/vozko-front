import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const create = vi.fn();
const frames: Record<string, { width: number; height: number } | null> = {};

vi.mock("@/hooks/use-studio-project-creator", () => ({
  useStudioProjectCreator: () => ({ create, busy: null }),
  readMediaFrame: (url: string) => (frames[url] ? Promise.resolve(frames[url]) : Promise.reject(new Error("unreadable"))),
}));

import { PlacementCheck } from "./placement-check";

const square = { kind: "image" as const, mediaId: "6a1f0c3e-2b4d-4c8e-9f10-1a2b3c4d5e6f", url: "https://cdn/square.png" };
const catalog = {
  automaticPlatforms: ["facebook", "instagram"],
  videoOnlyPositions: { facebook: ["instream_video"] },
  placements: { facebook: ["feed", "story", "marketplace", "instream_video"], instagram: ["stream", "story", "reels"] },
};
const t = ptMessages.adsEditor.placementCheck;

function renderCheck(images = [square], flush = vi.fn().mockResolvedValue(true)) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <PlacementCheck images={images} placements={{ automatic: false, platforms: ["instagram"] }} catalog={catalog} beforeStudio={flush} />
    </NextIntlClientProvider>,
  );
  return flush;
}

describe("PlacementCheck", () => {
  beforeEach(() => {
    create.mockReset().mockResolvedValue({ ok: true, path: "/dashboard/studio/image/p1" });
    frames[square.url] = { width: 1080, height: 1080 };
  });

  it("shows one preview per frame with the safe zone drawn only where the interface covers the ad", async () => {
    const { container } = render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <PlacementCheck images={[square]} placements={{ automatic: false, platforms: ["instagram"] }} catalog={catalog} />
      </NextIntlClientProvider>,
    );
    await waitFor(() => expect(screen.getByText(t.frames.vertical)).toBeTruthy());
    expect(screen.getByText(t.frames.feed)).toBeTruthy();
    expect(container.querySelectorAll("[data-frame]")).toHaveLength(2);
    expect(screen.getAllByText(t.bandTop)).toHaveLength(1);
    expect(screen.getByText(t.background.replace("{percent}", "44"))).toBeTruthy();
    expect(screen.getByText(t.whole)).toBeTruthy();
    expect(screen.getAllByText(t.minText.replace("{px}", "34"))).toHaveLength(2);
  });

  it("says so when the image cannot be read and never invents a preview", async () => {
    frames[square.url] = null;
    renderCheck();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(t.unreadable));
  });

  it("opens the image in the studio with one artboard per placement size, after saving the draft", async () => {
    const flush = renderCheck();
    await waitFor(() => expect(screen.getByText(t.frames.vertical)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: t.openInStudio }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(flush).toHaveBeenCalled();
    const [order] = create.mock.calls[0];
    expect(order).toMatchObject({ kind: "image", media: [{ mediaId: square.mediaId, url: square.url, type: "image" }], sizes: [{ width: 1440, height: 1800 }, { width: 1440, height: 2560 }] });
  });

  it("keeps images hosted by Meta out of the studio", async () => {
    renderCheck([{ ...square, mediaId: "meta:abc" }]);
    await waitFor(() => expect(screen.getByText(t.frames.vertical)).toBeTruthy());
    expect((screen.getByRole("button", { name: t.openInStudio }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(t.hostedImage)).toBeTruthy();
  });

  it("explains a creative without images", () => {
    renderCheck([]);
    expect(screen.getByText(t.noImage)).toBeTruthy();
  });
});
