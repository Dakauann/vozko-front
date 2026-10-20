export const MAX_BUILDER_BUTTONS = 3;

export const BUTTON_TEXT_LIMIT = 20;

export const FLOW_BUTTON_TEXT_LIMIT = 25;

export const MAX_FLOW_BUTTONS = 1;

export const FOOTER_TEXT_LIMIT = 60;

type ButtonLike = { type: string };

export function hasFlowButton(buttons: readonly ButtonLike[]): boolean {
  return buttons.filter((button) => button.type === "FLOW").length >= MAX_FLOW_BUTTONS;
}
