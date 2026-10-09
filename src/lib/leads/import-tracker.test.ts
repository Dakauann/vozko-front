import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIRST_POLL_MS, MAX_POLL_MS, nextPollDelay } from "@/lib/media-generation/polling";

import { LeadImportTracker, MAX_TRACKED_IMPORTS, type LeadImportFetch, type LeadImportListFetch } from "./import-tracker";
import { leadImportSummaryOf, type LeadImportJob, type LeadImportLimits, type LeadImportStatus, type LeadImportSummary } from "./imports";

function job(id: string, status: LeadImportStatus, processed = 0): LeadImportJob {
  return {
    id,
    status,
    fileName: `${id}.csv`,
    sizeBytes: 10,
    totalRows: 100,
    processed,
    preview: { headers: ["telefone"], sample: [], columns: [] },
    fields: [],
    options: { fillEmpty: true, seedInbox: false, seedConversations: false },
    createdAt: "2026-10-08T12:00:00Z",
    expiresAt: "2026-10-15T12:00:00Z",
  };
}

function summary(id: string, status: LeadImportStatus, processed = 0): LeadImportSummary {
  return leadImportSummaryOf(job(id, status, processed));
}

const LIMITS: LeadImportLimits = {
  maxBytes: 20971520,
  maxMegabytes: 20,
  maxRows: 200000,
  maxSeededConversations: 200,
  retentionDays: 7,
  maxUnusedUploads: 5,
};

function listed(answers: Array<Awaited<ReturnType<LeadImportListFetch>>>) {
  let calls = 0;
  const fetchList: LeadImportListFetch = async () => {
    calls += 1;
    const next = answers.length > 1 ? answers.shift() : answers[0];
    return next ?? { error: { message: "missing", status: 500 } };
  };
  return { fetchList, calls: () => calls };
}

function scripted(responses: Record<string, Array<Awaited<ReturnType<LeadImportFetch>>>>) {
  const calls: string[] = [];
  const fetchJob: LeadImportFetch = async (id) => {
    calls.push(id);
    const queue = responses[id] ?? [];
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return next ?? { error: { message: "missing", status: 500 } };
  };
  return { calls, fetchJob };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("LeadImportTracker polling", () => {
  it("polls an active import with backoff until it settles, then stops", async () => {
    const { calls, fetchJob } = scripted({
      a: [{ job: job("a", "importing", 30) }, { job: job("a", "importing", 70) }, { job: job("a", "done", 100) }],
    });
    const tracker = new LeadImportTracker({ fetchJob });
    const settled: LeadImportSummary[] = [];
    tracker.onSettled((value) => settled.push(value));
    const stop = tracker.subscribe(() => {});

    tracker.track(job("a", "importing"));
    expect(calls).toEqual([]);

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    expect(calls).toEqual(["a"]);
    expect(tracker.get("a")?.job?.processed).toBe(30);

    const second = nextPollDelay(FIRST_POLL_MS);
    await vi.advanceTimersByTimeAsync(second - 1);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);

    await vi.advanceTimersByTimeAsync(nextPollDelay(second));
    expect(calls).toHaveLength(3);
    expect(tracker.get("a")?.job?.status).toBe("done");
    expect(settled.map((value) => value.status)).toEqual(["done"]);

    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 4);
    expect(calls).toHaveLength(3);
    stop();
  });

  it("does not poll while nobody is watching", async () => {
    const { calls, fetchJob } = scripted({ a: [{ job: job("a", "importing") }] });
    const tracker = new LeadImportTracker({ fetchJob });
    tracker.track(job("a", "importing"));

    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 3);
    expect(calls).toEqual([]);

    const stop = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    expect(calls).toEqual(["a"]);

    stop();
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 3);
    expect(calls).toEqual(["a"]);
  });

  it("polls each import once per tick however many watchers there are", async () => {
    const { calls, fetchJob } = scripted({ a: [{ job: job("a", "importing") }] });
    const tracker = new LeadImportTracker({ fetchJob });
    const first = tracker.subscribe(() => {});
    const second = tracker.subscribe(() => {});
    tracker.track(job("a", "importing"));

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    expect(calls).toEqual(["a"]);
    first();
    second();
  });

  it("does not poll an import that waits for the person", async () => {
    const { calls, fetchJob } = scripted({});
    const tracker = new LeadImportTracker({ fetchJob });
    const stop = tracker.subscribe(() => {});
    tracker.track(job("a", "uploaded"));
    tracker.track(job("b", "analyzed"));

    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 3);
    expect(calls).toEqual([]);
    stop();
  });

  it("reports the end of a dry run as a settle", async () => {
    const { fetchJob } = scripted({ a: [{ job: job("a", "analyzed") }] });
    const tracker = new LeadImportTracker({ fetchJob });
    const settled: string[] = [];
    tracker.onSettled((value) => settled.push(value.status));
    const stop = tracker.subscribe(() => {});
    tracker.track(job("a", "analyzing"));

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    expect(settled).toEqual(["analyzed"]);
    stop();
  });

  it("marks an import that no longer exists as gone and stops polling it", async () => {
    const { calls, fetchJob } = scripted({ a: [{ error: { message: "not found", status: 404, code: "lead_import_not_found" } }] });
    const tracker = new LeadImportTracker({ fetchJob });
    const stop = tracker.subscribe(() => {});
    tracker.track(job("a", "importing"));

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    expect(tracker.get("a")?.gone).toBe(true);

    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 3);
    expect(calls).toEqual(["a"]);
    stop();
  });

  it("stops after three failures in a row and resumes on retry", async () => {
    const failure = { error: { message: "boom", status: 502 } };
    const { calls, fetchJob } = scripted({ a: [failure, failure, failure, { job: job("a", "done") }] });
    const tracker = new LeadImportTracker({ fetchJob });
    const stop = tracker.subscribe(() => {});
    tracker.track(job("a", "importing"));

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS + MAX_POLL_MS * 2);
    expect(calls).toHaveLength(3);
    expect(tracker.get("a")?.pollError?.status).toBe(502);

    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 3);
    expect(calls).toHaveLength(3);

    tracker.retry("a");
    expect(tracker.get("a")?.pollError).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(4);
    expect(tracker.get("a")?.job?.status).toBe("done");
    stop();
  });

  it("keeps polling through a single failure", async () => {
    const { calls, fetchJob } = scripted({
      a: [{ error: { message: "busy", status: 503 } }, { job: job("a", "done") }],
    });
    const tracker = new LeadImportTracker({ fetchJob });
    const stop = tracker.subscribe(() => {});
    tracker.track(job("a", "importing"));

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS + MAX_POLL_MS);
    expect(calls).toHaveLength(2);
    expect(tracker.get("a")?.pollError).toBeNull();
    expect(tracker.get("a")?.job?.status).toBe("done");
    stop();
  });
});

