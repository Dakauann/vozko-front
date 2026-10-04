import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { AdPage } from "@/lib/advertising/types";

vi.mock("@/app/actions/advertising", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/actions/advertising")>()),
  requestNumberLinkAction: vi.fn(),
  confirmNumberLinkAction: vi.fn(),
}));

import { PageWhatsAppList } from "./page-whatsapp-list";

const labels = pt.adsWhatsApp;
const linkLabels = pt.adsWizard.promotion.linkNumber;

const base: AdPage = { pageId: "p-1", name: "Vozko Technology LTDA", canAdvertise: true, leadTermsAccepted: true, numbers: [], linkable: [] };

function renderList(pages: AdPage[], canLink = true) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <PageWhatsAppList accountId="acc-1" pages={pages} canLink={canLink} onChanged={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("PageWhatsAppList", () => {
  it("shows the number each Page already has", () => {
    renderList([{ ...base, numbers: [{ kind: "official", label: "Vozkoia Dev", number: "+55 11 96546-7700" }] }]);
    expect(screen.getByText("Vozko Technology LTDA")).toBeTruthy();
    expect(screen.getByText(labels.linked)).toBeTruthy();
    expect(screen.getByText("Vozkoia Dev · +55 11 96546-7700")).toBeTruthy();
    expect(screen.queryByRole("button", { name: linkLabels.sendCode })).toBeNull();
  });

  it("offers to link a Page without a number", () => {
    renderList([{ ...base, linkable: [{ kind: "official", label: "Vozkoia Dev", number: "5511965467700" }] }]);
    expect(screen.getByRole("button", { name: linkLabels.sendCode })).toBeTruthy();
  });

  it("explains a number linked on Meta that is not connected to Vozko", () => {
    renderList([{ ...base, whatsAppNumber: "+55 11 90000-0000" }]);
    expect(screen.getByText(labels.metaOnly.replace("{number}", "+55 11 90000-0000"))).toBeTruthy();
  });

  it("tells who cannot edit ads that someone else has to link", () => {
    renderList([{ ...base, linkable: [{ kind: "official", label: "Vozkoia Dev", number: "5511965467700" }] }], false);
    expect(screen.queryByRole("button", { name: linkLabels.sendCode })).toBeNull();
    expect(screen.getByText(labels.cannotLink)).toBeTruthy();
  });

  it("says when the connection has no Page", () => {
    renderList([]);
    expect(screen.getByText(labels.noPages)).toBeTruthy();
  });
});
