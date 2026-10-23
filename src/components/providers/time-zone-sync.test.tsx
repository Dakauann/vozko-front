import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
const browser = vi.hoisted(() => ({ zone: "America/Sao_Paulo" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/working-hours/types", () => ({ browserTimezone: () => browser.zone }));

import { TimeZoneSync } from "./time-zone-sync";

function renderWith(timeZone: string) {
  render(
    <NextIntlClientProvider locale="pt" messages={{}} timeZone={timeZone}>
      <TimeZoneSync />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  refresh.mockReset();
  document.cookie = "tz=; path=/; max-age=0";
});

describe("TimeZoneSync", () => {
  it("does nothing when the page was already rendered in the browser's zone", () => {
    renderWith("America/Sao_Paulo");
    expect(refresh).not.toHaveBeenCalled();
    expect(document.cookie).not.toContain("tz=");
  });

  it("stores the browser's zone and renders the page again when they differ", () => {
    browser.zone = "Europe/Berlin";
    renderWith("America/Sao_Paulo");
    expect(document.cookie).toContain("tz=Europe%2FBerlin");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
