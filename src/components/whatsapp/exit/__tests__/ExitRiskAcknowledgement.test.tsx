import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { ExitRiskAcknowledgement } from "../ExitRiskAcknowledgement";

const t = ptMessages.templateExit.risk;

function Harness() {
  const [checked, setChecked] = useState(false);
  return (
    <>
      <ExitRiskAcknowledgement checked={checked} onCheckedChange={setChecked} />
      <output>{checked ? "acknowledged" : "pending"}</output>
    </>
  );
}

function renderHarness() {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <Harness />
    </NextIntlClientProvider>,
  );
}

describe("ExitRiskAcknowledgement", () => {
  it("lists every risk the user takes by going on without an exit", () => {
    renderHarness();
    expect(screen.getByText(t.policy)).toBeInTheDocument();
    expect(screen.getByText(t.quality)).toBeInTheDocument();
    expect(screen.getByText(t.lgpd)).toBeInTheDocument();
    expect(screen.getByText(t.recorded)).toBeInTheDocument();
  });

  it("starts unticked and reports the tick the user gives", () => {
    renderHarness();
    const box = screen.getByRole("checkbox", { name: t.confirm });
    expect(box).not.toBeChecked();
    expect(screen.getByText("pending")).toBeInTheDocument();
    fireEvent.click(box);
    expect(box).toBeChecked();
    expect(screen.getByText("acknowledged")).toBeInTheDocument();
  });
});
