import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { GeneratingImage } from "./generating-image";

function renderImage(props: Parameters<typeof GeneratingImage>[0]) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <GeneratingImage {...props} />
    </NextIntlClientProvider>,
  );
}

describe("GeneratingImage", () => {
  it("holds the requested aspect with an estimated percentage", () => {
    const { container } = renderImage({ aspect: "story" });
    const bar = screen.getByRole("progressbar", { name: ptMessages.imageGeneration.generating });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByText("0%")).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-[9/16]");
  });

  it("becomes the failure in the same frame", () => {
    const { container } = renderImage({ aspect: "portrait", failed: true });
    expect(screen.getByRole("alert")).toHaveTextContent(ptMessages.imageGeneration.failed);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-[4/5]");
  });
});