describe("LeadImportTracker server list", () => {
  it("loads the importer's recent imports once someone watches, without announcing old results", async () => {
    const { fetchList, calls: listCalls } = listed([
      { list: { items: [summary("live", "importing", 10), summary("old", "done")], limits: LIMITS } },
    ]);
    const { calls, fetchJob } = scripted({ live: [{ job: job("live", "importing", 50) }, { job: job("live", "done", 100) }] });
    const tracker = new LeadImportTracker({ fetchJob, fetchList });
    const settled: string[] = [];
    tracker.onSettled((value) => settled.push(value.id));
    expect(tracker.getSnapshot()).toEqual([]);
    expect(tracker.getLimits()).toBeNull();
    expect(listCalls()).toBe(0);

    const stop = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(listCalls()).toBe(1);
    expect(tracker.getSnapshot().map((entry) => [entry.id, entry.summary.status])).toEqual([
      ["live", "importing"],
      ["old", "done"],
    ]);
    expect(tracker.getLimits()).toEqual(LIMITS);
    expect(tracker.get("old")?.job).toBeNull();

    await vi.advanceTimersByTimeAsync(FIRST_POLL_MS);
    expect(calls).toEqual(["live"]);
    expect(tracker.get("live")?.summary.processed).toBe(50);
    expect(tracker.get("live")?.job?.preview.headers).toEqual(["telefone"]);

    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 3);
    expect(calls).toEqual(["live", "live"]);
    expect(settled).toEqual(["live"]);
    stop();
  });

  it("loads the full import only when someone opens it", async () => {
    const { fetchList } = listed([{ list: { items: [summary("old", "done")], limits: LIMITS } }]);
    const { calls, fetchJob } = scripted({ old: [{ job: job("old", "done") }] });
    const tracker = new LeadImportTracker({ fetchJob, fetchList });
    const stop = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS);
    expect(calls).toEqual([]);

    tracker.load("old");
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["old"]);
    expect(tracker.get("old")?.job?.status).toBe("done");

    tracker.load("old");
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS);
    expect(calls).toEqual(["old"]);
    stop();
  });

  it("waits for a watcher before loading an import someone asked for", async () => {
    const { calls, fetchJob } = scripted({ a: [{ job: job("a", "done") }] });
    const { fetchList } = listed([{ list: { items: [summary("a", "done")], limits: LIMITS } }]);
    const tracker = new LeadImportTracker({ fetchJob, fetchList });
    const stop = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    stop();

    tracker.load("a");
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS);
    expect(calls).toEqual([]);

    const again = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["a"]);
    again();
  });

  it("keeps an import it tracked meanwhile instead of the older listed state", async () => {
    let answer: (value: Awaited<ReturnType<LeadImportListFetch>>) => void = () => {};
    const fetchList: LeadImportListFetch = () =>
      new Promise((resolve) => {
        answer = resolve;
      });
    const tracker = new LeadImportTracker({ fetchJob: scripted({}).fetchJob, fetchList });
    const stop = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    tracker.track(job("a", "analyzed"));

    answer({ list: { items: [summary("a", "uploaded"), summary("b", "done")], limits: LIMITS } });
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.getSnapshot().map((entry) => [entry.id, entry.summary.status])).toEqual([
      ["a", "analyzed"],
      ["b", "done"],
    ]);
    stop();
  });

  it("refreshes the list each time someone starts watching again and announces what finished meanwhile", async () => {
    const { fetchList, calls: listCalls } = listed([
      { list: { items: [summary("a", "importing")], limits: LIMITS } },
      { list: { items: [summary("a", "done")], limits: LIMITS } },
    ]);
    const { fetchJob } = scripted({ a: [{ error: { message: "busy", status: 503 } }] });
    const tracker = new LeadImportTracker({ fetchJob, fetchList });
    const settled: string[] = [];
    tracker.onSettled((value) => settled.push(value.status));
    const first = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    first();

    const second = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(listCalls()).toBe(2);
    expect(tracker.get("a")?.summary.status).toBe("done");
    expect(settled).toEqual(["done"]);
    second();
  });

  it("retries a failed list with backoff and gives up after three failures in a row", async () => {
    const failure = { error: { message: "boom", status: 502 } };
    const { fetchList, calls } = listed([failure, failure, failure, failure]);
    const tracker = new LeadImportTracker({ fetchJob: scripted({}).fetchJob, fetchList });
    const stop = tracker.subscribe(() => {});

    await vi.advanceTimersByTimeAsync(0);
    expect(calls()).toBe(1);
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 6);
    expect(calls()).toBe(3);
    expect(tracker.getLimits()).toBeNull();
    expect(tracker.getSnapshot()).toEqual([]);
    stop();
  });

  it("never loads a list without a list source", async () => {
    const tracker = new LeadImportTracker({ fetchJob: scripted({}).fetchJob, fetchList: null });
    const stop = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(MAX_POLL_MS);
    expect(tracker.getSnapshot()).toEqual([]);
    expect(tracker.getLimits()).toBeNull();
    stop();
  });

  it("keeps a dismissed import hidden when the list comes back with it", async () => {
    const { fetchList } = listed([{ list: { items: [summary("a", "done"), summary("b", "done")], limits: LIMITS } }]);
    const tracker = new LeadImportTracker({ fetchJob: scripted({}).fetchJob, fetchList });
    const first = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    tracker.forget("a");
    first();

    const second = tracker.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(tracker.getSnapshot().map((entry) => entry.id)).toEqual(["b"]);

    tracker.track(job("a", "analyzed"));
    expect(tracker.get("a")).toBeDefined();
    second();
  });
});

