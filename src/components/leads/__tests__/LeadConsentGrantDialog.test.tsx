import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const leadActions = vi.hoisted(() => ({ grantLeadConsentAction: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/app/actions/leads", () => leadActions);
vi.mock("sonner", () => ({ toast }));

import { LeadConsentGrantDialog } from "../LeadConsentGrantDialog";

const t = ptMessages.leadExit.regrant;
const record = { id: "lead-1", workspaceId: "ws-1", number: "5511900010142", version: 8 };

function renderDialog() {
  const onRecorded = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LeadConsentGrantDialog leadId="lead-1" onOpenChange={onOpenChange} onRecorded={onRecorded} />
    </NextIntlClientProvider>,
  );
  return { onRecorded, onOpenChange };
}

beforeEach(() => {
  leadActions.grantLeadConsentAction.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
});

describe("LeadConsentGrantDialog", () => {
  it("needs a note saying how the lead gave permission again", () => {
    renderDialog();
    expect(screen.getByText(t.description)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.confirm })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(t.note), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: t.confirm })).toBeDisabled();
  });

  it("records a manual grant through the consent route with the note and the optional purpose", async () => {
    leadActions.grantLeadConsentAction.mockResolvedValue({ lead: record, changed: true, error: null });
    const { onRecorded } = renderDialog();
    fireEvent.change(screen.getByLabelText(t.note), { target: { value: "Pediu por telefone para voltar a receber" } });
    fireEvent.change(screen.getByLabelText(t.purpose), { target: { value: "ofertas" } });
    fireEvent.click(screen.getByRole("button", { name: t.confirm }));

    await waitFor(() =>
      expect(leadActions.grantLeadConsentAction).toHaveBeenCalledWith("lead-1", { note: "Pediu por telefone para voltar a receber", purpose: "ofertas" }),
    );
    expect(onRecorded).toHaveBeenCalledWith(record);
    expect(toast.success).toHaveBeenCalledWith(t.done);
  });

  it("explains a refusal with its code", async () => {
    leadActions.grantLeadConsentAction.mockResolvedValue({ lead: null, error: { status: 400, code: "lead_consent_excerpt_too_long", message: "x" } });
    const { onRecorded } = renderDialog();
    fireEvent.change(screen.getByLabelText(t.note), { target: { value: "nota" } });
    fireEvent.click(screen.getByRole("button", { name: t.confirm }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(t.failed, { description: ptMessages.leads.errors.lead_consent_excerpt_too_long }));
    expect(onRecorded).not.toHaveBeenCalled();
  });
});
