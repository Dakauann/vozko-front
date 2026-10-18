import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import DragDropBuilder, { paletteForCategory, type DraggableComponent } from "../DragDropBuilder";

const builder = ptMessages.whatsappTemplates.builder;
const exit = ptMessages.templateExit;
const onChange = vi.fn();
const onPick = vi.fn();

function renderBuilder(components: DraggableComponent[], used = false) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <DragDropBuilder
        components={components}
        onChange={onChange}
        palette={paletteForCategory("MARKETING")}
        pickers={{ LEAD_EXIT: { onPick, used, hint: used ? exit.piece.used : undefined } }}
      />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  onChange.mockReset();
  onPick.mockReset();
});

describe("DragDropBuilder lead exit piece", () => {
  it("opens the user's choice instead of adding a component", () => {
    renderBuilder([]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(builder.palette.lead_exit.label) }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adds the other pieces with the same click", () => {
    renderBuilder([]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(builder.palette.footer.label) }));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ type: "FOOTER" })]);
  });

  it("is used only once", () => {
    renderBuilder([], true);
    const piece = screen.getByRole("button", { name: new RegExp(builder.palette.lead_exit.label) });
    expect(piece).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(exit.piece.used)).toBeInTheDocument();
    fireEvent.click(piece);
    expect(onPick).not.toHaveBeenCalled();
  });

  it("is not offered on authentication templates", () => {
    expect(paletteForCategory("AUTHENTICATION").map((item) => item.type)).not.toContain("LEAD_EXIT");
  });
});

describe("DragDropBuilder composer", () => {
  const body: DraggableComponent = { id: "body", type: "BODY", data: { text: "Olá, temos novidades." } };
  const onSelect = vi.fn();

  function renderComposer(selectedId: string | null) {
    onSelect.mockReset();
    return render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <DragDropBuilder
          components={[body]}
          onChange={onChange}
          onComponentSelect={onSelect}
          selectedComponentId={selectedId}
          palette={paletteForCategory("MARKETING")}
          pickers={{ LEAD_EXIT: { onPick, used: false } }}
          renderEditor={(component) => <p>editando {component.id}</p>}
        />
      </NextIntlClientProvider>,
    );
  }

  it("opens the editor inside the selected piece instead of a separate panel", () => {
    renderComposer("body");
    expect(screen.getByText("editando body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ptMessages.whatsappTemplates.componentType.BODY, expanded: true })).toBeInTheDocument();
  });

  it("shows a summary while closed and collapses an open piece on a second click", () => {
    renderComposer(null);
    expect(screen.queryByText("editando body")).not.toBeInTheDocument();
    expect(screen.getByText("Olá, temos novidades.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ptMessages.whatsappTemplates.componentType.BODY, expanded: false }));
    expect(onSelect).toHaveBeenCalledWith(body);
  });

  it("collapses the open piece when its header is clicked again", () => {
    renderComposer("body");
    fireEvent.click(screen.getByRole("button", { name: ptMessages.whatsappTemplates.componentType.BODY, expanded: true }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("says why a single piece can no longer be added", () => {
    renderComposer(null);
    const piece = screen.getByText(builder.inMessage).closest("button") as HTMLElement;
    expect(piece).toHaveAttribute("aria-disabled", "true");
    expect(within(piece).getByText(builder.palette.body.label)).toBeInTheDocument();
  });
});

describe("DragDropBuilder canvas cards", () => {
  it("shows where each button leads and the footer text the lead sees", () => {
    renderBuilder([
      { id: "f", type: "FOOTER", data: { text: "Digite /sair para sair" } },
      {
        id: "b",
        type: "BUTTONS",
        data: {
          buttons: [
            { id: "1", type: "QUICK_REPLY", text: "SAIR", action: { kind: "opt_out", params: {}, confirmation: "" } },
            { id: "2", type: "QUICK_REPLY", text: "Ver horários" },
          ],
        },
      },
    ]);
    expect(screen.getByText(exit.campaign.destination.replace("{text}", "SAIR").replace("{action}", exit.kinds.opt_out))).toBeInTheDocument();
    expect(screen.getByText("Ver horários")).toBeInTheDocument();
    expect(screen.getByText("Digite /sair para sair")).toBeInTheDocument();
  });
});
