import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { AdPage, AdPageCapability } from "@/lib/advertising/types";

vi.mock("@/app/actions/advertising", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/actions/advertising")>()),
  requestNumberLinkAction: vi.fn(),
  confirmNumberLinkAction: vi.fn(),
}));

import { PageAssetsList } from "./page-assets-list";

const labels = pt.adsPages;
const linkLabels = pt.adsWizard.promotion.linkNumber;

const ready = (channel: AdPageCapability["channel"]): AdPageCapability => ({ channel, state: "ready" });

const base: AdPage = {
  pageId: "p-1",
  name: "Vozko Technology LTDA",
  canAdvertise: true,
  leadTermsAccepted: true,
  instagramUserId: "ig-1",
  instagramUsername: "vozko",
  numbers: [{ kind: "official", label: "Vozkoia Dev", number: "+55 11 96546-7700" }],
  linkable: [],
  capabilities: ["advertise", "whatsapp", "instagram", "messenger", "lead_forms"].map((channel) => ready(channel as AdPageCapability["channel"])),
};

function withCapability(capability: AdPageCapability, page: Partial<AdPage> = {}): AdPage {
  return { ...base, ...page, capabilities: base.capabilities?.map((c) => (c.channel === capability.channel ? capability : c)) };
}

function renderList(pages: AdPage[], canLink = true) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <PageAssetsList accountId="acc-1" pages={pages} canLink={canLink} checking={false} onChanged={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("PageAssetsList", () => {
  it("shows every Meta channel of a ready Page with what it uses", () => {
    renderList([base]);
    for (const channel of ["advertise", "whatsapp", "instagram", "messenger", "lead_forms"] as const) {
      expect(screen.getByText(labels.channels[channel].title)).toBeTruthy();
    }
    expect(screen.getByText("Vozkoia Dev · +55 11 96546-7700")).toBeTruthy();
    expect(screen.getByText("@vozko")).toBeTruthy();
  });

  it("links WhatsApp inside Vozko when a number can take the Page", () => {
    renderList([withCapability({ channel: "whatsapp", state: "missing", action: { kind: "in_app", key: "link_whatsapp" } }, { numbers: [], linkable: [{ kind: "official", label: "Vozkoia Dev", number: "5511965467700" }] })]);
    expect(screen.getByRole("button", { name: linkLabels.sendCode })).toBeTruthy();
  });

  it("sends to connecting a WhatsApp number when none can take the Page", () => {
    renderList([withCapability({ channel: "whatsapp", state: "missing", action: { kind: "in_app", key: "connect_whatsapp" } }, { numbers: [] })]);
    expect(screen.getByRole("link", { name: labels.connectWhatsApp })).toHaveAttribute("href", expect.stringContaining("/dashboard/whatsapp-business-phones/connect"));
  });

  it("opens Meta for what only Meta can do, with a way to check again", () => {
    renderList([withCapability({ channel: "instagram", state: "missing", action: { kind: "portal", url: "https://www.facebook.com/settings/?tab=linked_instagram" } }, { instagramUserId: "", instagramUsername: "" })]);
    expect(screen.getByText(labels.channels.instagram.missing)).toBeTruthy();
    expect(screen.getByRole("link", { name: labels.openAtMeta })).toHaveAttribute("href", "https://www.facebook.com/settings/?tab=linked_instagram");
    expect(screen.getByRole("button", { name: pt.adsRequirements.recheck })).toBeTruthy();
  });

  it("keeps the WhatsApp link to people who can edit ads", () => {
    renderList([withCapability({ channel: "whatsapp", state: "missing", action: { kind: "in_app", key: "link_whatsapp" } }, { numbers: [], linkable: [{ kind: "official", label: "Vozkoia Dev", number: "5511965467700" }] })], false);
    expect(screen.queryByRole("button", { name: linkLabels.sendCode })).toBeNull();
    expect(screen.getByText(labels.cannotLink)).toBeTruthy();
  });

  it("says when the connection has no Page", () => {
    renderList([]);
    expect(screen.getByText(labels.noPages)).toBeTruthy();
  });
});
