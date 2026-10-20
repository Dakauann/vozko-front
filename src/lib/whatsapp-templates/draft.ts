import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";

import { MAX_FLOW_BUTTONS } from "./builder";
import type { ButtonType, HeaderFormat, OtpType, TemplateButton, TemplateCategory, TemplateComponent } from "./types";

export type TemplateDraftPurpose = "create" | "edit";

export type ParameterFormatState = "named" | "positional" | "none" | "mixed";

export type DraftMessageProblems = Partial<Record<"header" | "body" | "footer" | "buttons" | "format", string>>;

type Translate = (key: string, values?: Record<string, string | number>) => string;

type BuilderButton = NonNullable<DraggableComponent["data"]["buttons"]>[number];

const MEDIA_HEADER_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT", "GIF"];

const POSITIONAL = /\{\{(\d+)\}\}/g;
const NAMED = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

export function isMediaHeaderFormat(format: string | undefined): boolean {
  return MEDIA_HEADER_FORMATS.includes(format ?? "");
}

export function detectVariables(text: string): { type: "positional" | "named"; variables: string[] } {
  const positional = [...text.matchAll(POSITIONAL)].map((m) => m[1]);
  if (positional.length > 0) {
    return { type: "positional", variables: [...new Set(positional)].sort((a, b) => parseInt(a) - parseInt(b)) };
  }
  const named = [...text.matchAll(NAMED)].map((m) => m[1]);
  if (named.length > 0) return { type: "named", variables: [...new Set(named)] };
  return { type: "positional", variables: [] };
}

export function computeParameterFormat(components: DraggableComponent[]): ParameterFormatState {
  let hasPositional = false;
  let hasNamed = false;
  for (const c of components) {
    const isTextComp = c.type === "BODY" || (c.type === "HEADER" && c.data.format === "TEXT");
    const text = isTextComp ? c.data.text || "" : "";
    if (!text) continue;
    if (/\{\{\d+\}\}/.test(text)) hasPositional = true;
    if (/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/.test(text)) hasNamed = true;
  }
  if (hasPositional && hasNamed) return "mixed";
  if (hasNamed) return "named";
  if (hasPositional) return "positional";
  return "none";
}

function variablePosition(text: string): { atStart: boolean; atEnd: boolean } {
  const trimmed = text.trim();
  const hasVariable = /\{\{[^}]+\}\}/.test(trimmed);
  return { atStart: hasVariable && /^\{\{[^}]+\}\}/.test(trimmed), atEnd: hasVariable && /\{\{[^}]+\}\}$/.test(trimmed) };
}

function hasConsecutiveVariables(text: string): boolean {
  return /\{\{[^}]+\}\}\s*\{\{[^}]+\}\}/.test(text);
}

function missingExamples(component: DraggableComponent, text: string): string[] {
  const { type, variables } = detectVariables(text);
  if (type === "positional") {
    const examples = component.data.variableExamples || [];
    return variables.filter((varNum) => !examples[parseInt(varNum) - 1]?.trim());
  }
  const examples = component.data.namedVariableExamples || {};
  return variables.filter((varName) => !examples[varName]?.trim());
}

function listed(variables: string[]): string {
  return variables.map((v) => `{{${v}}}`).join(", ");
}

function bodyProblem(component: DraggableComponent | undefined, category: TemplateCategory, t: Translate): string | undefined {
  if (!component) return t("form.validation.bodyRequired");
  if (category === "AUTHENTICATION") return undefined;
  const text = component.data.text || "";
  if (!text.trim()) return t("form.validation.bodyRequired");
  const position = variablePosition(text);
  if (position.atStart) return t("form.validation.noVariableAtStart");
  if (position.atEnd) return t("form.validation.noVariableAtEnd");
  if (text.length > 1024) return t("form.validation.bodyTooLong");
  if (hasConsecutiveVariables(text)) return t("form.validation.noConsecutiveVariables");
  const missing = missingExamples(component, text);
  return missing.length > 0 ? t("form.validation.examplesRequired", { variables: listed(missing) }) : undefined;
}

function textHeaderProblem(component: DraggableComponent, t: Translate): string | undefined {
  const text = component.data.text;
  if (!text) return undefined;
  const { variables } = detectVariables(text);
  if (variables.length > 1) return t("form.validation.headerMaxOneVariable");
  if (text.length > 60) return t("form.validation.headerTooLong");
  const position = variablePosition(text);
  if (position.atStart) return t("form.validation.noVariableAtStart");
  if (position.atEnd) return t("form.validation.noVariableAtEnd");
  const missing = missingExamples(component, text);
  return missing.length > 0 ? t("form.validation.headerExamplesRequired", { variables: listed(missing) }) : undefined;
}

