import { describe, expect, it } from "vitest";

import type { GroupCampaign, GroupMember, NumberSeat, ParticipantTotal, WorkspaceGroup } from "@/lib/unofficial-whatsapp-groups/types";

import {
  departures,
  oursRemovedMark,
  DEFAULT_MEMBER_FILTERS,
  DESCRIPTION_MAX_CHARS,
  GROUP_CAMPAIGNS_LIMIT,
  HEADLINE_CHARS,
  SUBJECT_MAX_CHARS,
  bulkTargets,
  campaignTally,
  campaignTotalLabel,
  canCreateNextInSeries,
  groupPhotoProblem,
  hasAdminSeat,
  headline,
  isAdminRefusal,
  isFiltered,
  knownCampaignTally,
  leaveConfirmed,
  memberFiltersFromLink,
  memberLinkOf,
  memberLinkSignature,
  memberMenu,
  memberQuery,
  outstandingSetupWarnings,
  parsePhoneList,
  seatTally,
  seatsMark,
  seriesBaseName,
  seriesMemberTotal,
  setupWarningsFor,
  tabSearch,
  topTalkers,
  whatsAppDraftProblems,
  whatsAppPatch,
  withMemberLink,
} from "./detail-model";

function seat(instanceId: string, patch: Partial<NumberSeat> = {}): NumberSeat {
  return { instanceId, label: instanceId, connected: true, admin: false, canPost: true, ...patch };
}

function member(personKey: string, patch: Partial<GroupMember> = {}): GroupMember {
  return {
    id: personKey,
    groupId: "g1",
    workspaceId: "w1",
    personKey,
    jid: `${personKey}@s.whatsapp.net`,
    role: "member",
    status: "active",
    ourNumber: false,
    otherGroups: 0,
    ...patch,
  };
}

function campaign(entryStatus: string, campaignStatus = "COMPLETED"): GroupCampaign {
  return { campaignId: entryStatus, name: entryStatus, campaignStatus, instanceId: "i1", entryStatus, createdAt: "2026-10-01T10:00:00Z" };
}

const group = { subject: "Ofertas #2", description: "Promoções da semana" } as WorkspaceGroup;

describe("tabSearch", () => {
  it("drops the tab for the overview and keeps other params", () => {
    expect(tabSearch("tab=members&x=1", "overview")).toBe("?x=1");
    expect(tabSearch("", "overview")).toBe("");
  });

  it("sets the tab for any other view", () => {
    expect(tabSearch("", "campaigns")).toBe("?tab=campaigns");
    expect(tabSearch("tab=members", "settings")).toBe("?tab=settings");
  });
});

describe("headline", () => {
  it("takes the first non empty line", () => {
    expect(headline("\n  Ofertas da semana \nmais texto")).toBe("Ofertas da semana");
    expect(headline(undefined)).toBe("");
  });

  it("shortens a long first line", () => {
    const text = headline("a".repeat(HEADLINE_CHARS + 20));
    expect(text.length).toBe(HEADLINE_CHARS);
    expect(text.endsWith("…")).toBe(true);
  });
});

describe("seats", () => {
  it("knows when some number is an admin", () => {
    expect(hasAdminSeat([seat("a")])).toBe(false);
    expect(hasAdminSeat([seat("a"), seat("b", { admin: true })])).toBe(true);
  });

  it("counts connected, admin, posting and offline seats", () => {
    expect(seatTally([seat("a", { admin: true }), seat("b", { connected: false, canPost: false })])).toEqual({
      connected: 1,
      admin: 1,
      posting: 1,
      offline: 1,
    });
  });

  it("marks a fault when no seat posts and a warning when a seat is offline", () => {
    expect(seatsMark([seat("a", { canPost: false })])).toBe("fault");
    expect(seatsMark([seat("a"), seat("b", { connected: false })])).toBe("warning");
    expect(seatsMark([seat("a")])).toBeUndefined();
    expect(seatsMark([])).toBe("fault");
  });
});

