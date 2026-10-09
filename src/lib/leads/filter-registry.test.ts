import { describe, expect, it } from "vitest";

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";
import { keyedFilterField } from "@/lib/crm/board";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import {
    LEAD_FILTER_FIELD,
    LEAD_FILTER_FIELDS,
    LEAD_FILTER_GROUP_ORDER,
    LEAD_ZIP_FILTER_MAX,
    activeLeadPredicates,
    customFieldFilterSpecs,
    emptyLeadFilter,
    leadFilterFieldSpecs,
    leadQuickFilterFields,
    toggleInSet,
    zipFilterEntries,
} from "@/lib/leads/filters";

function messageAt(messages: unknown, path: string): unknown {
    return path.split(".").reduce<unknown>(
        (node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined),
        messages,
    );
}

const LOCALES = { pt: ptMessages, en: enMessages, es: esMessages, de: deMessages };

const definition = (overrides: Partial<CustomFieldDefinition>): CustomFieldDefinition => ({
    id: "f",
    workspaceId: "ws",
    objectType: "lead",
    key: "campo",
    label: "Campo",
    type: "text",
    required: false,
    sensitive: false,
    position: 0,
    readable: true,
    createdAt: "",
    updatedAt: "",
    ...overrides,
});

describe("the lead ERP filter groups", () => {
    it("renders Endereço, Família, Responsável and Campos personalizados", () => {
        expect(LEAD_FILTER_GROUP_ORDER).toEqual(expect.arrayContaining(["address", "family", "owner", "custom"]));
    });

    it("files every place, family and owner field under its group", () => {
        const groupOf = (field: string) => LEAD_FILTER_FIELDS.find((spec) => spec.field === field)?.group;
        expect(groupOf(LEAD_FILTER_FIELD.city)).toBe("address");
        expect(groupOf(LEAD_FILTER_FIELD.district)).toBe("address");
        expect(groupOf(LEAD_FILTER_FIELD.state)).toBe("address");
        expect(groupOf(LEAD_FILTER_FIELD.hasAddress)).toBe("address");
        expect(groupOf(LEAD_FILTER_FIELD.geoPrecision)).toBe("address");
        expect(groupOf(LEAD_FILTER_FIELD.geoStatus)).toBe("address");
        expect(groupOf(LEAD_FILTER_FIELD.relationKind)).toBe("family");
        expect(groupOf(LEAD_FILTER_FIELD.relativesCount)).toBe("family");
        expect(groupOf(LEAD_FILTER_FIELD.referredCount)).toBe("family");
        expect(groupOf(LEAD_FILTER_FIELD.owner)).toBe("owner");
    });

    it("takes city, bairro, owner and CRM options from the loaded option sets", () => {
        const runtime = (field: string) => LEAD_FILTER_FIELDS.find((spec) => spec.field === field)?.runtimeOptions;
        expect(runtime(LEAD_FILTER_FIELD.city)).toBe("cities");
        expect(runtime(LEAD_FILTER_FIELD.district)).toBe("districts");
        expect(runtime(LEAD_FILTER_FIELD.owner)).toBe("owners");
        expect(runtime(LEAD_FILTER_FIELD.campaign)).toBe("campaigns");
        expect(runtime(LEAD_FILTER_FIELD.stage)).toBe("stages");
        expect(runtime(LEAD_FILTER_FIELD.label)).toBe("labels");
    });

    it("gives every runtime option field the idset control", () => {
        for (const spec of LEAD_FILTER_FIELDS) {
            if (spec.runtimeOptions) expect(spec.control).toBe("idset");
        }
    });

    it("leaves street level fields out for a viewer without leads:read_addresses", () => {
        const open = leadFilterFieldSpecs({ readsAddresses: false }).map((spec) => spec.field);
        expect(open).not.toContain(LEAD_FILTER_FIELD.geoPrecision);
        expect(open).not.toContain(LEAD_FILTER_FIELD.geoStatus);
        expect(open).toContain(LEAD_FILTER_FIELD.district);
        expect(open).toContain(LEAD_FILTER_FIELD.city);
        expect(open).toContain(LEAD_FILTER_FIELD.hasAddress);

        const full = leadFilterFieldSpecs({ readsAddresses: true }).map((spec) => spec.field);
        expect(full).toContain(LEAD_FILTER_FIELD.geoPrecision);
        expect(full).toContain(LEAD_FILTER_FIELD.geoStatus);
    });

    it("offers birthdays as the three windows the server understands", () => {
        const spec = LEAD_FILTER_FIELDS.find((s) => s.field === LEAD_FILTER_FIELD.birthday);
        expect(spec?.options?.map((option) => option.value)).toEqual(["today", "this_week", "this_month"]);
    });

    it("offers the 27 federative units as states", () => {
        const spec = LEAD_FILTER_FIELDS.find((s) => s.field === LEAD_FILTER_FIELD.state);
        expect(spec?.options).toHaveLength(27);
        expect(spec?.options?.every((option) => /^[A-Z]{2}$/.test(option.value))).toBe(true);
    });

    it("names every static option in all four locales", () => {
        for (const spec of LEAD_FILTER_FIELDS) {
            for (const option of spec.options ?? []) {
                if (!option.labelKey) continue;
                for (const [locale, messages] of Object.entries(LOCALES)) {
                    expect(typeof messageAt(messages, option.labelKey), `${locale} ${option.labelKey}`).toBe("string");
                }
            }
        }
    });

    it("names every field, boolean side and group in all four locales", () => {
        for (const [locale, messages] of Object.entries(LOCALES)) {
            for (const spec of LEAD_FILTER_FIELDS) {
                const paths = [`leadsPage.filters.fields.${spec.labelKey}`];
                if (spec.sides) paths.push(spec.sides.true, spec.sides.false);
                for (const path of paths) {
                    expect(typeof messageAt(messages, path), `${locale} ${path}`).toBe("string");
                }
            }
            for (const group of LEAD_FILTER_GROUP_ORDER) {
                const path = `leadsPage.filters.groups.${group}`;
                expect(typeof messageAt(messages, path), `${locale} ${path}`).toBe("string");
            }
        }
    });
});