function headerProblem(component: DraggableComponent | undefined, category: TemplateCategory, t: Translate): string | undefined {
  if (category === "AUTHENTICATION" && component) return t("form.validation.authNoHeader");
  if (!component) return undefined;
  if (component.data.format === "TEXT") return textHeaderProblem(component, t);
  if (isMediaHeaderFormat(component.data.format) && !component.data.example?.trim()) {
    return t("form.validation.mediaHeaderRequiresExample");
  }
  return undefined;
}

function footerProblem(component: DraggableComponent | undefined, t: Translate): string | undefined {
  const text = component?.data.text;
  if (!text) return undefined;
  if (detectVariables(text).variables.length > 0) return t("form.validation.footerNoVariables");
  if (text.length > 60) return t("form.validation.footerTooLong");
  return undefined;
}

function buttonProblem(button: BuilderButton, index: number, t: Translate): string | undefined {
  const position = { index: index + 1 };
  if (button.text && button.text.length > 25) return t("form.validation.buttonTextTooLong", position);
  if (button.type === "URL" && !button.url?.trim()) return t("form.validation.urlButtonRequiresUrl", position);
  if (button.type === "URL" && button.url) {
    const urlVariables = detectVariables(button.url).variables;
    if (urlVariables.length > 0 && !button.example?.trim()) return t("form.validation.urlButtonRequiresExample", position);
    if (urlVariables.length > 1) return t("form.validation.urlMaxOneVariable", position);
  }
  if (button.type === "PHONE_NUMBER" && !button.phone_number?.trim()) return t("form.validation.phoneButtonRequiresNumber", position);
  if (button.type === "COPY_CODE" && !button.example?.trim()) return t("form.validation.copyCodeRequiresExample", position);
  if (button.type === "FLOW" && !button.text?.trim()) return t("form.validation.flowButtonRequiresText", position);
  if (button.type === "FLOW" && !button.flowId?.trim()) return t("form.validation.flowButtonRequiresForm", position);
  return undefined;
}

function quickRepliesApart(buttons: BuilderButton[]): boolean {
  const indices = buttons.flatMap((button, index) => (button.type === "QUICK_REPLY" ? [index] : []));
  return indices.some((index, i) => i > 0 && index - indices[i - 1] !== 1);
}

function buttonsProblem(components: DraggableComponent[], category: TemplateCategory, t: Translate): string | undefined {
  const holder = components.find((c) => c.type === "BUTTONS");
  const buttons = holder?.data.buttons ?? [];
  if (holder && components.some((c) => c.type === "CALL_PERMISSION_REQUEST")) return t("form.validation.callPermissionWithButtons");
  for (const [index, button] of buttons.entries()) {
    const problem = buttonProblem(button, index, t);
    if (problem) return problem;
  }
  if (buttons.length > 10) return t("form.validation.maxButtons");
  if (buttons.filter((button) => button.type === "FLOW").length > MAX_FLOW_BUTTONS) return t("form.validation.oneFlowButton");
  if (category === "AUTHENTICATION" && !buttons.some((b) => b.type === "OTP")) return t("form.validation.authNeedsOtpButton");
  return quickRepliesApart(buttons) ? t("form.validation.quickRepliesMustBeGrouped") : undefined;
}

export function validateDraftMessage(components: DraggableComponent[], category: TemplateCategory, t: Translate): DraftMessageProblems {
  const found: DraftMessageProblems = {
    header: headerProblem(components.find((c) => c.type === "HEADER"), category, t),
    body: bodyProblem(components.find((c) => c.type === "BODY"), category, t),
    footer: footerProblem(components.find((c) => c.type === "FOOTER"), t),
    buttons: buttonsProblem(components, category, t),
    format: computeParameterFormat(components) === "mixed" ? t("form.validation.mixedVariableFormat") : undefined,
  };
  return Object.fromEntries(Object.entries(found).filter(([, message]) => Boolean(message))) as DraftMessageProblems;
}

function textExample(component: DraggableComponent, kind: "header" | "body"): TemplateComponent["example"] {
  const text = component.data.text || "";
  const { type, variables } = detectVariables(text);
  if (variables.length === 0) return undefined;
  if (type === "named") {
    const named = component.data.namedVariableExamples || {};
    const params = variables.map((varName) => ({ param_name: varName, example: named[varName] || "" }));
    return kind === "header" ? { header_text_named_params: params } : { body_text_named_params: params };
  }
  if (!component.data.variableExamples) return undefined;
  const examples = variables.map((varNum) => component.data.variableExamples?.[parseInt(varNum) - 1] || "");
  if (!examples.some((e) => e)) return undefined;
  return kind === "header" ? { header_text: examples } : { body_text: [examples] };
}

