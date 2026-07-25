/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  parseInteractiveConfig,
  WhatsAppMessagePreview,
  centerWithin,
} from "./whatsapp-message-preview";

describe("parseInteractiveConfig", () => {
  it("parses reply buttons, keeping id/title and skipping empty ids", () => {
    const parsed = parseInteractiveConfig({
      interactive_type: "buttons",
      body: "Escolha:",
      buttons: JSON.stringify([
        { Type: "reply", ID: "sim", Title: "Sim" },
        { Type: "reply", ID: "nao", Title: "Não" },
        { Type: "reply", ID: "", Title: "Sem id" },
      ]),
    });
    expect(parsed.interactiveType).toBe("buttons");
    expect(parsed.options.map((o) => o.id)).toEqual(["sim", "nao"]);
    expect(parsed.options[0]).toMatchObject({ id: "sim", title: "Sim", kind: "button" });
  });

  it("marks copy_code buttons", () => {
    const parsed = parseInteractiveConfig({
      buttons: JSON.stringify([
        { Type: "copy_code", ID: "cc", CopyCode: "PROMO10" },
      ]),
    });
    expect(parsed.options[0]).toMatchObject({
      id: "cc",
      kind: "copy_code",
      copyCode: "PROMO10",
    });
  });

  it("parses list rows across sections and skips empty ids", () => {
    const parsed = parseInteractiveConfig({
      interactive_type: "list",
      body: "Menu",
      list_button: "Ver",
      sections: JSON.stringify([
        {
          title: "A",
          rows: [
            { id: "r1", title: "Row 1", description: "d1" },
            { id: "", title: "skip" },
          ],
        },
        { title: "B", rows: [{ id: "r2", title: "Row 2" }] },
      ]),
    });
    expect(parsed.interactiveType).toBe("list");
    expect(parsed.options.map((o) => o.id)).toEqual(["r1", "r2"]);
    expect(parsed.options[0]).toMatchObject({
      id: "r1",
      description: "d1",
      kind: "list",
    });
  });

  it("never throws on malformed JSON", () => {
    const parsed = parseInteractiveConfig({ buttons: "{not json" });
    expect(parsed.options).toEqual([]);
  });

  it("defaults to buttons and normalizes header type", () => {
    expect(parseInteractiveConfig({}).interactiveType).toBe("buttons");
    expect(
      parseInteractiveConfig({ header_type: "IMAGE" }).headerType,
    ).toBe("image");
    expect(
      parseInteractiveConfig({ header_type: "carousel" }).headerType,
    ).toBe("");
  });
});

describe("WhatsAppMessagePreview", () => {
  function optionIds(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll("[data-option-id]")).map(
      (el) => el.getAttribute("data-option-id") ?? "",
    );
  }

  it("renders body, footer and text header", () => {
    const parsed = parseInteractiveConfig({
      header_type: "text",
      header_text: "Olá!",
      body: "Como posso ajudar?",
      footer: "Equipe Vozko",
      buttons: JSON.stringify([{ Type: "reply", ID: "a", Title: "A" }]),
    });
    render(<WhatsAppMessagePreview parsed={parsed} />);
    expect(screen.getByText("Olá!")).toBeInTheDocument();
    expect(screen.getByText("Como posso ajudar?")).toBeInTheDocument();
    expect(screen.getByText("Equipe Vozko")).toBeInTheDocument();
  });

  it("renders one row per reply button, keyed by option id", () => {
    const parsed = parseInteractiveConfig({
      body: "x",
      buttons: JSON.stringify([
        { Type: "reply", ID: "sim", Title: "Sim" },
        { Type: "reply", ID: "nao", Title: "Não" },
      ]),
    });
    const { container } = render(<WhatsAppMessagePreview parsed={parsed} />);
    expect(optionIds(container)).toEqual(["sim", "nao"]);
    expect(screen.getByText("Sim")).toBeInTheDocument();
    expect(screen.getByText("Não")).toBeInTheDocument();
  });

  it("shows the copy code on a copy_code button", () => {
    const parsed = parseInteractiveConfig({
      body: "x",
      buttons: JSON.stringify([
        { Type: "copy_code", ID: "cc", CopyCode: "PROMO10" },
      ]),
    });
    render(<WhatsAppMessagePreview parsed={parsed} />);
    expect(screen.getByText("PROMO10")).toBeInTheDocument();
  });

  it("renders the list menu label and one row per option with descriptions", () => {
    const parsed = parseInteractiveConfig({
      interactive_type: "list",
      body: "Menu",
      list_button: "Abrir menu",
      sections: JSON.stringify([
        {
          title: "S",
          rows: [
            { id: "r1", title: "Vendas", description: "Falar com vendas" },
            { id: "r2", title: "Suporte" },
          ],
        },
      ]),
    });
    const { container } = render(<WhatsAppMessagePreview parsed={parsed} />);
    expect(screen.getByText("Abrir menu")).toBeInTheDocument();
    expect(optionIds(container)).toEqual(["r1", "r2"]);
    expect(screen.getByText("Vendas")).toBeInTheDocument();
    expect(screen.getByText("Falar com vendas")).toBeInTheDocument();
  });

  it("shows empty states for missing body and options", () => {
    const parsed = parseInteractiveConfig({ body: "", buttons: "[]" });
    render(<WhatsAppMessagePreview parsed={parsed} />);
    expect(screen.getByText("Sem mensagem")).toBeInTheDocument();
    expect(screen.getByText("Nenhum botão")).toBeInTheDocument();
  });

  it("calls rowRef for each option row so handles can be aligned", () => {
    const parsed = parseInteractiveConfig({
      body: "x",
      buttons: JSON.stringify([
        { Type: "reply", ID: "a", Title: "A" },
        { Type: "reply", ID: "b", Title: "B" },
      ]),
    });
    const rowRef = vi.fn();
    render(<WhatsAppMessagePreview parsed={parsed} rowRef={rowRef} />);
    const calls = rowRef.mock.calls as Array<[HTMLDivElement | null, string]>;
    const seen = calls.filter(([el]) => el).map(([, id]) => id);
    expect(new Set(seen)).toEqual(new Set(["a", "b"]));
  });
});

describe("centerWithin", () => {
  // Build a fake offsetParent chain (jsdom has no layout) to verify the pure
  // offset-summing math used to position handles at any zoom.
  function fakeEl(
    offsetTop: number,
    offsetHeight: number,
    offsetParent: HTMLElement | null,
  ): HTMLElement {
    return { offsetTop, offsetHeight, offsetParent } as unknown as HTMLElement;
  }

  it("sums offsetTop up to the root and adds half the row height", () => {
    const root = fakeEl(0, 0, null);
    const mid = fakeEl(100, 0, root);
    const row = fakeEl(20, 24, mid);
    expect(centerWithin(row, root)).toBe(20 + 100 + 12);
  });

  it("stops at a null offsetParent when root is not an ancestor", () => {
    const row = fakeEl(20, 24, null);
    const otherRoot = fakeEl(0, 0, null);
    expect(centerWithin(row, otherRoot)).toBe(20 + 12);
  });
});
