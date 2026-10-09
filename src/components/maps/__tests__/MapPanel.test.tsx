import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";

import { MapPanel } from "../MapPanel";
import { renderInPortuguese } from "./intl";

describe("MapPanel", () => {
  it("is a labelled complementary region", () => {
    renderInPortuguese(
      <MapPanel title="Resumo do mapa">
        <p>Conteúdo</p>
      </MapPanel>,
    );
    expect(screen.getByRole("complementary", { name: "Resumo do mapa" })).toBeInTheDocument();
  });

  it("is a right panel from 640 px and a bottom sheet of the map below, never pinned to the window", () => {
    renderInPortuguese(
      <MapPanel title="Resumo do mapa">
        <p>Conteúdo</p>
      </MapPanel>,
    );
    const panel = screen.getByRole("complementary");
    const classes = panel.className.split(/\s+/);
    expect(classes).not.toContain("fixed");
    expect(classes.some((name) => name.endsWith(":fixed"))).toBe(false);
    expect(classes).toContain("absolute");
    expect(classes).toContain("inset-x-0");
    expect(classes).toContain("bottom-0");
    expect(panel.className).toContain("sm:right-3");
    expect(panel.className).toContain("sm:w-[300px]");
    expect(panel.className).toContain("sm:border-border-strong");
    expect(panel.className).toContain("sm:shadow-lg");
  });

  it("keeps its title for assistive technology only on the floating panel, like the artifact", () => {
    renderInPortuguese(
      <MapPanel title="Resumo do mapa">
        <p>Conteúdo</p>
      </MapPanel>,
    );
    expect(screen.getByRole("heading", { name: "Resumo do mapa" }).parentElement?.className).toContain("sm:sr-only");
  });

  it("collapses the sheet body on phones and expands it from the handle", () => {
    renderInPortuguese(
      <MapPanel title="Resumo do mapa">
        <p>Conteúdo</p>
      </MapPanel>,
    );
    const toggle = screen.getByRole("button", { name: "Abrir painel do mapa" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const body = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
    expect(body?.className).toContain("max-sm:hidden");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Recolher painel do mapa" })).toHaveAttribute("aria-expanded", "true");
    expect(body?.className).not.toContain("max-sm:hidden");
  });
});
