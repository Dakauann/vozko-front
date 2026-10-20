import { describe, expect, it } from "vitest";

import {
  forgetHistoryRequests,
  hasHistoryRequest,
  noHistoryRequests,
  requestHistory,
  routeHistoryPage,
} from "./history-routing";

const E1 = "whatsapp:e1";

describe("history routing", () => {
  it("hands an older page only to the view that asked for it, so a window never splices in the pane's scrollback", () => {
    const requests = requestHistory(noHistoryRequests, E1, "before", "pane");
    const routed = routeHistoryPage(requests, E1, "before");
    expect([...routed.holders]).toEqual(["pane"]);
    expect(routeHistoryPage(routed.requests, E1, "before").holders.size).toBe(0);
  });

  it("hands a jump page only to the view that jumped", () => {
    let requests = requestHistory(noHistoryRequests, E1, "around", "window");
    requests = requestHistory(requests, E1, "before", "pane");
    expect([...routeHistoryPage(requests, E1, "around").holders]).toEqual(["window"]);
  });

  it("hands the subscribe page to every view holding the conversation", () => {
    expect(routeHistoryPage(noHistoryRequests, E1, "latest").holders).toEqual(new Set(["pane", "window"]));
  });

  it("serves two views that asked the same thing", () => {
    let requests = requestHistory(noHistoryRequests, E1, "after", "pane");
    requests = requestHistory(requests, E1, "after", "window");
    expect(routeHistoryPage(requests, E1, "after").holders).toEqual(new Set(["pane", "window"]));
  });

  it("keeps other conversations' requests apart", () => {
    const requests = requestHistory(noHistoryRequests, "whatsapp:e2", "before", "prefetch");
    expect(routeHistoryPage(requests, E1, "before").holders.size).toBe(0);
  });

  it("tells whether a view is already waiting for a page, so a hover does not ask twice", () => {
    const requests = requestHistory(noHistoryRequests, E1, "before", "prefetch");
    expect(hasHistoryRequest(requests, E1, "before", "prefetch")).toBe(true);
    expect(hasHistoryRequest(requests, E1, "before", "pane")).toBe(false);
  });

  it("forgets a conversation's open request when the server refuses it", () => {
    const requests = forgetHistoryRequests(requestHistory(noHistoryRequests, E1, "around", "pane"), E1, "around");
    expect(routeHistoryPage(requests, E1, "around").holders.size).toBe(0);
  });
});