function headerComponent(component: DraggableComponent, out: TemplateComponent): TemplateComponent {
  const format = component.data.format;
  if (!format) return out;
  out.format = format as HeaderFormat;
  if (format === "TEXT") {
    out.text = component.data.text;
    const example = textExample(component, "header");
    if (example) out.example = example;
    return out;
  }
  if (format === "LOCATION") {
    const location = [component.data.locationName, component.data.locationAddress].filter((part) => part?.trim()).join("\n");
    if (location) out.text = location;
  }
  if (isMediaHeaderFormat(format) && component.data.example) {
    out.example = { header_handle: [component.data.example] };
  }
  return out;
}

function templateButton(button: BuilderButton): TemplateButton {
  const out: TemplateButton = { type: button.type as ButtonType, text: button.text || "" };
  if (button.url) out.url = button.url;
  if (button.phone_number) out.phone_number = button.phone_number;
  if (button.example) out.example = button.type === "URL" ? [button.example] : button.example;
  if (button.type === "OTP") out.otp_type = (button.otp_type as OtpType) || "COPY_CODE";
  if (button.type === "FLOW") {
    out.flowId = button.flowId ?? "";
    out.flowAction = button.flowAction ?? "navigate";
    if (button.navigateScreen) out.navigateScreen = button.navigateScreen;
  }
  return out;
}

export function toTemplateComponents(draft: DraggableComponent[]): TemplateComponent[] {
  return draft.map((component) => {
    const out: TemplateComponent = { type: component.type };
    if (component.data.add_security_recommendation !== undefined) {
      out.add_security_recommendation = component.data.add_security_recommendation;
    }
    if (component.data.code_expiration_minutes !== undefined) {
      out.code_expiration_minutes = component.data.code_expiration_minutes;
    }
    if (component.type === "HEADER") return headerComponent(component, out);
    if (component.type === "BODY") {
      out.text = component.data.text;
      const example = textExample(component, "body");
      if (example) out.example = example;
    } else if (component.type === "FOOTER") {
      out.text = component.data.text;
    } else if (component.type === "BUTTONS" && component.data.buttons) {
      out.buttons = component.data.buttons.map(templateButton);
    }
    return out;
  });
}

function namedExamples(params: Array<{ param_name: string; example: string }> | undefined): Record<string, string> | undefined {
  if (!params || params.length === 0) return undefined;
  return Object.fromEntries(params.map((param) => [param.param_name, param.example]));
}

function flowFields(button: TemplateButton): Pick<BuilderButton, "flowId" | "flowAction" | "navigateScreen"> {
  return {
    ...(button.flowId ? { flowId: String(button.flowId) } : {}),
    flowAction: button.flowAction ?? "navigate",
    ...(button.navigateScreen ? { navigateScreen: button.navigateScreen } : {}),
  };
}

function draftData(component: TemplateComponent, headerMediaUrl: string | null | undefined): DraggableComponent["data"] {
  const example = component.example;
  const data: DraggableComponent["data"] = {
    format: component.format,
    text: component.text,
    variableExamples: component.parameters ?? example?.body_text?.[0] ?? example?.header_text,
    namedVariableExamples: namedExamples(example?.body_text_named_params ?? example?.header_text_named_params),
    add_security_recommendation: component.add_security_recommendation,
    code_expiration_minutes: component.code_expiration_minutes,
  };
  if (component.type === "HEADER" && component.format !== "TEXT") {
    data.text = undefined;
    data.example = headerMediaUrl ?? example?.header_handle?.[0];
  }
  if (component.type === "HEADER" && component.format === "LOCATION" && component.text) {
    const [locationName, locationAddress] = component.text.split("\n");
    data.locationName = locationName;
    data.locationAddress = locationAddress;
  }
  if (component.buttons && component.buttons.length > 0) {
    data.buttons = component.buttons.map((button, index) => ({
      id: `btn-${index}`,
      type: button.type,
      text: button.text,
      url: button.url,
      phone_number: button.phone_number,
      example: Array.isArray(button.example) ? button.example[0] : button.example,
      otp_type: button.otp_type,
      ...(button.type === "FLOW" ? flowFields(button) : {}),
    }));
  }
  return data;
}

export function toDraftComponents(components: TemplateComponent[], headerMediaUrl?: string | null): DraggableComponent[] {
  return components.map((component, index) => ({
    id: `${component.type}-${index}`,
    type: component.type,
    data: draftData(component, headerMediaUrl),
  }));
}

export function headerMediaOf(draft: DraggableComponent[]): string | undefined {
  const header = draft.find((c) => c.type === "HEADER");
  return header && isMediaHeaderFormat(header.data.format) ? header.data.example?.trim() || undefined : undefined;
}

export function replacedHeaderMedia(original: DraggableComponent[], draft: DraggableComponent[]): string | undefined {
  const next = headerMediaOf(draft);
  return next && next !== headerMediaOf(original) ? next : undefined;
}
