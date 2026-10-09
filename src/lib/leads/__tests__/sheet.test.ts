import { describe, expect, it } from "vitest";

import { cepDigits } from "@/lib/address/cep";
import type { LeadRecord } from "@/lib/leads/types";

import {
  addAddress,
  addPhone,
  applyCepLookup,
  conflictFields,
  createLeadBody,
  draftFromRecord,
  emptyLeadDraft,
  leadConflict,
  leadDraftIssues,
  makePrimary,
  moveNumberToContacts,
  pinKeepOffered,
  rebaseDraft,
  refusalPath,
  refusalShownOnField,
  removeAddress,
  relativeFromText,
  updateLeadBody,
  type LeadSheetDraft,
} from "../sheet";

function record(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return {
    id: "lead-1",
    workspaceId: "ws",
    number: "5511987654321",
    name: "Maria Souza",
    realName: "Maria Souza",
    nickname: "Cida",
    email: "",
    birthDate: "1980-03-12",
    blocked: false,
    relativesCount: 0,
    referredCount: 0,
    version: 4,
    phones: [{ id: "p-1", number: "551133334444", label: "landline" }],
    addresses: [
      { id: "a-1", label: "home", primary: true, zipCode: "06402000", street: "R. das Acácias", number: "120", district: "Jardim Silveira", city: "Barueri", state: "SP", cityCode: "3505708", geoStatus: "pending" },
    ],
    customFields: { escola: "Prisma", turno: "manhã" },
    ...overrides,
  };
}

function draft(overrides: Partial<LeadSheetDraft> = {}): LeadSheetDraft {
  return { ...emptyLeadDraft(), ...overrides };
}

describe("leadDraftIssues", () => {
  it("leaves the identity rule to the server", () => {
    expect(leadDraftIssues(draft())).toEqual([]);
  });

  it("points at a contact phone row left without a number and an address row left empty", () => {
    const withRows = addAddress(addPhone(draft({ name: "Ana" })));
    expect(leadDraftIssues(withRows)).toEqual(["phones.0", "addresses.0"]);
  });
});

describe("createLeadBody", () => {
  it("sends only what was filled, with every contact phone and address", () => {
    let d = addPhone(draft({ name: " Ana ", number: "(11) 98765-4321", whatsappOptIn: true }));
    d = { ...d, phones: [{ ...d.phones[0], number: "(11) 3333-4444", label: "landline" }] };
    d = addAddress(d);
    d = { ...d, addresses: [{ ...d.addresses[0], zipCode: "06402-000", district: "Centro", city: "Barueri", state: "SP" }] };
    d = { ...d, customFields: { escola: "Prisma", vazio: undefined } };

    expect(createLeadBody(d)).toEqual({
      name: "Ana",
      number: "(11) 98765-4321",
      whatsappOptIn: true,
      phones: [{ number: "(11) 3333-4444", label: "landline" }],
      addresses: [{ label: "home", primary: true, zipCode: "06402-000", district: "Centro", city: "Barueri", state: "SP" }],
      customFields: { escola: "Prisma" },
    });
  });

  it("leaves the consent out unless it was given", () => {
    expect(createLeadBody(draft({ name: "Ana" }))).toEqual({ name: "Ana" });
  });
});

describe("addresses", () => {
  it("makes the first address primary and keeps exactly one primary", () => {
    let d = addAddress(draft());
    d = addAddress(d);
    expect(d.addresses.map((a) => a.primary)).toEqual([true, false]);
    d = makePrimary(d, d.addresses[1].key);
    expect(d.addresses.map((a) => a.primary)).toEqual([false, true]);
  });

  it("hands the primary to the next address when the primary is removed", () => {
    let d = addAddress(addAddress(draft()));
    d = removeAddress(d, d.addresses[0].key);
    expect(d.addresses).toHaveLength(1);
    expect(d.addresses[0].primary).toBe(true);
  });
});

