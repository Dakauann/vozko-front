import { configText } from "./config-text";

const TEMPLATE_BUTTON_VARIABLE = "{{selected_option_id}}";

const TEMPLATE_BUTTON_OPERATOR = "eq";
const TEMPLATE_BUTTON_PREFIX = "template_button:";
const TEMPLATE_BUTTON_VALUE = /^template_button:(\d{1,2})$/;
const MAX_TEMPLATE_BUTTONS = 10;

export const TEMPLATE_BUTTON_POSITIONS: readonly number[] = Array.from({ length: MAX_TEMPLATE_BUTTONS }, (_, index) => index);

export type TemplateButtonCondition = {
  variable: string;
  operator: string;
  value: string;
};

export function templateButtonCondition(index: number): TemplateButtonCondition {
  return { variable: TEMPLATE_BUTTON_VARIABLE, operator: TEMPLATE_BUTTON_OPERATOR, value: `${TEMPLATE_BUTTON_PREFIX}${index}` };
}

export function templateButtonIndexOf(config: Record<string, unknown>): number | null {
  if (configText(config.variable) !== TEMPLATE_BUTTON_VARIABLE || configText(config.operator) !== TEMPLATE_BUTTON_OPERATOR) return null;
  const match = TEMPLATE_BUTTON_VALUE.exec(configText(config.value));
  return match ? Number(match[1]) : null;
}
