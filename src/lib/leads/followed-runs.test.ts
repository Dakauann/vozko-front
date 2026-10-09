import { describe, expect, it } from "vitest";

import {
  FOLLOWED_LIMIT,
  FOLLOWED_MAX_AGE_MS,
  followedJobsKey,
  forgetFollowed,
  parseFollowed,
  readFollowed,
  rememberFollowed,
  withFollowed,
  withoutFollowed,
  type FollowedJob,
} from "./followed-runs";

const NOW = Date.parse("2026-10-08T12:00:00Z");

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    items,
  };
}

const BROKEN = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("followed lead jobs", () => {
  it("keeps one list per workspace", () => {
    expect(followedJobsKey("ws-1")).not.toBe(followedJobsKey("ws-2"));
  });

  it("reads the runs and audiences still worth following and drops the rest", () => {
    const raw = JSON.stringify([
      { id: "r-1", kind: "run", since: NOW - 1000 },
      { id: "a-1", kind: "audience", since: NOW - 2000 },
      { id: "r-old", kind: "run", since: NOW - FOLLOWED_MAX_AGE_MS - 1 },
      { id: "x-1", kind: "report", since: NOW },
      { id: "", kind: "run", since: NOW },
      { id: "r-2", kind: "run", since: "now" },
      "r-3",
    ]);
    expect(parseFollowed(raw, NOW)).toEqual([
      { id: "r-1", kind: "run", since: NOW - 1000 },
      { id: "a-1", kind: "audience", since: NOW - 2000 },
    ]);
  });

  it("reads nothing from an empty, broken or foreign value", () => {
    expect(parseFollowed(null, NOW)).toEqual([]);
    expect(parseFollowed("{", NOW)).toEqual([]);
    expect(parseFollowed(JSON.stringify({ id: "r-1" }), NOW)).toEqual([]);
  });

  it("adds a job once and keeps only the newest ones", () => {
    const one: FollowedJob = { id: "r-1", kind: "run", since: NOW };
    expect(withFollowed([one], { ...one, since: NOW + 1 })).toEqual([{ ...one, since: NOW + 1 }]);
    expect(withFollowed([one], { id: "r-1", kind: "audience", since: NOW })).toHaveLength(2);
    const many = Array.from({ length: FOLLOWED_LIMIT }, (_, index) => ({ id: `r-${index}`, kind: "run" as const, since: NOW + index }));
    const next = withFollowed(many, { id: "r-new", kind: "run", since: NOW + FOLLOWED_LIMIT });
    expect(next).toHaveLength(FOLLOWED_LIMIT);
    expect(next.some((job) => job.id === "r-0")).toBe(false);
    expect(next.at(-1)?.id).toBe("r-new");
  });

  it("removes a job by kind and id", () => {
    const list: FollowedJob[] = [
      { id: "r-1", kind: "run", since: NOW },
      { id: "r-1", kind: "audience", since: NOW },
    ];
    expect(withoutFollowed(list, "run", "r-1")).toEqual([{ id: "r-1", kind: "audience", since: NOW }]);
  });

  it("remembers and forgets through the browser storage", () => {
    const storage = memoryStorage();
    rememberFollowed(storage, "ws-1", { id: "r-1", kind: "run", since: NOW }, NOW);
    rememberFollowed(storage, "ws-1", { id: "a-1", kind: "audience", since: NOW }, NOW);
    expect(readFollowed(storage, "ws-1", NOW).map((job) => job.id)).toEqual(["r-1", "a-1"]);
    expect(readFollowed(storage, "ws-2", NOW)).toEqual([]);
    forgetFollowed(storage, "ws-1", "run", "r-1", NOW);
    expect(readFollowed(storage, "ws-1", NOW).map((job) => job.id)).toEqual(["a-1"]);
    forgetFollowed(storage, "ws-1", "audience", "a-1", NOW);
    expect(storage.items.has(followedJobsKey("ws-1"))).toBe(false);
  });

  it("works without storage, or when the browser refuses it", () => {
    expect(readFollowed(null, "ws-1", NOW)).toEqual([]);
    expect(readFollowed(BROKEN, "ws-1", NOW)).toEqual([]);
    expect(() => rememberFollowed(BROKEN, "ws-1", { id: "r-1", kind: "run", since: NOW }, NOW)).not.toThrow();
    expect(() => forgetFollowed(BROKEN, "ws-1", "run", "r-1", NOW)).not.toThrow();
    expect(() => rememberFollowed(null, "ws-1", { id: "r-1", kind: "run", since: NOW }, NOW)).not.toThrow();
  });

  it("follows nothing without a workspace", () => {
    const storage = memoryStorage();
    rememberFollowed(storage, "", { id: "r-1", kind: "run", since: NOW }, NOW);
    expect(storage.items.size).toBe(0);
    expect(readFollowed(storage, "", NOW)).toEqual([]);
  });
});