describe("CEP lookup", () => {
  it("reads the digits of a complete CEP only", () => {
    expect(cepDigits("06402-000")).toBe("06402000");
    expect(cepDigits("0640")).toBeNull();
    expect(cepDigits("064020001")).toBeNull();
  });

  it("fills street, bairro, city, UF and the city code, keeping the typed street when the CEP is generic", () => {
    const base = addAddress(draft()).addresses[0];
    const filled = applyCepLookup({ ...base, number: "120" }, { cep: "06402000", logradouro: "R. das Acácias", complemento: "", bairro: "Jardim Silveira", localidade: "Barueri", uf: "SP", ibge: "3505708" });
    expect(filled).toMatchObject({ street: "R. das Acácias", number: "120", district: "Jardim Silveira", city: "Barueri", state: "SP", cityCode: "3505708" });

    const generic = applyCepLookup({ ...base, street: "Rua typed" }, { cep: "06400000", logradouro: "", complemento: "", bairro: "", localidade: "Barueri", uf: "SP" });
    expect(generic).toMatchObject({ street: "Rua typed", district: "", city: "Barueri", state: "SP", cityCode: "" });
  });
});

describe("updateLeadBody", () => {
  it("sends nothing when nothing changed", () => {
    const base = record();
    expect(updateLeadBody(base, draftFromRecord(base), { addresses: true })).toEqual({});
  });

  it("starts the name from the real name, so a number stored as the name is not sent back", () => {
    const base = record({ name: "5511987654321", realName: "" });
    const d = draftFromRecord(base);
    expect(d.name).toBe("");
    expect(updateLeadBody(base, d, { addresses: true })).toEqual({});
  });

  it("sends changed text fields, clearing with an empty string", () => {
    const base = record();
    const d = { ...draftFromRecord(base), nickname: "", email: "maria@exemplo.com.br" };
    expect(updateLeadBody(base, d, { addresses: true })).toEqual({ nickname: "", email: "maria@exemplo.com.br" });
  });

  it("replaces the whole phone list once one phone changed, keeping the ids", () => {
    const base = record();
    let d = draftFromRecord(base);
    d = addPhone(d);
    d = { ...d, phones: [d.phones[0], { ...d.phones[1], number: "(11) 4199-0000", label: "work" }] };
    expect(updateLeadBody(base, d, { addresses: true }).phones).toEqual([
      { id: "p-1", number: d.phones[0].number, label: "landline" },
      { number: "(11) 4199-0000", label: "work" },
    ]);
  });

  it("never sends addresses for a viewer who cannot read them", () => {
    const base = record();
    const d = draftFromRecord(base);
    const edited = { ...d, addresses: [{ ...d.addresses[0], number: "121" }] };
    expect(updateLeadBody(base, edited, { addresses: false })).toEqual({});
    expect(updateLeadBody(base, edited, { addresses: true }).addresses).toEqual([
      { id: "a-1", label: "home", primary: true, zipCode: "06402000", street: "R. das Acácias", number: "121", district: "Jardim Silveira", city: "Barueri", state: "SP", cityCode: "3505708" },
    ]);
  });

  it("keeps a hand-placed position through a text edit only when the viewer chose to keep it", () => {
    const base = record({ addresses: [{ ...record().addresses![0], geoStatus: "located", positionSource: "manual", latitude: -23.5, longitude: -46.8 }] });
    const d = draftFromRecord(base);
    const moved = { ...d, addresses: [{ ...d.addresses[0], number: "121" }] };
    expect(updateLeadBody(base, moved, { addresses: true }).addresses?.[0]).not.toHaveProperty("keepPosition");
    const kept = { ...d, addresses: [{ ...d.addresses[0], number: "121", keepPosition: true }] };
    expect(updateLeadBody(base, kept, { addresses: true }).addresses?.[0]).toMatchObject({ id: "a-1", number: "121", keepPosition: true });
  });

  it("never asks to keep a position the server calculated, nor one whose address text did not change", () => {
    const base = record({ addresses: [{ ...record().addresses![0], geoStatus: "located", positionSource: "reference", latitude: -23.5, longitude: -46.8 }] });
    const d = draftFromRecord(base);
    const edited = { ...d, addresses: [{ ...d.addresses[0], number: "121", keepPosition: true }] };
    expect(updateLeadBody(base, edited, { addresses: true }).addresses?.[0]).not.toHaveProperty("keepPosition");

    const pinned = record({ addresses: [{ ...record().addresses![0], geoStatus: "located", positionSource: "lead_pin", latitude: -23.5, longitude: -46.8 }] });
    const relabeled = { ...draftFromRecord(pinned), addresses: [{ ...draftFromRecord(pinned).addresses[0], label: "work" as const, keepPosition: true }] };
    expect(updateLeadBody(pinned, relabeled, { addresses: true }).addresses?.[0]).not.toHaveProperty("keepPosition");
  });

  it("does not count the keep choice alone as a change", () => {
    const base = record({ addresses: [{ ...record().addresses![0], geoStatus: "located", positionSource: "manual", latitude: -23.5, longitude: -46.8 }] });
    const d = draftFromRecord(base);
    expect(updateLeadBody(base, { ...d, addresses: [{ ...d.addresses[0], keepPosition: true }] }, { addresses: true })).toEqual({});
  });

  it("patches custom fields key by key, with null for a cleared key", () => {
    const base = record();
    const d = { ...draftFromRecord(base), customFields: { escola: "Outra", nova: ["A"] } };
    expect(updateLeadBody(base, d, { addresses: true }).customFields).toEqual({ escola: "Outra", nova: ["A"], turno: null });
  });
});

