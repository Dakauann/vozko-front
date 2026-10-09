import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { LeadAddress, LeadDetail } from "@/lib/leads/types";

const miniMap = vi.hoisted(() => ({ props: [] as Array<Record<string, unknown>> }));

vi.mock("@/components/maps/MiniMap", () => ({
  MiniMap: (props: Record<string, unknown>) => {
    miniMap.props.push(props);
    return <div data-testid="mini-map" aria-label={String(props.ariaLabel)} />;
  },
}));
vi.mock("@/components/leads/LeadCall", () => ({ LeadNumberCall: () => null }));

import { LeadOverview } from "../LeadOverview";

const t = ptMessages.leadDetail.address;
const tMap = ptMessages.leadMap;

function lead(address: Partial<LeadAddress>): LeadDetail {
  return {
    id: "lead-1",
    workspaceId: "ws-1",
    number: "5511900010142",
    name: "Maria",
    blocked: false,
    relativesCount: 0,
    referredCount: 0,
    version: 3,
    whatsappCampaigns: 0,
    totalCampaigns: 0,
    whatsappWindowOpen: false,
    campaigns: [],
    addresses: [
      {
        id: "addr-1",
        label: "home",
        primary: true,
        street: "R. das Acácias",
        number: "120",
        district: "Jardim Silveira",
        city: "Barueri",
        state: "SP",
        zipCode: "06402000",
        geoStatus: "pending",
        ...address,
      },
    ],
  };
}

function renderOverview(record: LeadDetail, readsAddresses = true) {
  miniMap.props = [];
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <LeadOverview lead={record} definitions={[]} definitionsLoading={false} definitionsFailed={false} readsAddresses={readsAddresses} />
    </NextIntlClientProvider>,
  );
  return screen.getByRole("region", { name: t.title });
}

const exact = {
  geoStatus: "located" as const,
  precision: "exact" as const,
  positionSource: "manual",
  latitude: -23.5113,
  longitude: -46.8761,
  geocodedAt: "2026-10-02T15:00:00Z",
};

describe("lead detail, Endereço principal", () => {
  it("labels a hand-placed position as exact and says who placed it and when", () => {
    const section = renderOverview(lead(exact));
    expect(within(section).getByText(tMap.precision.exact)).toBeInTheDocument();
    expect(within(section).getByText(t.positionSource.replace("{source}", tMap.source.manual).replace("{date}", "02/10/2026"))).toBeInTheDocument();
  });

  it("draws the position on a small map for a viewer who may read addresses", () => {
    const section = renderOverview(lead(exact));
    expect(within(section).getByTestId("mini-map")).toBeInTheDocument();
    expect(miniMap.props[0]).toMatchObject({ position: { lat: -23.5113, lng: -46.8761 }, precision: "exact", interactive: false, draggable: false });
  });

  it("never draws the house on a map for a viewer who sees only bairro and city", () => {
    const section = renderOverview(lead(exact), false);
    expect(within(section).queryByTestId("mini-map")).not.toBeInTheDocument();
    expect(within(section).getByText(tMap.precision.exact)).toBeInTheDocument();
  });

  it("names the provider behind a provider position", () => {
    const section = renderOverview(lead({ ...exact, precision: "street", positionSource: "provider", positionProvider: "opencage", geocodedAt: undefined }));
    expect(within(section).getByText(tMap.precision.street)).toBeInTheDocument();
    expect(
      within(section).getByText(t.providerSource.replace("{source}", tMap.source.provider).replace("{provider}", tMap.providers.opencage)),
    ).toBeInTheDocument();
  });

  it.each([
    ["postal_code", tMap.precision.postalCode],
    ["district", tMap.precision.district],
    ["city", tMap.precision.city],
  ] as const)("labels an approximate %s position", (precision, label) => {
    const section = renderOverview(lead({ geoStatus: "approximate", precision, positionSource: "reference", latitude: -23.5, longitude: -46.8 }));
    expect(within(section).getByText(label)).toBeInTheDocument();
    expect(within(section).getByText(tMap.source.reference)).toBeInTheDocument();
  });

  it.each([
    ["pending", t.geoStatus.pending],
    ["not_found", t.geoStatus.not_found],
    ["refused", t.geoStatus.refused],
  ] as const)("labels a %s address by its status", (geoStatus, label) => {
    const section = renderOverview(lead({ geoStatus }));
    expect(within(section).getByText(label)).toBeInTheDocument();
    expect(within(section).queryByTestId("mini-map")).not.toBeInTheDocument();
  });

  it.each([
    ["pending", t.queuedNote.pending],
    ["unavailable", t.queuedNote.unavailable],
    ["quota_exceeded", t.queuedNote.quota_exceeded],
  ] as const)("notes that an approximate %s position is still waiting for a better one", (geoStatus, note) => {
    const section = renderOverview(lead({ geoStatus, geoQueued: true, precision: "district", positionSource: "reference", latitude: -23.5, longitude: -46.8 }));
    expect(within(section).getByText(tMap.precision.district)).toBeInTheDocument();
    expect(within(section).getByText(note)).toBeInTheDocument();
    expect(within(section).queryByText(t.geoStatus[geoStatus])).not.toBeInTheDocument();
  });

  it("draws the precision as the shared status chip in its tone", () => {
    const section = renderOverview(lead(exact));
    expect(within(section).getByText(tMap.precision.exact).closest("span")?.className).toContain("bg-healthy");
  });
});
