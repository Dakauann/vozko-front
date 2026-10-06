import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { GeneratingMedia } from "./generating-media";

function renderMedia(props: Parameters<typeof GeneratingMedia>[0]) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <GeneratingMedia {...props} />
    </NextIntlClientProvider>,
  );
}

describe("GeneratingMedia", () => {
  it("holds the requested aspect with an estimated percentage", () => {
    const { container } = renderMedia({ kind: "image", frame: "story" });
    const bar = screen.getByRole("progressbar", { name: ptMessages.mediaGeneration.generating.image });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-[9/16]");
  });

  it("becomes the failure in the same frame", () => {
    const { container } = renderMedia({ kind: "image", frame: "portrait", failed: true });
    expect(screen.getByRole("alert")).toHaveTextContent(ptMessages.mediaGeneration.failed.image);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-[4/5]");
  });

  it("names the kind being made", () => {
    renderMedia({ kind: "music", frame: "audio" });
    expect(screen.getByRole("progressbar", { name: ptMessages.mediaGeneration.generating.music })).toBeTruthy();
  });

  it("says it is finishing while the cost is being settled", () => {
    renderMedia({ kind: "voice", frame: "audio", settling: true });
    expect(screen.getByRole("progressbar", { name: ptMessages.mediaGeneration.finalizing })).toBeTruthy();
  });
});
