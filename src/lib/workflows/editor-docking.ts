export type RightPanel = "test" | "copilot";

export interface RightSlotView {
  active: RightPanel | null;
  tabs: boolean;
  launcher: boolean;
}

export function rightSlotView(input: { testOpen: boolean; copilotOpen: boolean; preferred: RightPanel }): RightSlotView {
  const { testOpen, copilotOpen, preferred } = input;
  if (testOpen && copilotOpen) return { active: preferred, tabs: true, launcher: false };
  if (testOpen) return { active: "test", tabs: true, launcher: false };
  if (copilotOpen) return { active: "copilot", tabs: false, launcher: false };
  return { active: null, tabs: false, launcher: true };
}
