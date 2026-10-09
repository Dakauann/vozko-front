import { describe, expect, it, vi } from "vitest";

import { createLeadRefresher, type LeadFetched } from "./lead-refresh";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function fetched(version: number): LeadFetched {
  return { version, applyFields: vi.fn() };
}

type Fetch = (leadId: string, fields: readonly string[]) => Promise<LeadFetched | null>;

describe("createLeadRefresher", () => {
  it("fetches once per lead and folds the updates that arrive meanwhile into one more fetch", async () => {
    const first = deferred<LeadFetched | null>();
    const fetchLead = vi.fn<Fetch>().mockReturnValueOnce(first.promise).mockResolvedValueOnce(fetched(6));
    const refresh = createLeadRefresher(fetchLead);

    refresh({ leadId: "lead-1", version: 4, fields: ["name"] });
    refresh({ leadId: "lead-1", version: 5, fields: ["blocked"] });
    refresh({ leadId: "lead-1", version: 6, fields: ["number"] });
    expect(fetchLead).toHaveBeenCalledTimes(1);

    first.resolve(fetched(4));
    await flush();

    expect(fetchLead).toHaveBeenCalledTimes(2);
    expect(fetchLead.mock.calls[1]).toEqual(["lead-1", ["blocked", "number"]]);
  });

  it("skips the second fetch when the first already reached the newest version", async () => {
    const first = deferred<LeadFetched | null>();
    const fetchLead = vi.fn<Fetch>().mockReturnValueOnce(first.promise);
    const refresh = createLeadRefresher(fetchLead);

    refresh({ leadId: "lead-1", version: 4, fields: ["name"] });
    refresh({ leadId: "lead-1", version: 5, fields: ["name"] });
    first.resolve(fetched(5));
    await flush();

    expect(fetchLead).toHaveBeenCalledTimes(1);
  });

  it("applies the fields of the skipped updates from the record already fetched", async () => {
    const first = deferred<LeadFetched | null>();
    const fetchLead = vi.fn<Fetch>().mockReturnValueOnce(first.promise);
    const refresh = createLeadRefresher(fetchLead);
    const record = fetched(6);

    refresh({ leadId: "lead-1", version: 5, fields: ["name"] });
    refresh({ leadId: "lead-1", version: 6, fields: ["blocked"] });
    first.resolve(record);
    await flush();

    expect(fetchLead).toHaveBeenCalledTimes(1);
    expect(fetchLead.mock.calls[0]).toEqual(["lead-1", ["name"]]);
    expect(record.applyFields).toHaveBeenCalledWith(["blocked"]);
  });

  it("refreshes different leads independently", async () => {
    const fetchLead = vi.fn<Fetch>().mockResolvedValue(fetched(4));
    const refresh = createLeadRefresher(fetchLead);

    refresh({ leadId: "lead-1", version: 4, fields: ["name"] });
    refresh({ leadId: "lead-2", version: 4, fields: ["name"] });
    await flush();

    expect(fetchLead.mock.calls.map((call) => call[0])).toEqual(["lead-1", "lead-2"]);
  });

  it("lets a later update fetch again after a failed fetch", async () => {
    const fetchLead = vi.fn<Fetch>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(fetched(5));
    const refresh = createLeadRefresher(fetchLead);

    refresh({ leadId: "lead-1", version: 4, fields: ["name"] });
    await flush();
    refresh({ leadId: "lead-1", version: 5, fields: ["name"] });
    await flush();

    expect(fetchLead).toHaveBeenCalledTimes(2);
  });

  it("fetches again when the route cannot tell the version reached", async () => {
    const first = deferred<LeadFetched | null>();
    const fetchLead = vi.fn<Fetch>().mockReturnValueOnce(first.promise).mockResolvedValue(null);
    const refresh = createLeadRefresher(fetchLead);

    refresh({ leadId: "lead-1", version: 4, fields: ["name"] });
    refresh({ leadId: "lead-1", version: 5, fields: ["name"] });
    first.resolve(null);
    await flush();
    await flush();

    expect(fetchLead).toHaveBeenCalledTimes(2);
  });
});
