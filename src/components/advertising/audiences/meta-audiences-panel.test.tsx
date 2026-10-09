import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

vi.mock("@/app/actions/advertising-audiences", () => ({
  listAudiencesAction: async () => ({ data: { audiences: [], termsAccepted: true } }),
  deleteAudienceAction: vi.fn(),
}));
vi.mock("@/app/actions/advertising", () => ({ isAdsError: (result: { error?: unknown }) => typeof result.error === "string" }));
vi.mock("./crm-list-dialog", () => ({ CrmListDialog: () => null }));
vi.mock("./file-list-dialog", () => ({ FileListDialog: () => null }));
vi.mock("./lookalike-dialog", () => ({ LookalikeDialog: () => null }));
vi.mock("./list-result-dialog", () => ({ ListResultDialog: () => null }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import type { AdAccount } from "@/lib/advertising/types";

import type { AudiencePermissions } from "./audiences-page";
import { MetaAudiencesPanel } from "./meta-audiences-panel";

const actions = ptMessages.adsAudiences.actions;

function renderPanel(permissions: AudiencePermissions) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <MetaAudiencesPanel account={{ id: "act_1" } as AdAccount} permissions={permissions} />
    </NextIntlClientProvider>,
  );
}

async function openNewMenu() {
  const trigger = await screen.findByRole("button", { name: actions.new });
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: "mouse" });
  await screen.findByRole("menuitem", { name: new RegExp(actions.file) });
}

describe("MetaAudiencesPanel", () => {
  it("offers the CRM list to whoever may read leads and build an audience from them", async () => {
    renderPanel({ canCreate: true, canUpdate: true, canDelete: false, canCreateFromLeads: true });
    await openNewMenu();
    expect(screen.getByRole("menuitem", { name: new RegExp(actions.crm) })).toBeInTheDocument();
  });

  it("does not offer the CRM list without access to leads", async () => {
    renderPanel({ canCreate: true, canUpdate: true, canDelete: false, canCreateFromLeads: false });
    await openNewMenu();
    expect(screen.queryByRole("menuitem", { name: new RegExp(actions.crm) })).toBeNull();
    expect(screen.getByRole("menuitem", { name: new RegExp(actions.lookalike) })).toBeInTheDocument();
  });
});
