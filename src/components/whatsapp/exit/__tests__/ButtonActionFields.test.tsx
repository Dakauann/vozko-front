import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ButtonActionChoice, ButtonActionKind } from "@/lib/whatsapp-templates/exit";

vi.mock("../use-action-param-options", () => ({
  TEAM_PREFIX: "team:",
  MEMBER_PREFIX: "user:",
  AGENT_PREFIX: "agent:",
  FLOW_PREFIX: "flow:",
  useDelegateOptions: () => ({
    options: [
      { value: "agent:agent-1", label: "Elo de vendas" },
      { value: "flow:wf-2", label: "Triagem" },
    ],
    loading: false,
    failed: false,
  }),
  useHandOffOptions: () => ({
    options: [
      { value: "team:dep-1", label: "Cobrança" },
      { value: "user:u-1", label: "Ana" },
    ],
    loading: false,
    failed: false,
  }),
  useWorkflowOptions: () => ({ options: [{ value: "wf-1", label: "Agenda" }], loading: false, failed: false }),
  useCallListOptions: () => ({ options: [], loading: false, failed: false }),
  useDealPipelineOptions: () => ({ options: [], loading: false, failed: false }),
  useDealStageOptions: () => ({ options: [], loading: false, failed: false }),
  useLeadSelectFields: () => ({ fields: [], loading: false, failed: false }),
}));

import { ButtonActionFields } from "../ButtonActionFields";

const t = ptMessages.templateExit;
const OFFERED: ButtonActionKind[] = ["opt_out", "hand_off", "start_workflow"];

const seen = vi.hoisted(() => ({ values: [] as unknown[] }));

function Harness({ initial = null, kinds = OFFERED }: { initial?: ButtonActionChoice | null; kinds?: ButtonActionKind[] }) {
  const [value, setValue] = useState<ButtonActionChoice | null>(initial);
  return (
    <ButtonActionFields
      value={value}
      kinds={kinds}
      onChange={(next) => {
        seen.values.push(next);
        setValue(next);
      }}
    />
  );
}

function renderFields(props: { initial?: ButtonActionChoice | null; kinds?: ButtonActionKind[] } = {}) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );
}

async function pick(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  seen.values = [];
});

describe("ButtonActionFields", () => {
  it("offers exactly the kinds it is given, plus no action", async () => {
    renderFields();
    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    const names = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(names).toEqual([t.kinds.none, t.kinds.opt_out, t.kinds.hand_off, t.kinds.start_workflow]);
  });

  it("keeps showing a stored kind the viewer may not set", async () => {
    renderFields({ initial: { kind: "create_deal", params: { pipelineId: "p", stageId: "s" }, confirmation: "" } });
    fireEvent.click(screen.getByRole("combobox", { name: t.action.label }));
    expect(await screen.findByRole("option", { name: t.kinds.create_deal })).toBeInTheDocument();
  });

  it("sets an opt-out with nothing prefilled", async () => {
    renderFields();
    await pick(t.action.label, t.kinds.opt_out);
    expect(seen.values.at(-1)).toEqual({ kind: "opt_out", params: {}, confirmation: "" });
    expect(screen.getByLabelText(t.action.confirmation)).toHaveValue("");
  });

  it("writes the confirmation the user types", async () => {
    renderFields({ initial: { kind: "opt_out", params: {}, confirmation: "" } });
    fireEvent.change(screen.getByLabelText(t.action.confirmation), { target: { value: "Você não recebe mais." } });
    expect(seen.values.at(-1)).toEqual({ kind: "opt_out", params: {}, confirmation: "Você não recebe mais." });
  });

  it("hands off to the team the user picks", async () => {
    renderFields();
    await pick(t.action.label, t.kinds.hand_off);
    fireEvent.click(screen.getByRole("button", { name: t.params.handOff }));
    fireEvent.click(await screen.findByText("Cobrança"));
    expect(seen.values.at(-1)).toEqual({ kind: "hand_off", params: { departmentId: "dep-1" }, confirmation: "" });
  });

  it("hands the conversation to the agent the user picks", async () => {
    renderFields({ kinds: ["delegate"] });
    await pick(t.action.label, t.kinds.delegate);
    fireEvent.click(screen.getByRole("button", { name: t.params.delegate }));
    fireEvent.click(await screen.findByText("Elo de vendas"));
    expect(seen.values.at(-1)).toEqual({ kind: "delegate", params: { agentId: "agent-1" }, confirmation: "" });
  });

  it("hands the conversation to the flow the user picks", async () => {
    renderFields({ kinds: ["delegate"] });
    await pick(t.action.label, t.kinds.delegate);
    fireEvent.click(screen.getByRole("button", { name: t.params.delegate }));
    fireEvent.click(await screen.findByText("Triagem"));
    expect(seen.values.at(-1)).toEqual({ kind: "delegate", params: { workflowId: "wf-2" }, confirmation: "" });
  });

  it("drops the previous kind's params when the kind changes", async () => {
    renderFields({ initial: { kind: "hand_off", params: { userId: "u-1" }, confirmation: "Ok" } });
    await pick(t.action.label, t.kinds.opt_out);
    expect(seen.values.at(-1)).toEqual({ kind: "opt_out", params: {}, confirmation: "Ok" });
  });

  it("clears the action when the user picks no action", async () => {
    renderFields({ initial: { kind: "opt_out", params: {}, confirmation: "" } });
    await pick(t.action.label, t.kinds.none);
    expect(seen.values.at(-1)).toBeNull();
  });

  it("asks for the consent purpose in the user's own words", async () => {
    renderFields({ initial: { kind: "consent_grant", params: {}, confirmation: "" }, kinds: ["consent_grant"] });
    const purpose = screen.getByLabelText(t.params.purpose);
    expect(purpose).toHaveValue("");
    fireEvent.change(purpose, { target: { value: "receber ofertas" } });
    expect(seen.values.at(-1)).toEqual({ kind: "consent_grant", params: { purpose: "receber ofertas" }, confirmation: "" });
  });
});
