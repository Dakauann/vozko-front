import { describe, expect, it } from "vitest";

import { areaLine, areaParts, calendarDateOf, instantOf, leadDetailHref, primaryAddress, streetLine, withBlockOutcome, withRecord } from "../detail";
import type { LeadAddress, LeadDetail, LeadRecord } from "../types";

function detail(overrides: Partial<LeadDetail> = {}): LeadDetail {
  return {
    id: "lead-1",
    workspaceId: "ws-1",
    number: "5511900010142",
    name: "Maria",
    nickname: "Cida",
    blocked: false,
    relativesCount: 1,
    referredCount: 0,
    version: 4,
    whatsappCampaigns: 2,
    totalCampaigns: 3,
    lastActivityAt: "2026-10-07T14:32:00Z",
    whatsappWindowOpen: true,
    campaigns: [{ campaignId: "c-1", campaignName: "Matrículas", type: "whatsapp", entries: [] }],
    ...overrides,
  };
}

function record(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: "lead-1",
    workspaceId: "ws-1",
    number: "5511900010142",
    name: "Maria Souza",
    blocked: false,
    relativesCount: 2,
    referredCount: 0,
    version: 5,
    ...overrides,
  };
}

function address(overrides: Partial<LeadAddress>): LeadAddress {
  return { id: "a", label: "home", primary: false, geoStatus: "pending", ...overrides };
}

describe("withRecord", () => {
  it("takes every record field from a newer answer and keeps the campaign summary", () => {
    const next = withRecord(detail(), record());
    expect(next.name).toBe("Maria Souza");
    expect(next.relativesCount).toBe(2);
    expect(next.version).toBe(5);
    expect(next.nickname).toBeUndefined();
    expect(next.totalCampaigns).toBe(3);
    expect(next.campaigns).toHaveLength(1);
    expect(next.whatsappWindowOpen).toBe(true);
  });

  it("keeps the owner name the server sent while the owner stays the same", () => {
    const next = withRecord(detail({ owner: "u-1", ownerName: "Clara Mendes" }), record({ owner: "u-1" }));
    expect(next.ownerName).toBe("Clara Mendes");
  });

  it("drops the owner name when the record names another owner or none", () => {
    expect(withRecord(detail({ owner: "u-1", ownerName: "Clara Mendes" }), record({ owner: "u-2" })).ownerName).toBeUndefined();
    expect(withRecord(detail({ owner: "u-1", ownerName: "Clara Mendes" }), record()).ownerName).toBeUndefined();
  });

  it("ignores an answer older than what is shown", () => {
    const shown = detail({ version: 7 });
    expect(withRecord(shown, record({ version: 6 }))).toBe(shown);
  });
});

describe("withBlockOutcome", () => {
  it("applies the block and its version", () => {
    const next = withBlockOutcome(detail(), { leadId: "lead-1", blocked: true, metaApplied: false, version: 5 });
    expect(next.blocked).toBe(true);
    expect(next.version).toBe(5);
  });

  it("ignores an outcome older than what is shown", () => {
    const shown = detail({ version: 9 });
    expect(withBlockOutcome(shown, { leadId: "lead-1", blocked: true, metaApplied: true, version: 8 })).toBe(shown);
  });
});

describe("primaryAddress", () => {
  it("finds the primary address", () => {
    expect(primaryAddress([address({ id: "x" }), address({ id: "y", primary: true })])?.id).toBe("y");
  });

  it("has none without addresses", () => {
    expect(primaryAddress(undefined)).toBeUndefined();
    expect(primaryAddress([address({ id: "x" })])).toBeUndefined();
  });
});

describe("areaLine", () => {
  it("writes the place in one line, the same everywhere", () => {
    expect(areaLine({ district: "Jardim Silveira", city: "Barueri", state: "SP" })).toBe("Jardim Silveira · Barueri/SP");
    expect(areaLine(undefined)).toBe("");
  });
});

describe("areaParts", () => {
  it("names the bairro and the city with its state", () => {
    expect(areaParts({ district: "Jardim Silveira", city: "Barueri", state: "SP" })).toEqual(["Jardim Silveira", "Barueri/SP"]);
  });

  it("leaves out what is missing", () => {
    expect(areaParts({ city: "Barueri" })).toEqual(["Barueri"]);
    expect(areaParts({ district: "  ", state: "SP" })).toEqual(["SP"]);
    expect(areaParts(undefined)).toEqual([]);
  });
});

describe("calendarDateOf", () => {
  it("reads a stored birth date as that calendar day in UTC", () => {
    expect(calendarDateOf("1980-03-12")?.toISOString()).toBe("1980-03-12T00:00:00.000Z");
  });

  it("refuses anything that is not a real calendar day", () => {
    expect(calendarDateOf("1980-02-31")).toBeNull();
    expect(calendarDateOf("12/03/1980")).toBeNull();
    expect(calendarDateOf("")).toBeNull();
  });
});

describe("instantOf", () => {
  it("reads a server timestamp", () => {
    expect(instantOf("2026-10-07T14:32:00Z")?.toISOString()).toBe("2026-10-07T14:32:00.000Z");
  });

  it("has nothing for a missing or broken timestamp", () => {
    expect(instantOf(undefined)).toBeNull();
    expect(instantOf(null)).toBeNull();
    expect(instantOf("soon")).toBeNull();
  });
});

describe("streetLine", () => {
  it("joins street, number and complement", () => {
    expect(streetLine(address({ street: "R. das Acácias", number: "120", complement: "apto 31" }))).toBe("R. das Acácias, 120, apto 31");
  });

  it("is empty when the address carries only its area", () => {
    expect(streetLine(address({ district: "Centro", city: "Barueri" }))).toBe("");
  });
});

describe("leadDetailHref", () => {
  it("opens the lead page", () => {
    expect(leadDetailHref("lead-1")).toBe("/dashboard/leads/lead-1");
  });

  it("keeps an odd id inside its own path segment", () => {
    expect(leadDetailHref("a/b?c")).toBe("/dashboard/leads/a%2Fb%3Fc");
  });
});
