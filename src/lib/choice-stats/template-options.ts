import type { TemplateComponent } from "@/lib/whatsapp-templates/types";

export type TemplateChoiceKind = "quick_reply" | "url";

export interface TemplateChoiceOption {
  optionId: string;
  label: string;
  kind: TemplateChoiceKind;
}

export function templateButtonOptionId(index: number): string {
  return `template_button:${index}`;
}

export function templateUrlOptionId(index: number): string {
  return `template_url:${index}`;
}

export function templateChoiceOptions(components: readonly TemplateComponent[]): TemplateChoiceOption[] {
  const buttons = components.find((component) => component.type === "BUTTONS")?.buttons ?? [];
  return buttons.flatMap((button, index): TemplateChoiceOption[] => {
    if (button.type === "QUICK_REPLY") return [{ optionId: templateButtonOptionId(index), label: button.text, kind: "quick_reply" }];
    if (button.type === "URL") return [{ optionId: templateUrlOptionId(index), label: button.text, kind: "url" }];
    return [];
  });
}

export function choiceOptionLabels(outputs: readonly { id: string; label: string }[], templateOptions: readonly TemplateChoiceOption[]): ReadonlyMap<string, string> {
  return new Map([...outputs.map((output): [string, string] => [output.id, output.label]), ...templateOptions.map((option): [string, string] => [option.optionId, option.label])]);
}
