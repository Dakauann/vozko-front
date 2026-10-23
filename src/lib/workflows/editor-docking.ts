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

export const RIGHT_SLOT_DEFAULT_WIDTH = 480;
export const RIGHT_SLOT_MIN_WIDTH = 360;
const RIGHT_SLOT_MAX_VIEWPORT_SHARE = 0.7;

export function rightSlotMaxWidth(viewportWidth: number): number {
  return Math.max(RIGHT_SLOT_MIN_WIDTH, Math.round(viewportWidth * RIGHT_SLOT_MAX_VIEWPORT_SHARE));
}

export function rightSlotWidth(desired: number, viewportWidth: number): number {
  return Math.min(Math.max(RIGHT_SLOT_MIN_WIDTH, desired), rightSlotMaxWidth(viewportWidth));
}