describe("memberQuery", () => {
  it("sends only the filters that narrow the list", () => {
    expect(memberQuery(DEFAULT_MEMBER_FILTERS, 1, 20)).toEqual({ page: 1, pageSize: 20, status: "active" });
  });

  it("maps every filter to the API names", () => {
    expect(memberQuery({ status: "all", lead: "without", adminsOnly: true, inOtherOnly: true, search: "  ana " }, 3, 50)).toEqual({
      page: 3,
      pageSize: 50,
      leadLinked: false,
      adminsOnly: true,
      inOtherOnly: true,
      search: "ana",
    });
  });

  it("tells when the list is narrowed", () => {
    expect(isFiltered(DEFAULT_MEMBER_FILTERS)).toBe(false);
    expect(isFiltered({ ...DEFAULT_MEMBER_FILTERS, search: " " })).toBe(false);
    expect(isFiltered({ ...DEFAULT_MEMBER_FILTERS, adminsOnly: true })).toBe(true);
  });
});

describe("member links", () => {
  it("reads a group link into member filters", () => {
    expect(memberFiltersFromLink(undefined)).toEqual(DEFAULT_MEMBER_FILTERS);
    expect(memberFiltersFromLink({ status: "left", search: "5511", lead: true })).toEqual({
      ...DEFAULT_MEMBER_FILTERS,
      status: "left",
      search: "5511",
      lead: "with",
    });
  });

  it("writes only the linkable filters back", () => {
    expect(memberLinkOf(DEFAULT_MEMBER_FILTERS)).toBeUndefined();
    expect(memberLinkOf({ ...DEFAULT_MEMBER_FILTERS, status: "all", lead: "with", search: " ana " })).toEqual({
      status: "all",
      search: "ana",
      lead: true,
    });
    expect(memberLinkOf({ ...DEFAULT_MEMBER_FILTERS, lead: "without", adminsOnly: true })).toBeUndefined();
  });

  it("gives the same signature to equal links", () => {
    expect(memberLinkSignature(undefined)).toBe(memberLinkSignature({}));
    expect(memberLinkSignature({ status: "left" })).not.toBe(memberLinkSignature(undefined));
  });

  it("rewrites the member params of the current search and keeps the rest", () => {
    expect(withMemberLink("tab=members&members=left&x=1", { search: "ana" })).toBe("?tab=members&x=1&msearch=ana");
    expect(withMemberLink("tab=members&lead=1", undefined)).toBe("?tab=members");
    expect(withMemberLink("", undefined)).toBe("");
  });
});

describe("parsePhoneList", () => {
  it("keeps digits, dedupes and splits valid from invalid", () => {
    expect(parsePhoneList("+55 (11) 91234-5678\n5511912345678, 123\n\n  44 20 7946 0958 ; abc")).toEqual({
      valid: ["5511912345678", "442079460958"],
      invalid: ["123", "abc"],
    });
  });

  it("refuses numbers longer than 15 digits", () => {
    expect(parsePhoneList("1234567890123456").invalid).toEqual(["1234567890123456"]);
  });

  it("returns nothing for blank text", () => {
    expect(parsePhoneList(" \n ")).toEqual({ valid: [], invalid: [] });
  });
});

describe("isAdminRefusal", () => {
  it("recognises the backend refusals for a missing admin number", () => {
    expect(isAdminRefusal("the connected number is not an admin of this group")).toBe(true);
    expect(isAdminRefusal("Error: none of your connected numbers is in this group")).toBe(true);
    expect(isAdminRefusal("group not found")).toBe(false);
    expect(isAdminRefusal(undefined)).toBe(false);
  });
});

describe("memberMenu", () => {
  const all = { update: true, remove: true, addLeads: true };

  it("never manages our own number", () => {
    expect(memberMenu(member("a", { ourNumber: true }), all)).toEqual({ promote: false, demote: false, remove: false, addLead: false });
  });

  it("promotes members and demotes admins", () => {
    expect(memberMenu(member("a"), all)).toEqual({ promote: true, demote: false, remove: true, addLead: true });
    expect(memberMenu(member("a", { role: "admin" }), all)).toMatchObject({ promote: false, demote: true, remove: true });
  });

  it("leaves the group owner alone", () => {
    expect(memberMenu(member("a", { role: "superadmin" }), all)).toMatchObject({ promote: false, demote: false, remove: false });
  });

  it("offers no WhatsApp change for someone who left", () => {
    expect(memberMenu(member("a", { status: "left" }), all)).toEqual({ promote: false, demote: false, remove: false, addLead: true });
  });

  it("follows the grants and the lead link", () => {
    expect(memberMenu(member("a", { leadId: "l1" }), { update: false, remove: false, addLeads: true })).toEqual({
      promote: false,
      demote: false,
      remove: false,
      addLead: false,
    });
  });
});

