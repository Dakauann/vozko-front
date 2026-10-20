import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import SendFormDialog from "../SendFormDialog";

const sendableFormsAction = vi.fn();
const sendFormInConversationAction = vi.fn();

vi.mock("@/app/actions/whatsapp-forms", () => ({
  sendableFormsAction: (...args: unknown[]) => sendableFormsAction(...args),
  sendFormInConversationAction: (...args: unknown[]) => sendFormInConversationAction(...args),
}));

vi.mock("@/components/elevated-design/elevated-command-select", () => ({
  ElevatedCommandSelect: ({
    label,
    options,
    onValueChange,
  }: {
    label: string;
    options: { value: string; label: string }[];
    onValueChange: (value: string, option: { value: string; label: string }) => void;
  }) => (
    <label>
      {label}
      <select aria-label={label} onChange={(event) => onValueChange(event.target.value, options.find((option) => option.value === event.target.value)!)}>
        <option value="" />
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const copy = ptMessages.crmComposer.form;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  sendableFormsAction.mockReset();
  sendFormInConversationAction.mockReset();
  sendableFormsAction.mockResolvedValue({
    data: [{ formId: "f1", name: "Captação", versionId: "v1", metaFlowId: "flow-1", firstScreen: "S_INICIO" }],
    error: null,
  });
});

async function pickForm() {
  const select = await screen.findByLabelText(copy.form);
  await waitFor(() => expect(screen.getByRole("option", { name: "Captação" })).toBeInTheDocument());
  fireEvent.change(select, { target: { value: "f1" } });
}

describe("SendFormDialog", () => {
  it("lists the forms of the conversation number and sends the default copy", async () => {
    const onOpenChange = vi.fn();
    sendFormInConversationAction.mockResolvedValue({ data: { id: "send-1" }, error: null });
    render(<SendFormDialog open onOpenChange={onOpenChange} entryId="entry-1" businessPhoneId="phone-1" />, { wrapper });

    expect(sendableFormsAction).toHaveBeenCalledWith({ phoneId: "phone-1" }, expect.any(AbortSignal));
    expect(screen.getByDisplayValue(copy.defaultBody)).toBeInTheDocument();
    expect(screen.getByDisplayValue(copy.defaultCta)).toBeInTheDocument();
    expect(screen.getByText(`${copy.defaultCta.length}/30`)).toBeInTheDocument();

    await pickForm();
    fireEvent.click(screen.getByRole("button", { name: copy.send }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(sendFormInConversationAction).toHaveBeenCalledWith("entry-1", "f1", { body: copy.defaultBody, cta: copy.defaultCta });
  });

  it("explains a closed window and offers the template dialog", async () => {
    const onOpenChange = vi.fn();
    const onUseTemplate = vi.fn();
    sendFormInConversationAction.mockResolvedValue({ data: null, error: { status: 409, code: "whatsapp_form_outside_window" } });
    render(
      <SendFormDialog open onOpenChange={onOpenChange} entryId="entry-1" businessPhoneId="phone-1" onUseTemplate={onUseTemplate} />,
      { wrapper },
    );

    await pickForm();
    fireEvent.click(screen.getByRole("button", { name: copy.send }));

    expect(await screen.findByText(copy.outsideWindow.title)).toBeInTheDocument();
    expect(screen.getByText(copy.outsideWindow.text)).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: copy.outsideWindow.useTemplate }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onUseTemplate).toHaveBeenCalled();
  });

  it("shows the coded refusal for other failures", async () => {
    sendFormInConversationAction.mockResolvedValue({ data: null, error: { status: 422, code: "whatsapp_form_copy_invalid" } });
    render(<SendFormDialog open onOpenChange={vi.fn()} entryId="entry-1" businessPhoneId="phone-1" />, { wrapper });

    await pickForm();
    fireEvent.click(screen.getByRole("button", { name: copy.send }));

    expect(await screen.findByText(copy.errors.whatsapp_form_copy_invalid)).toBeInTheDocument();
    expect(screen.queryByText(copy.outsideWindow.title)).toBeNull();
  });
});