describe("pinKeepOffered", () => {
  const located = (positionSource: string) =>
    record({ addresses: [{ ...record().addresses![0], geoStatus: "located", positionSource, latitude: -23.5, longitude: -46.8 }] });

  it.each(["manual", "lead_pin"])("offers to keep a %s position once the address text changed", (source) => {
    const base = located(source);
    const d = draftFromRecord(base);
    expect(pinKeepOffered(base, d.addresses[0])).toBe(false);
    expect(pinKeepOffered(base, { ...d.addresses[0], street: "R. das Palmeiras" })).toBe(true);
  });

  it.each(["reference", "provider", "import"])("does not offer it for a %s position", (source) => {
    const base = located(source);
    expect(pinKeepOffered(base, { ...draftFromRecord(base).addresses[0], street: "R. das Palmeiras" })).toBe(false);
  });

  it("does not offer it for a new address, an unknown lead or an address with no position", () => {
    const base = located("manual");
    const fresh = addAddress(draft()).addresses[0];
    expect(pinKeepOffered(base, { ...fresh, street: "R. das Palmeiras" })).toBe(false);
    expect(pinKeepOffered(null, { ...draftFromRecord(base).addresses[0], street: "R. das Palmeiras" })).toBe(false);
    const unplaced = record({ addresses: [{ ...record().addresses![0], positionSource: "manual" }] });
    expect(pinKeepOffered(unplaced, { ...draftFromRecord(unplaced).addresses[0], street: "R. das Palmeiras" })).toBe(false);
  });
});

describe("refusalPath", () => {
  it.each([
    [{ code: "lead_number_invalid" }, "number"],
    [{ code: "lead_identity_taken", expected: { leadId: "other" } }, "number"],
    [{ code: "lead_identity_in_use" }, "number"],
    [{ code: "lead_identity_required" }, "name"],
    [{ code: "lead_name_too_long" }, "name"],
    [{ code: "lead_email_invalid" }, "email"],
    [{ code: "lead_birth_date_invalid" }, "birthDate"],
    [{ code: "lead_phone_repeated", expected: { field: "phones", index: "1" } }, "phones.1"],
    [{ code: "lead_address_invalid", expected: { field: "addresses", index: "0", addressField: "zip_code", rule: "format" } }, "addresses.0"],
    [{ code: "custom_field_value_required", expected: { key: "escola" } }, "customFields.escola"],
    [{ code: "lead_phone_limit" }, "phones"],
    [{ code: "version_conflict" }, null],
  ])("places %j at %s", (error, path) => {
    expect(refusalPath(error)).toBe(path);
  });
});

describe("refusalShownOnField", () => {
  const targets = { addressesEditable: true, readableFieldKeys: new Set(["escola"]) };

  it("shows a refusal on a field only when the sheet renders that field", () => {
    expect(refusalShownOnField("name", targets)).toBe(true);
    expect(refusalShownOnField("phones.1", targets)).toBe(true);
    expect(refusalShownOnField("addresses.0", targets)).toBe(true);
    expect(refusalShownOnField("customFields.escola", targets)).toBe(true);
  });

  it("sends a refusal on a hidden field or a read-only list to the message instead", () => {
    expect(refusalShownOnField("customFields.classificacao", targets)).toBe(false);
    expect(refusalShownOnField("addresses", { ...targets, addressesEditable: false })).toBe(false);
    expect(refusalShownOnField("addresses.0", { ...targets, addressesEditable: false })).toBe(false);
    expect(refusalShownOnField("customFields.escola", { ...targets, readableFieldKeys: new Set<string>() })).toBe(false);
  });
});

