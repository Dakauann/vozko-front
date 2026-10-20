import { describe, expect, it } from "vitest";

import { rightSlotView } from "./editor-docking";

describe("rightSlotView", () => {
  it("leaves the slot empty and shows the copilot launcher when nothing is open", () => {
    expect(rightSlotView({ testOpen: false, copilotOpen: false, preferred: "copilot" })).toEqual({ active: null, tabs: false, launcher: true });
  });

  it("docks the test panel alone and offers the copilot as a tab instead of a floating launcher over it", () => {
    expect(rightSlotView({ testOpen: true, copilotOpen: false, preferred: "copilot" })).toEqual({ active: "test", tabs: true, launcher: false });
  });

  it("docks the copilot alone without tabs", () => {
    expect(rightSlotView({ testOpen: false, copilotOpen: true, preferred: "test" })).toEqual({ active: "copilot", tabs: false, launcher: false });
  });

  it("shows the preferred panel when both are open, with tabs to switch, so neither covers the other", () => {
    expect(rightSlotView({ testOpen: true, copilotOpen: true, preferred: "copilot" })).toEqual({ active: "copilot", tabs: true, launcher: false });
    expect(rightSlotView({ testOpen: true, copilotOpen: true, preferred: "test" })).toEqual({ active: "test", tabs: true, launcher: false });
  });
});
