import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

import { renderInPortuguese } from "@/components/maps/__tests__/intl";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";
import { NO_COLOUR } from "@/lib/leads/map-view";

import { MapLayerBar } from "../MapLayerBar";

const field = (key: string, label: string): CustomFieldDefinition => ({
  id: key,
  workspaceId: "ws1",
  objectType: "lead",
  key,
  label,
  type: "select",
  options: ["A"],
  required: false,
  sensitive: false,
  position: 1,
  readable: true,
  createdAt: "",
  updatedAt: "",
});

const fields = [field("interesse", "Interesse"), field("etapa", "Etapa")];

describe("MapLayerBar", () => {
  it("offers Calor, Pontos and Por bairro, pressing the current one", () => {
    const onModeChange = vi.fn();
    renderInPortuguese(<MapLayerBar mode="heat" onModeChange={onModeChange} fields={fields} colourKey="interesse" onColourChange={vi.fn()} />);
    const group = screen.getByRole("group", { name: "Camada do mapa" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Calor", "Pontos", "Por bairro"]);
    expect(within(group).getByRole("button", { name: "Calor" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(group).getByRole("button", { name: "Pontos" }));
    expect(onModeChange).toHaveBeenCalledWith("points");
  });

  it("shows the field that colours the map and lets the person pick another field or none", () => {
    const onColourChange = vi.fn();
    renderInPortuguese(<MapLayerBar mode="points" onModeChange={vi.fn()} fields={fields} colourKey="interesse" onColourChange={onColourChange} />);
    const trigger = screen.getByRole("button", { name: "Colorir por: Interesse" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    const options = screen.getAllByRole("menuitemradio");
    expect(options.map((option) => option.textContent)).toEqual(["Nenhum", "Interesse", "Etapa"]);
    expect(screen.getByRole("menuitemradio", { name: "Interesse" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Etapa" }));
    expect(onColourChange).toHaveBeenCalledWith("etapa");
  });

  it("says Nenhum when no field colours the map, and offers none when there is no field", () => {
    const onColourChange = vi.fn();
    const { rerender } = renderInPortuguese(<MapLayerBar mode="points" onModeChange={vi.fn()} fields={fields} colourKey={undefined} onColourChange={onColourChange} />);
    expect(screen.getByRole("button", { name: "Colorir por: Nenhum" })).toBeInTheDocument();
    rerender(<MapLayerBar mode="points" onModeChange={vi.fn()} fields={[]} colourKey={undefined} onColourChange={onColourChange} />);
    expect(screen.queryByRole("button", { name: /Colorir por/ })).not.toBeInTheDocument();
  });

  it("passes the none choice up as the none value", () => {
    const onColourChange = vi.fn();
    renderInPortuguese(<MapLayerBar mode="points" onModeChange={vi.fn()} fields={fields} colourKey="etapa" onColourChange={onColourChange} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Colorir por: Etapa" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Nenhum" }));
    expect(onColourChange).toHaveBeenCalledWith(NO_COLOUR);
  });

  it("keeps the extra tools the page puts at its end", () => {
    renderInPortuguese(
      <MapLayerBar mode="points" onModeChange={vi.fn()} fields={[]} colourKey={undefined} onColourChange={vi.fn()}>
        <button type="button">Áreas 2</button>
      </MapLayerBar>,
    );
    expect(screen.getByRole("button", { name: "Áreas 2" })).toBeInTheDocument();
  });
});
