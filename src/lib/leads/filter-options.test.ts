import { describe, expect, it } from "vitest";

import {
    cityOptions,
    countedOptions,
    districtOptions,
    keepSelected,
    ownerOptions,
} from "@/lib/leads/filter-options";
import type { LeadCityCount, LeadDistrictCount } from "@/lib/leads/sections";

const city = (cityKey: string, name: string, count: number): LeadCityCount => ({ cityKey, city: name, state: "SP", count });
const district = (pair: string, name: string, cityName: string, count: number): LeadDistrictCount => {
    const [cityKey, districtKey] = pair.split("/");
    return { pair, cityKey, districtKey, district: name, city: cityName, state: "SP", count };
};

describe("counted options", () => {
    it("shows the server's count and zero for a value it did not bucket", () => {
        expect(countedOptions([{ value: "a", label: "A" }, { value: "b", label: "B" }], { a: 3 })).toEqual([
            { value: "a", label: "A", count: 3 },
            { value: "b", label: "B", count: 0 },
        ]);
    });

    it("shows no count at all while the counts are unknown", () => {
        expect(countedOptions([{ value: "a", label: "A" }], undefined)).toEqual([{ value: "a", label: "A" }]);
    });
});

describe("selected values", () => {
    it("keeps a selected value listed when the loaded options do not have it", () => {
        expect(keepSelected([{ value: "a", label: "A" }], ["a", "z"], (value) => `?${value}`)).toEqual([
            { value: "a", label: "A" },
            { value: "z", label: "?z" },
        ]);
    });
});

describe("place options", () => {
    it("lists cities by the server's order with their counts", () => {
        const options = cityOptions([city("sp:barueri", "Barueri", 900), city("sp:carapicuiba", "Carapicuíba", 40)], [], (c) => `${c.city} (${c.state})`);
        expect(options).toEqual([
            { value: "sp:barueri", label: "Barueri (SP)", count: 900 },
            { value: "sp:carapicuiba", label: "Carapicuíba (SP)", count: 40 },
        ]);
    });

    it("offers a bairro as its city and bairro pair so two Centros never merge", () => {
        const options = districtOptions(
            [district("sp:barueri/centro", "Centro", "Barueri", 120), district("sp:carapicuiba/centro", "Centro", "Carapicuíba", 80)],
            [],
            (d) => `${d.district}, ${d.city}`,
        );
        expect(options.map((option) => [option.value, option.label])).toEqual([
            ["sp:barueri/centro", "Centro, Barueri"],
            ["sp:carapicuiba/centro", "Centro, Carapicuíba"],
        ]);
    });

    it("keeps a selected bairro outside the top list", () => {
        const options = districtOptions([district("sp:barueri/centro", "Centro", "Barueri", 120)], ["sp:barueri/aldeia"], (d) => d.district);
        expect(options.map((option) => option.value)).toEqual(["sp:barueri/centro", "sp:barueri/aldeia"]);
    });
});

describe("owner options", () => {
    it("merges the counted owners with the members who own nothing yet", () => {
        const options = ownerOptions({
            owners: [
                { owner: "u-2", name: "Rafael T.", count: 9 },
                { owner: "ai:agent-1", name: "Agente Ana", count: 4 },
            ],
            members: new Map([
                ["u-1", "Clara M."],
                ["u-2", "Rafael T."],
            ]),
            ownersTruncated: false,
            selected: [],
            unnamed: "sem nome",
        });
        expect(options).toEqual([
            { value: "u-2", label: "Rafael T.", count: 9 },
            { value: "ai:agent-1", label: "Agente Ana", count: 4 },
            { value: "u-1", label: "Clara M.", count: 0 },
        ]);
    });

    it("leaves members without a count when the server says it left owners out", () => {
        const options = ownerOptions({
            owners: [{ owner: "u-top", count: 500 }],
            members: new Map([["u-1", "Clara M."]]),
            ownersTruncated: true,
            selected: [],
            unnamed: "sem nome",
        });
        expect(options.at(-1)).toEqual({ value: "u-1", label: "Clara M." });
    });

    it("counts an idle member as zero when the server listed every owner, however many", () => {
        const owners = Array.from({ length: 100 }, (_, index) => ({ owner: `u-top-${index}`, count: 500 - index }));
        const options = ownerOptions({
            owners,
            members: new Map([["u-1", "Clara M."]]),
            ownersTruncated: false,
            selected: [],
            unnamed: "sem nome",
        });
        expect(options.at(-1)).toEqual({ value: "u-1", label: "Clara M.", count: 0 });
    });

    it("names a counted owner from the members when the server sent no name", () => {
        const options = ownerOptions({
            owners: [{ owner: "u-1", count: 2 }, { owner: "u-9", count: 1 }],
            members: new Map([["u-1", "Clara M."]]),
            ownersTruncated: false,
            selected: [],
            unnamed: "sem nome",
        });
        expect(options.map((option) => option.label)).toEqual(["Clara M.", "sem nome"]);
    });

    it("lists members without counts while the facets are unknown", () => {
        const options = ownerOptions({ owners: null, members: new Map([["u-1", "Clara M."]]), ownersTruncated: false, selected: ["u-7"], unnamed: "sem nome" });
        expect(options).toEqual([
            { value: "u-1", label: "Clara M." },
            { value: "u-7", label: "sem nome" },
        ]);
    });
});
