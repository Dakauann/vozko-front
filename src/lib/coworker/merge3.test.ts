import { describe, expect, it } from "vitest";

import { merge3 } from "./merge3";

interface Clip {
  id: string;
  x: number;
  text?: string;
}

interface Doc {
  title: string;
  clips: Clip[];
  tags: string[];
}

const base: Doc = { title: "Oferta", clips: [{ id: "a", x: 0 }, { id: "b", x: 0 }], tags: ["promo"] };

describe("merge3", () => {
  it("takes each side's change where the other side left things alone", () => {
    const mine = { ...base, clips: [{ id: "a", x: 0.4 }, base.clips[1]] };
    const theirs = { ...base, title: "Corrida", clips: [base.clips[0], { id: "b", x: 0.9, text: "Sábado" }] };
    expect(merge3(base, mine, theirs)).toEqual({
      value: { title: "Corrida", clips: [{ id: "a", x: 0.4 }, { id: "b", x: 0.9, text: "Sábado" }], tags: ["promo"] },
      conflicts: [],
    });
  });

  it("keeps the person's value when both changed the same field, and names it", () => {
    const mine = { ...base, clips: [{ id: "a", x: 0.2 }, base.clips[1]] };
    const theirs = { ...base, clips: [{ id: "a", x: 0.8 }, base.clips[1]] };
    const merged = merge3(base, mine, theirs);
    expect(merged.value.clips[0].x).toBe(0.2);
    expect(merged.conflicts).toEqual(["clips.a.x"]);
  });

  it("keeps items each side added, in place, and honours deletions", () => {
    const mine = { ...base, clips: [base.clips[0], { id: "m", x: 1 }, base.clips[1]] };
    const theirs = { ...base, clips: [base.clips[0], { id: "t", x: 2 }] };
    expect(merge3(base, mine, theirs).value.clips.map((c) => c.id)).toEqual(["a", "m", "t"]);
  });

  it("keeps an item the person changed even when the other side deleted it", () => {
    const mine = { ...base, clips: [base.clips[0], { id: "b", x: 0.5 }] };
    const theirs = { ...base, clips: [base.clips[0]] };
    const merged = merge3(base, mine, theirs);
    expect(merged.value.clips.map((c) => c.id)).toEqual(["a", "b"]);
    expect(merged.conflicts).toEqual(["clips.b"]);
  });

  it("drops an item the person deleted, even if the other side changed it", () => {
    const mine = { ...base, clips: [base.clips[0]] };
    const theirs = { ...base, clips: [base.clips[0], { id: "b", x: 0.7 }] };
    const merged = merge3(base, mine, theirs);
    expect(merged.value.clips.map((c) => c.id)).toEqual(["a"]);
    expect(merged.conflicts).toEqual(["clips.b"]);
  });

  it("follows the other side's order when only it reordered", () => {
    const theirs = { ...base, clips: [base.clips[1], base.clips[0]] };
    expect(merge3(base, base, theirs).value.clips.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("treats plain lists and removed fields as whole values", () => {
    const mine = { ...base, tags: ["promo", "novo"] };
    const theirs = { ...base, tags: ["corrida"] };
    expect(merge3(base, mine, theirs)).toEqual({ value: mine, conflicts: ["tags"] });
    const cleared: Doc = { ...base, clips: [{ id: "a", x: 0 }, { id: "b", x: 0 }] };
    const withText: Doc = { ...base, clips: [{ id: "a", x: 0, text: "Oi" }, base.clips[1]] };
    expect(merge3(withText, cleared, withText).value.clips[0].text).toBeUndefined();
  });

  it("returns the same objects when nothing changed on the other side", () => {
    const mine = { ...base, title: "Meu" };
    expect(merge3(base, mine, base).value).toBe(mine);
    expect(merge3(base, base, mine).value).toBe(mine);
  });
});
