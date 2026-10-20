import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { FLOW_BUTTON_TEXT_LIMIT } from "@/lib/whatsapp-templates/builder";
import { BUTTON_ACTION_KINDS } from "@/lib/whatsapp-templates/exit";
import { toDraftComponents, toTemplateComponents, validateDraftMessage } from "@/lib/whatsapp-templates/draft";

import ComponentEditor, { type FormButtonSource } from "../ComponentEditor";
import type { DraggableComponent } from "../DragDropBuilder";

const sendableFormsAction = vi.fn();
vi.mock("@/app/actions/whatsapp-forms", () => ({
  sendableFormsAction: (...args: unknown[]) => sendableFormsAction(...args),
}));

vi.mock("@/components/elevated-design/elevated-command-select", () => ({
  ElevatedCommandSelect: ({
    label,
    options,
    onValueChange,
    disabled,
  }: {
    label: string;
    options: { value: string; label: string }[];
    onValueChange: (value: string, option: { value: string; label: string }) => void;
    disabled?: boolean;
  }) => (
    <select aria-label={label} disabled={disabled} onChange={(event) => onValueChange(event.target.value, options.find((option) => option.value === event.target.value)!)}>
      <option value="" />
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

const buttons = ptMessages.whatsappTemplates.form.editor.buttons;
const onChange = vi.fn();

const NUMBER_FORMS: FormButtonSource = { query: { phoneId: "phone-1" } };

function renderEditor(component: DraggableComponent, forms: FormButtonSource | null = NUMBER_FORMS) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ComponentEditor component={component} onChange={onChange} category="MARKETING" allowedKinds={BUTTON_ACTION_KINDS} forms={forms ?? undefined} />
    </NextIntlClientProvider>,
  );
}

function addChip(label: string) {
  return screen.getAllByRole("button").find((button) => button.textContent?.trim() === label);
}

beforeEach(() => {
  onChange.mockReset();
  sendableFormsAction.mockReset();
  sendableFormsAction.mockResolvedValue({
    data: [{ formId: "f1", name: "Captação", versionId: "v1", metaFlowId: "flow-1", firstScreen: "S_INICIO" }],
    error: null,
  });
});

describe("FLOW button", () => {
  it("offers the form button type and adds it with the navigate action", () => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [] } });
    fireEvent.click(addChip(buttons.types.flow)!);
    const added = onChange.mock.calls[0][0] as DraggableComponent;
    expect(added.data.buttons?.[0]).toMatchObject({ type: "FLOW", text: "", flowAction: "navigate" });
  });

  it("hides the form button type when forms are not available to this viewer", () => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [] } }, null);
    expect(addChip(buttons.types.flow)).toBeUndefined();
  });

  it("allows only one form button per template", () => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [{ id: "f", type: "FLOW", text: "Responder", flowId: "flow-1" }] } });
    const chip = addChip(buttons.types.flow)!;
    expect(chip).toBeDisabled();
    expect(chip).toHaveAttribute("title", buttons.flow.onlyOne);
    fireEvent.click(chip);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("picks a form of the template number and stores its flow and first screen", async () => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [{ id: "f", type: "FLOW", text: "Responder", flowAction: "navigate" }] } });
    expect(sendableFormsAction).toHaveBeenCalledWith({ phoneId: "phone-1" }, expect.any(AbortSignal));
    const select = screen.getByLabelText(buttons.flow.form);
    await waitFor(() => expect(screen.getByRole("option", { name: "Captação" })).toBeInTheDocument());
    fireEvent.change(select, { target: { value: "f1" } });
    const updated = onChange.mock.calls.at(-1)?.[0] as DraggableComponent;
    expect(updated.data.buttons?.[0]).toMatchObject({ flowId: "flow-1", flowAction: "navigate", navigateScreen: "S_INICIO", formName: "Captação" });
  });

  it("caps the button text at 25 characters", () => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [{ id: "f", type: "FLOW", text: "Responder" }] } });
    expect(screen.getByDisplayValue("Responder")).toHaveAttribute("maxLength", String(FLOW_BUTTON_TEXT_LIMIT));
    expect(FLOW_BUTTON_TEXT_LIMIT).toBe(25);
  });

  it("asks for a number before listing forms", () => {
    renderEditor({ id: "b", type: "BUTTONS", data: { buttons: [{ id: "f", type: "FLOW", text: "Responder" }] } }, { query: null });
    expect(sendableFormsAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText(buttons.flow.form)).toBeDisabled();
    expect(screen.getAllByText(buttons.flow.needsNumber).length).toBeGreaterThan(0);
  });
});

describe("FLOW button draft", () => {
  const t = (key: string, values?: Record<string, string | number>) => `${key}${values ? JSON.stringify(values) : ""}`;
  const flow = { id: "f", type: "FLOW", text: "Responder", flowId: "flow-1", flowAction: "navigate" as const, navigateScreen: "S_INICIO", formName: "Captação" };

  it("sends the flow fields and drops the display name", () => {
    const [component] = toTemplateComponents([{ id: "b", type: "BUTTONS", data: { buttons: [flow] } }]);
    expect(component.buttons).toEqual([{ type: "FLOW", text: "Responder", flowId: "flow-1", flowAction: "navigate", navigateScreen: "S_INICIO" }]);
  });

  it("reads the flow fields back from a saved template", () => {
    const [draft] = toDraftComponents([
      { type: "BUTTONS", buttons: [{ type: "FLOW", text: "Responder", flowId: "flow-1", flowAction: "navigate", navigateScreen: "S_INICIO" }] },
    ]);
    expect(draft.data.buttons?.[0]).toMatchObject({ type: "FLOW", flowId: "flow-1", navigateScreen: "S_INICIO" });
  });

  it("refuses a form button without a form and a second form button", () => {
    const missing = validateDraftMessage([{ id: "b", type: "BUTTONS", data: { buttons: [{ ...flow, flowId: "" }] } }], "MARKETING", t);
    expect(missing.buttons).toContain("form.validation.flowButtonRequiresForm");
    const twice = validateDraftMessage([{ id: "b", type: "BUTTONS", data: { buttons: [flow, { ...flow, id: "g" }] } }], "MARKETING", t);
    expect(twice.buttons).toBe("form.validation.oneFlowButton");
  });
});
