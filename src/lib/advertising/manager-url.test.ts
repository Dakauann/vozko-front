import { describe, expect, it } from "vitest";

import { EMPTY_SELECTION } from "./manager-toolbar";
import { viewFromParams, viewToParams, type ManagerView } from "./manager-url";

const params = (query: string) => new URLSearchParams(query);

describe("viewFromParams", () => {
  it("opens on campaigns with nothing selected when the URL says nothing", () => {
    expect(viewFromParams(params(""), "a1")).toEqual({ level: "campaign", selection: EMPTY_SELECTION, panel: null });
  });

  it("reads the tab, the selection of every level and the open panel like Meta", () => {
    const view = viewFromParams(
      params("account=a1&tab=ads&selected_campaign_ids=c1&selected_adset_ids=s1,s2&selected_ad_ids=d1&panel=insights"),
      "a1",
    );
    expect(view.level).toBe("ad");
    expect([...view.selection.campaign]).toEqual(["c1"]);
    expect([...view.selection.adset]).toEqual(["s1", "s2"]);
    expect([...view.selection.ad]).toEqual(["d1"]);
    expect(view.panel).toBe("insights");
  });

  it("ignores unknown tabs, panels and empty ids", () => {
    const view = viewFromParams(params("tab=reports&panel=history&selected_campaign_ids=,c1,,"), "a1");
    expect(view.level).toBe("campaign");
    expect(view.panel).toBeNull();
    expect([...view.selection.campaign]).toEqual(["c1"]);
  });

  it("keeps old links that focus a campaign working", () => {
    expect([...viewFromParams(params("account=a1&campaign=c9"), "a1").selection.campaign]).toEqual(["c9"]);
    expect([...viewFromParams(params("campaign=c9&selected_campaign_ids=c1"), "a1").selection.campaign]).toEqual(["c1"]);
  });

  it("drops a selection made on another account", () => {
    const view = viewFromParams(params("account=a1&tab=adsets&selected_campaign_ids=c1&panel=insights"), "a2");
    expect(view).toEqual({ level: "adset", selection: EMPTY_SELECTION, panel: null });
  });
});

describe("viewToParams", () => {
  const view = (overrides: Partial<ManagerView>): ManagerView => ({ level: "campaign", selection: EMPTY_SELECTION, panel: null, ...overrides });

  it("writes the view next to the parameters it does not own", () => {
    const next = viewToParams(
      params("account=a0&campaign=c9&jobs=1"),
      view({ level: "adset", selection: { campaign: new Set(["c2", "c1"]), adset: new Set(), ad: new Set() }, panel: "insights" }),
      "a1",
    );
    expect(next.toString()).toBe("jobs=1&account=a1&tab=adsets&selected_campaign_ids=c1%2Cc2&panel=insights");
  });

  it("leaves the default view out of the URL", () => {
    expect(viewToParams(params("tab=ads&selected_ad_ids=d1&panel=insights"), view({}), null).toString()).toBe("");
  });

  it("round trips", () => {
    const original = view({ level: "ad", selection: { campaign: new Set(["c1"]), adset: new Set(["s1"]), ad: new Set(["d1", "d2"]) }, panel: "insights" });
    expect(viewFromParams(viewToParams(params(""), original, "a1"), "a1")).toEqual(original);
  });
});