describe("bulkTargets", () => {
  const rows = [
    member("a"),
    member("b", { role: "admin" }),
    member("c", { role: "superadmin" }),
    member("d", { ourNumber: true }),
    member("e", { status: "left" }),
  ];

  it("picks the jids each action can change", () => {
    expect(bulkTargets(rows, "promote")).toEqual(["a@s.whatsapp.net"]);
    expect(bulkTargets(rows, "demote")).toEqual(["b@s.whatsapp.net"]);
    expect(bulkTargets(rows, "remove")).toEqual(["a@s.whatsapp.net", "b@s.whatsapp.net"]);
    expect(bulkTargets(rows, "add")).toEqual([]);
  });
});

describe("campaignTally", () => {
  it("counts running, delivered and failed entries", () => {
    expect(
      campaignTally([
        campaign("SENT", "RUNNING"),
        campaign("DELIVERED"),
        campaign("READ"),
        campaign("FAILED"),
        campaign("SKIPPED_NOT_ON_WHATSAPP"),
        campaign("NOT_ELIGIBLE_POSSIBLE_SPAM"),
        campaign("PENDING", "RUNNING"),
      ]),
    ).toEqual({ total: 7, running: 2, delivered: 3, failed: 3, capped: false });
  });

  it("flags a list that reached the backend limit", () => {
    const full = Array.from({ length: GROUP_CAMPAIGNS_LIMIT }, (_, index) => ({ ...campaign("SENT"), campaignId: `c${index}` }));
    expect(campaignTally(full).capped).toBe(true);
    expect(campaignTally(full.slice(1)).capped).toBe(false);
  });
});

describe("knownCampaignTally", () => {
  it("is unknown while the first load runs or when the load failed", () => {
    expect(knownCampaignTally({ loading: true, error: null, campaigns: [] })).toBeNull();
    expect(knownCampaignTally({ loading: false, error: "boom", campaigns: [] })).toBeNull();
  });

  it("keeps the last list while it reloads", () => {
    expect(knownCampaignTally({ loading: true, error: null, campaigns: [campaign("SENT")] })?.total).toBe(1);
    expect(knownCampaignTally({ loading: false, error: null, campaigns: [] })?.total).toBe(0);
  });
});

describe("campaignTotalLabel", () => {
  it("marks a capped total with a plus sign", () => {
    const num = (value: number) => String(value);
    expect(campaignTotalLabel({ total: 3, running: 0, delivered: 0, failed: 0, capped: false }, num)).toBe("3");
    expect(campaignTotalLabel({ total: GROUP_CAMPAIGNS_LIMIT, running: 0, delivered: 0, failed: 0, capped: true }, num)).toBe(`${GROUP_CAMPAIGNS_LIMIT}+`);
  });
});

describe("canCreateNextInSeries", () => {
  it("needs the create grant and a group we created", () => {
    expect(canCreateNextInSeries({ origin: "managed" }, { create: true })).toBe(true);
    expect(canCreateNextInSeries({ origin: "external" }, { create: true })).toBe(false);
    expect(canCreateNextInSeries({ origin: "managed" }, { create: false })).toBe(false);
  });
});

describe("series", () => {
  it("sums the members of every group in the series", () => {
    expect(
      seriesMemberTotal([
        { groupId: "a", subject: "A #1", sequence: 1, members: 10 },
        { groupId: "b", subject: "A #2", sequence: 2, members: 5 },
      ]),
    ).toBe(15);
  });

  it("strips the sequence suffix to get the base name", () => {
    expect(seriesBaseName("Ofertas #12")).toBe("Ofertas");
    expect(seriesBaseName("  Ofertas  ")).toBe("Ofertas");
    expect(seriesBaseName("Sala #A")).toBe("Sala #A");
  });
});

