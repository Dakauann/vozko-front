import { describe, expect, it } from "vitest";

import { parseFilterParam } from "@/lib/crm/board";

import { companyChange, companyImageProblem, companyImageUrl, companyMembersFilter, companyMembersHref, parseLeadCompany, parseLeadCompanyPage } from "../companies";

const acme = {
  id: "c-1",
  name: "Acme",
  acceptsLeads: true,
  image: { mediaId: "m-1", url: "https://cdn/logo.png", previewUrl: "https://cdn/logo-preview.jpg" },
  membersCount: 3,
  createdBy: "u-1",
  createdAt: "2026-10-17T12:00:00Z",
  updatedAt: "2026-10-17T12:00:00Z",
};

describe("parseLeadCompany", () => {
  it("reads a company with its image", () => {
    expect(parseLeadCompany(acme)).toEqual(acme);
  });

  it("reads a company without an image or a creator", () => {
    const bare = { id: acme.id, name: acme.name, acceptsLeads: acme.acceptsLeads, membersCount: acme.membersCount, createdAt: acme.createdAt, updatedAt: acme.updatedAt };
    expect(parseLeadCompany(bare)).toEqual(bare);
  });

  it("refuses what is not a company", () => {
    for (const value of [null, "x", { ...acme, acceptsLeads: "yes" }, { ...acme, membersCount: -1 }, { ...acme, image: { url: 3 } }, { ...acme, id: "" }]) {
      expect(parseLeadCompany(value)).toBeNull();
    }
  });
});

describe("parseLeadCompanyPage", () => {
  it("reads the data and the paging", () => {
    const page = parseLeadCompanyPage({ data: [acme], meta: { page: 2, pageSize: 10, totalPages: 3, totalItems: 21 } });
    expect(page).toEqual({ items: [acme], page: 2, pageSize: 10, totalPages: 3, totalItems: 21 });
  });

  it("refuses a page with a broken company", () => {
    expect(parseLeadCompanyPage({ data: [{ id: 1 }], meta: { page: 1, pageSize: 10, totalPages: 1, totalItems: 1 } })).toBeNull();
  });
});

describe("company members", () => {
  it("are the leads whose company is the company", () => {
    expect(companyMembersFilter("c-1")).toEqual({ groups: [{ conjunction: "and", predicates: [{ field: "company", operator: "in", values: ["c-1"] }] }] });
  });

  it("open as the lead list filtered by the company", () => {
    const href = companyMembersHref("/dashboard/leads", "c-1");
    const filter = new URL(href, "https://app").searchParams.get("filter");
    expect(href.startsWith("/dashboard/leads?filter=")).toBe(true);
    expect(parseFilterParam(filter)).toEqual({ status: "valid", filter: companyMembersFilter("c-1") });
  });
});

describe("company images", () => {
  it("take png, jpeg and webp up to 5 MB, the types the media library stores as images", () => {
    expect(companyImageProblem({ type: "image/png", size: 1024 })).toBeNull();
    expect(companyImageProblem({ type: "image/gif", size: 1024 })).toBe("lead_company_image_type");
    expect(companyImageProblem({ type: "image/webp", size: 5 * 1024 * 1024 + 1 })).toBe("lead_company_image_too_large");
    expect(companyImageProblem({ type: "image/jpeg", size: 0 })).toBe("lead_company_image_too_large");
  });

  it("show the small preview when there is one", () => {
    expect(companyImageUrl(acme)).toBe("https://cdn/logo-preview.jpg");
    expect(companyImageUrl({ image: { mediaId: "m", url: "https://cdn/full.png" } })).toBe("https://cdn/full.png");
    expect(companyImageUrl({})).toBe("");
  });
});

describe("companyChange", () => {
  it("sends only what the dialog changed", () => {
    expect(companyChange(acme, { name: "Acme", acceptsLeads: true, imageMediaId: "m-1" })).toEqual({});
    expect(companyChange(acme, { name: "Acme SA", acceptsLeads: false, imageMediaId: "m-1" })).toEqual({ name: "Acme SA", acceptsLeads: false });
  });

  it("clears the image with an empty id and replaces it with the new one", () => {
    expect(companyChange(acme, { name: "Acme", acceptsLeads: true, imageMediaId: "" })).toEqual({ imageMediaId: "" });
    expect(companyChange({ ...acme, image: undefined }, { name: "Acme", acceptsLeads: true, imageMediaId: "m-2" })).toEqual({ imageMediaId: "m-2" });
  });
});
