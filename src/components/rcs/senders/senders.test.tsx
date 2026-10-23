import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({ uploadMediaAction: vi.fn() }));
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));

import rawPt from "@/i18n/messages/pt.json";
import type { CodedRefusal } from "@/lib/api/coded-error";
import { EMPTY_SENDER_INPUT, senderInputOf } from "@/lib/rcs/sender-form";
import { senderFixture } from "@/lib/rcs/test-fixtures";
import type { RcsSenderInput } from "@/lib/rcs/types";
import { brandedMessages } from "@/test/branded-messages";

import { SenderForm } from "./SenderForm";
import { SenderStatusTrack } from "./SenderStatusTrack";

const pt = brandedMessages(rawPt);
const copy = pt.rcs.senders;

function withIntl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      {node}
    </NextIntlClientProvider>
  );
}

describe("SenderStatusTrack", () => {
  it("puts a rejected sender back on the draft step with the carriers' reason", () => {
    render(withIntl(<SenderStatusTrack sender={senderFixture({ status: "rejected", status_reason: "Logo ilegível" })} />));
    expect(screen.getByRole("alert")).toHaveTextContent(copy.track.rejectedTitle);
    expect(screen.getByRole("alert")).toHaveTextContent("Logo ilegível");
    expect(screen.getByText(copy.track.now.rejected)).toBeInTheDocument();
  });

  it("marks the current step and explains a carrier pause", () => {
    render(withIntl(<SenderStatusTrack sender={senderFixture({ status: "paused", paused_by: "carrier", pause_reason: "carrier" })} />));
    const current = document.querySelector('[aria-current="step"]');
    expect(current).toHaveTextContent(copy.status.paused);
    expect(screen.getByText(copy.track.now.pausedBy.carrier)).toBeInTheDocument();
    expect(screen.getByText(copy.track.now.pauseReasons.carrier)).toBeInTheDocument();
  });

  it("names the inbox the brand must confirm from", () => {
    render(withIntl(<SenderStatusTrack sender={senderFixture({ status: "awaiting_confirmation" })} />));
    expect(screen.getByText(/ana@padariasol\.com\.br/)).toBeInTheDocument();
  });
});

function FormHarness({ initial, error, onSeen }: { initial: RcsSenderInput; error?: CodedRefusal; onSeen?: (input: RcsSenderInput) => void }) {
  const [value, setValue] = useState(initial);
  onSeen?.(value);
  return withIntl(<SenderForm value={value} onChange={setValue} error={error} suggestedDescription="A plataforma envia avisos em nome de Padaria Sol." />);
}

describe("SenderForm", () => {
  it("shows the backend refusal next to the field it names", () => {
    render(<FormHarness initial={senderInputOf(senderFixture())} error={{ code: "rcs_contact_email_domain", message: "x" }} />);
    expect(screen.getByText(pt.rcs.errors.rcs_contact_email_domain)).toBeInTheDocument();
    expect(screen.queryByText(copy.form.errorTitle)).not.toBeInTheDocument();
  });

  it("shows a refusal without a field as a notice", () => {
    render(<FormHarness initial={EMPTY_SENDER_INPUT} error={{ code: "carrier_provider_unavailable", message: "x" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(pt.carrierMessaging.errors.carrier_provider_unavailable);
  });

  it("explains the sectors carriers refuse and asks betting brands for the authorization", () => {
    const { rerender } = render(<FormHarness initial={{ ...EMPTY_SENDER_INPUT, sector: "political" }} />);
    expect(screen.getByText(copy.form.sectorNotices.political.title)).toBeInTheDocument();
    rerender(<FormHarness key="gambling" initial={{ ...EMPTY_SENDER_INPUT, sector: "gambling" }} />);
    expect(screen.getByText(copy.form.sectorNotices.gambling.title)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.form.use.gamblingAuthorization)).toBeInTheDocument();
  });

  it("masks the CNPJ while storing only its digits", () => {
    let seen: RcsSenderInput = EMPTY_SENDER_INPUT;
    render(<FormHarness initial={EMPTY_SENDER_INPUT} onSeen={(input) => (seen = input)} />);
    fireEvent.change(screen.getByLabelText(copy.form.company.cnpj), { target: { value: "11222333000181" } });
    expect(screen.getByLabelText(copy.form.company.cnpj)).toHaveValue("11.222.333/0001-81");
    expect(seen.cnpj).toBe("11222333000181");
  });

  it("offers the backend description suggestion", () => {
    let seen: RcsSenderInput = EMPTY_SENDER_INPUT;
    render(<FormHarness initial={EMPTY_SENDER_INPUT} onSeen={(input) => (seen = input)} />);
    fireEvent.click(screen.getByRole("button", { name: copy.form.brand.useSuggestion }));
    expect(seen.description).toBe("A plataforma envia avisos em nome de Padaria Sol.");
  });

  it("previews the brand profile live", () => {
    render(<FormHarness initial={{ ...EMPTY_SENDER_INPUT, brand_name: "Padaria Sol", website_url: "https://sol.example" }} />);
    expect(screen.getAllByText("Padaria Sol").length).toBeGreaterThan(0);
    expect(screen.getByText("https://sol.example")).toBeInTheDocument();
  });
});
