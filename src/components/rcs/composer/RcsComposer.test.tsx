import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ checkRcsContentAction: vi.fn(), resolveRcsMediaAction: vi.fn() }));

vi.mock("@/app/actions/rcs", () => actions);
const smsActions = vi.hoisted(() => ({ checkSmsTextAction: vi.fn(), smsTextToGsmAction: vi.fn() }));
vi.mock("@/app/actions/sms", () => smsActions);
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: () => 5 }));
vi.mock("@/hooks/use-lead-field-definitions", () => ({ useLeadFieldDefinitions: () => ({ definitions: [] }) }));

import rawPt from "@/i18n/messages/pt.json";
import type { VariableBinding } from "@/lib/leads/sends";
import type { RcsContent, RcsContentCheck } from "@/lib/rcs/types";
import { brandedMessages } from "@/test/branded-messages";

import { FallbackFields } from "./FallbackFields";
import { RcsComposer } from "./RcsComposer";

const pt = brandedMessages(rawPt);
const copy = pt.rcs.composer;

const VERDICT: RcsContentCheck = {
  kind: "text",
  billing_class: "basic",
  variable_slots: 1,
  issues: [{ code: "rcs_text_too_long", path: "text" }],
  price: { charge_kind: "rcs_basic", unit_micros: 15000, quantity: 1, total_micros: 15000 },
};

const latest: { content: RcsContent; bindings: VariableBinding[] } = { content: {}, bindings: [] };

function Harness({ initial }: { initial: RcsContent }) {
  const [content, setContent] = useState<RcsContent>(initial);
  const [bindings, setBindings] = useState<VariableBinding[]>([]);
  return (
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      <RcsComposer
        value={content}
        onChange={(next) => {
          latest.content = next;
          setContent(next);
        }}
        bindings={bindings}
        onBindingsChange={(next) => {
          latest.bindings = next;
          setBindings(next);
        }}
        agent={{ name: "Padaria Sol" }}
      />
    </NextIntlClientProvider>
  );
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(600);
  });
}

describe("RcsComposer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    latest.content = {};
    latest.bindings = [];
    actions.checkRcsContentAction.mockReset();
    actions.checkRcsContentAction.mockResolvedValue({ data: VERDICT, error: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the backend price and the issue next to the field it belongs to", async () => {
    render(<Harness initial={{ text: "Oi {{1}}" }} />);
    await settle();
    expect(screen.getByText(/^Mensagem básica · R\$\s0,08$/)).toBeInTheDocument();
    expect(screen.getByText(pt.rcs.errors.rcs_text_too_long)).toBeInTheDocument();
    expect(screen.getByText(pt.carrierMessaging.variables.title)).toBeInTheDocument();
  });

  it("inserts a friendly field as a positional slot and binds it", async () => {
    render(<Harness initial={{ text: "Oi" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Inserir Primeiro nome" }));
    expect(latest.content.text).toBe("Oi {{1}}");
    expect(latest.bindings).toEqual([{ source: "lead.first_name" }]);
  });

  it("moves the text into the card when the format becomes a card", () => {
    render(<Harness initial={{ text: "Promoção de pão" }} />);
    fireEvent.click(screen.getByRole("button", { name: pt.rcs.kinds.rich_card }));
    expect(latest.content).toEqual({ cards: [{ description: "Promoção de pão" }] });
    expect(screen.getByText(copy.card.buttons)).toBeInTheDocument();
  });

  it("builds a carousel and adds cards up to the limit", () => {
    render(<Harness initial={{ text: "Oi" }} />);
    fireEvent.click(screen.getByRole("button", { name: pt.rcs.kinds.carousel }));
    expect(latest.content.cards).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: copy.carousel.add }));
    expect(latest.content.cards).toHaveLength(3);
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("adds a message button and changes its action", () => {
    render(<Harness initial={{ text: "Oi" }} />);
    const buttons = screen.getByRole("region", { name: copy.suggestions.title });
    fireEvent.click(within(buttons).getByRole("button", { name: copy.button.add }));
    expect(latest.content.suggestions).toEqual([{ kind: "reply", label: copy.button.defaultLabel }]);
  });
});

describe("FallbackFields", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    smsActions.checkSmsTextAction.mockReset();
    smsActions.checkSmsTextAction.mockResolvedValue({
      data: {
        measurement: { encoding: "gsm7", units: 8, segments: 1, per_segment: 160, remaining: 152 },
        composed_text: "Loja: Oi",
        variable_slots: 0,
        issues: [],
        price: { charge_kind: "sms_segment", unit_micros: 1, quantity: 1, total_micros: 1 },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("puts the WhatsApp template, the SMS route and the compact SMS composer in order", async () => {
    render(
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <FallbackFields
          smsText="Oi"
          onSmsTextChange={() => {}}
          bindings={[]}
          onBindingsChange={() => {}}
          whatsappTemplateSlot={<p>Modelo escolhido</p>}
          smsRouteSlot={<p>Número compartilhado</p>}
          smsRouteId="rt-1"
          smsBrandPrefix="Loja"
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText("Modelo escolhido")).toBeInTheDocument();
    expect(screen.getByText("Número compartilhado")).toBeInTheDocument();
    expect(screen.getByText("Loja:")).toBeInTheDocument();
    await settle();
    expect(smsActions.checkSmsTextAction.mock.calls[0][0]).toEqual({ text: "Oi", route_id: "rt-1" });
    expect(screen.getByText(/^Padrão · 1 parte · 152 livres/)).toBeInTheDocument();
    expect(screen.queryByText(pt.sms.preview.label)).not.toBeInTheDocument();
  });
});
