import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { AgentOptOutNote } from "../AgentOptOutNote";

const note = ptMessages.leadExit.agentNote;
const risk = ptMessages.templateExit.risk;
const optOut = { name: "record_opt_out", displayName: "Registrar opt-out" };

function renderNote(props: Partial<Parameters<typeof AgentOptOutNote>[0]> = {}) {
  const onAdd = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <AgentOptOutNote tools={[optOut]} selected={[]} onAdd={onAdd} {...props} />
    </NextIntlClientProvider>,
  );
  return onAdd;
}

describe("AgentOptOutNote", () => {
  it("explains, with the shared risk list, what happens without the opt-out skill", () => {
    renderNote();
    expect(screen.getByText(note.title.replace("{name}", "Registrar opt-out"))).toBeInTheDocument();
    expect(screen.getByText(note.body)).toBeInTheDocument();
    for (const item of [risk.policy, risk.quality, risk.lgpd]) expect(screen.getByText(item)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("adds the skill only when the author asks", () => {
    const onAdd = renderNote();
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: note.add.replace("{name}", "Registrar opt-out") }));
    expect(onAdd).toHaveBeenCalledWith(optOut);
  });

  it("is not shown once the agent has the skill or when the server does not offer it", () => {
    const { container } = render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <AgentOptOutNote tools={[optOut]} selected={[{ name: "record_opt_out" }]} onAdd={vi.fn()} />
        <AgentOptOutNote tools={[]} selected={[]} onAdd={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
