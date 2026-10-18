import { describe, expect, it } from "vitest";

import type { GroupPerson } from "@/lib/unofficial-whatsapp-groups/types";

import {
  DEFAULT_MIN_GROUPS,
  MIN_GROUP_OPTIONS,
  isHiddenNumber,
  memberSearchOf,
  minGroupOptions,
  pageCounts,
  parsePeopleQuery,
  peopleHref,
  personSource,
} from "./people-model";

function person(overrides: Partial<GroupPerson> = {}): GroupPerson {
  return {
    personKey: "k-1",
    name: "Ana Souza",
    phone: "5584999990001",
    jid: "5584999990001@s.whatsapp.net",
    groupCount: 3,
    groups: [
      { groupId: "g-1", subject: "Vendas" },
      { groupId: "g-2", subject: "Suporte" },
      { groupId: "g-3", subject: "Eventos" },
    ],
    ...overrides,
  };
}

describe("parsePeopleQuery", () => {
  it("reads the search and the minimum from the URL", () => {
    expect(parsePeopleQuery(new URLSearchParams("search=%20ana%20&minGroups=5"))).toEqual({ search: "ana", minGroups: 5 });
  });

  it("falls back to two groups when the minimum is missing, below two or not a whole number", () => {
    expect(parsePeopleQuery(new URLSearchParams("")).minGroups).toBe(DEFAULT_MIN_GROUPS);
    expect(parsePeopleQuery(new URLSearchParams("minGroups=1")).minGroups).toBe(2);
    expect(parsePeopleQuery(new URLSearchParams("minGroups=abc")).minGroups).toBe(2);
    expect(parsePeopleQuery(new URLSearchParams("minGroups=2.5")).minGroups).toBe(2);
  });

  it("keeps a minimum a link asked for even when the toggle does not list it", () => {
    expect(parsePeopleQuery(new URLSearchParams("minGroups=4")).minGroups).toBe(4);
  });
});

describe("minGroupOptions", () => {
  it("offers the Verus thresholds", () => {
    expect(MIN_GROUP_OPTIONS).toEqual([2, 3, 5, 10]);
    expect(minGroupOptions(3)).toEqual([2, 3, 5, 10]);
  });

  it("adds the current minimum in order when a link brought another one", () => {
    expect(minGroupOptions(4)).toEqual([2, 3, 4, 5, 10]);
    expect(minGroupOptions(20)).toEqual([2, 3, 5, 10, 20]);
  });
});

describe("peopleHref", () => {
  it("leaves the defaults out of the URL", () => {
    expect(peopleHref("", 2)).toBe("/dashboard/unofficial-whatsapp-groups/people");
  });

  it("carries the search and a non default minimum", () => {
    expect(peopleHref("ana", 5)).toBe("/dashboard/unofficial-whatsapp-groups/people?search=ana&minGroups=5");
  });
});

describe("personSource", () => {
  it("uses the server name as the display name", () => {
    expect(personSource(person({ leadName: "Ana (lead)" }))).toMatchObject({
      displayName: "Ana Souza",
      leadName: "Ana (lead)",
      phone: "5584999990001",
    });
  });

  it("drops a name that is only the phone or the JID the server filled in", () => {
    expect(personSource(person({ name: "5584999990001" })).displayName).toBeUndefined();
    expect(personSource(person({ name: "5584999990001@s.whatsapp.net" })).displayName).toBeUndefined();
    expect(personSource(person({ name: "  " })).displayName).toBeUndefined();
  });

  it("drops the JID of a hidden number as the name, so the label becomes its local part", () => {
    const hidden = person({ name: "123456789012345@lid", phone: undefined, jid: "123456789012345@lid" });
    expect(personSource(hidden)).toMatchObject({ displayName: undefined, jid: "123456789012345@lid" });
  });
});

describe("isHiddenNumber", () => {
  it("is true only when neither the phone nor the JID gives a number", () => {
    expect(isHiddenNumber(person())).toBe(false);
    expect(isHiddenNumber(person({ phone: undefined }))).toBe(false);
    expect(isHiddenNumber(person({ phone: undefined, jid: "123456789012345@lid" }))).toBe(true);
  });
});

describe("memberSearchOf", () => {
  it("searches the members list by phone", () => {
    expect(memberSearchOf(person())).toBe("5584999990001");
    expect(memberSearchOf(person({ phone: undefined }))).toBe("5584999990001");
  });

  it("searches a hidden number person by the real name, since the member search never matches a JID", () => {
    expect(memberSearchOf(person({ phone: undefined, jid: "123456789012345@lid" }))).toBe("Ana Souza");
  });

  it("searches nothing for a hidden number person without a real name", () => {
    expect(memberSearchOf(person({ name: "123456789012345@lid", phone: undefined, jid: "123456789012345@lid" }))).toBeUndefined();
    expect(memberSearchOf(person({ name: "", phone: undefined, jid: "123456789012345@lid" }))).toBeUndefined();
  });
});

describe("pageCounts", () => {
  it("counts leads, hidden numbers and the largest group count on the page", () => {
    const rows = [
      person({ leadId: "l-1", groupCount: 4 }),
      person({ personKey: "k-2", phone: undefined, jid: "1@lid", groupCount: 7 }),
      person({ personKey: "k-3", groupCount: 2 }),
    ];
    expect(pageCounts(rows)).toEqual({ withLead: 1, hidden: 1, maxGroups: 7 });
  });

  it("is all zero on an empty page", () => {
    expect(pageCounts([])).toEqual({ withLead: 0, hidden: 0, maxGroups: 0 });
  });
});
