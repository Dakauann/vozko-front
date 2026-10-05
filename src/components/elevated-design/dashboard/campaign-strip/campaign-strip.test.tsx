import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { CAMPAIGN_STRIP_HEIGHT_VAR, CampaignStrip } from "./campaign-strip";
import { activeCampaign, dismissalKey } from "./campaigns";

function renderStrip(now: Date) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CampaignStrip now={now} />
    </NextIntlClientProvider>,
  );
}

const OCTOBER = new Date(2026, 9, 5, 10);
const NOVEMBER = new Date(2026, 10, 1, 10);

describe("activeCampaign", () => {
  it("runs Outubro Rosa for the whole of October", () => {
    expect(activeCampaign(new Date(2026, 9, 1, 0, 0))?.id).toBe("outubro-rosa");
    expect(activeCampaign(new Date(2026, 9, 31, 23, 59))?.id).toBe("outubro-rosa");
  });

  it("has nothing outside a campaign month", () => {
    expect(activeCampaign(new Date(2026, 8, 30, 23, 59))).toBeNull();
    expect(activeCampaign(NOVEMBER)).toBeNull();
  });

  it("keys a dismissal by campaign and year so it returns next year", () => {
    const campaign = activeCampaign(OCTOBER)!;
    expect(dismissalKey(campaign, OCTOBER)).toBe("campaign-strip:outubro-rosa:2026");
    expect(dismissalKey(campaign, new Date(2027, 9, 2))).toBe("campaign-strip:outubro-rosa:2027");
  });
});

describe("CampaignStrip", () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.style.removeProperty(CAMPAIGN_STRIP_HEIGHT_VAR);
  });

  it("shows the campaign and reserves its height in October", () => {
    renderStrip(OCTOBER);
    expect(screen.getByText("Outubro Rosa")).toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue(CAMPAIGN_STRIP_HEIGHT_VAR)).toBe("28px");
  });

  it("renders nothing and reserves no height outside October", () => {
    const { container } = renderStrip(NOVEMBER);
    expect(container).toBeEmptyDOMElement();
    expect(document.documentElement.style.getPropertyValue(CAMPAIGN_STRIP_HEIGHT_VAR)).toBe("");
  });

  it("hides for good once dismissed and gives the height back", () => {
    renderStrip(OCTOBER);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Fechar aviso" }));
    });
    expect(screen.queryByText("Outubro Rosa")).not.toBeInTheDocument();
    expect(document.documentElement.style.getPropertyValue(CAMPAIGN_STRIP_HEIGHT_VAR)).toBe("");
    expect(localStorage.getItem("campaign-strip:outubro-rosa:2026")).toBe("dismissed");
  });

  it("stays hidden when this year's campaign was already dismissed", () => {
    localStorage.setItem("campaign-strip:outubro-rosa:2026", "dismissed");
    const { container } = renderStrip(OCTOBER);
    expect(container).toBeEmptyDOMElement();
  });
});