describe("quick filters", () => {
    it("follows the frame order: Bairro, Cidade, the classification, Responsável", () => {
        expect(leadQuickFilterFields(keyedFilterField("custom", "interesse"))).toEqual([
            LEAD_FILTER_FIELD.district,
            LEAD_FILTER_FIELD.city,
            keyedFilterField("custom", "interesse"),
            LEAD_FILTER_FIELD.owner,
        ]);
    });

    it("drops the classification when the viewer cannot see one", () => {
        expect(leadQuickFilterFields(undefined)).toEqual([
            LEAD_FILTER_FIELD.district,
            LEAD_FILTER_FIELD.city,
            LEAD_FILTER_FIELD.owner,
        ]);
    });
});

describe("custom field filters", () => {
    it("binds each readable definition to the control its type allows", () => {
        const specs = customFieldFilterSpecs([
            definition({ key: "nota", label: "Nota", type: "number" }),
            definition({ key: "visita", label: "Visita", type: "date" }),
            definition({ key: "aluno", label: "Aluno", type: "boolean" }),
            definition({ key: "obs", label: "Observação", type: "text" }),
            definition({ key: "turma", label: "Turma", type: "multiselect", options: ["A", "B"] }),
        ]);

        expect(specs.map((spec) => [spec.field, spec.control, spec.group])).toEqual([
            [keyedFilterField("custom", "nota"), "number", "custom"],
            [keyedFilterField("custom", "visita"), "date", "custom"],
            [keyedFilterField("custom", "aluno"), "boolean", "custom"],
            [keyedFilterField("custom", "obs"), "text", "custom"],
            [keyedFilterField("custom", "turma"), "enum", "custom"],
        ]);
        expect(specs[4].label).toBe("Turma");
        expect(specs[4].options).toEqual([
            { value: "A", label: "A" },
            { value: "B", label: "B" },
        ]);
    });

    it("never offers a definition the server marked unreadable", () => {
        const specs = customFieldFilterSpecs([
            definition({ key: "saude", sensitive: true, readable: false }),
            definition({ key: "opiniao", sensitive: true, readable: undefined }),
            definition({ key: "aberto" }),
        ]);
        expect(specs.map((spec) => spec.field)).toEqual([keyedFilterField("custom", "aberto")]);
    });

    it("carries option tones for the classification chip colours", () => {
        const [spec] = customFieldFilterSpecs([
            definition({
                key: "interesse",
                type: "select",
                role: "classification",
                options: ["Positivo", "Negativo"],
                optionTones: { Positivo: "chart-2" },
            }),
        ]);
        expect(spec.options?.[0]).toEqual({ value: "Positivo", label: "Positivo", tone: "chart-2" });
        expect(spec.options?.[1]).toEqual({ value: "Negativo", label: "Negativo" });
    });

    it("writes a predicate the server binds by key", () => {
        const [spec] = customFieldFilterSpecs([definition({ key: "turma", type: "select", options: ["A"] })]);
        const filter = toggleInSet(emptyLeadFilter, spec.field, "A");
        expect(filter.groups[0].predicates).toEqual([{ field: "custom", key: "turma", operator: "in", values: ["A"] }]);
    });

    it("lists custom predicates after the catalogue fields", () => {
        let filter = toggleInSet(emptyLeadFilter, keyedFilterField("custom", "turma"), "A");
        filter = toggleInSet(filter, LEAD_FILTER_FIELD.city, "sp:barueri");
        expect(activeLeadPredicates(filter).map((p) => p.field)).toEqual([LEAD_FILTER_FIELD.city, "custom"]);
    });
});

