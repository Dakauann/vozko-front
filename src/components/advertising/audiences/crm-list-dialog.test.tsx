import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const listLeadsQueryAction = vi.fn();

vi.mock("@/app/actions/leads", () => ({ listLeadsQueryAction: (...args: unknown[]) => listLeadsQueryAction(...args) }));
vi.mock("@/app/actions/advertising-audiences", () => ({ createCustomerListAction: vi.fn() }));
vi.mock("@/app/actions/advertising", () => ({ isAdsError: () => false }));
vi.mock("@/components/leads/LeadsToolbar", () => ({ LeadsToolbar: () => null }));

import { CrmListDialog } from "./crm-list-dialog";
import type { AdAccount } from "@/lib/advertising/types";

const EMPTY_PAGE = { items: [], meta: { totalItems: 0, totalPages: 0, currentPage: 1, itemsPerPage: 1 } };

function renderDialog() {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmListDialog account={{ id: "act_1" } as AdAccount} onClose={vi.fn()} onCreated={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("CrmListDialog", () => {
  beforeEach(() => {
    listLeadsQueryAction.mockReset();
  });

  it("translates a refused count instead of showing the server text", async () => {
    listLeadsQueryAction.mockResolvedValue({
      ...EMPTY_PAGE,
      error: "lead filter reads addresses",
      errorCode: "lead_filter_address_forbidden",
    });
    renderDialog();
    expect(await screen.findByText(ptMessages.leadsPage.errors.lead_filter_address_forbidden)).toBeInTheDocument();
    expect(screen.queryByText("lead filter reads addresses")).not.toBeInTheDocument();
  });

  it("falls back to its own copy for a count failure without a known code", async () => {
    listLeadsQueryAction.mockResolvedValue({ ...EMPTY_PAGE, error: "socket hang up", errorCode: null });
    renderDialog();
    expect(await screen.findByText(ptMessages.adsAudiences.crm.countFailed)).toBeInTheDocument();
    expect(screen.queryByText("socket hang up")).not.toBeInTheDocument();
  });
});
