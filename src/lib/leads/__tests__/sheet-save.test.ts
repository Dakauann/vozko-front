import { describe, expect, it, vi } from "vitest";

import type { CreatedLead, LeadRecord } from "@/lib/leads/types";

import { draftFromRecord, emptyLeadDraft, type LeadSheetDraft } from "../sheet";
import { saveLeadSheet, type LeadSheetActions } from "../sheet-save";

function record(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: "lead-1",
    workspaceId: "ws",
    number: "5511987654321",
    realName: "Maria",
    name: "Maria",
    blocked: false,
    relativesCount: 0,
    referredCount: 0,
    version: 3,
    ...overrides,
  };
}

function created(overrides: Partial<CreatedLead> = {}): CreatedLead {
  return { ...record({ id: "new-1", version: 1 }), duplicates: [], ...overrides };
}

function actions(overrides: Partial<LeadSheetActions> = {}): LeadSheetActions {
  return {
    create: vi.fn().mockResolvedValue({ lead: created(), error: null }),
    update: vi.fn().mockResolvedValue({ status: "saved", lead: record({ version: 4 }) }),
    setOwner: vi.fn().mockResolvedValue({ lead: record(), error: null }),
    addRelative: vi.fn().mockResolvedValue({ result: { lead: record(), relative: record({ id: "rel-1" }), relation: { id: "r-1" }, duplicates: [] }, error: null }),
    linkRelation: vi.fn().mockResolvedValue({ result: { id: "r-2" }, error: null }),
    removeRelation: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

const fullAccess = { addresses: true, assign: true };

function draft(overrides: Partial<LeadSheetDraft>): LeadSheetDraft {
  return { ...emptyLeadDraft(), ...overrides };
}

describe("saveLeadSheet on a new lead", () => {
  it("sends nothing while the sheet still has issues", async () => {
    const deps = actions();
    const outcome = await saveLeadSheet({ base: null, draft: draft({ phones: [{ key: "p", number: " ", label: "mobile" }] }), access: fullAccess, actions: deps });
    expect(outcome).toEqual({ kind: "invalid", issues: ["phones.0"] });
    expect(deps.create).not.toHaveBeenCalled();
  });

  it("leaves the name or WhatsApp rule to the server and places its refusal on the name", async () => {
    const deps = actions({ create: vi.fn().mockResolvedValue({ lead: null, error: { code: "lead_identity_required", status: 400 } }) });
    const outcome = await saveLeadSheet({ base: null, draft: draft({}), access: fullAccess, actions: deps });
    expect(deps.create).toHaveBeenCalledWith({});
    expect(outcome).toMatchObject({ kind: "refused", path: "name" });
  });

  it("places a refusal on the field the server named", async () => {
    const deps = actions({
      create: vi.fn().mockResolvedValue({ lead: null, error: { code: "lead_phone_repeated", status: 400, expected: { field: "phones", index: "0" } } }),
    });
    const outcome = await saveLeadSheet({ base: null, draft: draft({ name: "Ana" }), access: fullAccess, actions: deps });
    expect(outcome).toMatchObject({ kind: "refused", path: "phones.0", error: { code: "lead_phone_repeated" } });
  });

  it("creates, then sets the owner and links the family, and returns the duplicate warnings", async () => {
    const deps = actions({
      create: vi.fn().mockResolvedValue({ lead: created({ duplicates: [{ leadId: "dup-1", reasons: ["shared_phone"], name: "João" }] }), error: null }),
      addRelative: vi.fn().mockResolvedValue({
        result: { lead: record(), relative: record({ id: "rel-1" }), relation: { id: "r-1" }, duplicates: [{ leadId: "dup-2", reasons: ["shared_phone"] }] },
        error: null,
      }),
    });
    const outcome = await saveLeadSheet({
      base: null,
      draft: draft({
        name: "Ana",
        ownerId: "u-9",
        relatives: [
          { key: "k1", kind: "child", name: "Pedro", number: "", copyPrimaryAddress: true },
          { key: "k2", kind: "spouse", existingLeadId: "lead-joao", name: "João", number: "", copyPrimaryAddress: false },
        ],
      }),
      access: fullAccess,
      actions: deps,
    });

    expect(deps.create).toHaveBeenCalledWith({ name: "Ana" });
    expect(deps.setOwner).toHaveBeenCalledWith("new-1", "u-9");
    expect(deps.addRelative).toHaveBeenCalledWith("new-1", { kind: "child", relative: { name: "Pedro" }, copyPrimaryAddress: true });
    expect(deps.linkRelation).toHaveBeenCalledWith("new-1", "lead-joao", "spouse");
    expect(outcome).toMatchObject({
      kind: "saved",
      lead: { id: "new-1" },
      duplicates: [{ leadId: "dup-1" }, { leadId: "dup-2" }],
      followUpFailures: [],
    });
  });

  it("never sets an owner without leads:assign", async () => {
    const deps = actions();
    await saveLeadSheet({ base: null, draft: draft({ name: "Ana", ownerId: "u-9" }), access: { addresses: true, assign: false }, actions: deps });
    expect(deps.setOwner).not.toHaveBeenCalled();
  });

  it("reports a family link that failed after the lead was saved", async () => {
    const refusal = { code: "lead_relation_exists", status: 409 };
    const deps = actions({ linkRelation: vi.fn().mockResolvedValue({ result: null, error: refusal }) });
    const outcome = await saveLeadSheet({
      base: null,
      draft: draft({ name: "Ana", relatives: [{ key: "k", kind: "sibling", existingLeadId: "x", name: "Bia", number: "", copyPrimaryAddress: false }] }),
      access: fullAccess,
      actions: deps,
    });
    expect(outcome).toMatchObject({ kind: "saved", followUpFailures: [{ step: "relative", label: "Bia", error: refusal }] });
  });

  it("offers to link the lead that already holds a new relative's number", async () => {
    const deps = actions({
      addRelative: vi.fn().mockResolvedValue({ result: null, error: { code: "lead_identity_taken", status: 409, expected: { leadId: "lead-holder" } } }),
    });
    const outcome = await saveLeadSheet({
      base: null,
      draft: draft({ name: "Ana", relatives: [{ key: "k", kind: "sibling", name: "Bia", number: "11 90000-0000", copyPrimaryAddress: false }] }),
      access: fullAccess,
      actions: deps,
    });
    expect(outcome).toMatchObject({
      kind: "saved",
      followUpFailures: [],
      linkOffers: [{ label: "Bia", kind: "sibling", leadId: "lead-holder" }],
    });
  });

  it("reports a taken number without a holder it may see as a failure", async () => {
    const refusal = { code: "lead_identity_taken", status: 409 };
    const deps = actions({ addRelative: vi.fn().mockResolvedValue({ result: null, error: refusal }) });
    const outcome = await saveLeadSheet({
      base: null,
      draft: draft({ name: "Ana", relatives: [{ key: "k", kind: "sibling", name: "Bia", number: "11 90000-0000", copyPrimaryAddress: false }] }),
      access: fullAccess,
      actions: deps,
    });
    expect(outcome).toMatchObject({ kind: "saved", linkOffers: [], followUpFailures: [{ step: "relative", label: "Bia", error: refusal }] });
  });
});

describe("saveLeadSheet on an existing lead", () => {
  it("sends the changed fields with the version it read", async () => {
    const base = record();
    const deps = actions();
    await saveLeadSheet({ base, draft: { ...draftFromRecord(base), nickname: "Mari" }, access: fullAccess, actions: deps });
    expect(deps.update).toHaveBeenCalledWith("lead-1", 3, { nickname: "Mari" });
  });

  it("skips the record save when only the owner and the family changed", async () => {
    const base = record();
    const deps = actions();
    const outcome = await saveLeadSheet({
      base,
      draft: { ...draftFromRecord(base), ownerId: "u-2", removedRelationIds: ["r-9"] },
      access: fullAccess,
      actions: deps,
    });
    expect(deps.update).not.toHaveBeenCalled();
    expect(deps.setOwner).toHaveBeenCalledWith("lead-1", "u-2");
    expect(deps.removeRelation).toHaveBeenCalledWith("r-9");
    expect(outcome).toMatchObject({ kind: "saved", lead: { id: "lead-1" } });
  });

  it("stops at a version conflict and hands back the current record, touching nothing else", async () => {
    const base = record();
    const current = record({ version: 5, nickname: "Dona" });
    const deps = actions({ update: vi.fn().mockResolvedValue({ status: "conflict", current }) });
    const outcome = await saveLeadSheet({
      base,
      draft: { ...draftFromRecord(base), email: "a@b.co", ownerId: "u-2" },
      access: fullAccess,
      actions: deps,
    });
    expect(outcome).toEqual({ kind: "conflict", current });
    expect(deps.setOwner).not.toHaveBeenCalled();
  });
});
