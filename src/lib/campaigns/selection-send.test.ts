import { describe, expect, it } from "vitest";

import { selectionSendControls, selectionSendRefusal } from "./selection-send";

describe("selectionSendControls", () => {
  it("leaves a campaign built by hand as it was", () => {
    expect(selectionSendControls(undefined, "STOPPED")).toEqual({ fromLeads: false, start: true, reset: true, editContent: true });
    expect(selectionSendControls("manual", "COMPLETED")).toEqual({ fromLeads: false, start: true, reset: true, editContent: true });
  });

  it("lets a send prepared from leads only resume from a pause, never reset and never change what is sent", () => {
    expect(selectionSendControls("lead_selection", "PAUSED")).toEqual({ fromLeads: true, start: true, reset: false, editContent: false });
    expect(selectionSendControls("lead_selection", "STOPPED")).toEqual({ fromLeads: true, start: false, reset: false, editContent: false });
    expect(selectionSendControls("lead_selection", "COMPLETED")).toEqual({ fromLeads: true, start: false, reset: false, editContent: false });
  });
});

describe("selectionSendRefusal", () => {
  it("names only the refusals a send prepared from leads answers", () => {
    expect(selectionSendRefusal("send_start_from_leads")).toBe("send_start_from_leads");
    expect(selectionSendRefusal("send_selection_locked")).toBe("send_selection_locked");
    expect(selectionSendRefusal("CAMPAIGN_NOT_FOUND")).toBeNull();
    expect(selectionSendRefusal(undefined)).toBeNull();
  });
});
