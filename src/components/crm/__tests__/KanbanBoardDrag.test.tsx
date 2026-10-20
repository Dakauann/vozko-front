import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { fakeBoardLayout, flushTimers, keyboardMove, pressKey } from "@/test/board-layout";
import KanbanBoard from "../KanbanBoard";

interface Deal {
  id: string;
  title: string;
  column: string;
}

const COLUMNS = [
  { id: "a", name: "Novo", count: 1 },
  { id: "b", name: "Proposta", count: 1 },
  { id: "c", name: "Fechamento", count: 0 },
];

const DEALS: Deal[] = [
  { id: "d1", title: "Contrato anual", column: "a" },
  { id: "d2", title: "Renovação", column: "b" },
];

function renderBoard(props: Partial<React.ComponentProps<typeof KanbanBoard<Deal>>> = {}) {
  const onCardMove = vi.fn();
  const onCardOpen = vi.fn();
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <KanbanBoard<Deal>
        board="opportunities"
        columns={COLUMNS}
        itemsFor={(columnId) => DEALS.filter((d) => d.column === columnId)}
        getItemId={(d) => d.id}
        cardLabel={(d) => d.title}
        renderCard={(d) => <span>{d.title}</span>}
        onCardOpen={onCardOpen}
        onCardMove={onCardMove}
        {...props}
      />
    </NextIntlClientProvider>,
  );
  return { onCardMove, onCardOpen };
}

function cardButton(title: string): HTMLElement {
  return screen.getByText(title).closest("[role='button']") as HTMLElement;
}

describe("kanban board drag", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      fakeBoardLayout(COLUMNS.map((c) => c.id)),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("makes every card a focusable button that opens on Enter", () => {
    const { onCardOpen } = renderBoard();
    const card = cardButton("Contrato anual");

    expect(card).toHaveAttribute("tabindex", "0");
    card.focus();
    fireEvent.keyDown(card, { key: "Enter", code: "Enter" });

    expect(onCardOpen).toHaveBeenCalledWith(DEALS[0]);
  });

  it("moves a card to the next column with Space, an arrow and Space", async () => {
    const { onCardMove } = renderBoard();

    await keyboardMove(cardButton("Contrato anual"), "ArrowRight");

    expect(onCardMove).toHaveBeenCalledTimes(1);
    expect(onCardMove).toHaveBeenCalledWith(DEALS[0], "a", "b");
  });

  it("walks several columns with repeated arrows", async () => {
    const { onCardMove } = renderBoard();

    await keyboardMove(cardButton("Contrato anual"), "ArrowRight", "ArrowRight");

    expect(onCardMove).toHaveBeenCalledWith(DEALS[0], "a", "c");
  });

  it("moves a card dragged with the mouse onto another column", async () => {
    const { onCardMove, onCardOpen } = renderBoard();
    const card = cardButton("Contrato anual");

    fireEvent.mouseDown(card, { button: 0, clientX: 40, clientY: 90 });
    fireEvent.mouseMove(document, { clientX: 48, clientY: 90 });
    await flushTimers();
    fireEvent.mouseMove(document, { clientX: 400, clientY: 120 });
    await flushTimers();
    fireEvent.mouseUp(document, { clientX: 400, clientY: 120 });
    await flushTimers();
    fireEvent.click(card);

    expect(onCardMove).toHaveBeenCalledWith(DEALS[0], "a", "b");
    expect(onCardOpen).not.toHaveBeenCalled();
  });

  it("treats a press that moves less than five pixels as a click, not a drag", async () => {
    const { onCardMove } = renderBoard();
    const card = cardButton("Contrato anual");

    fireEvent.mouseDown(card, { button: 0, clientX: 40, clientY: 90 });
    fireEvent.mouseMove(document, { clientX: 43, clientY: 90 });
    await flushTimers();
    fireEvent.mouseUp(document, { clientX: 43, clientY: 90 });
    await flushTimers();

    expect(onCardMove).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("levantado");
  });

  it("announces the lift and the drop in the viewer's language", async () => {
    renderBoard();
    const card = cardButton("Contrato anual");
    card.focus();

    await pressKey(card, "Space", " ");
    expect(document.body.textContent).toContain("Contrato anual levantado na coluna Novo.");
    await pressKey(card, "ArrowRight");
    await pressKey(card, "Space", " ");

    expect(document.body.textContent).toContain("Contrato anual movido para a coluna Proposta.");
  });

  it("cancels with Esc and sends nothing", async () => {
    const { onCardMove } = renderBoard();
    const card = cardButton("Contrato anual");
    card.focus();

    await pressKey(card, "Space", " ");
    await pressKey(card, "ArrowRight");
    await pressKey(card, "Escape");

    expect(onCardMove).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Movimento cancelado.");
  });

  it("does not offer a drag where the viewer cannot move cards, but still opens them", () => {
    const { onCardOpen } = renderBoard({ onCardMove: undefined });
    const card = cardButton("Contrato anual");

    expect(card).not.toHaveAttribute("aria-roledescription");
    fireEvent.keyDown(card, { key: " ", code: "Space" });

    expect(onCardOpen).toHaveBeenCalledWith(DEALS[0]);
  });

  it("collapses a column to a strip with its name and count", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Recolher a coluna Novo" }));

    const strip = document.querySelector("[data-column-id='a']") as HTMLElement;
    expect(strip).toHaveAttribute("data-collapsed", "true");
    expect(within(strip).getByText("Novo")).toBeInTheDocument();
    expect(within(strip).getByText("1")).toBeInTheDocument();
    expect(screen.queryByText("Contrato anual")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expandir a coluna Novo" }));

    expect(screen.getByText("Contrato anual")).toBeInTheDocument();
  });
});
