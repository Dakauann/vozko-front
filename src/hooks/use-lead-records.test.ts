import { describe, expect, it, vi } from "vitest";
import { QueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";

vi.mock("@/app/actions/leads", () => ({}));
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" } }) }));

import { forgetLeadQueries, leadQueryKeys, refreshLeadDeals, refreshLeadQueries } from "./use-lead-records";

const pages = (count: number): InfiniteData<string, string> => ({
  pages: Array.from({ length: count }, (_, index) => `page-${index}`),
  pageParams: Array.from({ length: count }, (_, index) => (index === 0 ? "" : `cur-${index}`)),
});

function seeded() {
  const client = new QueryClient();
  client.setQueryData(leadQueryKeys.detail("ws-1", "lead-1"), { id: "lead-1" });
  client.setQueryData(leadQueryKeys.relatives("ws-1", "lead-1"), pages(1));
  client.setQueryData(leadQueryKeys.timeline("ws-1", "lead-1"), pages(3));
  client.setQueryData(leadQueryKeys.deals("ws-1", "lead-1"), pages(2));
  return client;
}

const stale = (client: QueryClient, key: QueryKey) => client.getQueryState(key)?.isInvalidated ?? false;

describe("lead query keys", () => {
  it("keeps the timeline and the deals outside the lead key, so a lead change does not read them all again", () => {
    const lead = leadQueryKeys.lead("ws-1", "lead-1");
    for (const key of [leadQueryKeys.timeline("ws-1", "lead-1"), leadQueryKeys.deals("ws-1", "lead-1")]) {
      expect(lead.every((part, index) => key[index] === part)).toBe(false);
    }
  });

  it("reads the record again and only the first timeline page when the lead changes, leaving the deals alone", () => {
    const client = seeded();

    refreshLeadQueries(client, "ws-1", "lead-1");

    expect(stale(client, leadQueryKeys.detail("ws-1", "lead-1"))).toBe(true);
    expect(stale(client, leadQueryKeys.relatives("ws-1", "lead-1"))).toBe(true);
    expect(client.getQueryData(leadQueryKeys.timeline("ws-1", "lead-1"))).toEqual(pages(1));
    expect(stale(client, leadQueryKeys.timeline("ws-1", "lead-1"))).toBe(true);
    expect(client.getQueryData(leadQueryKeys.deals("ws-1", "lead-1"))).toEqual(pages(2));
    expect(stale(client, leadQueryKeys.deals("ws-1", "lead-1"))).toBe(false);
  });

  it("reads the deals again and the first timeline page after a deal is saved, leaving the record alone", () => {
    const client = seeded();

    refreshLeadDeals(client, "ws-1", "lead-1");

    expect(stale(client, leadQueryKeys.deals("ws-1", "lead-1"))).toBe(true);
    expect(client.getQueryData(leadQueryKeys.timeline("ws-1", "lead-1"))).toEqual(pages(1));
    expect(stale(client, leadQueryKeys.timeline("ws-1", "lead-1"))).toBe(true);
    expect(stale(client, leadQueryKeys.detail("ws-1", "lead-1"))).toBe(false);
  });

  it("forgets everything read about an anonymized lead", () => {
    const client = seeded();

    forgetLeadQueries(client, "ws-1", "lead-1");

    for (const key of [
      leadQueryKeys.detail("ws-1", "lead-1"),
      leadQueryKeys.relatives("ws-1", "lead-1"),
      leadQueryKeys.timeline("ws-1", "lead-1"),
      leadQueryKeys.deals("ws-1", "lead-1"),
    ]) {
      expect(client.getQueryData(key)).toBeUndefined();
    }
  });
});

describe("lead summary key", () => {
  it("reads the summary again when the lead changes, after a deal is saved, and forgets it with the lead", () => {
    const summaryKey = leadQueryKeys.summary("ws-1", "lead-1");
    const lead = leadQueryKeys.lead("ws-1", "lead-1");
    expect(lead.every((part, index) => summaryKey[index] === part)).toBe(true);

    const changed = seeded();
    changed.setQueryData(summaryKey, { memoriesCount: 0, sharedNumbers: [] });
    refreshLeadQueries(changed, "ws-1", "lead-1");
    expect(stale(changed, summaryKey)).toBe(true);

    const dealt = seeded();
    dealt.setQueryData(summaryKey, { memoriesCount: 0, sharedNumbers: [] });
    refreshLeadDeals(dealt, "ws-1", "lead-1");
    expect(stale(dealt, summaryKey)).toBe(true);
    expect(stale(dealt, leadQueryKeys.detail("ws-1", "lead-1"))).toBe(false);

    const forgotten = seeded();
    forgotten.setQueryData(summaryKey, { memoriesCount: 0, sharedNumbers: [] });
    forgetLeadQueries(forgotten, "ws-1", "lead-1");
    expect(forgotten.getQueryData(summaryKey)).toBeUndefined();
  });
});