describe("CEP, Indicado por and Sem responsável", () => {
    const specOf = (field: string) => LEAD_FILTER_FIELDS.find((spec) => spec.field === field);

    it("filters by CEP only for a viewer with leads:read_addresses, as typed values under Endereço", () => {
        expect(LEAD_FILTER_FIELD.zip).toBe("zip");
        expect(specOf(LEAD_FILTER_FIELD.zip)).toMatchObject({ control: "idset", group: "address", entry: "zip", readsAddresses: true });
        expect(leadFilterFieldSpecs({ readsAddresses: false }).map((spec) => spec.field)).not.toContain(LEAD_FILTER_FIELD.zip);
        expect(leadFilterFieldSpecs({ readsAddresses: true }).map((spec) => spec.field)).toContain(LEAD_FILTER_FIELD.zip);
    });

    it("filters by the lead who referred, picked from the leads, under Família", () => {
        expect(LEAD_FILTER_FIELD.referredBy).toBe("referred_by");
        expect(specOf(LEAD_FILTER_FIELD.referredBy)).toMatchObject({ control: "idset", group: "family", entry: "lead" });
        expect(leadFilterFieldSpecs({ readsAddresses: false }).map((spec) => spec.field)).toContain(LEAD_FILTER_FIELD.referredBy);
    });

    it("lets the owner filter ask for leads with or without an owner", () => {
        const owner = specOf(LEAD_FILTER_FIELD.owner);
        expect(owner?.presence).toEqual({
            true: "leadsPage.filters.options.ownerPresence.true",
            false: "leadsPage.filters.options.ownerPresence.false",
        });
        expect(messageAt(ptMessages, owner?.presence?.false ?? "")).toBe("Sem responsável");
    });

    it("names every presence side in all four locales", () => {
        for (const [locale, messages] of Object.entries(LOCALES)) {
            for (const spec of LEAD_FILTER_FIELDS) {
                if (!spec.presence) continue;
                for (const path of [spec.presence.true, spec.presence.false]) {
                    expect(typeof messageAt(messages, path), `${locale} ${path}`).toBe("string");
                }
            }
        }
    });

    it("reads every CEP in pasted text and keeps apart what is not one", () => {
        expect(zipFilterEntries("06402-000, 01310100\n123  06402000")).toEqual({ values: ["06402000", "01310100"], invalid: ["123"] });
        expect(zipFilterEntries("   ")).toEqual({ values: [], invalid: [] });
    });

    it("caps CEPs at what the server accepts in one filter", () => {
        expect(LEAD_ZIP_FILTER_MAX).toBe(200);
    });
});
