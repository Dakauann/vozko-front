import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ checkSmsTextAction: vi.fn(), smsTextToGsmAction: vi.fn() }));

vi.mock("@/app/actions/sms", () => actions);
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));

import rawPt from "@/i18n/messages/pt.json";
import type { VariableBinding } from "@/lib/leads/sends";
import type { SmsTextCheck } from "@/lib/sms/types";
import { brandedMessages } from "@/test/branded-messages";

import { SmsComposer } from "./SmsComposer";
import { SmsPhonePreview } from "./SmsPhonePreview";

const pt = brandedMessages(rawPt);
const copy = pt.sms;

const UNICODE: SmsTextCheck = {
  measurement: { encoding: "ucs2", units: 74, segments: 2, per_segment: 67, remaining: 60 },
  composed_text: "Loja: Olá, sua entrega chegou!",
  variable_slots: 0,
  issues: [],
  price: { charge_kind: "sms_segment", unit_micros: 20000, quantity: 2, total_micros: 40000 },
};

const latest = { text: "", bindings: [] as VariableBinding[] };

function Harness({ initial, compact = false }: { initial: string; compact?: boolean }) {
  const [text, setText] = useState(initial);
  const [bindings, setBindings] = useState<VariableBinding[]>([]);
  return (
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <SmsComposer
        value={text}
        onChange={(next) => {
          latest.text = next;
          setText(next);
        }}
        bindings={bindings}
        onBindingsChange={(next) => {
          latest.bindings = next;
          setBindings(next);
        }}
        brandPrefix="Loja"
        sender="29090"
        compact={compact}
      />
    </NextIntlClientProvider>
  );
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}

describe("SmsComposer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    latest.text = "";
    latest.bindings = [];
    actions.checkSmsTextAction.mockReset();
    actions.smsTextToGsmAction.mockReset();
    actions.checkSmsTextAction.mockResolvedValue({ data: UNICODE, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the brand prefix as a locked chip and the backend measurement", async () => {
    render(<Harness initial="Olá, sua entrega chegou!" />);
    expect(screen.getByText("Loja:")).toBeInTheDocument();
    await settle();
    expect(actions.checkSmsTextAction.mock.calls[0][0]).toEqual({ text: "Olá, sua entrega chegou!" });
    expect(screen.getByText(/^Com acentos · 2 partes · 60 livres · R\$\s0,20$/)).toBeInTheDocument();
    expect(screen.getByText(UNICODE.composed_text)).toBeInTheDocument();
  });

  it("removes the accents through the backend", async () => {
    actions.smsTextToGsmAction.mockResolvedValue({ data: { text: "Ola, sua entrega chegou!" }, error: null });
    render(<Harness initial="Olá, sua entrega chegou!" />);
    await settle();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: copy.composer.removeAccents }));
    });
    expect(actions.smsTextToGsmAction).toHaveBeenCalledWith({ text: "Olá, sua entrega chegou!" });
    expect(latest.text).toBe("Ola, sua entrega chegou!");
  });

  it("shows a text issue from the backend under the field", async () => {
    actions.checkSmsTextAction.mockResolvedValue({ data: { ...UNICODE, issues: [{ code: "sms_text_too_long" }] }, error: null });
    render(<Harness initial="Texto longo" />);
    await settle();
    expect(screen.getByText(copy.errors.sms_text_too_long)).toBeInTheDocument();
  });

  it("drops the preview in compact mode", async () => {
    render(<Harness initial="Oi" compact />);
    await settle();
    expect(screen.queryByText(copy.preview.label)).not.toBeInTheDocument();
    expect(screen.getByText(/^Com acentos · 2 partes/)).toBeInTheDocument();
  });

  it("binds a friendly field to a positional slot", () => {
    render(<Harness initial="Oi" />);
    fireEvent.click(screen.getByRole("button", { name: "Inserir Primeiro nome" }));
    expect(latest.text).toBe("Oi {{1}}");
    expect(latest.bindings).toEqual([{ source: "lead.first_name" }]);
  });
});

describe("SmsPhonePreview", () => {
  it("shows the text from a short code and switches to the iPhone look", () => {
    const { container } = render(
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <SmsPhonePreview text="Loja: Oi {{1}}" values={["[Nome]"]} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Loja: Oi [Nome]")).toBeInTheDocument();
    expect(screen.getByText(copy.preview.senderFallback)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: pt.carrierMessaging.preview.platforms.ios }));
    expect(container.querySelector("figcaption")?.textContent).toBe(copy.preview.frame.ios);
  });
});