describe("conflicts", () => {
  it("names what the other person changed", () => {
    const base = record();
    const current = record({ version: 5, nickname: "Dona Cida", phones: [], customFields: { escola: "Prisma", turno: "tarde" } });
    expect(conflictFields(base, current)).toEqual(["nickname", "phones", "customFields.turno"]);
  });

  it("re-applies only my edits on top of the newer record", () => {
    const base = record();
    const current = record({ version: 5, nickname: "Dona Cida", customFields: { escola: "Prisma", turno: "tarde" } });
    const mine = { ...draftFromRecord(base), email: "maria@exemplo.com.br", customFields: { escola: "Outra", turno: "manhã" } };

    const rebased = rebaseDraft(base, current, mine);

    expect(rebased.nickname).toBe("Dona Cida");
    expect(rebased.email).toBe("maria@exemplo.com.br");
    expect(rebased.customFields).toEqual({ escola: "Outra", turno: "tarde" });
    expect(updateLeadBody(current, rebased, { addresses: true })).toEqual({ email: "maria@exemplo.com.br", customFields: { escola: "Outra" } });
  });

  it("finds the fields both people changed", () => {
    const base = record();
    const current = record({ version: 5, nickname: "Dona Cida", owner: "user-2", customFields: { escola: "Prisma", turno: "tarde" } });
    const mine = { ...draftFromRecord(base), nickname: "Cidinha", email: "maria@exemplo.com.br", customFields: { escola: "Prisma", turno: "noite" } };

    expect(leadConflict(base, current, mine)).toEqual({
      changed: ["nickname", "owner", "customFields.turno"],
      overlap: ["nickname", "customFields.turno"],
    });
  });

  it("keeps the newer value on a field both people changed unless I chose to keep mine", () => {
    const base = record();
    const current = record({ version: 5, nickname: "Dona Cida", customFields: { escola: "Prisma", turno: "tarde" } });
    const mine = { ...draftFromRecord(base), nickname: "Cidinha", email: "maria@exemplo.com.br", customFields: { escola: "Prisma", turno: "noite" } };

    const kept = rebaseDraft(base, current, mine);
    expect(kept.nickname).toBe("Dona Cida");
    expect(kept.customFields.turno).toBe("tarde");
    expect(kept.email).toBe("maria@exemplo.com.br");

    const chosen = rebaseDraft(base, current, mine, new Set(["nickname"]));
    expect(chosen.nickname).toBe("Cidinha");
    expect(chosen.customFields.turno).toBe("tarde");
  });

  it("re-applies my phones and owner unless the other person changed them too", () => {
    const base = record();
    const current = record({ version: 5, owner: "user-2" });
    const mine = { ...draftFromRecord(base), ownerId: "user-3", phones: [] };

    const rebased = rebaseDraft(base, current, mine);
    expect(rebased.ownerId).toBe("user-2");
    expect(rebased.phones).toEqual([]);
    expect(rebaseDraft(base, current, mine, new Set(["owner"])).ownerId).toBe("user-3");
  });
});

describe("relativeFromText", () => {
  it("reads a typed phone as the WhatsApp number and anything else as the name", () => {
    expect(relativeFromText(" (11) 90002-3301 ")).toEqual({ name: "", number: "(11) 90002-3301" });
    expect(relativeFromText("João Souza")).toEqual({ name: "João Souza", number: "" });
    expect(relativeFromText("1234")).toEqual({ name: "1234", number: "" });
  });
});

describe("moveNumberToContacts", () => {
  it("keeps the WhatsApp the lead already has and files the typed number as a contact phone", () => {
    const base = record();
    const d = { ...draftFromRecord(base), number: "(11) 95555-0000" };
    const moved = moveNumberToContacts(d, base);
    expect(moved.number).toBe(draftFromRecord(base).number);
    expect(moved.phones.map((phone) => [phone.number, phone.label])).toEqual([
      [d.phones[0].number, "landline"],
      ["(11) 95555-0000", "mobile"],
    ]);
  });
});
