import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { VideoPlacementNotice } from "./video-placement-notice";

function renderNotice(skipped: { platform: string; position: string }[]) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <VideoPlacementNotice skipped={skipped} />
    </NextIntlClientProvider>,
  );
}

describe("VideoPlacementNotice", () => {
  it("names each placement the ad will not run in, like Meta's preview warning", () => {
    renderNotice([{ platform: "facebook", position: "instream_video" }]);
    expect(screen.getByText("Seu anúncio não será veiculado em 1 posicionamento")).toBeTruthy();
    expect(screen.getByText("Facebook · Vídeos in-stream")).toBeTruthy();
    expect(screen.getByText(/use um vídeo como criativo/)).toBeTruthy();
  });

  it("renders nothing when every placement can run", () => {
    const { container } = renderNotice([]);
    expect(container.textContent).toBe("");
  });
});
