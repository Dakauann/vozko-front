import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { FormTriggerPreview, SendFormPreview } from "./node-previews/form-previews";
import { SendFormConfigSection } from "./send-form-config";

const listFormsAction = vi.fn();
vi.mock("@/app/actions/whatsapp-forms", () => ({
  listFormsAction: (...args: unknown[]) => listFormsAction(...args),
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
    <select aria-label={label} onChange={(event) => onValueChange(event.target.value, options.find((option) => option.value === event.target.value)!)}>
      <option value="" />
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("./variable-command-input", () => ({
  VariableCommandInput: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
    <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

const copy = ptMessages.workflowsPage.sendForm;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

function form(id: string, name: string, publishedVersionId?: string) {
  return {
    form: { id, workspaceId: "w1", name, kind: "built", draftVersionId: "d", createdAt: "", updatedAt: "", ...(publishedVersionId ? { publishedVersionId } : {}) },
    publications: [],
    sent: 0,
    responses: 0,
  };
}

beforeEach(() => {
  listFormsAction.mockReset();
  listFormsAction.mockResolvedValue({ data: [form("f1", "Captação", "v1"), form("f2", "Rascunho")], error: null });
});

describe("SendFormConfigSection", () => {
  it("lists only published forms and seeds the default copy on pick", async () => {
    const onChange = vi.fn();
    render(<SendFormConfigSection config={{}} onChange={onChange} availableVars={[]} fallbackTemplate={<span>fallback picker</span>} />, { wrapper });

    await waitFor(() => expect(screen.getByRole("option", { name: "Captação" })).toBeInTheDocument());
    expect(screen.queryByRole("option", { name: "Rascunho" })).toBeNull();
    expect(screen.getByText("fallback picker")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(copy.form), { target: { value: "f1" } });
    expect(onChange).toHaveBeenCalledWith({ form_id: "f1", _display_form_id: "Captação", body: copy.defaultBody, cta: copy.defaultCta });
  });

  it("edits the copy and stores the timeout in seconds", async () => {
    const onChange = vi.fn();
    render(
      <SendFormConfigSection
        config={{ form_id: "f1", body: "Olá", cta: "Abrir", timeout_seconds: 3600 }}
        onChange={onChange}
        availableVars={[]}
        fallbackTemplate={null}
      />,
      { wrapper },
    );
    await waitFor(() => expect(listFormsAction).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(`${copy.cta} *`), { target: { value: "Responder" } });
    expect(onChange).toHaveBeenCalledWith({ cta: "Responder" });
    expect(screen.getByDisplayValue("60")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("60"), { target: { value: "30" } });
    expect(onChange).toHaveBeenCalledWith({ timeout_seconds: 1800 });
    expect(screen.getByText("5/30")).toBeInTheDocument();
  });
});

describe("form node previews", () => {
  it("shows the form message on the canvas", () => {
    render(<SendFormPreview config={{ form_id: "f1", _display_form_id: "Captação", body: "Preencha", cta: "Abrir" }} />, { wrapper });
    expect(screen.getByText("Preencha")).toBeInTheDocument();
    expect(screen.getByText("Abrir · Captação")).toBeInTheDocument();
  });

  it("says any form when the trigger has no filter", () => {
    render(<FormTriggerPreview config={{ form_ids: [] }} />, { wrapper });
    expect(screen.getByText(ptMessages.workflowsPage.formTrigger.anyForm)).toBeInTheDocument();
  });
});