describe("whatsAppPatch", () => {
  it("sends only what changed", () => {
    expect(whatsAppPatch(group, { subject: "Ofertas #2", description: "Promoções da semana", applyToSeries: false })).toEqual({});
    expect(whatsAppPatch(group, { subject: " Novas ", description: "Promoções da semana", applyToSeries: false })).toEqual({ subject: "Novas" });
    expect(whatsAppPatch(group, { subject: "Ofertas #2", description: "Outra", imageUrl: "https://x/y.png", applyToSeries: false })).toEqual({
      description: "Outra",
      imageUrl: "https://x/y.png",
    });
  });

  it("asks for the series only with a WhatsApp change", () => {
    expect(whatsAppPatch(group, { subject: "Ofertas #2", description: "Promoções da semana", applyToSeries: true })).toEqual({});
    expect(whatsAppPatch(group, { subject: "Novas", description: "Promoções da semana", applyToSeries: true })).toEqual({
      subject: "Novas",
      applyToSeries: true,
    });
  });

  it("flags an empty or long name and a long description", () => {
    expect(whatsAppDraftProblems({ subject: " ", description: "" })).toEqual({ subject: "required" });
    expect(whatsAppDraftProblems({ subject: "a".repeat(SUBJECT_MAX_CHARS + 1), description: "b".repeat(DESCRIPTION_MAX_CHARS + 1) })).toEqual({
      subject: "tooLong",
      description: "tooLong",
    });
    expect(whatsAppDraftProblems({ subject: "Ok", description: "" })).toEqual({});
  });
});

describe("groupPhotoProblem", () => {
  it("accepts jpeg, png and webp up to 5 MB", () => {
    expect(groupPhotoProblem({ type: "image/png", size: 1000 })).toBeNull();
    expect(groupPhotoProblem({ type: "image/gif", size: 1000 })).toBe("type");
    expect(groupPhotoProblem({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toBe("size");
    expect(groupPhotoProblem({ type: "image/webp", size: 0 })).toBe("size");
  });
});

describe("topTalkers", () => {
  it("keeps the busiest participants and drops the silent ones", () => {
    const people: ParticipantTotal[] = [
      { key: "a", name: "A", messages: 2, sentiments: {} },
      { key: "b", name: "B", messages: 0, sentiments: {} },
      { key: "c", name: "C", messages: 9, sentiments: {} },
    ];
    expect(topTalkers(people, 8).map((person) => person.key)).toEqual(["c", "a"]);
    expect(topTalkers(people, 1).map((person) => person.key)).toEqual(["c"]);
  });
});

describe("leaveConfirmed", () => {
  it("needs the exact group name", () => {
    expect(leaveConfirmed(" Ofertas #2 ", "Ofertas #2")).toBe(true);
    expect(leaveConfirmed("ofertas #2", "Ofertas #2")).toBe(false);
    expect(leaveConfirmed("", "")).toBe(false);
  });
});

describe("setupWarningsFor", () => {
  it("keeps the stored reasons for the linked steps", () => {
    expect(setupWarningsFor(["description", "admins_only"], [{ step: "description", reason: "timeout" }])).toEqual([
      { step: "description", reason: "timeout" },
      { step: "admins_only", reason: "" },
    ]);
    expect(setupWarningsFor([], [{ step: "description", reason: "x" }])).toEqual([]);
  });
});

describe("outstandingSetupWarnings", () => {
  const warnings = [
    { step: "description" as const, reason: "timeout" },
    { step: "admins_only" as const, reason: "" },
    { step: "promote_numbers" as const, reason: "offline" },
  ];

  it("keeps every step the group still lacks", () => {
    expect(outstandingSetupWarnings(warnings, { description: "", announce: false }, [seat("a", { admin: true }), seat("b")])).toEqual(warnings);
  });

  it("drops the steps the group already shows as done", () => {
    expect(outstandingSetupWarnings(warnings, { description: " Regras ", announce: true }, [seat("a", { admin: true })])).toEqual([]);
    expect(outstandingSetupWarnings(warnings, { announce: true }, [])).toEqual([warnings[0], warnings[2]]);
  });
});

describe("departure counts", () => {
  const counts = { active: 40, left30d: 7, removed30d: 3, oursRemoved: 1, withLead: 5, hidden: 2 };

  it("splits the departures of the period into plain leaves and removals", () => {
    expect(departures(counts)).toEqual({ left: 4, removed: 3 });
  });

  it("never reports a negative plain leave count", () => {
    expect(departures({ ...counts, left30d: 1, removed30d: 3 })).toEqual({ left: 0, removed: 3 });
  });

  it("flags the group when one of our numbers was removed", () => {
    expect(oursRemovedMark(counts)).toBe("fault");
    expect(oursRemovedMark({ ...counts, oursRemoved: 0 })).toBeUndefined();
  });
});
