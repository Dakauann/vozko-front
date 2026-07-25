/**
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  MessageBubble,
  ActionRowList,
  type ActionRowItem,
} from "./message-node-primitives";

describe("MessageBubble", () => {
  it("renders body, header text and footer", () => {
    render(
      <MessageBubble headerText="Cabeçalho" body="Corpo da mensagem" footer="Rodapé" />,
    );
    expect(screen.getByText("Cabeçalho")).toBeInTheDocument();
    expect(screen.getByText("Corpo da mensagem")).toBeInTheDocument();
    expect(screen.getByText("Rodapé")).toBeInTheDocument();
  });

  it("shows the empty-body label when there is no body", () => {
    render(<MessageBubble emptyBodyLabel="Sem conteúdo" />);
    expect(screen.getByText("Sem conteúdo")).toBeInTheDocument();
  });

  it("renders an image header when media kind is image", () => {
    const { container } = render(
      <MessageBubble
        media={{ url: "https://example.com/a.jpg", kind: "image" }}
        body="x"
      />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("https://example.com/a.jpg");
  });

  it("renders a video placeholder (no img) for a video header", () => {
    const { container } = render(
      <MessageBubble media={{ url: "", kind: "video" }} body="x" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("ActionRowList", () => {
  const rows: ActionRowItem[] = [
    { id: "a", primary: "Opção A", secondary: "desc A" },
    { id: "b", primary: "Opção B" },
  ];

  function optionIds(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll("[data-option-id]")).map(
      (el) => el.getAttribute("data-option-id") ?? "",
    );
  }

  it("renders one row per item, tagged with data-option-id (buttons)", () => {
    const { container } = render(
      <ActionRowList rows={rows} variant="buttons" />,
    );
    expect(optionIds(container)).toEqual(["a", "b"]);
    expect(screen.getByText("Opção A")).toBeInTheDocument();
    expect(screen.getByText("Opção B")).toBeInTheDocument();
  });

  it("renders secondary text in list variant", () => {
    render(<ActionRowList rows={rows} variant="list" />);
    expect(screen.getByText("desc A")).toBeInTheDocument();
  });

  it("calls rowRef for each row so a handle can be aligned", () => {
    const rowRef = vi.fn();
    render(<ActionRowList rows={rows} variant="buttons" rowRef={rowRef} />);
    const calls = rowRef.mock.calls as Array<[HTMLDivElement | null, string]>;
    const seen = calls.filter(([el]) => el).map(([, id]) => id);
    expect(new Set(seen)).toEqual(new Set(["a", "b"]));
  });
});
