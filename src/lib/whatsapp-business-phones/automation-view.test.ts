import { describe, expect, it } from "vitest";

import { numberAutomationView } from "./automation";

describe("numberAutomationView", () => {
  it("lets the owning workspace configure who answers, platform admins included", () => {
    expect(numberAutomationView({ connected: true, ownerWorkspaceId: "ws-1", currentWorkspaceId: "ws-1" })).toBe("configure");
  });

  it("tells any other workspace that the owner decides", () => {
    expect(numberAutomationView({ connected: true, ownerWorkspaceId: "ws-1", currentWorkspaceId: "ws-2" })).toBe("ownedElsewhere");
  });

  it("explains a connected number without an owner instead of hiding the section", () => {
    expect(numberAutomationView({ connected: true, ownerWorkspaceId: null, currentWorkspaceId: "ws-1" })).toBe("noOwner");
    expect(numberAutomationView({ connected: true, ownerWorkspaceId: undefined, currentWorkspaceId: undefined })).toBe("noOwner");
  });

  it("shows nothing until the number is connected", () => {
    expect(numberAutomationView({ connected: false, ownerWorkspaceId: "ws-1", currentWorkspaceId: "ws-1" })).toBe("hidden");
  });
});
