import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ExitVerdict } from "@/lib/whatsapp-templates/exit";

import { ButtonDestinations } from "../ButtonDestinations";
import { ExitVerdictNotice } from "../ExitVerdictNotice";

const t = ptMessages.templateExit;

const exitAction = { buttonIndex: 1, buttonText: "SAIR", kind: "opt_out" as const, params: {}, confirmation: "", stale: false, version: 2 };
const handOff = { buttonIndex: 0, buttonText: "Falar com atendente", kind: "hand_off" as const, params: { departmentId: "d" }, confirmation: "", stale: false, version: 2 };

const OK: ExitVerdict = {
  state: "ok",
  buttons: [
    { index: 0, text: "Falar com atendente", action: handOff, source: "template", stale: false },
    { index: 1, text: "SAIR", action: exitAction, source: "template", stale: false },
  ],
  exitWords: ["sair"],
  templateExitRequired: false,
  campaignAcknowledgementRequired: false,
};

function wrap(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("ExitVerdictNotice", () => {
  it("lists the exits the lead sees when the template has one", () => {
    wrap(<ExitVerdictNotice verdict={OK} />);
    expect(screen.getByText(t.verdict.ok)).toBeInTheDocument();
    expect(screen.getByText(t.verdict.buttonExit.replace("{text}", "SAIR").replace("{action}", t.kinds.opt_out))).toBeInTheDocument();
    expect(screen.getByText(t.verdict.shownWords.replace("{words}", "/sair"))).toBeInTheDocument();
    expect(screen.queryByText(/Falar com atendente/)).not.toBeInTheDocument();
  });

  it("warns when the lead sees no exit", () => {
    wrap(<ExitVerdictNotice verdict={{ ...OK, state: "none", buttons: [], exitWords: [], campaignAcknowledgementRequired: true }} />);
    expect(screen.getByText(t.verdict.none)).toBeInTheDocument();
    expect(screen.getByText(t.verdict.noneDescription)).toBeInTheDocument();
  });
});

describe("ButtonDestinations", () => {
  it("says what each button does, no action until set, and the change for this send", () => {
    const buttons = [...OK.buttons, { index: 2, text: "Ver horários", action: null, stale: false }];
    wrap(<ButtonDestinations buttons={buttons} overrides={{ 0: { kind: "start_workflow", params: { workflowId: "wf" }, confirmation: "" } }} />);
    const line = (text: string, action: string) => t.campaign.destination.replace("{text}", text).replace("{action}", action);
    const overridden = screen.getByRole("listitem", { name: line("Falar com atendente", t.kinds.start_workflow) });
    expect(overridden).toHaveAttribute("data-state", "linked");
    expect(within(overridden).getByText("Falar com atendente")).toBeInTheDocument();
    expect(within(overridden).getByText(t.kinds.start_workflow)).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: line("SAIR", t.kinds.opt_out) })).toHaveAttribute("data-state", "linked");
    expect(screen.getByRole("listitem", { name: line("Ver horários", t.builder.noAction) })).toHaveAttribute("data-state", "open");
  });

  it("shows the CTR of each quick reply beside it when the template has clicks", () => {
    const clicks = {
      sends: 50,
      clickedPrompts: 20,
      clickRate: 4000,
      freeText: { count: 0, rate: 0 },
      options: [{ optionId: "template_button:0", shown: 50, clicks: 20, ctr: 4000, tracked: true }],
    };
    wrap(<ButtonDestinations buttons={OK.buttons} clicks={clicks} />);
    const line = (text: string, action: string) => t.campaign.destination.replace("{text}", text).replace("{action}", action);
    expect(screen.getByRole("listitem", { name: line("Falar com atendente", t.kinds.hand_off) })).toHaveTextContent("CTR 40,0%");
    expect(screen.getByRole("listitem", { name: line("SAIR", t.kinds.opt_out) })).toHaveTextContent("CTR n/d");
  });
});
