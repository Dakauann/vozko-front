import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useLocale: () => "pt" }));

import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";

import { campaignColumns } from "./campaign-columns";

const t = (key: string, values?: Record<string, string | number>) => (values ? `${key}:${JSON.stringify(values)}` : key);

function cell(key: string, row: UnofficialWhatsAppCampaign) {
  const column = campaignColumns(t, "Pronta").find((c) => c.key === key);
  if (!column?.render) throw new Error(`no ${key} column`);
  return render(<>{column.render(row, 0)}</>);
}

function campaign(patch: Partial<UnofficialWhatsAppCampaign>): UnofficialWhatsAppCampaign {
  return {
    id: "c",
    name: "Ofertas",
    instanceId: "",
    status: "RUNNING",
    instanceSessionLive: false,
    createdAt: "2026-10-18T12:00:00Z",
    metrics: { totalNumbers: 7 },
    ...patch,
  } as UnofficialWhatsAppCampaign;
}

describe("campaign list target column", () => {
  it("names the first groups and counts the rest", () => {
    cell("target", campaign({ audience: "groups", targetNames: ["Vila", "Centro", "Praia"] }));
    expect(screen.getByText("Vila, Centro, Praia")).toBeInTheDocument();
    expect(screen.getByText('table.targetMore:{"count":4}')).toBeInTheDocument();
    expect(screen.getByText("table.targetGroups")).toBeInTheDocument();
  });

  it("counts the contacts of a person campaign", () => {
    cell("target", campaign({ audience: "leads", instanceId: "i-1" }));
    expect(screen.getByText('table.targetLeads:{"count":7}')).toBeInTheDocument();
  });

  it("shows the empty value when a group campaign has no names yet", () => {
    cell("target", campaign({ audience: "groups", metrics: { totalNumbers: 0 } as UnofficialWhatsAppCampaign["metrics"] }));
    expect(screen.getByText("n/d")).toBeInTheDocument();
  });
});

describe("campaign list name column", () => {
  it("says a group campaign posts from the numbers in each group instead of naming one", () => {
    cell("name", campaign({ audience: "groups" }));
    expect(screen.getByText("table.senderPerGroup")).toBeInTheDocument();
  });

  it("keeps the number of a person campaign", () => {
    cell("name", campaign({ audience: "leads", instanceId: "i-1", instanceLabel: "Loja Centro", instanceSessionLive: true }));
    expect(screen.getByText("Loja Centro")).toBeInTheDocument();
  });
});

describe("campaign list status column", () => {
  it("shows a never started campaign as ready", () => {
    cell("status", campaign({ status: "STOPPED", readyToStart: true }));
    expect(screen.getByText("Pronta")).toHaveClass("bg-[hsl(var(--plate-neutral))]");
  });

  it("keeps stopped for a campaign the server does not call ready", () => {
    cell("status", campaign({ status: "STOPPED", readyToStart: false }));
    expect(screen.getByText("status.stopped")).toBeInTheDocument();
  });
});
