import { describe, expect, it } from "vitest";

import type { NumberSeat, SeriesSibling } from "@/lib/unofficial-whatsapp-groups/types";

import { sharedPostingSeats, usableSeats } from "./campaign-model";
import { parseSeriesConflict, seriesName, seriesRenames } from "./series-model";

const series: SeriesSibling[] = [
  { groupId: "g2", subject: "Turma #2", sequence: 2, members: 10 },
  { groupId: "g1", subject: "Turma #1", sequence: 1, members: 250 },
  { groupId: "g3", subject: "Turma, extra", sequence: 3, members: 4 },
];

describe("parseSeriesConflict", () => {
  it("links each subject to its sibling", () => {
    expect(parseSeriesConflict("some groups of the series could not be updated: Turma #1, Turma #2", series)).toEqual([
      { subject: "Turma #1", groupId: "g1" },
      { subject: "Turma #2", groupId: "g2" },
    ]);
  });

  it("keeps unmatched subjects as plain text", () => {
    expect(parseSeriesConflict("some groups of the series could not be updated: Outro", series)).toEqual([{ subject: "Outro" }]);
  });

  it("accepts a wrapped message", () => {
    expect(parseSeriesConflict("conflict: some groups of the series could not be updated: Turma #2", series)).toEqual([{ subject: "Turma #2", groupId: "g2" }]);
    expect(parseSeriesConflict("Some groups of the series could not be updated: Turma #2", series)).toEqual([{ subject: "Turma #2", groupId: "g2" }]);
  });

  it("returns null without the prefix", () => {
    expect(parseSeriesConflict("group not found", series)).toBeNull();
    expect(parseSeriesConflict("whatsapp: failed", series)).toBeNull();
    expect(parseSeriesConflict("some groups of the series could not be updated: ", series)).toBeNull();
  });
});

describe("series names", () => {
  it("numbers the base name", () => {
    expect(seriesName(" Turma ", 4)).toBe("Turma #4");
  });

  it("lists renames by sequence", () => {
    expect(seriesRenames("Aula", series).map((rename) => rename.to)).toEqual(["Aula #1", "Aula #2", "Aula #3"]);
  });
});

function seat(instanceId: string, canPost: boolean, connected = true): NumberSeat {
  return { instanceId, label: instanceId, connected, admin: false, canPost };
}

describe("sharedPostingSeats", () => {
  it("keeps the seats that post in every group", () => {
    const groups = [
      { numbers: [seat("a", true), seat("b", true), seat("c", false)] },
      { numbers: [seat("a", true), seat("b", false), seat("c", true)] },
    ];
    expect(sharedPostingSeats(groups).map((item) => item.instanceId)).toEqual(["a"]);
  });

  it("returns nothing without groups", () => {
    expect(sharedPostingSeats([])).toEqual([]);
  });

  it("marks a seat offline when it is offline in any group", () => {
    const groups = [{ numbers: [seat("a", true, true)] }, { numbers: [seat("a", true, false)] }];
    const shared = sharedPostingSeats(groups);
    expect(shared[0].connected).toBe(false);
    expect(usableSeats(shared)).toEqual([]);
  });
});
