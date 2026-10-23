import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { SendRiskNotice } from "../SendRiskNotice";

const t = ptMessages.campaignSendRisk;

function renderNotice(subject: "phone" | "template", risk: "fault" | "warning" | null) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <SendRiskNotice subject={subject} risk={risk} />
    </NextIntlClientProvider>,
  );
}

describe("SendRiskNotice", () => {
  it("shows nothing without a risk", () => {
    const { container } = renderNotice("phone", null);
    expect(container).toBeEmptyDOMElement();
  });

  it("alerts a faulty number as an alert and a template warning as a status", () => {
    renderNotice("phone", "fault");
    expect(screen.getByRole("alert")).toHaveTextContent(t.phone.fault.title);
  });

  it("warns about a medium quality template", () => {
    renderNotice("template", "warning");
    expect(screen.getByRole("status")).toHaveTextContent(t.template.warning.title);
  });
});
