import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";

import { AudienceConfirm } from "./AudienceConfirm";

const pt = brandedMessages(rawPt);
const copy = pt.carrierMessaging.pages.campaignEditor.review.audienceConfirm;
const filter = { groups: [] };

function wrap(node: ReactNode) {
  return (
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      {node}
    </NextIntlClientProvider>
  );
}

describe("AudienceConfirm", () => {
  it("asks for the typed count before sending to the whole base and hands back the backend fingerprint", () => {
    const onConfirm = vi.fn();
    render(wrap(<AudienceConfirm audience={{ mode: "everyone", expectedCount: 1200 }} estimate={{ recipients: 1200, audience_fingerprint: "fp-all" }} confirmed={null} onConfirm={onConfirm} />));
    expect(screen.getByText(copy.everyoneTitle)).toBeInTheDocument();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "1.199" } });
    expect(onConfirm).toHaveBeenLastCalledWith(null);
    fireEvent.change(input, { target: { value: "1.200" } });
    expect(onConfirm).toHaveBeenLastCalledWith({ count: 1200, fingerprint: "fp-all" });
  });

  it("shows the drift when the base changed since the count", () => {
    render(wrap(<AudienceConfirm audience={{ mode: "everyone", expectedCount: 1000 }} estimate={{ recipients: 1200, audience_fingerprint: "fp-all" }} confirmed={null} onConfirm={vi.fn()} />));
    expect(screen.getByRole("status")).toHaveTextContent("1.000");
    expect(screen.getByRole("status")).toHaveTextContent("1.200");
  });

  it("asks a filtered audience to accept its count even when nothing changed", () => {
    const onConfirm = vi.fn();
    render(wrap(<AudienceConfirm audience={{ mode: "all_matching", filter, expectedCount: 310 }} estimate={{ recipients: 310, audience_fingerprint: "fp-f" }} confirmed={null} onConfirm={onConfirm} />));
    expect(screen.getByText(copy.filteredTitle)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(onConfirm).toHaveBeenCalledWith({ count: 310, fingerprint: "fp-f" });
  });

  it("marks a filtered audience as accepted and flags a change", () => {
    const { rerender } = render(
      wrap(<AudienceConfirm audience={{ mode: "all_matching", filter, expectedCount: 300 }} estimate={{ recipients: 310, audience_fingerprint: "fp-f" }} confirmed={null} onConfirm={vi.fn()} />),
    );
    expect(screen.getByText(copy.changedTitle)).toBeInTheDocument();
    rerender(
      wrap(
        <AudienceConfirm
          audience={{ mode: "all_matching", filter, expectedCount: 300 }}
          estimate={{ recipients: 310, audience_fingerprint: "fp-f" }}
          confirmed={{ count: 310, fingerprint: "fp-f" }}
          onConfirm={vi.fn()}
        />,
      ),
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("asks nothing for picked ids or when the backend gave no fingerprint", () => {
    const { container, rerender } = render(wrap(<AudienceConfirm audience={{ mode: "ids", ids: ["l1"] }} estimate={{ recipients: 1, audience_fingerprint: "" }} confirmed={null} onConfirm={vi.fn()} />));
    expect(container).toBeEmptyDOMElement();
    rerender(wrap(<AudienceConfirm audience={{ mode: "all_matching", filter, expectedCount: 5 }} estimate={{ recipients: 5, audience_fingerprint: "" }} confirmed={null} onConfirm={vi.fn()} />));
    expect(container).toBeEmptyDOMElement();
  });
});
