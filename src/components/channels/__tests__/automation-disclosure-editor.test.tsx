import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { AutomationDisclosureEditor } from "@/components/channels/automation-disclosure-editor";
import ptMessages from "@/i18n/messages/pt.json";

const copy = ptMessages.facebook.automation;

function renderEditor(props: Partial<Parameters<typeof AutomationDisclosureEditor>[0]> = {}) {
  const onSave = props.onSave ?? vi.fn().mockResolvedValue({ saved: "Olá" });
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <AutomationDisclosureEditor value="" translationNamespace="facebook.automation" onSave={onSave} {...props} />
    </NextIntlClientProvider>,
  );
  return { onSave, box: screen.getByPlaceholderText(copy.disclosurePlaceholder), save: screen.getByRole("button", { name: copy.disclosureSave }) };
}

describe("AutomationDisclosureEditor", () => {
  it("saves the trimmed text once it changed", async () => {
    const { onSave, box, save } = renderEditor();
    expect(save).toBeDisabled();
    fireEvent.change(box, { target: { value: "  Olá  " } });
    fireEvent.click(save);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Olá"));
    expect(await screen.findByText(copy.saved)).toBeInTheDocument();
  });

  it("shows the save error", async () => {
    const { box, save } = renderEditor({ onSave: vi.fn().mockResolvedValue({ error: "Recusado" }) });
    fireEvent.change(box, { target: { value: "Olá" } });
    fireEvent.click(save);
    expect(await screen.findByText("Recusado")).toBeInTheDocument();
  });

  it("blocks the save while the channel check refuses the text, and shows why", () => {
    const check = (text: string) => ({ blocked: text.includes("x"), feedback: text.includes("x") ? <span>sem x</span> : null });
    const { box, save } = renderEditor({ check });
    fireEvent.change(box, { target: { value: "xis" } });
    expect(screen.getByText("sem x")).toBeInTheDocument();
    expect(save).toBeDisabled();
    fireEvent.change(box, { target: { value: "ok" } });
    expect(screen.queryByText("sem x")).not.toBeInTheDocument();
    expect(save).toBeEnabled();
  });
});
