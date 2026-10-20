
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { HandleDefinition } from "@/lib/workflows/types";

import {
  parseInteractiveConfig,
  WhatsAppMessagePreview,
  centerWithin,
} from "./whatsapp-message-preview";

const CATCH_ALLS: HandleDefinition[] = [
  { id: "no_match", label: "Sem correspondência", optional: true },
  { id: "no_reply", label: "Não respondeu", optional: true },
];

describe("parseInteractiveConfig", () => {
  it("takes the options from the server handles, never from the stored options", () => {
    const parsed = parseInteractiveConfig(
      {
        interactive_type: "buttons",
        body: "Escolha:",
        buttons: JSON.stringify([{ Type: "reply", ID: "outro", Title: "Do config" }]),
      },
      [{ id: "sim", label: "Sim" }, { id: "nao", label: "Não" }, ...CATCH_ALLS],
    );
    expect(parsed.interactiveType).toBe("buttons");
    expect(parsed.options).toEqual([
      { id: "sim", title: "Sim" },
      { id: "nao", title: "Não" },
    ]);
  });

  it("has no options without the server handles, even with a capitalized list in the config", () => {
    const parsed = parseInteractiveConfig({
      interactive_type: "list",
      sections: '[{"Title":"A","Rows":[{"ID":"1","Title":"Um"}]}]',
    });
    expect(parsed.options).toEqual([]);
  });

  it("reads the display fields as stored and normalizes the header type", () => {
    expect(parseInteractiveConfig({}).interactiveType).toBe("buttons");
    expect(parseInteractiveConfig({ interactive_type: "list" }).interactiveType).toBe("list");
    expect(parseInteractiveConfig({ header_type: "IMAGE" }).headerType).toBe("image");
    expect(parseInteractiveConfig({ header_type: "carousel" }).headerType).toBe("");
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
    });
    render(<WhatsAppMessagePreview parsed={parsed} />);
    expect(screen.getByText("Olá!")).toBeInTheDocument();
    expect(screen.getByText("Como posso ajudar?")).toBeInTheDocument();
    expect(screen.getByText("Equipe Vozko")).toBeInTheDocument();
  });

  it("renders one row per option handle, keyed by its id", () => {
    const parsed = parseInteractiveConfig({ body: "x" }, [{ id: "sim", label: "Sim" }, { id: "nao", label: "Não" }, ...CATCH_ALLS]);
    const { container } = render(<WhatsAppMessagePreview parsed={parsed} />);
    expect(optionIds(container)).toEqual(["sim", "nao"]);
    expect(screen.getByText("Sim")).toBeInTheDocument();
    expect(screen.getByText("Não")).toBeInTheDocument();
  });

  it("renders the list menu label and one row per option handle", () => {
    const parsed = parseInteractiveConfig(
      { interactive_type: "list", body: "Menu", list_button: "Abrir menu" },
      [{ id: "r1", label: "Vendas" }, { id: "r2", label: "Suporte" }, ...CATCH_ALLS],
    );
    const { container } = render(<WhatsAppMessagePreview parsed={parsed} />);
    expect(screen.getByText("Abrir menu")).toBeInTheDocument();
    expect(optionIds(container)).toEqual(["r1", "r2"]);
    expect(screen.getByText("Vendas")).toBeInTheDocument();
  });

  it("shows empty states for missing body and options", () => {
    const parsed = parseInteractiveConfig({ body: "", buttons: "[]" }, CATCH_ALLS);
    render(<WhatsAppMessagePreview parsed={parsed} />);
    expect(screen.getByText("Sem mensagem")).toBeInTheDocument();
    expect(screen.getByText("Nenhum botão")).toBeInTheDocument();
  });

  it("calls rowRef for each option row so handles can be aligned", () => {
    const parsed = parseInteractiveConfig({ body: "x" }, [{ id: "a", label: "A" }, { id: "b", label: "B" }]);
    const rowRef = vi.fn();
    render(<WhatsAppMessagePreview parsed={parsed} rowRef={rowRef} />);
    const calls = rowRef.mock.calls as Array<[HTMLDivElement | null, string]>;
    const seen = calls.filter(([el]) => el).map(([, id]) => id);
    expect(new Set(seen)).toEqual(new Set(["a", "b"]));
  });
});

describe("centerWithin", () => {
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
