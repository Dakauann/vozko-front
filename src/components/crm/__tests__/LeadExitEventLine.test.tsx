import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { LeadExitEventLine } from "../LeadExitEventLine";

const t = ptMessages.leadExit.events;

function show(type: string, details: Record<string, string>) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LeadExitEventLine type={type} details={details} />
    </NextIntlClientProvider>,
  );
}

describe("LeadExitEventLine", () => {
  it("reads like the agreed line: the tap, what it recorded and the one confirmation", () => {
    show("lead_exit_action", { trigger: "button", kind: "opt_out", outcome: "changed", button_text: "SAIR", confirmation: "sent" });
    expect(screen.getByText("Tocou SAIR: opt-out registrado")).toBeInTheDocument();
    expect(screen.getByText(t.confirmation.sent)).toBeInTheDocument();
  });

  it("names the typed word and a coded refusal in words", () => {
    show("lead_exit_action", { trigger: "workspace_word", kind: "start_workflow", outcome: "refused", word: "parar", reason: "workflow_not_active" });
    expect(screen.getByText(`Respondeu /parar: ${t.refused}`)).toBeInTheDocument();
    expect(screen.getByText(t.reason.replace("{reason}", t.reasons.workflow_not_active))).toBeInTheDocument();
  });

  it.each([
    "workflow_not_found",
    "workflow_not_active",
    "workflow_type_invalid",
    "workflow_no_trigger",
    "call_list_lead_not_admitted",
    "call_list_not_found",
    "call_list_not_active",
    "call_list_full",
  ])("says in words why a tap was refused: %s", (reason) => {
    show("lead_exit_action", { trigger: "button", kind: "call_list", outcome: "refused", button_text: "Me ligue", reason });
    const copy = (t.reasons as Record<string, string>)[reason];
    expect(copy).toBeTruthy();
    expect(screen.getByText(t.reason.replace("{reason}", copy))).toBeInTheDocument();
  });

  it.each(["workflow_workspace_at_capacity", "call_list_building"])("says a retried failure in words: %s", (reason) => {
    show("lead_exit_action", { trigger: "button", kind: "start_workflow", outcome: "failed", button_text: "Quero", reason });
    expect(screen.getByText(`Tocou Quero: ${t.failed}`)).toBeInTheDocument();
    expect(screen.getByText(t.reason.replace("{reason}", (t.reasons as Record<string, string>)[reason]))).toBeInTheDocument();
  });

  it("shows an unknown reason code as it came", () => {
    show("lead_exit_action", { trigger: "button", kind: "opt_out", outcome: "failed", button_text: "SAIR", reason: "lead_consent_actor_invalid" });
    expect(screen.getByText(t.reason.replace("{reason}", "lead_consent_actor_invalid"))).toBeInTheDocument();
  });

  it("says a workflow send was refused because the lead does not receive", () => {
    show("lead_send_refused", { workflow_id: "wf-1", run_id: "run-1", node_id: "send_1", reason: "lead_opted_out", lead_id: "lead-1" });
    expect(screen.getByText(t.sendRefused.lead_opted_out)).toBeInTheDocument();
  });

  it("renders nothing for other events", () => {
    const { container } = show("assigned", {});
    expect(container).toBeEmptyDOMElement();
  });
});