describe("LeadImportTracker entries", () => {
  it("puts the newest import first and keeps a bounded list", () => {
    const tracker = new LeadImportTracker({ fetchJob: scripted({}).fetchJob });
    for (let i = 0; i < MAX_TRACKED_IMPORTS + 3; i += 1) tracker.track(job(`j${i}`, "done"));

    const ids = tracker.getSnapshot().map((entry) => entry.id);
    expect(ids).toHaveLength(MAX_TRACKED_IMPORTS);
    expect(ids[0]).toBe(`j${MAX_TRACKED_IMPORTS + 2}`);
  });

  it("never drops a running import to make room", () => {
    const tracker = new LeadImportTracker({ fetchJob: scripted({}).fetchJob });
    tracker.track(job("running", "importing"));
    for (let i = 0; i < MAX_TRACKED_IMPORTS + 2; i += 1) tracker.track(job(`j${i}`, "done"));

    expect(tracker.get("running")).toBeDefined();
    expect(tracker.getSnapshot()).toHaveLength(MAX_TRACKED_IMPORTS);
  });

  it("updates an import in place when it is tracked again", () => {
    const tracker = new LeadImportTracker({ fetchJob: scripted({}).fetchJob });
    tracker.track(job("a", "uploaded"));
    tracker.track(job("b", "uploaded"));
    tracker.track(job("a", "analyzing"));

    expect(tracker.getSnapshot().map((entry) => [entry.id, entry.job?.status, entry.summary.status])).toEqual([
      ["a", "analyzing", "analyzing"],
      ["b", "uploaded", "uploaded"],
    ]);
  });

  it("forgets an import on request", async () => {
    const { calls, fetchJob } = scripted({ a: [{ job: job("a", "importing") }] });
    const tracker = new LeadImportTracker({ fetchJob });
    const stop = tracker.subscribe(() => {});
    tracker.track(job("a", "importing"));
    tracker.forget("a");

    await vi.advanceTimersByTimeAsync(MAX_POLL_MS * 2);
    expect(calls).toEqual([]);
    expect(tracker.get("a")).toBeUndefined();
    stop();
  });

  it("gives a stable snapshot between changes and notifies watchers on change", () => {
    const tracker = new LeadImportTracker({ fetchJob: scripted({}).fetchJob });
    const listener = vi.fn();
    const stop = tracker.subscribe(listener);
    const before = tracker.getSnapshot();
    expect(tracker.getSnapshot()).toBe(before);

    tracker.track(job("a", "uploaded"));
    expect(listener).toHaveBeenCalled();
    expect(tracker.getSnapshot()).not.toBe(before);
    stop();
  });
});
