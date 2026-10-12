import { describe, expect, it } from "vitest";

import { createLookShots, LOOK_SHOT_LIMIT } from "./look-shots";

describe("pictures Elo saw", () => {
  it("keeps the newest first and drops the oldest past the limit", () => {
    const shots = createLookShots();
    for (let i = 0; i < LOOK_SHOT_LIMIT + 2; i++) shots.add(`data:image/jpeg;base64,${i}`, { kind: "moments", fromMs: i, toMs: i });
    const kept = shots.store.getState().shots;
    expect(kept).toHaveLength(LOOK_SHOT_LIMIT);
    expect(kept.map((shot) => shot.image)).toEqual([4, 3, 2].map((i) => `data:image/jpeg;base64,${i}`));
    expect(new Set(kept.map((shot) => shot.id)).size).toBe(LOOK_SHOT_LIMIT);
  });

  it("forgets every picture when the editor closes", () => {
    const shots = createLookShots(2);
    shots.add("data:image/jpeg;base64,A", { kind: "artboards" });
    shots.clear();
    expect(shots.store.getState().shots).toEqual([]);
  });
});
